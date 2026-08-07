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

module.exports = {
    buscarMangaId,
    obtenerCapitulos,
    obtenerPaginas,
    descargarPaginasABuffers,
    ensamblarPDF,
    obtenerCapitulo,
    listarCapitulos,
    limpiarCacheId,
    MAX_PAGES_PDF
};
