const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { fetchWithRetry } = require('../utils/apiClient');
const { LRUCache } = require('../utils/lruCache');
const mangadex = require('../services/mangadex');

const execFileAsync = promisify(execFile);

// ============================================================
//     CAHÉ DE APIs EXTERNAS (Jikan, Wikipedia, etc.)
// ============================================================
// Evita repetir llamadas a APIs externas si el mismo dato fue pedido recientemente.
// TTL de 30 minutos. Reduce latencia de 2-3s a 0.001s en hits.
const apiCache = new LRUCache(100, 30 * 60 * 1000); // 100 entradas, 30min TTL

function getApiCache(key) {
    return apiCache.get(key);
}

function setApiCache(key, data) {
    apiCache.set(key, data);
}

// Mapa para controlar cancelaciones de descargas masivas (!parar)
const cancelMap = new Map();

module.exports = {
    name: 'media',
    isMultiple: true,
    names: ['!waifu', '!anime', '!personaje', '!estudio', '!proximo', '!estrenos', '!temporada', '!recomendar', '!random', '!trace', '!news', '!wiki', '!decir', '!catalogo', '!manga', '!leer', '!buscar', '!ver', '!parar'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, db, delay, downloadMediaMessage, traducirConCache, botState, sender, chatWithLiquidAI }) {
        // !parar - Cancela descargas masivas en curso
        if (start === '!parar') {
            cancelMap.set(chatId, true);
            return sock.sendMessage(chatId, { text: '🛑 Se han cancelado las descargas masivas en curso para este chat.' }, { quoted: msg });
        }

        // !ver @usuario - Descargar y enviar foto de perfil
        if (start === '!ver') {
            try {
                // Determinar el JID del usuario objetivo
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                let targetJid = null;

                if (mentioned && mentioned.length > 0) {
                    targetJid = mentioned[0];
                } else if (args.length > 0) {
                    // Si puso un número sin @, intentar construir el JID
                    const num = args[0].replace(/[^0-9]/g, '');
                    if (num.length >= 7) {
                        targetJid = num + '@s.whatsapp.net';
                    }
                }

                // Si no mencionó a nadie, usar al remitente
                if (!targetJid) {
                    targetJid = sender;
                }

                const nombre = targetJid.split('@')[0];

                // Obtener URL de la foto de perfil (calidad completa)
                let ppUrl;
                try {
                    ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                } catch (e) {
                    // El usuario tiene la foto de perfil privada o no tiene foto
                    return sock.sendMessage(chatId, {
                        text: `📸 No se pudo obtener la foto de perfil de @${nombre}.\n\n_Puede que tenga la foto en privado o no tenga una configurada._`,
                        mentions: [targetJid]
                    }, { quoted: msg });
                }

                // Descargar la imagen
                const imgRes = await axios.get(ppUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000
                });

                // Enviar la imagen al chat
                return sock.sendMessage(chatId, {
                    image: Buffer.from(imgRes.data),
                    caption: `📸 *Foto de perfil de* @${nombre}`,
                    mentions: [targetJid]
                }, { quoted: msg });

            } catch (e) {
                console.error('❌ [ver] Error:', e.message);
                return sock.sendMessage(chatId, {
                    text: '❌ Error al obtener la foto de perfil. Intenta de nuevo.'
                }, { quoted: msg });
            }
        }

        // !waifu (envía por URL directa, sin descargar buffer a RAM)
        if (start === '!waifu') {
            try {
                const res = await axios.get('https://api.waifu.pics/sfw/waifu', { timeout: 7000 });
                return sock.sendMessage(chatId, { image: { url: res.data.url }, caption: '🍱 Aquí tienes tu waifu' }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error al obtener waifu.' }); }
        }

        // !decir
        if (start === '!decir') {
            let t = args.join(' ');
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            // 1. Soporte para citados (si no hay texto, usa el del mensaje respondido)
            if (!t && quoted) {
                t = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || '';
            }

            // 2. Si sigue sin haber texto, invocamos a la IA (Liquid AI) para que genere algo divertido
            if (!t) {
                await sock.sendPresenceUpdate('composing', chatId);
                t = await chatWithLiquidAI('Saluda de forma breve y divertida al grupo como Diky Bot.', 'Eres Diky Bot, un bot de WhatsApp amigable.');
                if (!t) return sock.sendMessage(chatId, { text: '🗣️ No tengo nada que decir en este momento.' });
            }

            // 3. Soporte para Idiomas y Traducción
            const langMap = {
                'jp': 'ja', 'ja': 'ja', 'jap': 'ja',
                'en': 'en', 'ing': 'en',
                'fr': 'fr', 'fra': 'fr',
                'it': 'it', 'ita': 'it',
                'pt': 'pt', 'por': 'pt',
                'ru': 'ru', 'rus': 'ru',
                'de': 'de', 'ale': 'de',
                'ar': 'ar', 'ara': 'ar'
            };

            const firstWord = args[0]?.toLowerCase();
            let targetLang = 'es';
            let queryText = t;

            if (langMap[firstWord] && args.length > 1) {
                targetLang = langMap[firstWord];
                const textToTranslate = args.slice(1).join(' ') || (quoted ? t : '');

                if (textToTranslate) {
                    try {
                        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`, { timeout: 5000 });
                        queryText = res.data[0].map(x => x[0]).join('').trim();
                    } catch (e) {
                        queryText = textToTranslate;
                    }
                }
            }

            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(queryText.substring(0, 200))}&tl=${targetLang}&client=tw-ob`;
            try {
                const audioRes = await axios.get(ttsUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://translate.google.com/'
                    }
                });
                const mp3Buffer = Buffer.from(audioRes.data);
                if (mp3Buffer.length < 1024) throw new Error('TTS devolvio audio vacio');

                const tmpIn = path.join(os.tmpdir(), `decir_in_${Date.now()}.mp3`);
                const tmpOut = path.join(os.tmpdir(), `decir_out_${Date.now()}.ogg`);
                try {
                    fs.writeFileSync(tmpIn, mp3Buffer);
                    await execFileAsync('ffmpeg', [
                        '-i', tmpIn,
                        '-vn',
                        '-c:a', 'libopus',
                        '-b:a', '48k',
                        '-ar', '48000',
                        '-ac', '1',
                        '-f', 'ogg',
                        '-y',
                        tmpOut
                    ], { timeout: 15000, windowsHide: true });

                    const opusBuffer = fs.readFileSync(tmpOut);
                    if (opusBuffer.length < 1024) throw new Error('FFmpeg genero audio vacio');
                    return sock.sendMessage(chatId, { audio: opusBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
                } finally {
                    try { fs.unlinkSync(tmpIn); } catch (e) { }
                    try { fs.unlinkSync(tmpOut); } catch (e) { }
                }
            } catch (ttsErr) {
                console.error('❌ [decir] TTS Error:', ttsErr.message);
                // Fallback: enviar como texto si TTS falla
                return sock.sendMessage(chatId, { text: `🗣️ _"${queryText}"_` }, { quoted: msg });
            }
        }

        // Manga functions
        const cargarMangasLocal = () => {
            const pathM = path.join(__dirname, '..', 'mangas.json');
            if (fs.existsSync(pathM)) return JSON.parse(fs.readFileSync(pathM, 'utf-8'));
            return [];
        };

        // !catalogo
        if (start === '!catalogo') {
            const mangas = cargarMangasLocal();
            let lista = `📚 *CATÁLOGO* (${mangas.length})\n\n`;
            mangas.forEach(m => { lista += `[${m.codigo}] ${m.titulo}\n`; });
            lista += `\n💡 !manga <código> o !leer <código>.`;
            return sock.sendMessage(chatId, { text: lista });
        }

        // !manga [código o nombre]
        if (start === '!manga') {
            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '📖 Uso: !manga <código o nombre>' });

            // 1. Buscar localmente
            const localM = cargarMangasLocal().find(x => x.codigo === q || x.titulo.toLowerCase() === q.toLowerCase());
            if (localM) {
                const p = path.join(__dirname, '..', 'mangas', localM.carpeta, 'portada.png');
                const info = `📖 **${localM.titulo.toUpperCase()}** (Local)\n━━━━━━━━━━━━━━\n📝 ${localM.resumen || 'Sin descripción disponible.'}\n━━━━━━━━━━━━━━\n💡 Usa *!leer ${localM.codigo}* para leerlo aquí.`;

                if (fs.existsSync(p)) {
                    return sock.sendMessage(chatId, { image: fs.readFileSync(p), caption: info }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: info }, { quoted: msg });
            }

            // 2. Buscar Online (Jikan)
            try {
                const res = await fetchWithRetry(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=1`, { timeout: 8000 }, 3, 1000);
                if (!res.data.data[0]) return sock.sendMessage(chatId, { text: '❌ No se encontró ese manga en la base de datos mundial.' });
                const m = res.data.data[0];
                const sinopsis = await traducirConCache(m.synopsis, 'resumen');
                let info = `📖 **${m.title.toUpperCase()}** 📖\n`;
                info += `━━━━━━━━━━━━━━\n🌟 **Nota:** ${m.score || 'N/A'} | 📅 **Capítulos:** ${m.chapters || '?'}\n`;
                info += `🎭 **Géneros:** ${m.genres.map(g => g.name).join(', ')}\n`;
                info += `👤 **Autor:** ${m.authors.map(a => a.name).join(', ') || '?'}\n`;
                info += `━━━━━━━━━━━━━━\n📖 **SINOPSIS:**\n_${sinopsis}_\n━━━━━━━━━━━━━━`;
                return sock.sendMessage(chatId, { image: { url: m.images.jpg.image_url }, caption: info }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error al buscar online.' }); }
        }

        // !buscar
        if (start === '!buscar') {
            const q = args.join(' ').toLowerCase();
            const res = cargarMangasLocal().filter(x => x.titulo.toLowerCase().includes(q));
            if (res.length === 0) return sock.sendMessage(chatId, { text: '❌ No encontrado.' });
            let l = '📚 *Resultados:*\n';
            res.forEach(x => { l += `• ${x.titulo} (${x.codigo})\n`; });
            return sock.sendMessage(chatId, { text: l });
        }

        // !leer <código>         → lista capítulos disponibles en MangaDex
        // !leer <código> <cap>   → descarga capítulo como PDF al vuelo (data-saver)
        if (start === '!leer') {
            const cod    = args[0];
            const numCap = args[1]; // puede ser undefined

            if (!cod) {
                return sock.sendMessage(chatId,
                    { text: '📖 *Uso:*\n• `!leer <código>` — ver capítulos disponibles\n• `!leer <código> <número>` — leer un capítulo\n\nEjemplo: `!leer 019 1`' },
                    { quoted: msg }
                );
            }

            const m = cargarMangasLocal().find(x => x.codigo === cod);
            if (!m) {
                return sock.sendMessage(chatId,
                    { text: `❌ Código *${cod}* no encontrado.\nUsa *!catalogo* para ver los códigos disponibles.` },
                    { quoted: msg }
                );
            }

            // ── Caso A: solo código → listar capítulos ──────────────────────
            if (!numCap) {
                await sock.sendMessage(chatId,
                    { text: `🔍 Buscando capítulos de *${m.titulo}* en MangaDex...` },
                    { quoted: msg }
                );
                try {
                    const info = await mangadex.listarCapitulos(m.titulo, m.codigo);
                    if (!info || info.disponibles === 0) {
                        return sock.sendMessage(chatId,
                            { text: `❌ No se encontraron capítulos de *${m.titulo}* en MangaDex.\n\n💡 Puede que esté bajo otro título. Prueba *!manga ${m.codigo}* para ver el título original.` },
                            { quoted: msg }
                        );
                    }
                    const sample = info.caps.slice(0, 30);
                    const langEmoji = info.idioma === 'es' ? '🇪🇸' : '🇺🇸';
                    const langText = info.idioma === 'es' ? 'en español' : 'en inglés';
                    let lista = `📚 *${m.titulo}*\n━━━━━━━━━━━━━━\n📖 *${info.disponibles} capítulos ${langText}*\n\n`;
                    lista += sample.map(c => `${langEmoji} Cap. *${c.num}*${c.titulo ? ` — ${c.titulo}` : ''}`).join('\n');
                    if (info.disponibles > 30) lista += `\n...y ${info.disponibles - 30} más.`;
                    if (info.idioma === 'en') lista += `\n\n⚠️ *Aviso: No se encontraron capítulos en español, mostrando en inglés.*`;
                    lista += `\n\n💡 *!leer ${m.codigo} <número>* para leer un capítulo`;
                    return sock.sendMessage(chatId, { text: lista }, { quoted: msg });
                } catch (e) {
                    console.error('[!leer] Error listando:', e.message);
                    return sock.sendMessage(chatId,
                        { text: `❌ Error buscando capítulos: ${e.message}` },
                        { quoted: msg }
                    );
                }
            }

            // ── Caso B: código + número → descargar y enviar ────────────────
            const isAll = numCap.toLowerCase() === 'all';

            // Ejecutar en background para no bloquear al bot
            (async () => {
                try {
                    let capsToDownload = [];
                    if (isAll) {
                        await sock.sendMessage(chatId, { text: `⏳ Preparando descarga masiva de *${m.titulo}*...\n📡 Obteniendo lista de capítulos...` }, { quoted: msg });
                        const info = await mangadex.listarCapitulos(m.titulo, m.codigo);
                        if (!info || info.disponibles === 0) {
                            return sock.sendMessage(chatId, { text: `❌ No hay capítulos disponibles para descargar.` });
                        }
                        capsToDownload = info.caps.map(c => c.num);
                        await sock.sendMessage(chatId, { text: `🚀 Comenzando descarga de *${capsToDownload.length}* capítulos.\n⚠️ Esto tomará tiempo. Los capítulos llegarán uno por uno con pausas para no saturar el servidor.` });
                    } else {
                        capsToDownload = [numCap];
                        await sock.sendMessage(chatId,
                            { text: `⏳ Descargando *${m.titulo}* — Cap. *${numCap}*...\n📡 Obteniendo páginas desde MangaDex (calidad optimizada)` },
                            { quoted: msg }
                        );
                    }

                    // Resetear bandera de cancelación al iniciar
                    if (isAll) cancelMap.set(chatId, false);

                    for (const num of capsToDownload) {
                        if (isAll && cancelMap.get(chatId)) {
                            await sock.sendMessage(chatId, { text: `🛑 Descarga masiva detenida por el usuario.` });
                            break;
                        }

                        try {
                            if (isAll) {
                                await sock.sendMessage(chatId, { text: `🔄 Procesando Cap. *${num}*...` });
                            }
                            const resultado = await mangadex.obtenerCapitulo(m.titulo, m.codigo, num);

                            if (resultado.modo === 'pdf') {
                                // ✅ Modo principal: 1 PDF por capítulo
                                await sock.sendMessage(chatId, {
                                    document: resultado.pdf,
                                    mimetype: 'application/pdf',
                                    fileName: resultado.nombreArchivo,
                                    caption: `📖 *${m.titulo}*\nCap. *${num}* — ${resultado.paginas} páginas ${resultado.idioma === 'es' ? '🇪🇸' : '🇺🇸'}`
                                }, isAll ? {} : { quoted: msg });
                            } else {
                                // ⚠️ Modo fallback: capítulo muy largo → imágenes sueltas
                                await sock.sendMessage(chatId, {
                                    text: `⚠️ El capítulo ${num} tiene *${resultado.paginas} páginas*. Enviando por lotes de imágenes...`
                                });
                                const lote = 10;
                                for (let i = 0; i < resultado.imagenes.length; i += lote) {
                                    const batch = resultado.imagenes.slice(i, i + lote);
                                    for (let j = 0; j < batch.length; j++) {
                                        await sock.sendMessage(chatId, {
                                            image: batch[j],
                                            caption: `📄 Pág. ${i + j + 1}/${resultado.paginas}`
                                        });
                                        await new Promise(r => setTimeout(r, 800));
                                    }
                                }
                            }

                            if (isAll) {
                                // Pausa generosa entre capítulos para no agotar la RAM ni sufrir ban de WhatsApp/MangaDex
                                await new Promise(r => setTimeout(r, 4000));
                            }
                        } catch (err) {
                            console.error(`[!leer] Error obteniendo cap ${num}:`, err.message);
                            await sock.sendMessage(chatId, { text: `❌ Falló el capítulo ${num}: ${err.message}` });
                        }
                    }

                    if (isAll && !cancelMap.get(chatId)) {
                        await sock.sendMessage(chatId, { text: `✅ Descarga masiva de *${m.titulo}* completada.` });
                    }
                } catch (e) {
                    console.error(`[!leer] Error general:`, e.message);
                    await sock.sendMessage(chatId,
                        { text: `❌ Ocurrió un error: ${e.message}\n\n💡 Prueba *!leer ${m.codigo}* para ver los capítulos disponibles.` },
                        { quoted: msg }
                    );
                }
            })();

            return;
        }

        // !anime
        if (start === '!anime') {
            const subCmd = (args[0] || '').toLowerCase();

            // ═══════════════════════════════════════
            // !anime reto / !anime retos - Juego de memorización (5 a 10 animes)
            // ═══════════════════════════════════════
            if (subCmd === 'reto' || subCmd === 'retos') {
                if (botState.juegos[chatId]) {
                    return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                }

                const animeMaster = [
                    'Naruto Shippuden', 'Dragon Ball Z', 'One Piece', 'Attack on Titan', 'Death Note',
                    'Jujutsu Kaisen', 'Demon Slayer', 'Bleach', 'Hunter x Hunter', 'My Hero Academia',
                    'Fullmetal Alchemist: Brotherhood', 'Sword Art Online', 'Tokyo Ghoul', 'Black Clover',
                    'Chainsaw Man', 'Spy x Family', 'One Punch Man', 'Steins;Gate', 'Code Geass', 'Fairy Tail',
                    'JoJo\'s Bizarre Adventure', 'Cowboy Bebop', 'Neon Genesis Evangelion', 'Mob Psycho 100',
                    'Haikyuu!!', 'Kuroko no Basket', 'Blue Lock', 'Tokyo Revengers', 'Dr. Stone', 'Fire Force',
                    'Seven Deadly Sins', 'Overlord', 'Re:Zero', 'Konosuba', 'The Rising of the Shield Hero',
                    'Mushoku Tensei', 'Vinland Saga', 'Berserk', 'Hellsing Ultimate', 'Parasyte', 'Akame ga Kill',
                    'Kill la Kill', 'Gurren Lagann', 'Psycho-Pass', 'Fate/Zero', 'Fate/stay night', 'Your Lie in April',
                    'Anohana', 'Clannad', 'Angel Beats', 'Gintama', 'Slam Dunk', 'Yu Yu Hakusho', 'Saint Seiya',
                    'Rurouni Kenshin', 'InuYasha', 'Ranma 1/2', 'Sailor Moon', 'Cardcaptor Sakura', 'Digimon Adventure',
                    'Pokemon', 'Beyblade', 'Yu-Gi-Oh!', 'Captain Tsubasa', 'Initial D', 'Great Teacher Onizuka',
                    'Trigun', 'Black Lagoon', 'Baccano!', 'Durarara!!', 'Soul Eater', 'Blue Exorcist', 'Noragami',
                    'Magi: The Labyrinth of Magic', 'Seraph of the End', 'Bungou Stray Dogs', 'Golden Kamuy',
                    'Made in Abyss', 'The Promised Neverland', 'Dororo', 'Dorohedoro', 'Beastars', 'Odd Taxi',
                    'Ranking of Kings', 'Kaguya-sama: Love is War', 'Horimiya', 'Toradora!', 'Oregairu',
                    'Rascal Does Not Dream of Bunny Girl Senpai', 'Violet Evergarden', 'A Silent Voice', 'Your Name',
                    'Weathering With You', 'Suzume', '5 Centimeters per Second', 'Garden of Words', 'Summer Wars',
                    'Wolf Children', 'The Girl Who Leapt Through Time', 'Spirited Away', 'Princess Mononoke',
                    'My Neighbor Totoro', 'Howl\'s Moving Castle', 'Castle in the Sky', 'Grave of the Fireflies',
                    'Ponyo', 'Kiki\'s Delivery Service', 'Nausicaä of the Valley of the Wind', 'Whisper of the Heart',
                    'The Wind Rises', 'Porco Rosso', 'Akira', 'Ghost in the Shell', 'Perfect Blue', 'Paprika',
                    'Millennium Actress', 'Tokyo Godfathers', 'Redline', 'Sword of the Stranger', 'Promare',
                    'Cyberpunk: Edgerunners', 'Devilman Crybaby', 'Ergo Proxy', 'Texhnolyze', 'Serial Experiments Lain',
                    'Monster', 'Pluto', 'Legend of the Galactic Heroes', 'Ashita no Joe', 'Devilman', 'Mazinger Z',
                    'Mobile Suit Gundam', 'Gundam SEED', 'Gundam 00', 'Gundam Iron-Blooded Orphans',
                    'Code Geass: Akito the Exiled', 'Eureka Seven', 'Full Metal Panic!', 'Darling in the Franxx',
                    'Guilty Crown', 'Mirai Nikki', 'Elfen Lied', 'Highschool of the Dead', 'High School DxD',
                    'To Love Ru', 'Rosario + Vampire', 'Sora no Otoshimono', 'Date A Live', 'Plastic Memories'
                ];

                // Fuerzo cant = 10 para blind ranking
                const cant = 10;
                const chosen = [...animeMaster].sort(() => 0.5 - Math.random()).slice(0, cant);

                let followUp = `🏆 *DESAFÍO BLIND RANKING* 🏆\n`;
                followUp += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                followUp += `Te daré 10 animes, uno por uno. Tienes que darles una posición del 1 al 10 sin saber cuáles siguen.\n\n`;
                followUp += `🎬 *1/10:* ${chosen[0]}\n\n`;
                followUp += `👉 ¿Qué posición le das?\n`;
                followUp += `🔢 Disponibles: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`;

                const sentMsg = await sock.sendMessage(chatId, { text: followUp }, { quoted: msg });

                // Iniciar juego
                botState.juegos[chatId] = {
                    tipo: 'reto_anime',
                    responder: sender,
                    lista: chosen,
                    currentIndex: 0,
                    userRankings: {},
                    availableNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    msgId: sentMsg.key.id,
                    startTime: Date.now(),
                    timer: setTimeout(async () => {
                        if (botState.juegos[chatId] && botState.juegos[chatId].msgId === sentMsg.key.id) {
                            delete botState.juegos[chatId];
                            await sock.sendMessage(chatId, { text: `⏰ *TIEMPO AGOTADO* ⏰\n@${sender.split('@')[0]} tardó demasiado en elegir.`, mentions: [sender] });
                        }
                    }, 180000) // 3 minutos
                };
                return;
            }

            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '📺 Uso: !anime <nombre> o !anime reto' });
            try {
                // Caché de API para evitar repetir llamadas
                const cacheKey = `anime:${q.toLowerCase()}`;
                let a = getApiCache(cacheKey);
                if (!a) {
                    const res = await fetchWithRetry(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1`, { timeout: 8000 }, 3, 1000);
                    if (!res.data.data[0]) return sock.sendMessage(chatId, { text: '❌ No encontrado.' });
                    a = res.data.data[0];
                    setApiCache(cacheKey, a);
                }
                const sinopsis = await traducirConCache(a.synopsis, 'resumen');
                const generos = a.genres.map(g => g.name).join(', ');
                const estudio = a.studios.map(s => s.name).join(', ') || 'Desconocido';

                let info = `🎬 **${a.title.toUpperCase()}** 🎬\n`;
                info += `━━━━━━━━━━━━━━\n🌟 **Calificación:** ${a.score || 'N/A'} / 10\n`;
                info += `🎭 **Géneros:** ${generos}\n🎥 **Estudio:** ${estudio}\n`;
                info += `📅 **Estado:** ${a.status}\n🎞️ **Episodios:** ${a.episodes || '?'}\n`;
                info += `🔗 **Link:** ${a.url}\n━━━━━━━━━━━━━━\n`;
                info += `📖 **SINOPSIS:**\n_${sinopsis}_\n━━━━━━━━━━━━━━\n✨ _Busca más detalles con !wiki ${a.title}_`;

                // Enviar imagen por URL directa (sin descargar buffer a RAM)
                if (a.images?.jpg?.image_url) {
                    return sock.sendMessage(chatId, { image: { url: a.images.jpg.image_url }, caption: info }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: info }, { quoted: msg });
            } catch (e) {
                console.error('❌ [anime] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al buscar anime.' }, { quoted: msg });
            }
        }

        if (start === '!personaje') {
            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '👤 Uso: !personaje <nombre>' }, { quoted: msg });
            try {
                const cacheKey = `char:${q.toLowerCase()}`;
                let characters = getApiCache(cacheKey);
                
                if (!characters) {
                    // Buscar hasta 5 resultados para encontrar el mejor match
                    const res = await fetchWithRetry(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5`, { timeout: 8000 }, 3, 1000);
                    if (!res.data.data || res.data.data.length === 0) {
                        return sock.sendMessage(chatId, { text: '❌ No se encontró ese personaje.' }, { quoted: msg });
                    }
                    characters = res.data.data;
                    setApiCache(cacheKey, characters);
                }
                
                // Buscar el mejor match por nombre exacto o coincidencia parcial
                const qLower = q.toLowerCase();
                let c = characters.find(ch => 
                    ch.name.toLowerCase() === qLower || 
                    (ch.name_kanji && ch.name_kanji.toLowerCase() === qLower)
                ) || characters.find(ch => 
                    ch.name.toLowerCase().includes(qLower) || 
                    (ch.name_kanji && ch.name_kanji.toLowerCase().includes(qLower))
                ) || characters[0]; // fallback al primero si no hay match exacto
                
                // Asegurar que la bio sea traducida a español
                let bioText = c.about || 'Sin descripción disponible.';
                const bio = await traducirConCache(bioText, 'biografía');
                
                // Limitar bio para WhatsApp
                const bioCorta = bio.length > 400 ? bio.substring(0, 400) + '...' : bio;
                
                const caption = `👤 *${c.name}*\n🎌 *Nombre JP:* ${c.name_kanji || 'N/A'}\n⭐ *Favoritos:* ${c.favorites || 0}\n\n📖 *Biografía:*\n${bioCorta}`;

                if (c.images?.jpg?.image_url) {
                    return sock.sendMessage(chatId, { image: { url: c.images.jpg.image_url }, caption }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
            } catch (e) {
                console.error('❌ [personaje] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al buscar personaje. Intenta con otro nombre.' }, { quoted: msg });
            }
        }

        if (start === '!estudio') {
            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '🎬 Uso: !estudio <nombre>' }, { quoted: msg });
            try {
                const cacheKey = `studio:${q.toLowerCase()}`;
                let s = getApiCache(cacheKey);
                if (!s) {
                    const res = await fetchWithRetry(`https://api.jikan.moe/v4/producers?q=${encodeURIComponent(q)}&limit=1`, { timeout: 8000 }, 3, 1000);
                    if (!res.data.data[0]) return sock.sendMessage(chatId, { text: '❌ No encontrado.' }, { quoted: msg });
                    s = res.data.data[0];
                    setApiCache(cacheKey, s);
                }
                const caption = `🎬 *Estudio:* ${s.titles[0]?.title}\n📅 *Est:* ${s.established || '?'}\n🔗 *Web:* ${s.url}`;

                if (s.images?.jpg?.image_url) {
                    return sock.sendMessage(chatId, { image: { url: s.images.jpg.image_url }, caption }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
            } catch (e) {
                console.error('❌ [estudio] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al buscar estudio.' }, { quoted: msg });
            }
        }

        if (start === '!proximo') {
            const q = args.join(' ');
            try {
                const res = await fetchWithRetry(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1`, { timeout: 8000 }, 3, 1000);
                if (!res.data.data[0]) return sock.sendMessage(chatId, { text: '❌ No encontrado.' });
                const a = res.data.data[0];
                return sock.sendMessage(chatId, { text: `📺 *${a.title}*\n📡 *Emisión:* ${a.broadcast?.string || 'No disponible'}` });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ Error al buscar información.' }, { quoted: msg });
            }
        }

        if (start === '!estrenos') {
            try {
                const res = await fetchWithRetry(`https://api.jikan.moe/v4/schedules`, { timeout: 8000 }, 3, 1000);
                const hoy = res.data.data.slice(0, 10);
                let m = '📅 *ANIME HOY*\n\n';
                hoy.forEach(a => { m += `• ${a.title} (${a.broadcast?.time || '?'})\n`; });
                return sock.sendMessage(chatId, { text: m });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ Error al obtener estrenos.' }, { quoted: msg });
            }
        }

        if (start === '!temporada') {
            try {
                const res = await fetchWithRetry(`https://api.jikan.moe/v4/seasons/now?limit=15`, { timeout: 8000 }, 3, 1000);
                let m = '🌟 *ANIME DE TEMPORADA*\n\n';
                res.data.data.forEach(a => { m += `• ${a.title} [★${a.score || '?'}]\n`; });
                return sock.sendMessage(chatId, { text: m });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ Error al obtener temporada actual.' }, { quoted: msg });
            }
        }

        if (start === '!recomendar') {
            try {
                const cacheKey = 'recomendaciones_anime';
                let animeList = getApiCache(cacheKey);
                
                if (!animeList) {
                    // Usar endpoint de temporada actual con buena puntuación
                    const res = await fetchWithRetry(`https://api.jikan.moe/v4/seasons/now?filter=tv&limit=25`, { timeout: 10000 }, 3, 1000);
                    // Filtrar solo animes con score >= 7 para recomendaciones de calidad
                    animeList = res.data.data.filter(a => a.score && a.score >= 7);
                    if (animeList.length === 0) animeList = res.data.data; // fallback si no hay con score alto
                    setApiCache(cacheKey, animeList);
                }
                
                const a = animeList[Math.floor(Math.random() * animeList.length)];
                
                // Asegurar sinopsis en español
                let synopsisText = a.synopsis || 'Sin sinopsis disponible.';
                const sinopsis = await traducirConCache(synopsisText, 'resumen');
                const sinopsisCorta = sinopsis.length > 300 ? sinopsis.substring(0, 300) + '...' : sinopsis;
                
                const generos = a.genres?.map(g => g.name).join(', ') || 'Desconocido';
                const caption = `💡 *Te recomiendo:* ${a.title}\n\n⭐ *Calificación:* ${a.score || 'N/A'}/10\n🎭 *Géneros:* ${generos}\n� *Episodios:* ${a.episodes || '?'}\n\n�📖 *Sinopsis:*\n${sinopsisCorta}`;

                if (a.images?.jpg?.image_url) {
                    return sock.sendMessage(chatId, { image: { url: a.images.jpg.image_url }, caption }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
            } catch (e) { 
                console.error('❌ [recomendar] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al obtener recomendación. Intenta de nuevo.' }, { quoted: msg }); 
            }
        }

        if (start === '!random') {
            try {
                // Intentar hasta 3 veces si falla
                let a = null;
                let attempts = 0;
                const maxAttempts = 3;
                
                while (!a && attempts < maxAttempts) {
                    try {
                        const res = await fetchWithRetry(`https://api.jikan.moe/v4/random/anime`, { timeout: 10000 }, 2, 500);
                        a = res.data.data;
                        // Ignorar resultados sin título o sin imagen
                        if (!a || !a.title) a = null;
                    } catch (err) {
                        attempts++;
                        if (attempts < maxAttempts) await delay(500);
                    }
                }
                
                if (!a) {
                    return sock.sendMessage(chatId, { text: '❌ No se pudo obtener un anime aleatorio. Intenta de nuevo.' }, { quoted: msg });
                }
                
                // Asegurar sinopsis en español
                let synopsisText = a.synopsis || 'Sin sinopsis disponible.';
                const sinopsis = await traducirConCache(synopsisText, 'resumen');
                const sinopsisCorta = sinopsis.length > 300 ? sinopsis.substring(0, 300) + '...' : sinopsis;
                
                const generos = a.genres?.map(g => g.name).join(', ') || 'Desconocido';
                const caption = `🎲 *Anime al Azar:* ${a.title}\n\n⭐ *Calificación:* ${a.score || 'N/A'}/10\n🎭 *Géneros:* ${generos}\n📺 *Episodios:* ${a.episodes || '?'}\n📅 *Estado:* ${a.status || '?'}\n\n📖 *Sinopsis:*\n${sinopsisCorta}`;

                if (a.images?.jpg?.image_url) {
                    return sock.sendMessage(chatId, { image: { url: a.images.jpg.image_url }, caption }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
            } catch (e) { 
                console.error('❌ [random] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al obtener anime aleatorio.' }, { quoted: msg }); 
            }
        }

        if (start === '!trace') {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const media = msg.message?.imageMessage || quoted?.imageMessage;
            if (!media) return sock.sendMessage(chatId, { text: '🖼️ Responde a una imagen con !trace' });
            await sock.sendMessage(chatId, { text: '🔍 Buscando...' });
            try {
                const buffer = await downloadMediaMessage(quoted ? { message: quoted } : msg, 'buffer', {});
                const tres = await axios.post('https://api.trace.moe/search', buffer, { headers: { 'Content-Type': 'image/jpeg' } });
                const r = tres.data.result[0];
                return sock.sendMessage(chatId, { text: `🎞️ *ENCONTRADO!*\n📺 *Anime:* ${r.anilist?.title?.romaji || '?'}\n✅ *Similitud:* ${(r.similarity * 100).toFixed(2)}%` });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error.' }); }
        }

        if (start === '!news') {
            try {
                const res = await axios.get('https://somoskudasai.com/feed/');
                const items = (res.data.match(/<title>([\s\S]*?)<\/title>/g) || []).slice(2, 7);
                let m = '📰 *NOTICIAS ANIME*\n\n';
                items.forEach((title, i) => { m += `${i + 1}. *${title.replace(/<\/?title>|<!\[CDATA\[|\]\]>/g, '')}*\n`; });
                return sock.sendMessage(chatId, { text: m });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error.' }); }
        }

        if (start === '!wiki') {
            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '📖 Uso: !wiki <tema>' }, { quoted: msg });
            try {
                // Paso 1: Buscar el título correcto usando la API de búsqueda de Wikipedia
                const searchRes = await axios.get(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json`, { timeout: 8000 });
                const searchResults = searchRes.data?.query?.search;
                if (!searchResults || searchResults.length === 0) {
                    return sock.sendMessage(chatId, { text: `❌ No se encontró ningún artículo sobre *"${q}"* en Wikipedia.` }, { quoted: msg });
                }
                const pageTitle = searchResults[0].title;

                // Paso 2: Obtener el resumen con el título exacto (usando guiones bajos)
                const wikiTitle = pageTitle.replace(/ /g, '_');
                const res = await axios.get(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, { timeout: 8000 });
                const data = res.data;

                let wikiText = `📖 *WIKIPEDIA: ${data.title}*\n━━━━━━━━━━━━━━\n\n${data.extract}\n\n━━━━━━━━━━━━━━\n🔗 ${data.content_urls?.mobile?.page || ''}`;

                // Si hay imagen, enviar por URL directa (sin descargar buffer)
                if (data.thumbnail?.source) {
                    try {
                        return sock.sendMessage(chatId, { image: { url: data.thumbnail.source }, caption: wikiText }, { quoted: msg });
                    } catch (imgErr) {
                        return sock.sendMessage(chatId, { text: wikiText }, { quoted: msg });
                    }
                }
                return sock.sendMessage(chatId, { text: wikiText }, { quoted: msg });
            } catch (e) {
                console.error('❌ [wiki] Error:', e.message);
                return sock.sendMessage(chatId, { text: `❌ Error al buscar *"${q}"* en Wikipedia.` }, { quoted: msg });
            }
        }
    }
};

// ============================================================
//     REGISTRO DE VALIDACIONES (se hace DESPUÉS de cargar comandos)
// ============================================================

function registerMediaValidations(registerFn) {
    // Comandos que requieren término de búsqueda
    const searchCommands = ['!anime', '!personaje', '!estudio', '!manga', '!proximo', '!wiki'];
    searchCommands.forEach(cmd => {
        registerFn(cmd, {
            args: { min: 1 },
            query: { min: 2, max: 100, fieldName: 'Término de búsqueda' },
            usage: `${cmd} <nombre>`
        });
    });

    // Comandos que no requieren argumentos
    registerFn('!recomendar', { args: { min: 0, max: 0 } });
    registerFn('!random', { args: { min: 0, max: 0 } });
    registerFn('!estrenos', { args: { min: 0, max: 0 } });
    registerFn('!temporada', { args: { min: 0, max: 0 } });
    registerFn('!waifu', { args: { min: 0, max: 1 } });
}

module.exports.registerMediaValidations = registerMediaValidations;
