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
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
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

module.exports = {
    recomendarNovela,
    GENEROS_DISPLAY,
    GENERO_MAP_ES_EN
};
