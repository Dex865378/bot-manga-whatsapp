/**
 * 📚 MangaDex Service
 * Integración con la API pública de MangaDex para obtener capítulos al vuelo.
 * No requiere API key. Rate limit ~5 req/s, respetado con delays internos.
 *
 * Flujo principal:
 *   buscarMangaId(titulo) → chapterId[] → páginas → PDF en Buffer → WhatsApp
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');

// ─── Constantes ───────────────────────────────────────────────────────────────
const MDEX_BASE     = 'https://api.mangadex.org';
const MDEX_UPLOADS  = 'https://uploads.mangadex.org';
const IDS_CACHE_FILE = path.join(__dirname, '..', 'data', 'mangadex_ids.json');

/** Prioridad: español primero, inglés como fallback */
const LANGS_ES = ['es', 'es-la'];
const LANGS_EN = ['en'];

/** Máximo de páginas para armar PDF. Si supera esto → imágenes sueltas */
const MAX_PAGES_PDF = 300;

/** Máx concurrent downloads por capítulo */
const MAX_CONCURRENT_DL = 5;

/** Delay entre llamadas a la API de MangaDex (ms) */
const API_DELAY_MS = 250;

// ─── Caché en memoria (TTL) ───────────────────────────────────────────────────
const _idCache  = new Map();  // titulo → { id, ts }
const _capCache = new Map();  // mangaId → { caps, ts }
const TTL_IDS  = 24 * 60 * 60 * 1000;  // 24h
const TTL_CAPS =  6 * 60 * 60 * 1000;  //  6h

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Delay no bloqueante */
const delay = ms => new Promise(r => setTimeout(r, ms));

/** Carga el JSON de IDs persistido en disco */
function cargarIdsPersistedos() {
    try {
        if (fs.existsSync(IDS_CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(IDS_CACHE_FILE, 'utf-8'));
        }
    } catch (_) {}
    return {};
}

