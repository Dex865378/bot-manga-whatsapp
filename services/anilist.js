/**
 * 📖 AniList Service
 * Integración con la API pública GraphQL de AniList para recomendar novelas
 * ligeras (light novels). No requiere API key. Rate limit ~90 req/min.
 *
 * AniList clasifica las light novels como type: MANGA, format: NOVEL - no
 * existe un tipo "NOVEL" separado, es un formato dentro del catalogo de manga.
 *
 * Sigue el mismo patron que services/mangadex.js para consistencia:
 * cache con TTL + lista de respaldo local si la API falla.
 */

'use strict';

const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co';

// ─── Caché en memoria ──────────────────────────────────────────────────────
const _recoCache = new Map(); // cacheKey → { novelas, ts }
const TTL_RECO = 2 * 60 * 60 * 1000; // 2h

/** Delay no bloqueante */
const delay = ms => new Promise(r => setTimeout(r, ms));

/** POST a la API GraphQL de AniList con retry simple */
async function anilistQuery(query, variables, retries = 2) {
    try {
        const res = await axios.post(ANILIST_URL, { query, variables }, {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'DikybotWA/1.0 (WhatsApp Bot)' }
        });
        return res.data?.data || null;
    } catch (e) {
        const isRateLimit = e.response?.status === 429;
        if (retries > 0) {
            await delay(isRateLimit ? 3000 : 1000);
            return anilistQuery(query, variables, retries - 1);
        }
        console.error('[AniList] Error consultando API:', e.message);
        return null;
    }
}

// ─── Géneros soportados por AniList (nombres en inglés, tal como los usa la API) ──
const GENEROS_DISPLAY = [
    'action', 'adventure', 'comedy', 'drama', 'fantasy',
    'horror', 'mystery', 'romance', 'sci-fi', 'thriller',
    'psychological', 'supernatural', 'slice of life', 'sports'
];

// Mapa español → inglés (AniList solo acepta generos en ingles)
const GENERO_MAP_ES_EN = {
    'accion': 'action', 'acción': 'action',
    'aventura': 'adventure',
    'comedia': 'comedy', 'humor': 'comedy',
    'drama': 'drama',
    'fantasia': 'fantasy', 'fantasía': 'fantasy',
    'terror': 'horror', 'horror': 'horror', 'miedo': 'horror',
    'misterio': 'mystery',
    'romance': 'romance', 'amor': 'romance',
    'scifi': 'sci-fi', 'sci-fi': 'sci-fi', 'ciencia ficcion': 'sci-fi', 'ciencia ficción': 'sci-fi',
    'thriller': 'thriller', 'suspenso': 'thriller',
    'psicologico': 'psychological', 'psicológico': 'psychological',
    'sobrenatural': 'supernatural',
    'vida cotidiana': 'slice of life', 'cotidiano': 'slice of life',
    'deportes': 'sports', 'deporte': 'sports'
};

// 🛡️ FALLBACK DE RESPALDO: si la API de AniList falla o no responde,
// nunca dejar a !reconovela sin nada que ofrecer, igual que hace mangadex.js
const FALLBACK_NOVELAS = [
    { id: 101177, titulo: 'Solo Leveling', descripcion: 'En un mundo donde cazadores con poderes sobrenaturales luchan contra monstruos, Sung Jin-Woo, el cazador mas debil de la humanidad, obtiene un poder misterioso que le permite subir de nivel sin limites.', tags: ['Action', 'Fantasy', 'Adventure'], year: 2016, status: 'FINISHED', coverUrl: null },
    { id: 101517, titulo: 'The Beginning After the End', descripcion: 'El Rey Grey gobernaba con poder absoluto, pero su vida termino en tragedia. Reencarna en un mundo de magia y monstruos con memorias de su vida pasada.', tags: ['Action', 'Adventure', 'Fantasy'], year: 2018, status: 'RELEASING', coverUrl: null },
    { id: 103477, titulo: 'Omniscient Reader', descripcion: 'Dokja era el unico lector que termino una novela web de 10 años. Cuando el mundo de la novela se vuelve realidad, es el unico que sabe como sobrevivir.', tags: ['Action', 'Fantasy', 'Psychological'], year: 2020, status: 'RELEASING', coverUrl: null },
    { id: 105398, titulo: 'Reincarnated as a Sword', descripcion: 'Un hombre reencarna como una espada inteligente en otro mundo, y forma un vinculo con una joven gata-humana esclava para explorar juntos.', tags: ['Action', 'Fantasy', 'Adventure'], year: 2015, status: 'RELEASING', coverUrl: null },
    { id: 98917, titulo: 'Mushoku Tensei', descripcion: 'Un hombre de 34 años sin trabajo es atropellado y reencarna en un mundo de magia como Rudeus Greyrat, decidido a vivir su nueva vida sin arrepentimientos.', tags: ['Adventure', 'Drama', 'Fantasy'], year: 2014, status: 'RELEASING', coverUrl: null }
];

/**
 * Recomienda una light novel popular (o por género) desde AniList.
 * @param {string|null} generoEs   Género en español o null para popular general
 * @param {number[]}    excludeIds IDs de AniList ya vistos (para evitar repetidos)
 * @returns {{ novela: object, coverUrl: string|null }|{ error: string, genero: string }|null}
 */
async function recomendarNovela(generoEs, excludeIds = []) {
    const cacheKey = generoEs || '__popular__';

    let generoEn = null;
    if (generoEs) {
        const key = generoEs.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        generoEn = GENERO_MAP_ES_EN[key] || null;
        if (!generoEn) {
            return { error: 'genero_no_encontrado', genero: generoEs };
        }
    }

    const cached = _recoCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_RECO && cached.novelas.length > 0) {
        let disponibles = cached.novelas.filter(r => !excludeIds.includes(r.novela.id));
        if (disponibles.length === 0) disponibles = cached.novelas;
        return disponibles[Math.floor(Math.random() * disponibles.length)];
    }

    const query = `
        query ($genre: String, $page: Int) {
            Page(page: $page, perPage: 25) {
                media(type: MANGA, format: NOVEL, genre: $genre, sort: POPULARITY_DESC) {
                    id
                    title { romaji english }
                    description(asHtml: false)
                    genres
                    startDate { year }
                    status
                    coverImage { large }
                }
            }
        }
    `;

    try {
        const randomPage = Math.floor(Math.random() * 4) + 1; // variar entre las primeras 4 paginas de popularidad
        const data = await anilistQuery(query, { genre: generoEn, page: randomPage });
        const items = data?.Page?.media || [];

        const resultados = items
            .filter(m => m.description) // descartar entradas sin sinopsis
            .map(m => {
                let desc = (m.description || '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '') // quitar tags HTML residuales
                    .trim();
                if (desc.length > 400) desc = desc.substring(0, 400) + '...';

                return {
                    novela: {
                        id: m.id,
                        titulo: m.title.english || m.title.romaji,
                        descripcion: desc,
                        tags: m.genres || [],
                        year: m.startDate?.year,
                        status: m.status
                    },
                    coverUrl: m.coverImage?.large || null
                };
            });

        if (resultados.length > 0) {
            _recoCache.set(cacheKey, { novelas: resultados, ts: Date.now() });
            let disponibles = resultados.filter(r => !excludeIds.includes(r.novela.id));
            if (disponibles.length === 0) disponibles = resultados;
            return disponibles[Math.floor(Math.random() * disponibles.length)];
        }
    } catch (e) {
        console.error('[AniList] Error en recomendarNovela:', e.message);
    }

    // Fallback local si la API fallo o no devolvio nada util
    const fallbackList = FALLBACK_NOVELAS.map(n => ({ novela: n, coverUrl: n.coverUrl }));
    let disponiblesFallback = fallbackList.filter(r => !excludeIds.includes(r.novela.id));
    if (disponiblesFallback.length === 0) disponiblesFallback = fallbackList;
    return disponiblesFallback[Math.floor(Math.random() * disponiblesFallback.length)];
}