/** Persiste el mapeo código→ID en disco */
function persistirId(codigo, mangaId) {
    try {
        const data = cargarIdsPersistedos();
        data[codigo] = mangaId;
        fs.writeFileSync(IDS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[MangaDex] Error persistiendo ID:', e.message);
    }
}

/** Hace GET con retry + backoff. Reintenta hasta 3 veces en errores transitorios. */
async function mdexGet(endpoint, params = {}) {
    const url = `${MDEX_BASE}${endpoint}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await delay(API_DELAY_MS);
        try {
            const res = await axios.get(url, {
                params,
                timeout: 20000,
                headers: { 'User-Agent': 'DikybotWA/1.0 (WhatsApp Bot)' }
            });
            return res.data;
        } catch (e) {
            const isTransient = !e.response || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT'
                || e.code === 'ECONNABORTED' || e.message?.includes('socket hang up');
            if (!isTransient || attempt === maxRetries) throw e;
            const wait = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            console.warn(`[MangaDex] Intento ${attempt} falló (${e.code || e.message}), reintentando en ${wait}ms...`);
            await delay(wait);
        }
    }
}

// ─── Funciones principales ────────────────────────────────────────────────────

/**
 * Busca el ID de MangaDex para un manga dado su título.
 * Usa caché en disco (persistida) + caché en memoria.
 * @param {string} titulo  Título del manga
 * @param {string} codigo  Código interno (ej: "019"), para persistir el mapeo
 * @returns {string|null}  UUID de MangaDex o null si no se encontró
 */
async function buscarMangaId(titulo, codigo) {
    // 1. Memoria
    const cached = _idCache.get(codigo);
    if (cached && Date.now() - cached.ts < TTL_IDS) return cached.id;

    // 2. Disco
    const persistido = cargarIdsPersistedos();
    if (persistido[codigo]) {
        _idCache.set(codigo, { id: persistido[codigo], ts: Date.now() });
        return persistido[codigo];
    }

    // 3. Buscar en MangaDex
    try {
        const data = await mdexGet('/manga', {
            title: titulo,
            limit: 5,
            'order[relevance]': 'desc'
        });

        if (!data.data || data.data.length === 0) return null;

        // Preferir coincidencia exacta de título
        let match = data.data.find(m => {
            const attrs = m.attributes;
            const titles = [
                attrs.title?.en,
                attrs.title?.es,
                attrs.title?.['es-la'],
                ...Object.values(attrs.altTitles?.reduce((acc, t) => ({ ...acc, ...t }), {}) || {})
            ].filter(Boolean).map(t => t.toLowerCase());
            return titles.includes(titulo.toLowerCase());
        }) || data.data[0];

        const id = match.id;
        _idCache.set(codigo, { id, ts: Date.now() });
        persistirId(codigo, id);
        console.log(`[MangaDex] ID encontrado para "${titulo}": ${id}`);
        return id;
    } catch (e) {
        console.error(`[MangaDex] Error buscando "${titulo}":`, e.message);
        return null;
    }
}

/**
 * Obtiene la lista de capítulos de un manga, ordenados numéricamente.
 * Incluye número, idioma disponible y chapterId.
 * @param {string} mangaId  UUID de MangaDex
 * @returns {Array<{num: string, lang: string, id: string, titulo: string}>}
 */
async function obtenerCapitulos(mangaId) {
    const cached = _capCache.get(mangaId);
    if (cached && Date.now() - cached.ts < TTL_CAPS) return cached.result;

    try {
        // Paso 1: buscar en español
        let allChapters = await _fetchFeed(mangaId, LANGS_ES);
        let idioma = 'es'; // flag para avisar al usuario

        // Paso 2: si no hay español → fallback a inglés
        if (allChapters.length === 0) {
            console.log(`[MangaDex] No hay caps en ES para ${mangaId}, buscando en inglés...`);
            allChapters = await _fetchFeed(mangaId, LANGS_EN);
            idioma = 'en';
        }

        // Agrupar por número de capítulo (deduplicar)
        const capMap = new Map();
        for (const ch of allChapters) {
            const num = ch.attributes.chapter;
            if (!num) continue;
            const lang = ch.attributes.translatedLanguage;
            const existing = capMap.get(num);
            if (!existing) {
                capMap.set(num, { num, lang, id: ch.id, titulo: ch.attributes.title || '' });
            } else if (idioma === 'es' && lang === 'es' && existing.lang === 'es-la') {
                // Preferir 'es' sobre 'es-la' si hay ambos
                capMap.set(num, { num, lang, id: ch.id, titulo: ch.attributes.title || '' });
            }
        }

        // Ordenar numéricamente
        const caps = [...capMap.values()].sort((a, b) =>
            parseFloat(a.num) - parseFloat(b.num)
        );

        const result = { caps, idioma };
        _capCache.set(mangaId, { result, ts: Date.now() });
        return result;
    } catch (e) {
        console.error('[MangaDex] Error obteniendo capítulos:', e.message);
        return { caps: [], idioma: 'es' };
    }
}

/** Helper: pagina el feed de capítulos en ES/ES-LA */
async function _fetchFeed(mangaId, langs) {
    const allChapters = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const data = await mdexGet('/manga/' + mangaId + '/feed', {
            limit,
            offset,
            'translatedLanguage[]': langs,
            'order[chapter]': 'asc',
            'order[volume]': 'asc',
            includeEmptyPages: 0
        });
        if (!data.data || data.data.length === 0) break;
        allChapters.push(...data.data);
        if (data.data.length < limit) break;
        offset += limit;
        if (offset > 5000) break; // safety cap
    }

    return allChapters;
}


/**
 * Devuelve las URLs de las páginas de un capítulo (calidad data-saver).
 * @param {string} chapterId  UUID del capítulo
 * @returns {{ urls: string[], server: string }}
 */
async function obtenerPaginas(chapterId) {
    const data = await mdexGet('/at-home/server/' + chapterId);
    const { baseUrl, chapter } = data;
    const hash = chapter.hash;
    const pages = chapter.dataSaver; // Calidad comprimida (data-saver)

    const urls = pages.map(p => `${baseUrl}/data-saver/${hash}/${p}`);
    return { urls, hash };
}

/**
 * Descarga una lista de URLs de imágenes con concurrencia limitada.
 * @param {string[]} urls
 * @returns {Buffer[]}
 */
async function descargarPaginasABuffers(urls) {
    const results = new Array(urls.length).fill(null);
    const queue = [...urls.entries()]; // [[index, url], ...]

    const worker = async () => {
        while (queue.length > 0) {
            const [idx, url] = queue.shift();
            try {
                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: { 'User-Agent': 'DikybotWA/1.0' },
                    maxRedirects: 5
                });
                results[idx] = Buffer.from(res.data);
            } catch (e) {
                console.warn(`[MangaDex] Error descargando página ${idx + 1}:`, e.message);
                results[idx] = null; // página fallida se omite del PDF
            }
        }
    };

    // Correr MAX_CONCURRENT_DL workers en paralelo
    const workers = Array.from({ length: MAX_CONCURRENT_DL }, () => worker());
    await Promise.all(workers);

    return results.filter(Boolean); // omitir las que fallaron
}

/**
 * Ensambla un PDF en memoria a partir de buffers de imagen.
 * Usa pdfkit en modo stream → acumula en un Buffer sin escribir a disco.
 * @param {Buffer[]} imageBuffers  Buffers de las páginas (JPEG/PNG)
 * @param {string}   titulo        Título del manga
 * @param {string}   numCap        Número del capítulo
 * @returns {Promise<Buffer>}      PDF completo como Buffer
 */
async function ensamblarPDF(imageBuffers, titulo, numCap) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });

        doc.on('data',  chunk => chunks.push(chunk));
        doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
        doc.on('error', err   => reject(err));

        for (const buf of imageBuffers) {
            try {
                // Leer dimensiones reales de la imagen
                const img = doc.openImage(buf);
                const imgW = img.width;
                const imgH = img.height;

                // Ancho fijo de lectura cómoda (tamaño celular/tablet)
                const PAGE_W = 620;
                const scale  = PAGE_W / imgW;
                const pageH  = imgH * scale;

                // Crear página del tamaño exacto de la imagen escalada
                doc.addPage({ size: [PAGE_W, pageH], margin: 0 });
                doc.image(img, 0, 0, { width: PAGE_W, height: pageH });
            } catch (e) {
                console.warn('[MangaDex] Error insertando imagen en PDF, se omite:', e.message);
            }
        }

        doc.end();
    });
}

// ─── Función de alto nivel ────────────────────────────────────────────────────

/**
 * Obtiene un capítulo completo listo para enviar por WhatsApp.
 *
 * @param {string} titulo    Título del manga (de mangas.json)
 * @param {string} codigo    Código interno (ej: "019")
 * @param {string} numCap    Número de capítulo pedido (ej: "47")
 * @returns {{ modo: 'pdf'|'imagenes', pdf?: Buffer, imagenes?: Buffer[], nombreArchivo: string, paginas: number }}
 */
async function obtenerCapitulo(titulo, codigo, numCap) {
    // 1. Resolver ID de MangaDex
    const mangaId = await buscarMangaId(titulo, codigo);
    if (!mangaId) throw new Error(`No se encontró "${titulo}" en MangaDex`);

    // 2. Obtener lista de capítulos (incluye flag de idioma)
    const { caps, idioma } = await obtenerCapitulos(mangaId);
    if (caps.length === 0) throw new Error(`No hay capítulos disponibles para "${titulo}"`);

    // 3. Buscar el capítulo pedido (número exacto o aproximado)
    const capInfo = caps.find(c => c.num === numCap || c.num === String(parseFloat(numCap)));
    if (!capInfo) {
        const disponibles = caps.slice(0, 10).map(c => `Cap. ${c.num}`).join(', ');
        throw new Error(`Capítulo ${numCap} no encontrado. Disponibles: ${disponibles}${caps.length > 10 ? '...' : ''}`);
    }

    // 4. Obtener URLs de páginas
    const { urls } = await obtenerPaginas(capInfo.id);
    if (urls.length === 0) throw new Error(`El capítulo ${numCap} no tiene páginas disponibles`);

    const langTag = idioma === 'es' ? '🇪🇸 ES' : '🇺🇸 EN';
    console.log(`[MangaDex] Cap ${numCap} de "${titulo}" → ${urls.length} páginas (${langTag})`);

    // 5. Descargar páginas
    const buffers = await descargarPaginasABuffers(urls);
    if (buffers.length === 0) throw new Error('No se pudieron descargar las páginas');

    const nombreBase = `${titulo.replace(/[^a-z0-9]/gi, '_')}_Cap${numCap}`;

    // 6. Decidir modo: PDF o imágenes sueltas
    if (buffers.length <= MAX_PAGES_PDF) {
        const pdf = await ensamblarPDF(buffers, titulo, numCap);
        return {
            modo: 'pdf',
            pdf,
            nombreArchivo: `${nombreBase}.pdf`,
            paginas: buffers.length,
            idioma
        };
    } else {
        return {
            modo: 'imagenes',
            imagenes: buffers,
            nombreArchivo: nombreBase,
            paginas: buffers.length,
            idioma
        };
    }
}

/**
 * Devuelve la lista de capítulos disponibles para mostrarle al usuario.
 * @param {string} titulo   Título del manga
 * @param {string} codigo   Código interno
 * @returns {{ disponibles: number, caps: Array, mangaId: string }}
 */
async function listarCapitulos(titulo, codigo) {
    const mangaId = await buscarMangaId(titulo, codigo);
    if (!mangaId) return null;

    const { caps, idioma } = await obtenerCapitulos(mangaId);
    return { disponibles: caps.length, caps, mangaId, idioma };
}

/**
 * Limpia la caché de ID de un manga (útil si el ID persistido es incorrecto)
 * @param {string} codigo
 */
function limpiarCacheId(codigo) {
    _idCache.delete(codigo);
    try {
        const data = cargarIdsPersistedos();
        delete data[codigo];
        fs.writeFileSync(IDS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) {}
}

/**
 * Fuerza un ID manual para un manga.
 * @param {string} codigo 
 * @param {string} id 
 */
function forzarMangaId(codigo, id) {
    _idCache.set(codigo, { id, ts: Date.now() });
    try {
        const data = cargarIdsPersistedos();
        data[codigo] = id;
        fs.writeFileSync(IDS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[MangaDex] Error forzando ID:', e.message);
    }
}

// ─── Tags de MangaDex (español → UUID) ────────────────────────────────────────
const TAGS_MAP = {
    // Acción
    'accion': '391b0423-d847-456f-aff0-8b0cfc03066b',
    'acción': '391b0423-d847-456f-aff0-8b0cfc03066b',
    // Aventura
    'aventura': '87cc87cd-a395-47af-b27a-93258283bbc6',
    // Comedia
    'comedia': '4d32cc48-9f00-4cca-9b5a-a839f0764984',
    'humor': '4d32cc48-9f00-4cca-9b5a-a839f0764984',
    // Drama
    'drama': 'b9af3a63-f058-46de-a9a0-e0c13906197a',
    // Fantasía
    'fantasia': 'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
    'fantasía': 'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
    // Terror / Horror
    'terror': 'cdad7e68-1419-41dd-bdce-27753074a640',
    'horror': 'cdad7e68-1419-41dd-bdce-27753074a640',
    'miedo': 'cdad7e68-1419-41dd-bdce-27753074a640',
    'suspenso': 'cdad7e68-1419-41dd-bdce-27753074a640',
    // Misterio
    'misterio': 'ee968100-4191-4968-93d3-f82d72be7e46',
    // Romance
    'romance': '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
    'amor': '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
    // Ciencia Ficción
    'scifi': '256c8bd9-4904-4360-bf4f-508a76d67183',
    'sci-fi': '256c8bd9-4904-4360-bf4f-508a76d67183',
    'ciencia ficcion': '256c8bd9-4904-4360-bf4f-508a76d67183',
    'ciencia ficción': '256c8bd9-4904-4360-bf4f-508a76d67183',
    // Thriller
    'thriller': '07251805-a27e-4d59-b488-f0bfbec15168',
    // Psicológico
    'psicologico': '3b60b75c-a2d7-4860-ab56-05f391bb889c',
    'psicológico': '3b60b75c-a2d7-4860-ab56-05f391bb889c',
    'psicologia': '3b60b75c-a2d7-4860-ab56-05f391bb889c',
    // Sobrenatural
    'sobrenatural': 'eabc5b4c-6aff-42f3-b657-3e90cbd00b75',
    'supernatural': 'eabc5b4c-6aff-42f3-b657-3e90cbd00b75',
    // Artes Marciales
    'artes marciales': '799c202e-7daa-44eb-9571-7a0eca22dc45',
    'artes': '799c202e-7daa-44eb-9571-7a0eca22dc45',
    'pelea': '799c202e-7daa-44eb-9571-7a0eca22dc45',
    // Isekai
    'isekai': 'ace04997-f6bd-436e-b261-779182193d3d',
    'otro mundo': 'ace04997-f6bd-436e-b261-779182193d3d',
    // Reencarnación
    'reencarnacion': '0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
    'reencarnación': '0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
    'regresion': '0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
    'regresión': '0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
    // Magia
    'magia': 'a1f53773-c69a-4ce5-8cab-fffcd90b1565',
    // Escolar / Vida escolar
    'escolar': 'caaa44eb-cd40-4177-b930-79d3ef2afe87',
    'colegio': 'caaa44eb-cd40-4177-b930-79d3ef2afe87',
    'escuela': 'caaa44eb-cd40-4177-b930-79d3ef2afe87',
    // Deportes
    'deportes': '69964a64-2f90-4d33-beeb-f3ed2875eb4c',
    'deporte': '69964a64-2f90-4d33-beeb-f3ed2875eb4c',
    // Música
    'musica': 'f42fbf9e-188a-447b-9571-21b5b1ef7b37',
    'música': 'f42fbf9e-188a-447b-9571-21b5b1ef7b37',
    // Mecha
    'mecha': 'fb83baab-eabc-4b75-ae1a-7d244fa347b1',
    'robots': 'fb83baab-eabc-4b75-ae1a-7d244fa347b1',
    // Militar
    'militar': 'ac72833b-c4e9-4571-8c65-36ef658baf4e',
    'guerra': 'ac72833b-c4e9-4571-8c65-36ef658baf4e',
    // Policía
    'policia': 'df33b754-73a3-4c54-80e6-0a7338571b2e',
    'policía': 'df33b754-73a3-4c54-80e6-0a7338571b2e',
    'crimen': 'df33b754-73a3-4c54-80e6-0a7338571b2e',
    // Vida cotidiana / Slice of life
    'vida cotidiana': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
    'slice of life': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
    'recuentos': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
    'cotidiano': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
    // Supervivencia
    'supervivencia': '5fff9cde-849c-4d78-aab0-0d52b2ee1d25',
    'survival': '5fff9cde-849c-4d78-aab0-0d52b2ee1d25',
    // Demonios
    'demonios': '39730448-9a5f-48a2-85b0-a70db87b1233',
    'demonio': '39730448-9a5f-48a2-85b0-a70db87b1233',
    // Monstruos
    'monstruos': '36fd93ea-e8b8-445e-b836-358f02b3d33d',
    'monstruo': '36fd93ea-e8b8-445e-b836-358f02b3d33d',
    // Histórico
    'historico': '33771934-028e-4cb3-8744-691e866a923e',
    'histórico': '33771934-028e-4cb3-8744-691e866a923e',
    'historia': '33771934-028e-4cb3-8744-691e866a923e',
    // Gore
    'gore': 'b29d6a3d-1569-4e7a-8caf-7557bc92cd5d',
    'sangre': 'b29d6a3d-1569-4e7a-8caf-7557bc92cd5d',
    // Vampiros
    'vampiros': 'd7d1730f-6eb0-4ba6-9437-602cac38664c',
    'vampiro': 'd7d1730f-6eb0-4ba6-9437-602cac38664c',
    // Samurai
    'samurai': '81183756-1453-4c81-aa9e-f6e1b63be016',
    // Ninja
    'ninja': '489dd859-9b61-4c37-af75-f8b0c4b29d3d',
    // Harem
    'harem': 'aafb99c1-7f60-43e4-bbc8-0234c72d56d0',
    // Cocina
    'cocina': '9ab53f92-3f2c-4f4e-87a5-b56c1cecff7c',
    'comida': '9ab53f92-3f2c-4f4e-87a5-b56c1cecff7c',
    'cooking': '9ab53f92-3f2c-4f4e-87a5-b56c1cecff7c'
};

// Géneros únicos para mostrar en el menú (sin duplicados)
const GENEROS_DISPLAY = [
    'accion', 'aventura', 'comedia', 'drama', 'fantasia',
    'terror', 'misterio', 'romance', 'scifi', 'thriller',
    'psicologico', 'sobrenatural', 'artes marciales', 'isekai',
    'reencarnacion', 'magia', 'escolar', 'deportes', 'musica',
    'mecha', 'militar', 'supervivencia', 'historico', 'vampiros',
    'gore', 'demonios', 'cocina', 'samurai', 'harem', 'vida cotidiana'
];

/** Caché de recomendaciones para no repetir la misma búsqueda */
const _recoCache = new Map(); // cacheKey → { mangas, ts }
const TTL_RECO = 2 * 60 * 60 * 1000; // 2h

// Lista de respaldo local para asegurar que !recomanga NUNCA falle ni de error aunque la API sufra caídas
const FALLBACK_MANGAS = [
    { id: 'a1c7c817-4e59-42b7-9e4d-d69d7742edb6', titulo: 'Chainsaw Man', descripcion: 'Denji es un joven atrapado en la pobreza extrema que trabaja como cazador de demonios para pagar las deudas de su padre.', tags: ['Action', 'Horror', 'Supernatural'], year: 2018, status: 'ongoing', coverUrl: 'https://uploads.mangadex.org/covers/a1c7c817-4e59-42b7-9e4d-d69d7742edb6/598a44b8-f350-4828-b0a3-a74e4c278a54.jpg.256.jpg' },
    { id: '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0', titulo: 'Solo Leveling', descripcion: 'En un mundo donde los cazadores luchan contra monstruos, Sung Jin-Woo es conocido como el cazador más débil de todos los tiempos.', tags: ['Action', 'Fantasy', 'Adventure'], year: 2018, status: 'completed', coverUrl: null },
    { id: '94891715-a109-4f5e-81ef-2bed5fb5bb19', titulo: 'Ijousha no Ai', descripcion: 'Midou Saki se enamoró de Kazumi cuando eran niños. Ese fue el comienzo de un infierno de celos y obsesión.', tags: ['Horror', 'Psychological', 'Drama'], year: 2017, status: 'completed', coverUrl: null },
    { id: 'b0b7270d-4295-46e3-a616-e575e9b9d363', titulo: 'Jujutsu Kaisen', descripcion: 'Yuuji Itadori es un estudiante de secundaria con una fuerza física extraordinaria que se ve envuelto en el mundo de las maldiciones.', tags: ['Action', 'Supernatural', 'Fantasy'], year: 2018, status: 'completed', coverUrl: null },
    { id: 'bd725916-2415-4676-a070-5b5c777641d4', titulo: 'Tokyo Ghoul', descripcion: 'Ken Kaneki es atacado por un ghoul y se convierte en un híbrido mitad humano mitad ghoul en una ciudad aterradora.', tags: ['Horror', 'Action', 'Drama'], year: 2011, status: 'completed', coverUrl: null },
    { id: 'e78a489f-26ee-4876-8545-9b2322384a56', titulo: 'Monster', descripcion: 'El Dr. Kenzo Tenma salva a un niño herido de bala sin saber que años más tarde se convertirá en un monstruo desalmado.', tags: ['Drama', 'Mystery', 'Psychological'], year: 1994, status: 'completed', coverUrl: null },
    { id: 'd8f93256-547c-416e-8264-a6900f7b11c9', titulo: 'Berserk', descripcion: 'Guts, conocido como el Espadachín Negro, busca venganza contra su antiguo amigo y mentor Griffith.', tags: ['Action', 'Adventure', 'Fantasy', 'Horror'], year: 1989, status: 'ongoing', coverUrl: null }
];

/**
 * Busca mangas populares en MangaDex y verifica que tengan capítulos en español.
 * @param {string|null} genero      Género/tag en español (ej: "terror") o null para popular
 * @param {string[]}    excludeIds  IDs de MangaDex ya vistos (para evitar repetidos)
 * @returns {{ manga: object, idioma: string, coverUrl: string|null }|null}
 */
async function recomendarManga(genero, excludeIds = []) {
    const cacheKey = genero || '__popular__';

    // Normalizar género (quitar tildes) para lookup en TAGS_MAP
    const tagKey = genero
        ? genero.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : null;
    const tagId = tagKey ? TAGS_MAP[tagKey] : null;

    // Si el género no existe en el mapa, avisarlo
    if (genero && !tagId) {
        return { error: 'genero_no_encontrado', genero };
    }

    const cached = _recoCache.get(cacheKey);

    // Servir del caché filtrando los ya vistos
    if (cached && Date.now() - cached.ts < TTL_RECO && cached.mangas.length > 0) {
        let disponibles = cached.mangas.filter(r => !excludeIds.includes(r.manga.id));
        if (disponibles.length === 0) disponibles = cached.mangas; // Reiniciar filtro si ya vio todos los del caché
        return disponibles[Math.floor(Math.random() * disponibles.length)];
    }

    try {
        // Consulta única limpia con límite alto (40) para evitar saturate/rate limit de MangaDex
        const randomOffset = Math.floor(Math.random() * 15);
        const params = {
            limit: 40,
            offset: randomOffset,
            'availableTranslatedLanguage[]': ['es', 'es-la'],
            'order[followedCount]': 'desc',
            'contentRating[]': ['safe', 'suggestive'],
            'includes[]': ['cover_art'],
            hasAvailableChapters: true
        };

        if (tagId) {
            params['includedTags[]'] = [tagId];
        }

        const data = await mdexGet('/manga', params);
        const resultados = [];

        if (data && data.data && data.data.length > 0) {
            for (const m of data.data) {
                const attrs = m.attributes;
                const titulo = attrs.title?.en || attrs.title?.es || attrs.title?.['ja-ro'] || Object.values(attrs.title || {})[0] || 'Sin título';
                const descEs = attrs.description?.es || attrs.description?.['es-la'] || '';
                const descEn = attrs.description?.en || '';
                const desc = descEs || descEn;
                const descLang = descEs ? 'es' : (descEn ? 'en' : 'es');
                const tags = attrs.tags?.filter(t => t.attributes.group === 'genre')
                    .map(t => t.attributes.name.en) || [];

                let coverUrl = null;
                const coverRel = m.relationships?.find(r => r.type === 'cover_art');
                if (coverRel?.attributes?.fileName) {
                    coverUrl = `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`;
                }

                resultados.push({
                    manga: {
                        id: m.id,
                        titulo,
                        descripcion: desc.length > 400 ? desc.substring(0, 400) + '...' : desc,
                        descLang,
                        tags,
                        year: attrs.year,
                        status: attrs.status
                    },
                    idioma: 'es',
                    coverUrl
                });
            }
        }

        if (resultados.length > 0) {
            _recoCache.set(cacheKey, { mangas: resultados, ts: Date.now() });

            let disponibles = resultados.filter(r => !excludeIds.includes(r.manga.id));
            if (disponibles.length === 0) disponibles = resultados; // Si ya vio todos, reiniciar filtro

            return disponibles[Math.floor(Math.random() * disponibles.length)];
        }
    } catch (e) {
        console.error('[MangaDex] Error consultando API en recomendarManga:', e.message);
    }

    // 🛡️ FALLBACK DE RESPALDO: Si la API falló o no devolvió resultados para ese offset, servir de la lista de respaldo local
    const fallbackList = FALLBACK_MANGAS.map(m => ({
        manga: { ...m, descLang: 'es' },
        idioma: 'es',
        coverUrl: m.coverUrl
    }));
    let disponiblesFallback = fallbackList.filter(r => !excludeIds.includes(r.manga.id));
    if (disponiblesFallback.length === 0) disponiblesFallback = fallbackList;
    return disponiblesFallback[Math.floor(Math.random() * disponiblesFallback.length)];
}

module.exports = {
    buscarMangaId,
    obtenerCapitulos,
    obtenerPaginas,
    descargarPaginasABuffers,
    ensamblarPDF,
    obtenerCapitulo,
    listarCapitulos,
    limpiarCacheId,
    forzarMangaId,
    recomendarManga,
    TAGS_MAP,
    GENEROS_DISPLAY,
    MAX_PAGES_PDF
};