// ─── Búsqueda de anime por nombre (respaldo de !anime cuando Jikan falla) ────
const _animeCache = new Map(); // nombre lower → { anime, ts }
const TTL_ANIME = 6 * 60 * 60 * 1000; // 6h
const _studioCache = new Map(); // nombre lower → { estudio, ts }
const _airingCache = new Map(); // nombre lower → { airing, ts }
const _mangaCache = new Map(); // nombre lower → { manga, ts }

// Evicción simple: si el mapa pasa de 100 entradas, saca la más vieja.
function cacheSetLimitado(map, key, val) {
    if (map.size >= 100) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
    }
    map.set(key, val);
}

/**
 * Busca un anime por nombre en AniList.
 * @param {string} nombre
 * @returns {Promise<{titulo, score, generos, estudio, estado, episodios, url, portada, sinopsis}|null>}
 */
async function buscarAnime(nombre) {
    const key = (nombre || '').toLowerCase().trim();
    if (!key) return null;
    const hit = _animeCache.get(key);
    if (hit && Date.now() - hit.ts < TTL_ANIME) return hit.anime;

    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                title { romaji english }
                averageScore
                genres
                studios { nodes { name } }
                status
                episodes
                siteUrl
                coverImage { large }
                description(asHtml: false)
            }
        }`;
    const data = await anilistQuery(query, { search: nombre }, 2);
    const m = data && data.Media;
    if (!m) return null;

    const anime = {
        titulo: (m.title && (m.title.english || m.title.romaji)) || nombre,
        score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
        generos: (m.genres || []).join(', '),
        estudio: ((m.studios && m.studios.nodes) || []).map(s => s.name).join(', ') || 'Desconocido',
        estado: m.status || '?',
        episodios: m.episodes || '?',
        url: m.siteUrl || '',
        portada: (m.coverImage && m.coverImage.large) || null,
        sinopsis: (m.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 900)
    };
    if (_animeCache.size >= 100) {
        const oldest = _animeCache.keys().next().value;
        _animeCache.delete(oldest);
    }
    _animeCache.set(key, { anime, ts: Date.now() });
    return anime;
}

/**
 * Busca un estudio de animación (respaldo de !estudio cuando Jikan falla).
 * Devuelve nombre + sus 5 animes más populares con portada.
 */
async function buscarEstudio(nombre) {
    const key = (nombre || '').toLowerCase().trim();
    if (!key) return null;
    const hit = _studioCache.get(key);
    if (hit && Date.now() - hit.ts < TTL_ANIME) return hit.estudio;

    const query = `
        query ($search: String) {
            Studio(search: $search) {
                name
                siteUrl
                isAnimationStudio
                media(sort: POPULARITY_DESC, perPage: 5) {
                    nodes {
                        title { romaji english }
                        averageScore
                        siteUrl
                        coverImage { large }
                    }
                }
            }
        }`;
    const data = await anilistQuery(query, { search: nombre }, 2);
    const s = data && data.Studio;
    if (!s) return null;

    const top = ((s.media && s.media.nodes) || []).map(m => ({
        titulo: (m.title && (m.title.english || m.title.romaji)) || '?',
        score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
        url: m.siteUrl || '',
        portada: (m.coverImage && m.coverImage.large) || null
    }));
    const estudio = { nombre: s.name, url: s.siteUrl || '', esAnimacion: !!s.isAnimationStudio, top };
    cacheSetLimitado(_studioCache, key, { estudio, ts: Date.now() });
    return estudio;
}

/**
 * Busca un anime y devuelve su próxima emisión (respaldo de !proximo).
 */
async function buscarProximo(nombre) {
    const key = (nombre || '').toLowerCase().trim();
    if (!key) return null;
    const hit = _airingCache.get(key);
    if (hit && Date.now() - hit.ts < TTL_ANIME) return hit.airing;

    const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                title { romaji english }
                status
                siteUrl
                startDate { year month day }
                nextAiringEpisode { airingAt episode }
            }
        }`;
    const data = await anilistQuery(query, { search: nombre }, 2);
    const m = data && data.Media;
    if (!m) return null;

    const airing = {
        titulo: (m.title && (m.title.english || m.title.romaji)) || nombre,
        estado: m.status || '?',
        url: m.siteUrl || '',
        inicio: (m.startDate && m.startDate.year) ? `${m.startDate.day || '?'}/${m.startDate.month || '?'}/${m.startDate.year}` : null,
        proxEp: (m.nextAiringEpisode && m.nextAiringEpisode.episode) || null,
        proxFecha: (m.nextAiringEpisode && m.nextAiringEpisode.airingAt)
            ? new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : null
    };
    cacheSetLimitado(_airingCache, key, { airing, ts: Date.now() });
    return airing;
}

/**
 * Busca un manga (respaldo de !manga cuando Jikan falla).
 */
async function buscarManga(nombre) {
    const key = (nombre || '').toLowerCase().trim();
    if (!key) return null;
    const hit = _mangaCache.get(key);
    if (hit && Date.now() - hit.ts < TTL_ANIME) return hit.manga;

    const query = `
        query ($search: String) {
            Media(search: $search, type: MANGA) {
                title { romaji english }
                averageScore
                genres
                status
                chapters
                volumes
                siteUrl
                coverImage { large }
                description(asHtml: false)
            }
        }`;
    const data = await anilistQuery(query, { search: nombre }, 2);
    const m = data && data.Media;
    if (!m) return null;

    const manga = {
        titulo: (m.title && (m.title.english || m.title.romaji)) || nombre,
        score: m.averageScore ? (m.averageScore / 10).toFixed(2) : null,
        generos: (m.genres || []).join(', '),
        estado: m.status || '?',
        capitulos: m.chapters || '?',
        tomos: m.volumes || '?',
        url: m.siteUrl || '',
        portada: (m.coverImage && m.coverImage.large) || null,
        sinopsis: (m.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 900)
    };
    cacheSetLimitado(_mangaCache, key, { manga, ts: Date.now() });
    return manga;
}

// ─── Búsqueda de personaje (respaldo de !personaje cuando Jikan falla) ────
const _charCache = new Map(); // nombre lower → { char, ts }

/**
 * Busca un personaje por nombre en AniList.
 * @param {string} nombre
 * @returns {Promise<{nombre, nativo, favoritos, bio, portada, url}|null>}
 */
async function buscarPersonaje(nombre) {
    const key = (nombre || '').toLowerCase().trim();
    if (!key) return null;
    const hit = _charCache.get(key);
    if (hit && Date.now() - hit.ts < TTL_ANIME) return hit.char;

    const query = `
        query ($search: String) {
            Character(search: $search) {
                name { full native }
                favourites
                image { large }
                siteUrl
                description(asHtml: false)
            }
        }`;
    const data = await anilistQuery(query, { search: nombre }, 2);
    const c = data && data.Character;
    if (!c) return null;

    const char = {
        nombre: (c.name && c.name.full) || nombre,
        nativo: (c.name && c.name.native) || 'N/A',
        favoritos: c.favourites || 0,
        bio: (c.description || '').replace(/<[^>]+>/g, '').replace(/~!|!~/g, '').trim().slice(0, 900) || 'Sin descripción disponible.',
        portada: (c.image && c.image.large) || null,
        url: c.siteUrl || ''
    };
    cacheSetLimitado(_charCache, key, { char, ts: Date.now() });
    return char;
}

module.exports = {
    recomendarNovela,
    buscarAnime,
    buscarEstudio,
    buscarProximo,
    buscarManga,
    buscarPersonaje,
    GENEROS_DISPLAY,
    GENERO_MAP_ES_EN
};
