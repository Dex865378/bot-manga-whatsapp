/**
 * 🤖 DIKY BOT V3 - RENDER + TURSO EDITION
 * Motor: Baileys v7 | DB: Turso Cloud | Deploy: Render
 */
console.log('🚀 [CORE] El servidor Node.js ha arrancado correctamente.');
require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    downloadMediaMessage,
    getContentType,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const db = require('./database');
const { useTursoAuthState } = require('./turso-auth');
const handler = require('./commandHandler');
const { handleGameResponse } = require('./gameResponder');
const { handleMangaSession } = require('./mangaResponder');
const { handleNovelaSession } = require('./novelaResponder');
const execFileAsync = promisify(execFile);

// 🧰 Utils modularizados
const { LRUCache, fetchWithRetry, createLogger } = require('./utils');
const { CONFIG } = require('./config');

// Logger para el core
const logger = createLogger('core');

// --- CONFIG (Centralizada desde config/index.js) ---
const PORT = CONFIG.PORT;
const AUTH_DIR = CONFIG.AUTH_DIR;
const ADMIN_NUM = CONFIG.ADMIN_NUM;
const BOT_NUMBER = CONFIG.BOT_NUMBER;
const RENDER_URL = CONFIG.RENDER_URL;
const ADMIN_NUMBERS_CLEAN = (process.env.NUMERO_ADMIN || '')
    .split(',')
    .map(n => (n || '').split('@')[0].replace(/\D/g, ''))
    .filter(n => n && n.length >= 7);
const VERBOSE_LOGS = process.env.VERBOSE_LOGS === '1';
const FAST_COMMANDS = new Set(['!ping']); // !menu excluido para respetar el filtro de manga mode
const PAIRING_CODE_TTL_MS = Math.max(60000, parseInt(process.env.PAIRING_CODE_TTL_MS || '180000', 10));
const PAIRING_MIN_INTERVAL_MS = Math.max(60000, parseInt(process.env.PAIRING_MIN_INTERVAL_MS || '180000', 10));
const PAIRING_RATE_LIMIT_BACKOFF_MS = Math.max(300000, parseInt(process.env.PAIRING_RATE_LIMIT_BACKOFF_MS || '3600000', 10));
const PAIRING_METHOD = (process.env.PAIRING_METHOD || 'qr').toLowerCase();

let FFMPEG_PATH = 'ffmpeg';
try { FFMPEG_PATH = require('@ffmpeg-installer/ffmpeg').path; } catch (e) { }

// Punto 4: Caché de Administradores para máximo rendimiento
const adminCache = new Map();
const TTL_ADMIN = 10 * 60 * 1000; // 10 minutos
const cooldowns = new Map(); // ESCUDO ANTI-SPAM

// 🧹 Limpieza de cooldowns caducados cada 10 minutos (anti memory-leak)
setInterval(() => {
    const ahora = Date.now();
    const TTL_COOLDOWN = 5 * 60 * 1000; // 5 minutos = bien pasado cualquier cooldown
    let eliminados = 0;
    for (const [key, ts] of cooldowns.entries()) {
        if (ahora - ts > TTL_COOLDOWN) { cooldowns.delete(key); eliminados++; }
    }
    if (eliminados > 0 && VERBOSE_LOGS) console.log(`[GC] Cooldowns limpiados: ${eliminados} entradas | Restantes: ${cooldowns.size}`);
}, 15 * 60 * 1000);

// 🧹 Limpieza proactiva de cachés LRU cada 10 minutos (anti memory-leak en Render).
// Antes, las entradas expiradas por TTL solo se borraban cuando alguien las
// volvía a consultar (get/has). Si una clave nunca se repetía, quedaba ocupando
// RAM hasta que la evicción por tamaño la sacara. Este barrido activo evita eso.
setInterval(() => {
    if (typeof botState === 'undefined') return;
    const cachesLRU = [
        ['cacheTrad', botState.cacheTrad],
        ['mangaInfo', botState.mangaInfo], ['silenciados', botState.silenciados],
        ['bounties', botState.bounties], ['escudos', botState.escudos],
        ['groupCache', botState.groupCache], ['adminCache', botState.adminCache]
    ];
    let totalLimpiado = 0;
    for (const [nombre, cache] of cachesLRU) {
        if (cache && typeof cache.cleanup === 'function') {
            const n = cache.cleanup();
            totalLimpiado += n;
        }
    }
    // Barrido de sesiones interactivas y juegos sin TTL propio (5 min).
    // mangaSessions/novelaSessions solo se purgaban lazy al acceder; los chats
    // inactivos quedaban en RAM para siempre. juegos/duelos/propuestas son
    // objetos planos sin expiración y bloqueaban nuevos juegos si el usuario
    // abandonaba a mitad de partida.
    try {
        const ahora = Date.now();
        const TTL_SESION = 5 * 60 * 1000;
        const TTL_JUEGO = 10 * 60 * 1000;
        for (const [k, s] of botState.mangaSessions.entries()) {
            if (!s || ahora - (s.ts || 0) > TTL_SESION) botState.mangaSessions.delete(k);
        }
        for (const [k, s] of botState.novelaSessions.entries()) {
            if (!s || ahora - (s.ts || 0) > TTL_SESION) botState.novelaSessions.delete(k);
        }
        for (const [chatId, j] of Object.entries(botState.juegos)) {
            const ts = j && (j._ts || j.creadoEn || j.inicio);
            if (!j) delete botState.juegos[chatId];
            else if (ts && ahora - ts > TTL_JUEGO) delete botState.juegos[chatId];
            else if (!ts) j._ts = ahora; // primera vez visto: marcar para futuro barrido
        }
        for (const [k, d] of Object.entries(botState.duelos)) {
            if (d && d.expira && ahora > d.expira) delete botState.duelos[k];
        }
        for (const [k, p] of Object.entries(botState.propuestasBodas)) {
            if (p && p.expira && ahora > p.expira) delete botState.propuestasBodas[k];
        }
    } catch (e) { }
    if (totalLimpiado > 0 && VERBOSE_LOGS) console.log(`[GC] Cachés LRU limpiadas: ${totalLimpiado} entradas expiradas.`);
}, 10 * 60 * 1000);

let procesosActivos = 0; // LIMITADOR DE HARDWARE
const MAX_PROCESOS = 15; // Máximo de tareas pesadas simultáneas (aumentado para mejor rendimiento)
const colaHeavy = []; // Cola para tareas pesadas en espera
const MAX_COLA = 30; // Máximo de tareas encoladas (aumentado para grupos activos)

// ============================================================
//          COLA DE SALIDA (Anti rate-limit de WhatsApp)
// ============================================================
// El problema: si 20 usuarios usan comandos al mismo tiempo, el bot
// intenta mandar 20 mensajes simultáneos → WhatsApp devuelve 429.
// La solución: los mensajes salen en cola, 1 cada 250ms max.
// Así NADIE es bloqueado, pero los mensajes salen ordenados y seguros.
const colaSalida = new Map(); // chatId -> { cola: [], procesando: bool }
global.colaSalida = colaSalida; // Exponer para diagnósticos
const slowChats = new Map(); // chatId -> timestamp hasta cuando se reducen envios extra
const MAX_COLA_SALIDA = 50; // Límite máximo de mensajes en cola por chat

const SEND_MESSAGE_TIMEOUT_MS = Math.max(5000, parseInt(process.env.SEND_MESSAGE_TIMEOUT_MS || '25000', 10));

function sendMessageConTimeout(sock, chatId, content, options) {
    return Promise.race([
        sock.sendMessage(chatId, content, options || {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('sendMessage timeout')), SEND_MESSAGE_TIMEOUT_MS))
    ]);
}

function marcarChatLento(chatId) {
    slowChats.set(chatId, Date.now() + 5 * 60 * 1000);
}

function esChatLento(chatId) {
    const until = slowChats.get(chatId) || 0;
    if (until > Date.now()) return true;
    if (until) slowChats.delete(chatId);
    return false;
}

async function enviarConCola(sock, chatId, content, options) {
    if (!colaSalida.has(chatId)) {
        colaSalida.set(chatId, { cola: [], procesando: false, lastSendAt: 0, errors: 0 });
    }
    const estado = colaSalida.get(chatId);

    return new Promise((resolve, reject) => {
        // Si la cola está llena, descartar el mensaje más antiguo (evitar colapso)
        if (estado.cola.length >= MAX_COLA_SALIDA) {
            const dropped = estado.cola.shift();
            dropped.reject(new Error('Cola saturada - mensaje descartado'));
            if (VERBOSE_LOGS) console.log(`[COLA WARN] Chat ${chatId}: cola llena, mensaje descartado`);
        }
        estado.cola.push({ content, options, resolve, reject });
        if (!estado.procesando) procesarColaSalida(sock, chatId);
    });
}

async function procesarColaSalida(sock, chatId) {
    const estado = colaSalida.get(chatId);
    if (!estado || estado.procesando) return;
    estado.procesando = true;

    while (estado.cola.length > 0) {
        const { content, options, resolve, reject } = estado.cola.shift();
        try {
            const result = await sendMessageConTimeout(sock, chatId, content, options);
            estado.lastSendAt = Date.now();
            resolve(result);
        } catch (e) {
            estado.errors++;
            if (e.message === 'sendMessage timeout') {
                marcarChatLento(chatId);
                console.warn(`[COLA TIMEOUT] Chat ${chatId}: envio tardó mas de ${SEND_MESSAGE_TIMEOUT_MS}ms`);
            }
            // Si es rate-limit, reintentamos 1 vez después de 1 segundo
            if (e?.data === 429 || e?.message?.includes('rate-overlimit')) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const result = await sendMessageConTimeout(sock, chatId, content, options);
                    estado.lastSendAt = Date.now();
                    resolve(result);
                } catch (e2) { reject(e2); }
            } else {
                reject(e);
            }
        }
        // Pausa entre mensajes: ultra-dinámica según carga
        // 50ms modo turbo (>10 msgs), 100ms normal, 250ms protección flood
        let delayMs;
        if (estado.cola.length > 10) delayMs = 50;      // Modo turbo: cola colapsada
        else if (estado.cola.length > 5) delayMs = 100; // Normal
        else delayMs = 250;                             // Protección flood
        if (estado.cola.length > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    estado.procesando = false;
    // Limpiar colas vacías después de 30s para no acumular RAM
    setTimeout(() => {
        const e = colaSalida.get(chatId);
        if (e && e.cola.length === 0 && !e.procesando) colaSalida.delete(chatId);
    }, 30000);
}

// Helper: esperar turno en la cola de tareas pesadas
const RENDER_MAX_PROCESOS = Math.max(1, parseInt(process.env.MAX_PROCESOS || '9', 10));
const RENDER_MAX_COLA = Math.max(1, parseInt(process.env.MAX_COLA_HEAVY || '10', 10));

function esperarSlotHeavy() {
    return new Promise((resolve) => {
        if (procesosActivos < RENDER_MAX_PROCESOS) {
            procesosActivos++;
            return resolve(true);
        }
        if (colaHeavy.length >= RENDER_MAX_COLA) {
            return resolve(false); // Cola llena, rechazar
        }
        colaHeavy.push(resolve);
    });
}

function liberarSlotHeavy() {
    procesosActivos = Math.max(0, procesosActivos - 1);
    if (colaHeavy.length > 0) {
        const next = colaHeavy.shift();
        procesosActivos++;
        next(true);
    }
}
let errores401 = 0; // Contador de errores 401 consecutivos (solo nukear después de 3)

// ============================================================
//              WRITE-BEHIND CACHE (Batching de estadísticas)
// ============================================================
// En vez de escribir a Turso en cada comando, acumulamos en RAM y
// sincronizamos masivamente cada 2 minutos. Reduce tráfico de red ~90%.
const statsBatch = {
    comandos: new Map(),  // userId -> incremento acumulado
    rachas: new Set(),    // userIds que necesitan actualizar racha
    dirty: false
};

function batchRegistrarComando(userId) {
    statsBatch.comandos.set(userId, (statsBatch.comandos.get(userId) || 0) + 1);
    statsBatch.dirty = true;
}

function batchActualizarRacha(userId) {
    statsBatch.rachas.add(userId);
    statsBatch.dirty = true;
}

// --- Actividad por grupo (para !topactivos): conteo en RAM + flush en lote.
// Mapa acotado a 5000 entradas (chat::user) para no crecer sin control.
const actividadBatch = new Map();
function batchActividad(chatId, userId) {
    const k = `${chatId}::${userId}`;
    actividadBatch.set(k, (actividadBatch.get(k) || 0) + 1);
    if (actividadBatch.size > 5000) actividadBatch.delete(actividadBatch.keys().next().value);
    statsBatch.dirty = true;
}

async function flushStatsBatch() {
    if (!statsBatch.dirty) return;
    const comandosCopy = new Map(statsBatch.comandos);
    const rachasCopy = new Set(statsBatch.rachas);
    statsBatch.comandos.clear();
    statsBatch.rachas.clear();
    statsBatch.dirty = false;

    // Flush comandos en paralelo con concurrencia acotada (antes: secuencial N+1).
    // 100 usuarios = 200 roundtrips seguidos; ahora van de 5 en 5.
    const entries = [...comandosCopy.entries()];
    for (let i = 0; i < entries.length; i += 5) {
        await Promise.allSettled(entries.slice(i, i + 5).map(async ([userId, incremento]) => {
            const u = await db.obtenerUsuario(userId);
            if (u) await db.actualizarUsuario(userId, { total_comandos: (u.total_comandos || 0) + incremento });
        }));
    }

    // Flush rachas igual, de 5 en 5
    const rachas = [...rachasCopy];
    for (let i = 0; i < rachas.length; i += 5) {
        await Promise.allSettled(rachas.slice(i, i + 5).map((userId) => db.actualizarRacha(userId)));
    }

    // Flush actividad (!topactivos): insert/upsert directo, de 20 en 20
    if (actividadBatch.size > 0) {
        const acts = [...actividadBatch.entries()];
        actividadBatch.clear();
        for (let i = 0; i < acts.length; i += 20) {
            const lote = acts.slice(i, i + 20).map(([k, n]) => {
                const sep = k.lastIndexOf('::');
                return [k.slice(0, sep), k.slice(sep + 2), n];
            });
            await db.sumarActividadBatch(lote).catch(() => {});
        }
    }

    if (comandosCopy.size > 0) console.log(`📊 [Batch] Sincronizados ${comandosCopy.size} usuarios, ${rachasCopy.size} rachas.`);
}

// Flush automático cada 1 minuto (para grupos grandes, que se vea más rápido)
setInterval(flushStatsBatch, 1 * 60 * 1000);

// Flush al apagar el proceso para no perder datos
process.on('SIGTERM', async () => { await flushStatsBatch(); process.exit(0); });
process.on('SIGINT', async () => { await flushStatsBatch(); process.exit(0); });

// Normaliza un JID a solo dígitos para comparar (el formato varía: el JID
// de una mención puede venir como s.whatsapp.net y el del remitente como
// LID, o viceversa; comparar el string crudo falla y el mensaje se pierde).
function normJid(j) { return (j || '').split('@')[0].replace(/\D/g, ''); }

// Helper para prevenir saturación (Cooldown)
function verificarCooldown(userId, comando, ms = 3000) {
    const key = `${userId}-${comando}`;
    const ahora = Date.now();
    const last = cooldowns.get(key) || 0;
    if (ahora - last < ms) return Math.ceil((ms - (ahora - last)) / 1000);
    cooldowns.set(key, ahora);
    return 0;
}

// Caché en RAM de assets de bienvenida (evita fs.readFileSync por cada join)
let _bienvenidaCache = null;
function getBienvenidaAssets() {
    if (_bienvenidaCache) return _bienvenidaCache;
    try {
        const imgPath = path.join(__dirname, 'imagen_bienvenida.png');
        const stkPath = path.join(__dirname, 'sticker_bienvenida.webp');
        _bienvenidaCache = {
            img: fs.existsSync(imgPath) ? fs.readFileSync(imgPath) : null,
            stk: fs.existsSync(stkPath) ? fs.readFileSync(stkPath) : null
        };
    } catch (e) { _bienvenidaCache = { img: null, stk: null }; }
    return _bienvenidaCache;
}
// Usada por: group-participants.update (admin) y mensajes de sistema (sin admin)
// Rápida: config + portada se piden EN PARALELO (antes eran 2 viajes
// secuenciales a Turso) y el sticker sale sin bloquear (fire-and-forget).
async function enviarBienvenida(sock, groupId, participantJid) {
    try {
        const [conf, portadaDb, stickerDb] = await Promise.all([
            db.tieneBienvenida(groupId),
            db.getPortada('bienvenida', groupId).catch(() => null),
            db.getPortada('sticker_bienvenida', groupId).catch(() => null)
        ]);
        if (!conf.activa) {
            if (VERBOSE_LOGS) console.log(`[BIENVENIDA] omitida en ${groupId?.slice(-10)}: desactivada (usa !bienvenida on)`);
            return;
        }
        
        const nombre = participantJid.split('@')[0];
        
        let defaultMsg = `¡Hola @${nombre}! 🎉\nBienvenid@ al grupo.\n\n📜 Escribe *!menu* para ver todos los comandos.\n🎮 Hay juegos, stickers, anime y mucho más.\n\n¡Diviértete! 🐱✨`;
        let customMsg = conf.mensaje || defaultMsg;
        
        // Reemplazar variables
        customMsg = customMsg.replace(/{usuario}/gi, `@${nombre}`).replace(/{user}/gi, `@${nombre}`);
        
        // Agregar mención si no existe
        if (!customMsg.includes(`@${nombre}`)) {
            customMsg = `¡Hola @${nombre}!\n\n` + customMsg;
        }
        
        // Enviar imagen de bienvenida: portada configurada con !setportada
        // (cacheada en RAM) o la imagen por defecto. Imagen + texto en UN mensaje.
        let bienvenidaImg = portadaDb;
        if (!bienvenidaImg) bienvenidaImg = getBienvenidaAssets().img;
        let bienvenidaStk = stickerDb;
        if (!bienvenidaStk) bienvenidaStk = getBienvenidaAssets().stk;
        if (bienvenidaImg) {
            try {
                const captionFinal = `╔══════════════════════╗\n║    😺 *¡BIENVENID@!* 😺    ║\n╚══════════════════════╝\n\n${customMsg}`;
                await sock.sendMessage(groupId, {
                    image: bienvenidaImg,
                    caption: captionFinal,
                    mentions: [participantJid]
                });
                console.log(`📸 Bienvenida enviada a ${nombre}`);
            } catch (eImg) {
                console.error(`❌ Error imagen bienvenida:`, eImg.message);
                await sock.sendMessage(groupId, { text: customMsg, mentions: [participantJid] });
            }
        } else {
            await sock.sendMessage(groupId, { text: customMsg, mentions: [participantJid] });
        }
        
        // Sticker de regalo SIN bloquear: sale en segundo plano mientras el
        // bot ya quedó libre (antes esperaba 1.5s fijos aquí).
        if (bienvenidaStk) {
            sock.sendMessage(groupId, { sticker: bienvenidaStk }).catch(eStk => {
                console.error(`❌ Error sticker bienvenida:`, eStk.message);
            });
        }
    } catch (e) {
        console.error('❌ Error en enviarBienvenida:', e.message);
    }
}

// Deduplicador de despedidas (igual que bienvenidas, mapa propio).
const farewellDedup = new Map();
function yaDespedido(groupId, user) {
    const key = `${groupId}:${(user || '').split('@')[0]}`;
    const ahora = Date.now();
    const ts = farewellDedup.get(key);
    if (ts && (ahora - ts < 10 * 60 * 1000)) return true;
    farewellDedup.set(key, ahora);
    if (farewellDedup.size > 500) farewellDedup.delete(farewellDedup.keys().next().value);
    return false;
}

// Despedida al salir alguien (con portada + texto en UN mensaje).
// Rápida: config + portada en paralelo (igual que la bienvenida).
async function enviarDespedida(sock, groupId, participantJid) {
    try {
        const [conf, portadaDb] = await Promise.all([
            db.tieneDespedida(groupId),
            db.getPortada('despedida', groupId).catch(() => null)
        ]);
        if (!conf.activa) {
            if (VERBOSE_LOGS) console.log(`[DESPEDIDA] omitida: desactivada (usa !despedida on)`);
            return;
        }
        const nombre = (participantJid || '').split('@')[0];
        let customMsg = conf.mensaje || `Adiós @${nombre} 👋\nSe salió del grupo.`;
        customMsg = customMsg.replace(/{usuario}/gi, `@${nombre}`).replace(/{user}/gi, `@${nombre}`);
        if (!customMsg.includes(`@${nombre}`)) customMsg = `Adiós @${nombre} 👋\n\n` + customMsg;

        let img = portadaDb;
        if (!img) img = getBienvenidaAssets().img;
        if (img) {
            try {
                await sock.sendMessage(groupId, { image: img, caption: customMsg, mentions: [participantJid] });
                console.log(`👋 Despedida enviada a ${nombre}`);
                return;
            } catch (eImg) {
                console.error(`❌ Error imagen despedida:`, eImg.message);
            }
        }
        await sock.sendMessage(groupId, { text: customMsg, mentions: [participantJid] });
    } catch (e) {
        console.error('❌ Error en enviarDespedida:', e.message);
    }
}

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// --- ESTADO GLOBAL ---
const botState = {
    pairingCode: null,
    pairingCodeAt: 0,
    nextPairingRequestAt: 0,
    pairingFailures: 0,
    qrDataUrl: null,
    qrAt: 0,
    lastDisconnectCode: null,
    lastDisconnectReason: '',
    status: 'Iniciando...',
    isConnected: false,
    startTime: Date.now(),
    msgCount: 0,
    juegos: {},       // Para trivias y ahorcado (se limpian al terminar)
    duelos: {},       // Retos de duelo pendientes { targetJid: { retador, apuesta, expira } }
    propuestasBodas: {}, // Propuestas de matrimonio pendientes { targetJid: { de, expira } }
    afkCache: new Map(), // userId → { motivo, ts } (espejo RAM de la tabla afk, se pierde en reinicio)
    modoAdmin: {},    // Grupos con modo solo-admins activo
    
    // 🧠 Cachés LRU con límites desde CONFIG (anti memory-leak)
    cacheTrad: new LRUCache(CONFIG.CACHE.TRADUCCIONES.max, CONFIG.CACHE.TRADUCCIONES.ttl),
    mangaInfo: new LRUCache(CONFIG.CACHE.MANGA_INFO.max, CONFIG.CACHE.MANGA_INFO.ttl),
    silenciados: new LRUCache(CONFIG.CACHE.SILENCIADOS.max, CONFIG.CACHE.SILENCIADOS.ttl),
    
    antiSpam: {
        active: CONFIG.FEATURES.ANTI_SPAM,
        limit: 100,
        interval: 60 * 60 * 1000,
        banTime: 2 * 60 * 60 * 1000,
        tracker: new Map()
    },
    seConectoAlgunaVez: false,
    instanceId: Math.random().toString(36).substring(7).toUpperCase(),
    bounties: new LRUCache(CONFIG.CACHE.TRADUCCIONES.max, 7 * 24 * 60 * 60 * 1000),
    escudos: new LRUCache(200, 24 * 60 * 60 * 1000),
    groupCache: new LRUCache(CONFIG.CACHE.GROUP_CONFIG.max, CONFIG.CACHE.GROUP_CONFIG.ttl),
    adminCache: new LRUCache(CONFIG.CACHE.ADMIN_CACHE.max, CONFIG.CACHE.ADMIN_CACHE.ttl),
    mangaMode: new Map(), // chatId → true/false para modo manga exclusivo
    mangaSessions: new Map(), // `${chatId}_${sender}` → { tempCode, titulo, genero, step, ts }
    novelaSessions: new Map(), // `${chatId}_${sender}` → { titulo, generoEs, step, ts } - para !reconovela
};

const TTL_CONFIG = 5 * 60 * 1000; // 5 minutos para caché de config
// Throttle de groupMetadata: si el cache de admins expiró, no disparar 1
// fetch por mensaje (tormenta en grupos activos) sino máx 1 cada 60s por chat.
const adminFetchAt = new Map();
const ADMIN_FETCH_MIN_MS = 60 * 1000;

// Helper para obtener configuración de grupo con caché LRU
async function obtenerConfigGrupo(chatId) {
    const cached = botState.groupCache.get(chatId);
    if (cached) return cached;

    try {
        const active = await db.estaGrupoActivo(chatId);

        const config = { active };
        botState.groupCache.set(chatId, config);
        return config;
    } catch (e) {
        return { active: null };
    }
}

// --- HELPERS DE TRADUCCION ---
// Sistema LRU para caché de traducciones (elimina las más viejas gradualmente)
const cacheTradLRU = new Map();
const MAX_TRAD_CACHE = 200;

function getCacheTrad(key) {
    if (!cacheTradLRU.has(key)) return null;
    // Mover al final (más reciente) para LRU
    const val = cacheTradLRU.get(key);
    cacheTradLRU.delete(key);
    cacheTradLRU.set(key, val);
    return val;
}

function setCacheTrad(key, val) {
    if (cacheTradLRU.has(key)) cacheTradLRU.delete(key);
    cacheTradLRU.set(key, val);
    // Eliminar solo las más viejas si pasamos el límite (gradual, no nuke)
    while (cacheTradLRU.size > MAX_TRAD_CACHE) {
        const oldest = cacheTradLRU.keys().next().value;
        cacheTradLRU.delete(oldest);
    }
}

async function traducirConCache(texto, tipo = 'resumen') {
    if (!texto) return '';

    const cacheKey = `${tipo}:${texto.substring(0, 50).replace(/\s/g, '_')}`;
    const cached = getCacheTrad(cacheKey);
    if (cached) return cached;

    const textoRecortado = texto.substring(0, 1000);

    // Google Translate endpoint principal (translate.googleapis.com)
    try {
        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(textoRecortado)}`, { timeout: 8000 });
        const traducido = res.data[0].map(x => x[0]).join('').trim();
        if (traducido) {
            setCacheTrad(cacheKey, traducido);
            return traducido;
        }
    } catch (e) {
        console.error('[TRADUCCION] Endpoint principal fallo, probando endpoint alterno:', e.message);
    }

    // Intento 2: Google Translate endpoint alterno (translate.google.com, a veces
    // responde cuando translate.googleapis.com esta rate-limited)
    try {
        const res2 = await axios.get(`https://translate.google.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(textoRecortado)}`, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const traducido2 = res2.data[0].map(x => x[0]).join('').trim();
        if (traducido2) {
            setCacheTrad(cacheKey, traducido2);
            return traducido2;
        }
    } catch (e2) {
        console.error('[TRADUCCION] Endpoint alterno tambien fallo, se enviara texto original en ingles:', e2.message);
    }

    // Intento 3: MyMemory (gratis, sin key). Los endpoints gtx de Google dan
    // 429 muy seguido desde IPs de datacenter (Render), asi que este es el
    // que realmente salva la traduccion en produccion. Limite ~500
    // caracteres por pedido: se parte en trozos por palabras.
    try {
        const traducido3 = await traducirMyMemory(textoRecortado);
        if (traducido3) {
            setCacheTrad(cacheKey, traducido3);
            return traducido3;
        }
    } catch (e3) {
        console.error('[TRADUCCION] MyMemory tambien fallo, se enviara texto original en ingles:', e3.message);
    }

    // Ultimo recurso: texto original (en ingles) recortado
    return texto.substring(0, 200) + '...';
}

// Parte el texto en trozos de max N caracteres sin cortar palabras
function partirEnTrozos(texto, max = 450) {
    const trozos = [];
    let resto = texto;
    while (resto.length > max) {
        let corte = resto.lastIndexOf(' ', max);
        if (corte < max * 0.5) corte = max; // palabra larguisima: cortar duro
        trozos.push(resto.slice(0, corte));
        resto = resto.slice(corte).trim();
    }
    if (resto) trozos.push(resto);
    return trozos;
}

async function traducirMyMemory(texto) {
    const trozos = partirEnTrozos(texto);
    const traducidos = [];
    for (const t of trozos) {
        const res = await axios.get('https://api.mymemory.translated.net/get', {
            params: { q: t, langpair: 'en|es' },
            timeout: 10000
        });
        const status = res.data?.responseStatus;
        const txt = res.data?.responseData?.translatedText;
        if (status !== 200 || !txt) throw new Error('MyMemory status ' + status);
        traducidos.push(txt.trim());
        if (trozos.length > 1) await new Promise(r => setTimeout(r, 500)); // no saturar cuota
    }
    return traducidos.join(' ').trim() || null;
}

// --- Fallback local para mangas (cacheado: evita readFileSync por mensaje) ---
let _mangasCache = null;
let _mangasCacheMtime = 0;
function cargarMangasLocal() {
    try {
        const f = path.join(__dirname, 'mangas.json');
        if (!fs.existsSync(f)) return [];
        const st = fs.statSync(f);
        if (_mangasCache && st.mtimeMs === _mangasCacheMtime) return _mangasCache;
        _mangasCache = JSON.parse(fs.readFileSync(f, 'utf8'));
        _mangasCacheMtime = st.mtimeMs;
        return _mangasCache;
    } catch (e) { return _mangasCache || []; }
}

// ============================================================
//              DASHBOARD HTTP (nativo, sin express)
// ============================================================
// Solo 3 rutas (/, /health, /reset-session): express (~20MB baseline en
// 512MB) era sobredimensionado. http nativo hace lo mismo.
const http = require('http');

function dashboardHandler(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const sendJson = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
    };

    if (url.pathname === '/' && req.method === 'GET') {
        const up = Math.floor((Date.now() - botState.startTime) / 1000);
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
        const dbBadge = db.isConnected()
            ? '<span style="background:#166534;color:#4ade80;padding:2px 8px;border-radius:10px">TURSO ✅</span>'
            : '<span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:10px">LOCAL 📁</span>';
        const statusHtml = botState.isConnected
            ? '<p style="color:#22c55e;font-size:1.5em">✅ BOT ONLINE</p>'
            : botState.pairingCode
                ? `<p style="color:#94a3b8">CÓDIGO DE VINCULACIÓN:</p>
                   <p style="font-size:3em;letter-spacing:10px;color:#facc15;font-weight:bold">${botState.pairingCode}</p>
                   <p style="color:#64748b;font-size:0.8em">WhatsApp → Dispositivos vinculados → Vincular con número</p>`
                : `<p style="color:#eab308;font-size:1.2em">⏳ ${botState.status}</p>`;

        const qrHtml = (!botState.isConnected && botState.qrDataUrl)
            ? `<div style="margin-top:16px">
                   <p style="color:#94a3b8;margin-bottom:8px">QR DE VINCULACION:</p>
                   <img src="${botState.qrDataUrl}" alt="QR WhatsApp" style="background:#fff;padding:10px;border-radius:10px;max-width:260px;width:100%;display:block;margin:0 auto">
                   <p style="color:#64748b;font-size:0.8em;margin-top:8px">WhatsApp -> Dispositivos vinculados -> Vincular dispositivo</p>
               </div>`
            : '';

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Diky Bot</title>
    <meta http-equiv="refresh" content="5"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .c{background:#1e293b;padding:40px;border-radius:20px;border:1px solid #334155;max-width:500px;width:90%;text-align:center}
    h1{color:#38bdf8;margin-bottom:20px}
    .sb{background:#0f172a;padding:25px;border-radius:15px;margin:15px 0;border:2px solid ${botState.isConnected ? '#22c55e' : '#eab308'}}
    .st{text-align:left;margin-top:20px;font-size:0.9em;color:#94a3b8}
    .st p{padding:5px 0;border-bottom:1px solid #334155}
    .st b{color:#e2e8f0}
    </style></head><body><div class="c">
    <h1>😺 Diky Bot V3</h1>
    <div class="sb">${statusHtml}${qrHtml}</div>
    <div class="st">
        <p>⏱️ <b>Uptime:</b> ${h}h ${m}m ${s}s</p>
        <p>📨 <b>Mensajes:</b> ${botState.msgCount}</p>
        <p>☁️ <b>DB:</b> ${dbBadge}</p>
        <p>🔧 <b>Admin:</b> ${ADMIN_NUM || '⚠️'}</p>
        <p><b>Ultimo error:</b> ${botState.lastDisconnectCode || '-'} ${botState.lastDisconnectReason || ''}</p>
    </div></div></body></html>`);
        return;
    }

    if (url.pathname === '/health' && req.method === 'GET') {
        const mem = process.memoryUsage();
        const queues = [...colaSalida.entries()].map(([chatId, state]) => ({
            chatId,
            size: state.cola.length,
            procesando: state.procesando,
            slow: esChatLento(chatId),
            errors: state.errors || 0,
            lastSendAgoMs: state.lastSendAt ? Date.now() - state.lastSendAt : null
        }));
        sendJson(200, {
            ok: true,
            connected: botState.isConnected,
            memMB: {
                rss: +(mem.rss / 1048576).toFixed(1),
                heapUsed: +(mem.heapUsed / 1048576).toFixed(1),
                heapTotal: +(mem.heapTotal / 1048576).toFixed(1)
            },
            queues
        });
        return;
    }

    if (url.pathname === '/reset-session' && req.method === 'GET') {
        const token = process.env.RESET_SESSION_TOKEN;
        if (!token || url.searchParams.get('token') !== token) {
            sendJson(403, { ok: false, error: 'RESET_SESSION_TOKEN invalido o no configurado' });
            return;
        }
        resetAuthSession('dashboard reset').then(() => {
            sendJson(200, { ok: true, message: 'Sesion de WhatsApp borrada. Render reiniciara el bot.' });
            setTimeout(() => process.exit(0), 800);
        }).catch((e) => sendJson(500, { ok: false, error: e.message }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
}

async function resetAuthSession(reason = 'manual reset') {
    try { await db.init(); } catch (e) { }
    await db.nukeSession().catch(() => { });
    if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    botState.isConnected = false;
    botState.pairingCode = null;
    botState.qrDataUrl = null;
    botState.qrAt = 0;
    botState.status = 'Sesion borrada. Reiniciando...';
    console.log(`[AUTH RESET] ${reason}`);
}

http.createServer(dashboardHandler).listen(PORT, '0.0.0.0', () => console.log(`🌐 Dashboard en puerto ${PORT}`));

// ============================================================
//                     STICKER UTILS
// ============================================================
async function convertirAWebp(buffer, isVideo = false) {
    const ext = isVideo ? 'mp4' : 'png';
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpIn = path.join(os.tmpdir(), `stk_in_${uid}.${ext}`);
    const tmpOut = path.join(os.tmpdir(), `stk_out_${uid}.webp`);
    fs.writeFileSync(tmpIn, buffer);
    try {
        const vf = 'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0,format=yuva420p';
        const args = isVideo
            ? ['-i', tmpIn, '-vf', vf + ',fps=10', '-vcodec', 'libwebp', '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', '-t', '6', '-quality', '50', '-compression_level', '3', '-y', tmpOut]
            : ['-i', tmpIn, '-vf', vf, '-quality', '75', '-compression_level', '4', '-y', tmpOut];
        await execFileAsync(FFMPEG_PATH, args, { timeout: 15000, windowsHide: true });
        return fs.readFileSync(tmpOut);
    } catch (e) {
        console.error('❌ [Sticker]', e.message);
        return null;
    } finally {
        try { fs.unlinkSync(tmpIn); } catch (e) { }
        try { fs.unlinkSync(tmpOut); } catch (e) { }
    }
}

// ============================================================
//                     BOT PRINCIPAL
// ============================================================
// Guard contra timers duplicados en reconexiones (fuga RAM en 512MB):
// startBot() se re-ejecuta en cada reconnect; sin esto cada setInterval
// se duplicaba y acumulaba queries + closures con sock viejo.
function onceInterval(key, fn, ms) {
    if (!global.__botTimers) global.__botTimers = {};
    if (global.__botTimers[key]) clearInterval(global.__botTimers[key]);
    global.__botTimers[key] = setInterval(fn, ms);
    return global.__botTimers[key];
}
// Guard anti-sockets-duplicados (causa del 440 conflict): si startBot se
// re-ejecuta mientras el socket anterior sigue vivo, se cierra el viejo antes
// de crear el nuevo; y los reintentos de reconexión se programan una sola vez.
let activeSock = null;
let reconnectTimer = null;
function scheduleReconnect(ms, motivo) {
    botState.status = motivo;
    if (reconnectTimer) {
        if (VERBOSE_LOGS) console.log(`⏳ Reconnect ya programado, se ignora (${motivo})`);
        return;
    }
    console.log(`🔄 Reconectando en ${Math.round(ms / 1000)}s... (${motivo})`);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; startBot(); }, ms);
}
// ============================================================
async function startBot() {
    botState.status = 'Cargando motor...';
    console.log('🚀 Iniciando Diky Bot V3...');

    await db.init();
    handler.loadCommands(); // Punto 1: Carga dinámica de módulos

    // Auth: Turso Cloud → fallback local
    let authState, saveCreds;
    const tursoAuth = await useTursoAuthState();
    if (tursoAuth) {
        console.log('🔐 Auth: Turso Cloud');
        authState = tursoAuth.state;
        saveCreds = tursoAuth.saveCreds;
    } else {
        console.log('📁 Auth: Local (.bot_session)');
        const local = await useMultiFileAuthState(AUTH_DIR);
        authState = local.state;
        saveCreds = local.saveCreds;
    }

    // Obtener la versión más reciente del protocolo WA Web (SOLUCIONA ERROR 405)
    let waVersion;
    try {
        const { version } = await fetchLatestBaileysVersion();
        waVersion = version;
        console.log(`📡 Versión WA Web: ${version.join('.')}`);
    } catch (e) {
        console.warn('⚠️ No se pudo obtener versión WA, usando default');
        waVersion = undefined;
    }

    // Cerrar socket anterior si sigue vivo (evita 2 sockets con la misma
    // sesión = error 440 conflict que deja al bot sordo).
    if (activeSock) {
        try { activeSock.end(undefined); } catch (e) { }
        activeSock = null;
    }

    // Crear socket con versión dinámica + tolerancia para Render
    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }),
        browser: Browsers.macOS('Chrome'),
        version: waVersion,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false, // Ahorra CPU y RAM
        getMessage: async () => undefined // No retener mensajes viejos en RAM
    });
    activeSock = sock;

    const needsPairingCode = PAIRING_METHOD === 'code' && !sock.authState.creds.registered && BOT_NUMBER;
    let pairingRequested = false;

    // PRIMERO registrar event handlers
    sock.ev.on('creds.update', saveCreds);

    // --- CONEXIÓN ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                botState.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
                botState.qrAt = Date.now();
                if (!botState.pairingCode) botState.status = 'QR listo para vincular.';
            } catch (e) {
                console.error('[QR] Error generando QR:', e.message);
            }
        }

        // Si recibimos QR y necesitamos pairing, pedirlo ahora
        if (qr && needsPairingCode && !pairingRequested) {
            const now = Date.now();
            const waitMs = botState.nextPairingRequestAt - now;
            if (waitMs > 0) {
                const waitMin = Math.ceil(waitMs / 60000);
                botState.status = `WhatsApp bloqueo codigos. Espera ${waitMin} min.`;
                if (VERBOSE_LOGS) console.log(`[PAIRING] En backoff, faltan ${waitMin} min.`);
                return;
            }

            // Si ya tenemos un código activo, no pedir otro tan rápido
            if (botState.pairingCode && (now - botState.pairingCodeAt < PAIRING_CODE_TTL_MS)) {
                console.log('♻️ Usando código existente:', botState.pairingCode);
                botState.status = `Vincula con: ${botState.pairingCode}`;
                return;
            }
            botState.pairingCode = null;

            pairingRequested = true;
            const phoneClean = BOT_NUMBER.replace(/[^0-9]/g, '');
            console.log(`📱 Solicitando código de vinculación para: ${phoneClean}...`);
            botState.status = `Generando para ${phoneClean}...`;

            try {
                // Esperar 5 segundos para asegurar que el socket esté totalmente listo
                await delay(5000);
                const code = await sock.requestPairingCode(phoneClean);
                botState.pairingCode = code;
                botState.pairingCodeAt = Date.now();
                botState.nextPairingRequestAt = botState.pairingCodeAt + PAIRING_MIN_INTERVAL_MS;
                botState.pairingFailures = 0;
                console.log('🔑 ¡NUEVO CÓDIGO GENERADO!:', code);
                botState.status = `VINCULAR CON: ${code}`;
            } catch (e) {
                console.error('❌ Error al solicitar código:', e.message);
                pairingRequested = false;
                botState.pairingFailures++;
                const isRateLimit = e.message.includes('rate-overlimit') || e.message.includes('too many') || e.message.includes('429');
                const backoffMs = isRateLimit
                    ? PAIRING_RATE_LIMIT_BACKOFF_MS
                    : Math.min(PAIRING_MIN_INTERVAL_MS * botState.pairingFailures, PAIRING_RATE_LIMIT_BACKOFF_MS);
                botState.nextPairingRequestAt = Date.now() + backoffMs;
                const waitMin = Math.ceil(backoffMs / 60000);
                botState.status = `WhatsApp rechazo el codigo. Espera ${waitMin} min.`;
                console.log(`[PAIRING] Pausa ${waitMin} min para evitar bloqueo de WhatsApp.`);
            }
        }

        if (connection === 'open') {
            console.log('✅ BOT CONECTADO');
            botState.isConnected = true;
            botState.pairingCode = null;
            botState.qrDataUrl = null;
            botState.qrAt = 0;
            botState.status = 'Online';
            botState.seConectoAlgunaVez = true; // Marcar que SÍ logró conectarse
            errores401 = 0; // Reset del contador de errores al conectar exitosamente

            // 🔄 Cargar comandos explícitamente (evita problemas de carga circular)
            handler.loadCommands();

            // 🔄 Registrar validaciones de comandos (después de cargar todos los comandos)
            handler.registerAllValidations();

            // --- GESTOR DE SUBASTAS (Segundo Plano) ---
            onceInterval('subastas', async () => {
                try {
                    if (!db.isConnected()) return;
                    const subastas = await db.obtenerSubastasActivas();
                    const ahora = Date.now();
                    for (const s of subastas) {
                        if (ahora > s.end_time) {
                            await db.finalizarSubasta(s.id);
                            if (s.highest_bidder_id) {
                                // Hay ganador. Intentamos cobrar.
                                const bidderOk = await db.deducirMonedas(s.highest_bidder_id, s.current_bid);
                                if (bidderOk) {
                                    await db.sumarMonedas(s.seller_id, s.current_bid);
                                    await db.agregarItem(s.highest_bidder_id, s.item_name, 1);
                                    if (s.chat_id) {
                                        sock.sendMessage(s.chat_id, {
                                            text: `⚖️ **¡SUBASTA FINALIZADA!**\n━━━━━━━━━━━━━━\n📦 Objeto: *${s.item_name.toUpperCase()}*\n🏆 Ganador: @${s.highest_bidder_id.split('@')[0]}\n💰 Precio final: *${s.current_bid}* diky\n━━━━━━━━━━━━━━\n¡Felicidades al nuevo dueño!`,
                                            mentions: [s.highest_bidder_id]
                                        }).catch(() => { });
                                    }
                                } else {
                                    await db.agregarItem(s.seller_id, s.item_name, 1);
                                    if (s.chat_id) {
                                        sock.sendMessage(s.chat_id, { text: `⚖️ La subasta #${s.id} (*${s.item_name}*) se canceló porque el ganador (@${s.highest_bidder_id.split('@')[0]}) no tenía dinero al finalizar. Objeto devuelto al vendedor.`, mentions: [s.highest_bidder_id] }).catch(() => { });
                                    }
                                }
                            } else {
                                await db.agregarItem(s.seller_id, s.item_name, 1);
                                if (s.chat_id) {
                                    sock.sendMessage(s.chat_id, { text: `⚖️ La subasta #${s.id} (*${s.item_name}*) terminó sin ofertas. Objeto devuelto al vendedor.` }).catch(() => { });
                                }
                            }
                        }
                    }
                } catch (e) { console.error('Error en intervalo subastas:', e); }
            }, 60000);

            // --- RECORDATORIOS (!recordar): revisa vencidos cada 30s ---
            // Liviano: 1 query con LIMIT 10, solo envía los vencidos.
            onceInterval('recordatorios', async () => {
                try {
                    if (!db.isConnected()) return;
                    const vencidos = await db.recordatoriosVencidos(Date.now(), 10);
                    for (const r of vencidos) {
                        if (!r.chat_id) continue;
                        await sock.sendMessage(r.chat_id, {
                            text: `⏰ *¡RECORDATORIO!*\n━━━━━━━━━━━━━━\n@${(r.user_id || '').split('@')[0]}: ${r.texto}`,
                            mentions: r.user_id ? [r.user_id] : []
                        }).catch(() => { });
                    }
                } catch (e) { console.error('Error en intervalo recordatorios:', e.message); }
            }, 30000);

            // Sincronización automática de mangas (Silenciosa)
            const local = cargarMangasLocal();
            if (local.length > 0 && db.isConnected()) {
                console.log('🔄 Sincronizando catálogo con la DB...');
                for (const m of local) {
                    await db.guardarManga(m.codigo, m.titulo, m.carpeta, m.resumen, m.generos);
                }
            }
            // Heartbeat: Guardar credenciales cada 10 minutos para asegurar persistencia
            onceInterval('heartbeat', async () => {
                if (botState.isConnected && saveCreds) {
                    try {
                        await saveCreds();
                        console.log('💓 Heartbeat: Sesión sincronizada con Turso.');
                    } catch (e) { }
                }
            }, 10 * 60 * 1000);
        }

        if (connection === 'close') {
            botState.isConnected = false;
            const error = lastDisconnect?.error;
            const code = (new Boom(error))?.output?.statusCode;
            botState.lastDisconnectCode = code || null;
            botState.lastDisconnectReason = (error?.message || 'Sin mensaje').slice(0, 180);
            console.log(`🔌 Conexión cerrada. Código: ${code} | Razón: ${error?.message || 'Sin mensaje'}`);
            if (code === 440) {
                console.log('⚠️ 440 conflict: otra instancia tiene esta misma sesión abierta (2 deploys solapados u otro proceso con la misma cuenta). Esa otra copia debe apagarse o se seguirán pateando.');
            }

            if (code === DisconnectReason.loggedOut || code === 401) {
                // Punto de mejora: No borrar la sesión al primer fallo 401 si nunca se conectó.
                // Podría ser un error temporal de red o de Turso.

                errores401++;
                console.log(`⚠️ Desconexión 401/Logout #${errores401}/5`);

                if (errores401 >= 5 || code === DisconnectReason.loggedOut) {
                    console.log('🚪 Sesión definitivamente muerta o Logout manual. Limpiando...');
                    errores401 = 0;
                    botState.seConectoAlgunaVez = false;
                    await resetAuthSession('logout/401');
                    console.log('🔄 Reiniciando en 10s con sesión limpia...');
                    scheduleReconnect(10000, 'Reiniciando con sesión limpia...');
                    return;
                }

                // Reconectar con espera gradual más larga para proteger la base de datos
                const waitTime = Math.min(errores401 * 20000, 60000); // Max 1 minuto
                botState.status = `Error 401 (${errores401}/5). Reintentando...`;
                scheduleReconnect(waitTime, `Error 401 (${errores401}/5). Reintentando...`);
                return;
            }

            // Resetéar contador de 401 cuando el error es diferente
            errores401 = 0;

            // Si hay código de pairing activo, reconectar SIN borrar nada
            if (botState.pairingCode) {
                console.log(`⏳ Código activo (${botState.pairingCode}), reconectando...`);
                botState.status = `Código: ${botState.pairingCode} - ¡Ingresalo ya!`;
                const waitMs = Math.max(PAIRING_CODE_TTL_MS - (Date.now() - botState.pairingCodeAt), 30000);
                botState.nextPairingRequestAt = Date.now() + waitMs;
                scheduleReconnect(waitMs, `Código: ${botState.pairingCode} - ¡Ingresalo ya!`);
                return;
            }

            // Reconexión normal para cualquier otro error
            const reason = code || 'Desconocido';
            botState.status = `Reconectando... (Error: ${reason})`;
            scheduleReconnect(code === 440 ? 15000 : 8000, `Reconectando... (Error: ${reason})`);
        }
    });

    // 🔒 Deduplicación de mensajes: WhatsApp/Baileys puede reenviar el mismo
    // mensaje reciente en el evento messages.upsert tras una reconexion del
    // socket (keepalive de WhatsApp, blips de red, etc.), incluso con el
    // proceso Node corriendo 24/7 sin parar. Sin este filtro, el bot procesaba
    // el mismo comando dos veces en paralelo, causando ejecuciones dobles y
    // el tipico "mensaje + error de que no se pudo ejecutar" por choque de
    // candados/sesiones entre ambas ejecuciones simultaneas.
    const mensajesProcesadosIds = new Map(); // msg.key.id -> timestamp
    const TTL_DEDUP_MS = 2 * 60 * 1000; // 2 minutos es de sobra para cualquier reenvio

    // Deduplicador de bienvenidas: el mismo join puede llegar por 2 vías
    // (messageStubType en upsert + evento group-participants.update). Ventana
    // de 10 min por grupo+usuario para saludar una sola vez.
    const welcomeDedup = new Map(); // `${groupId}:${user}` -> timestamp
    const TTL_WELCOME_DEDUP_MS = 10 * 60 * 1000;
    function yaSaludado(groupId, user) {
        const key = `${groupId}:${(user || '').split('@')[0]}`;
        const ahora = Date.now();
        const ts = welcomeDedup.get(key);
        if (ts && (ahora - ts < TTL_WELCOME_DEDUP_MS)) return true;
        welcomeDedup.set(key, ahora);
        if (welcomeDedup.size > 500) {
            const oldest = welcomeDedup.keys().next().value;
            welcomeDedup.delete(oldest);
        }
        return false;
    }
    // Normaliza un participante que puede venir como JID string, JSON string
    // (messageStubParameters) u objeto { phoneNumber } de Baileys.
    function normWelcomeJid(p) {
        if (!p) return null;
        if (typeof p === 'string') {
            const t = p.trim();
            if (t.startsWith('{')) {
                try {
                    const o = JSON.parse(t);
                    if (o && o.phoneNumber) return o.phoneNumber;
                } catch (_) { return null; }
            }
            return t.includes('@') ? t : `${t}@s.whatsapp.net`;
        }
        if (typeof p === 'object') return p.phoneNumber || p.id || null;
        return null;
    }

    onceInterval('dedup-cleaner', () => {
        const ahora = Date.now();
        for (const [id, ts] of mensajesProcesadosIds.entries()) {
            if (ahora - ts > TTL_DEDUP_MS) mensajesProcesadosIds.delete(id);
        }
    }, 5 * 60 * 1000);

    // --- MENSAJES ---
    sock.ev.on('messages.upsert', async (upsert) => {
        // CRÍTICO: Solo procesar mensajes NUEVOS. 'append' es historial de WhatsApp y causa
        // respuestas duplicadas o perdidas. Sin este filtro, el bot procesa mensajes viejos
        // como si fueran nuevos cada vez que reconecta.
        if (upsert.type !== 'notify') return;

        const messages = upsert.messages || [];
        const ahora = Math.floor(Date.now() / 1000);

        for (const msg of messages) {
            if (!msg.message) continue;

            // IGNORAR mensajes extremadamente viejos (más de 5 minutos) para evitar lag
            const msgTime = msg.messageTimestamp;
            if (ahora - msgTime > 300) continue;

            // Detectar uniones al grupo por stub (funciona sin ser admin).
            // Estos avisos suelen venir SIN msg.message (solo stub), así que se
            // revisan ANTES del filtro `if (!msg.message)`. Tipos según
            // Baileys WAProto: 27=ADD, 31=INVITE, 71=ADD_REQUEST_JOIN.
            const remoteJidStub = msg.key.remoteJid;
            if (remoteJidStub?.endsWith('@g.us') && [27, 31, 71].includes(msg.messageStubType)) {
                const partes = (msg.messageStubParameters || []).map(normWelcomeJid).filter(Boolean);
                if (partes.length > 0) {
                    console.log(`👥 [STUB] Entrada de ${partes.length} usuario(s) a ${remoteJidStub}`);
                    for (const p of partes) {
                        if (!yaSaludado(remoteJidStub, p)) await enviarBienvenida(sock, remoteJidStub, p);
                    }
                }
                if (!msg.message) continue;
            }

            // Salidas del grupo por stub (28=REMOVE, 32=LEAVE).
            if (remoteJidStub?.endsWith('@g.us') && [28, 32].includes(msg.messageStubType)) {
                const partes = (msg.messageStubParameters || []).map(normWelcomeJid).filter(Boolean);
                if (partes.length > 0) {
                    console.log(`👋 [STUB] Salida de ${partes.length} usuario(s) de ${remoteJidStub}`);
                    for (const p of partes) {
                        if (!yaDespedido(remoteJidStub, p)) await enviarDespedida(sock, remoteJidStub, p);
                    }
                }
                if (!msg.message) continue;
            }

            // Detectar mensajes de sistema de unión al grupo (alternativa sin ser admin)
            const isGroupMsg = msg.key.remoteJid?.endsWith('@g.us');
            if (isGroupMsg) {
                const groupNotif = msg.message?.groupParticipantAddMessage || 
                                   msg.message?.groupParticipantAddedMessage;
                if (groupNotif) {
                    const participants = groupNotif.participants || [];
                    const groupId = msg.key.remoteJid;
                    console.log(`👥 [SISTEMA] Detectada entrada de ${participants.length} usuario(s) a ${groupId}`);
                    
                    // Procesar bienvenidas en paralelo (antes una por una)
                    await Promise.allSettled(participants.map(p => enviarBienvenida(sock, groupId, p)));
                    continue; // No procesar como mensaje normal
                }
            }

            const chatId = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;

            // 🔒 Descartar si este mensaje (por su ID unico) ya fue procesado
            // recientemente — evita doble ejecucion cuando WhatsApp reenvia el
            // mismo mensaje tras una reconexion del socket.
            const msgId = msg.key.id;
            if (msgId) {
                if (mensajesProcesadosIds.has(msgId)) continue;
                mensajesProcesadosIds.set(msgId, Date.now());
            }

            const tipo = getContentType(msg.message);

            let texto = '';
            if (tipo === 'conversation') texto = msg.message.conversation || '';
            else if (tipo === 'extendedTextMessage') texto = msg.message.extendedTextMessage?.text || '';
            else if (tipo === 'imageMessage') texto = msg.message.imageMessage?.caption || '';
            else if (tipo === 'videoMessage') texto = msg.message.videoMessage?.caption || '';

            // Ignorar lo que sale del propio teléfono vinculado (fromMe), SALVO
            // comandos: el dueño suele probar el bot desde ese mismo celular y
            // si no, su !s (incluso respondido a sus propias fotos) se descarta
            // en silencio. Los mensajes casuales fromMe sí se siguen ignorando
            // para no ensuciar nombres/stats con el pushName del perfil del bot.
            if (fromMe && !texto.trim().startsWith('!')) continue;

            const sender = msg.key.participant || chatId;
            const juegoActivo = botState.juegos[chatId];
            let tieneMangaSesionUpsert = false;
            if (botState.mangaSessions) {
                const TTL_MANGA_UPSERT = 5 * 60 * 1000;
                const nowUpsert = Date.now();
                for (const [k, s] of botState.mangaSessions.entries()) {
                    if (k.startsWith(`${chatId}_`) && (nowUpsert - s.ts <= TTL_MANGA_UPSERT)) {
                        tieneMangaSesionUpsert = true;
                        break;
                    }
                }
            }
            let tieneNovelaSesionUpsert = false;
            if (botState.novelaSessions) {
                const TTL_NOVELA_UPSERT = 5 * 60 * 1000;
                const nowUpsertN = Date.now();
                for (const [k, s] of botState.novelaSessions.entries()) {
                    if (k.startsWith(`${chatId}_`) && (nowUpsertN - s.ts <= TTL_NOVELA_UPSERT)) {
                        tieneNovelaSesionUpsert = true;
                        break;
                    }
                }
            }
            const participaEnJuego = tieneMangaSesionUpsert || tieneNovelaSesionUpsert || (juegoActivo && (
                juegoActivo.tipo === 'ahorcado' ||
                (juegoActivo.responder && normJid(juegoActivo.responder) === normJid(sender)) ||
                (juegoActivo.pareja && normJid(juegoActivo.pareja) === normJid(sender)) ||
                (juegoActivo.solicitante && normJid(juegoActivo.solicitante) === normJid(sender))
            ));
            const isCommand = texto.trim().startsWith('!');
            const botBare = (sock.user?.id || '').split(':')[0];
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isMentioned = botBare && (
                texto.includes(`@${botBare}`) ||
                texto.toLowerCase().includes('diky') ||
                mentionedJid.some(jid => jid.includes(botBare)) ||
                msg.message?.extendedTextMessage?.contextInfo?.participant?.includes(botBare)
            );

            if (!isCommand && !participaEnJuego && !isMentioned) continue;
            // PROCESAMIENTO CONCURRENTE
            procesarMensaje(sock, msg)
                .then(() => { botState.msgCount++; })
                .catch(e => console.error('❌ Error procesando mensaje:', e.message));
        }
    });

    // --- BIENVENIDAS (evento de participantes; funciona sin ser admin,
    // pero WhatsApp no siempre lo entrega: el stub en upsert es el respaldo) ---
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        console.log(`👥 [ADMIN] Evento grupo: ${action} en ${id} para ${participants.length} usuarios`);
        if (action === 'add') {
            const pendientes = participants.map(normWelcomeJid).filter(p => p && !yaSaludado(id, p));
            // En paralelo y sin pausas de 2s: cada bienvenida ya es rápida
            await Promise.allSettled(pendientes.map(p => enviarBienvenida(sock, id, p)));
            return;
        }
        if (action === 'remove' || action === 'leave') {
            const salientes = participants.map(normWelcomeJid).filter(p => p && !yaDespedido(id, p));
            await Promise.allSettled(salientes.map(p => enviarDespedida(sock, id, p)));
        }
    });

    // Keep-alive para Render
    if (RENDER_URL) {
        onceInterval('keepalive', () => axios.get(RENDER_URL).catch(() => { }), 4 * 60 * 1000);
    }

    // --- MODO DIOS AUTOMÁTICO (Cada 5 horas recarga al Admin) ---
    onceInterval('modo-dios', async () => {
        if (ADMIN_NUM) {
            const adminJid = ADMIN_NUM + '@s.whatsapp.net';
            try {
                console.log('⚡ [MODO DIOS] Restaurando stats del Administrador Principal...');
                await db.actualizarUsuario(adminJid, {
                    monedas: 1000000000,
                    xp: 1000000,
                    nivel: 999,
                    inventario: JSON.stringify({
                        pico_platino: 99,
                        cebo: 99,
                        silencio: 99,
                        fruta: 99,
                        escudo: 99,
                        pocion_xp: 99
                    })
                });
            } catch (e) {
                console.error('❌ Error en recarga Modo Dios:', e.message);
            }
        }
    }, 5 * 60 * 60 * 1000); // 5 Horas

    // --- SORTEO DE LOTERÍA AUTOMÁTICO (Cada 6 horas) ---
    onceInterval('loteria', async () => {
        if (!botState.loteria || botState.loteria.participantes.length === 0) return;
        const pool = botState.loteria.participantes;
        const winner = pool[Math.floor(Math.random() * pool.length)];
        const premio = botState.loteria.pozo;

        try {
            await db.sumarMonedas(winner, premio);
            const u = await db.obtenerUsuario(winner);
            const alias = u.nombre_wa || winner.split('@')[0];

            // Notificar al ganador (Buscamos un grupo activo o enviamos al admin como log)
            // Para simplicidad, se registra y el usuario lo verá en su perfil
            console.log(`🎫 [LOTERÍA] Sorteo realizado. Ganador: ${alias} | Premio: ${premio} diky.`);

            // Reset
            botState.loteria = { participantes: [], pozo: 0 };
        } catch (e) {
            console.error('❌ Error en sorteo de lotería:', e.message);
        }
    }, 6 * 60 * 60 * 1000);
}

// ============================================================
//                     PROCESADOR DE MENSAJES
// ============================================================
async function procesarMensaje(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const sender = msg.key.participant || chatId;
        const isGroup = chatId.endsWith('@g.us');
        const msgType = getContentType(msg.message);

        // --- SILENCIO CHECK ---
        const silenciadoHasta = botState.silenciados.get(sender);
        if (silenciadoHasta && Date.now() < silenciadoHasta) {
            if (VERBOSE_LOGS) console.log(`[SILENT] comando ignorado: sender ${(sender || '').split('@')[0]} silenciado hasta ${new Date(silenciadoHasta).toISOString()}`);
            return;
        }

        // --- EXTRACCIÓN Y LIMPIEZA ---
        const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ?
            msg.message.extendedTextMessage.contextInfo.stanzaId :
            (msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

        let txt = '';
        if (msgType === 'conversation') txt = msg.message.conversation || '';
        else if (msgType === 'extendedTextMessage') txt = msg.message.extendedTextMessage?.text || '';
        else if (msgType === 'imageMessage') txt = msg.message.imageMessage?.caption || '';
        else if (msgType === 'videoMessage') txt = msg.message.videoMessage?.caption || '';
        const pushName = msg.pushName || '';

        const cleanTxt = txt.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,]$/, "");
        let cmd = cleanTxt;
        const isCommand = cmd.startsWith('!');
        const juegoActivo = botState.juegos[chatId];

        // --- AFK + ACTIVIDAD (solo grupos, sin costo por mensaje) ---
        if (isGroup) {
            // 1. Quien escribe deja de estar AFK (aviso de vuelta, sin bloquear)
            if (botState.afkCache.has(sender)) {
                botState.afkCache.delete(sender);
                db.clearAFK(sender).catch(() => {});
                sock.sendMessage(chatId, {
                    text: `👋 @${sender.split('@')[0]} volvió. ¡Ya no está AFK!`,
                    mentions: [sender]
                }).catch(() => {});
            }
            // 2. Conteo para !topactivos (se guarda en Turso con el batch de 1 min)
            batchActividad(chatId, sender);
            // 3. Si mencionan a alguien AFK, avisar con su motivo
            const mencs = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
                || msg.message?.imageMessage?.contextInfo?.mentionedJid || [];
            const ausentes = mencs.filter(j => j && j !== sender && botState.afkCache.has(j));
            if (ausentes.length > 0) {
                (async () => {
                    const lineas = [];
                    for (const j of ausentes.slice(0, 3)) {
                        const mem = botState.afkCache.get(j);
                        let motivo = mem?.motivo, ts = mem?.ts;
                        if (!motivo) {
                            const row = await db.getAFK(j).catch(() => null);
                            if (!row) { botState.afkCache.delete(j); continue; }
                            motivo = row.motivo; ts = row.ts;
                            botState.afkCache.set(j, { motivo, ts });
                        }
                        const mins = Math.max(1, Math.round((Date.now() - (ts || Date.now())) / 60000));
                        lineas.push(`💤 @${j.split('@')[0]} está AFK (hace ~${mins} min).\n📌 ${motivo || 'sin motivo'}`);
                    }
                    if (lineas.length > 0) {
                        await sock.sendMessage(chatId, { text: lineas.join('\n\n'), mentions: ausentes });
                    }
                })().catch(() => {});
            }
        }

        // --- REGISTRO INTELIGENTE DE NOMBRE (WhatsApp Nickname) ---
        // Nunca con mensajes propios (fromMe): el pushName ahí es el del
        // perfil del teléfono del bot y renombraría filas ajenas a 'Dex'.
        if (pushName && isCommand && !msg.key.fromMe) {
            db.obtenerUsuario(sender)
                .then(u => {
                    if (u && u.nombre_wa !== pushName) {
                        return db.actualizarUsuario(sender, { nombre_wa: pushName });
                    }
                })
                .catch(() => { });
        }

        // --- FILTRO DE RELEVANCIA (Ahorro de CPU) ---
        const senderJidClean = (sender || '').split('@')[0].split(':')[0];
        let tieneMangaSesion = false;
        if (botState.mangaSessions) {
            const TTL_MANGA_SES = 5 * 60 * 1000;
            const nowMs = Date.now();
            for (const [k, s] of botState.mangaSessions.entries()) {
                if (k.startsWith(`${chatId}_`) && (nowMs - s.ts <= TTL_MANGA_SES)) {
                    tieneMangaSesion = true;
                    break;
                }
            }
        }
        let tieneNovelaSesion = false;
        if (botState.novelaSessions) {
            const TTL_NOVELA_SES = 5 * 60 * 1000;
            const nowMsN = Date.now();
            for (const [k, s] of botState.novelaSessions.entries()) {
                if (k.startsWith(`${chatId}_`) && (nowMsN - s.ts <= TTL_NOVELA_SES)) {
                    tieneNovelaSesion = true;
                    break;
                }
            }
        }

        const participaEnJuego = tieneMangaSesion || tieneNovelaSesion || (juegoActivo && (
            juegoActivo.tipo === 'ahorcado' ||
            (juegoActivo.responder && normJid(juegoActivo.responder) === normJid(sender)) ||
            (juegoActivo.pareja && normJid(juegoActivo.pareja) === normJid(sender)) ||
            (juegoActivo.solicitante && normJid(juegoActivo.solicitante) === normJid(sender))
        ));

        if (!isCommand && !participaEnJuego && !isGroup) return;

        // --- SETUP DE PRIVILEGIOS (solo para comandos) ---
        const cleanNumber = (n) => (n || '').split('@')[0].replace(/\D/g, '');
        const senderClean = cleanNumber(sender);

        const isGlobalAdmin = ADMIN_NUMBERS_CLEAN.some(adminClean =>
            senderClean.includes(adminClean) || adminClean.includes(senderClean)
        );
        let isAdmin = isGlobalAdmin;

        if (isCommand && isGroup && !isAdmin) {
            const adminsDe = (parts) => (parts || [])
                .filter(p => p && p.admin)
                // Normalizar a solo dígitos: sender puede llegar como @lid y la
                // metadata traer @s.whatsapp.net (o al revés); el JID completo
                // nunca coincidía y solo el dueño pasaba el filtro.
                .map(p => cleanNumber(p.id || p.jid || ''))
                .filter(Boolean);
            const esAdminEn = (lista) =>
                lista.includes(senderClean) || lista.includes(sender) ||
                lista.some(a => senderClean.includes(a) || a.includes(senderClean));

            const cached = botState.adminCache.get(chatId);
            const ahora = Date.now();
            let lista = cached && (ahora - cached.time < TTL_ADMIN) ? cached.admins : null;

            // Si el remitente NO está en la lista (posible admin nuevo con caché
            // viejo), refrescar de forma esperada con timeout en vez de usar el
            // caché vencido: así el primer comando del nuevo admin ya funciona.
            if (!lista || !esAdminEn(lista)) {
                const lastFetch = adminFetchAt.get(chatId) || 0;
                if (ahora - lastFetch >= ADMIN_FETCH_MIN_MS) {
                    adminFetchAt.set(chatId, ahora);
                    try {
                        const metadata = await Promise.race([
                            sock.groupMetadata(chatId),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('admin-timeout')), 5000))
                        ]);
                        lista = adminsDe(metadata.participants);
                        botState.adminCache.set(chatId, { admins: lista, time: Date.now() });
                    } catch (e) { /* timeout/red: se usa el caché viejo abajo */ }
                } else if (!lista) {
                    // Throttle activo y sin caché: refresco en segundo plano
                    sock.groupMetadata(chatId).then(metadata => {
                        botState.adminCache.set(chatId, { admins: adminsDe(metadata.participants), time: Date.now() });
                    }).catch(() => { });
                }
            }

            if (lista && esAdminEn(lista)) {
                isAdmin = true;
            } else if (VERBOSE_LOGS) {
                console.log(`[ADMIN] ${chatId} ${senderClean} no es admin (lista: ${lista ? lista.length : 'sin caché'}).`);
            }
        }

        // --- LÓGICA DE RESPUESTA A JUEGOS Y SESIONES INTERACTIVAS ---
        if (botState.juegos[chatId]) {
            const context = { chatId, sender, cmd, txt, quotedMsgId, botState, db, isCommand };
            const wasGameResponse = await handleGameResponse(sock, msg, context);
            if (wasGameResponse) return;
        }

        if (tieneMangaSesion) {
            const context = {
                chatId, sender, cmd, txt, msg, botState, db, isCommand, isGroup, isAdmin, isGlobalAdmin,
                pushName, downloadMediaMessage, traducirConCache, FFMPEG_PATH, ADMIN_NUM,
                quotedMsgId, quotedParticipant, msgType
            };
            const wasMangaResponse = await handleMangaSession(sock, msg, context);
            if (wasMangaResponse) return;
        }

        if (tieneNovelaSesion) {
            const context = {
                chatId, sender, cmd, txt, msg, botState, db, isCommand, isGroup, isAdmin, isGlobalAdmin,
                pushName, quotedMsgId, quotedParticipant, msgType
            };
            const wasNovelaResponse = await handleNovelaSession(sock, msg, context);
            if (wasNovelaResponse) return;
        }

        if (isCommand) {
            const start = cmd.split(' ')[0];
            // 🔍 DEBUG LOG — Eliminar cuando todo funcione
            if (VERBOSE_LOGS) console.log(`[CMD] ${start} | sender=${sender} | isGlobalAdmin=${isGlobalAdmin} | isGroup=${isGroup} | chatId=${chatId?.slice(-10)}`);
            // 🛡️ ANTI-DUPLICADO: mismo remitente + mismo comando + mismo texto
            // + misma cita en <5s se descarta (dos instancias vivas procesando
            // el mismo mensaje, o eco duplicado de WhatsApp). No es castigo:
            // un humano casi nunca repite el comando idéntico en 5 segundos.
            if (!globalThis.__dupCmd) globalThis.__dupCmd = new Map();
            const dupKey = `${sender}|${chatId}|${start}|${txt}|${quotedMsgId || ''}`;
            const ahoraDup = Date.now();
            const ultimoDup = globalThis.__dupCmd.get(dupKey) || 0;
            if (ahoraDup - ultimoDup < 5000) {
                if (VERBOSE_LOGS) console.log(`[DUP] ${start} duplicado (<5s), se ignora.`);
                return;
            }
            globalThis.__dupCmd.set(dupKey, ahoraDup);
            if (globalThis.__dupCmd.size > 500) {
                for (const [k, ts] of globalThis.__dupCmd) {
                    if (ahoraDup - ts > 5000) globalThis.__dupCmd.delete(k);
                    if (globalThis.__dupCmd.size <= 400) break;
                }
            }
            const comandosValidos = [
                '!menu', '!menu2', '!help', '!ping', '!s', '!sticker', '!v', '!toimg', '!ascii',
                '!profile', '!p', '!perfil', '!config', '!marry', '!divorce',
                '!catalogo', '!manga', '!modomanga', '!leer', '!buscar', '!recomanga', '!parar', '!setmanga', '!sincronizar',
                '!decir', '!setdecir', '!waifu', '!trace', '!personaje', '!anime', '!proximo', '!estrenos', '!temporada', '!wiki', '!estudio', '!recomendar', '!random',
                '!quiz', '!quizanime', '!adivina', '!matematicas', '!bandera', '!ahorcado', '!inglish', '!pescar', '!pokemon', '!duelo', '!duelo_real', '!aceptar',
                '!slot', '!ruleta', '!ruleta_rusa', '!ppt', '!pptx', '!minar', '!apostar', '!dado', '!moneda', '!8ball',
                '!bj', '!blackjack', '!poker', '!minas', '!carta', '!donde', '!deljuego', '!suelten', '!carrera',
                '!puente', '!mazmorra', '!cofre', '!bomba', '!cazar',
                '!roast', '!cumplido', '!ship', '!love', '!gay', '!iq', '!suerte', '!top', '!horoscopo', '!seria', '!kill', '!chiste', '!hacker', '!reto', '!verdad',
                '!pat', '!hug', '!kiss', '!slap', '!punch', '!cry', '!dance', '!bite', '!highfive',
                '!fumar', '!cafe', '!puchero', '!sonrojar', '!baka', '!dormir', '!comiendo', '!pensar',
                '!patear', '!celebrar', '!aburrido', '!risa', '!smug', '!stare',
                '!tag', '!reglas', '!kick', '!adm', '!promover', '!bot', '!bienvenida', '!setbienvenida', '!despedida', '!setdespedida', '!setportada', '!setsticker', '!news', '!broadcast', '!anuncio', '!sorteo', '!rifa',
                '!tienda', '!comprar', '!vender', '!inventario', '!mejor', '!bounty', '!regalar', '!regalaritem', '!dar',
                '!antispam', '!mododios', '!remoto', '!autoadmin', '!antifarma',
                '!prestigio', '!loteria', '!clase', '!pedir', '!plantarse', '!pl', '!trivia', '!daily', '!w', '!slut', '!robar', '!canjear',
                '!subastar', '!subastas', '!ofertar',
                '!waifus', '!mascotas', '!alimentar', '!casar', '!proponer', '!logros', '!tareas',
                '!ver',
                '!reconovela', '!novela',
                '!dinosaurios', '!aves', '!dragones', '!acuaticos', '!salvajes', '!miticos',
                '!parque', '!principal', '!lucha', '!escudo',
                '!aceptar_lucha', '!rechazar_lucha', '!comprar_mascota', '!rechazar',
                '!emojimix', '!ttt', '!warn', '!unwarn', '!warns', '!afk', '!encuesta', '!topactivos', '!recordar', '!recordatorios',
                '!pptpvp', '!c4', '!quizduelo', '!bingo',
                '!dados', '!tirar', '!numero', '!mates', '!carrera2', '!avanza', '!naval', '!fuego', '!reflejos', '!maraton', '!simon',
                '!hongbao', '!abrir', '!mentiroso', '!apuesta', '!duda', '!cadena', '!traidor', '!soy', '!votar', '!botella', '!girar',
                '!pares', '!voltea', '!ahorcado2', '!palabra', '!palabron', '!esgrima', '!tira', '!puja', '!miento', '!cual', '!globo', '!inflar', '!anagrama', '!rima',
                '!wordle', '!intruso', '!supervivencia', '!cazatesoros', '!ruleta2', '!escalera', '!caja',
            ];

            if (FAST_COMMANDS.has(start) && (handler.commands.has(start) || comandosValidos.includes(start))) {
                const args = txt.split(' ').slice(1);
                const sockProxy = new Proxy(sock, {
                    get(target, prop) {
                        if (prop === 'sendMessage') {
                            return (jid, content, opts) => sendMessageConTimeout(target, jid, content, opts);
                        }
                        return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
                    }
                });
                const extras = {
                    start, cmd, txt, args, sender, pushName, isGroup, isAdmin, isGlobalAdmin,
                    botState, db, delay, FFMPEG_PATH, ADMIN_NUM,
                    traducirConCache, convertirAWebp, downloadMediaMessage,
                    quotedMsgId, quotedParticipant, msgType,
                    sockOriginal: sock
                };
                const executedFast = await handler.handleCommand(start, sockProxy, chatId, msg, args, extras);
                if (executedFast) return;
            }

            // --- COOLDOWN GLOBAL (anti-spam / anti rate-limit de WhatsApp) ---
            // Admins: sin límite (la cola de salida protege el rate-limit)
            // Usuarios: 300ms mínimo entre comandos (balance entre velocidad y protección)
            const cooldownMs = isAdmin ? 0 : 300;
            if (cooldownMs > 0) {
                const globalWait = verificarCooldown(sender, 'global', cooldownMs);
                if (globalWait > 0) {
                    sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }).catch(() => {});
                    return;
                }
            }

            if (handler.commands.has(start) || comandosValidos.includes(start)) {
                // --- SOLO SI ES COMANDO HACEMOS LOS CHECKS PESADOS ---

                // 1. ¿Grupo Activo? (Optimizado con caché combinada)
                let groupConfig = { active: null, ai: { activado: false } };
                if (isGroup && !['!ping', '!bot'].includes(start)) {
                    groupConfig = await obtenerConfigGrupo(chatId);
                    const active = groupConfig.active;

                    if (!active && !isAdmin) {
                        return sock.sendMessage(chatId, {
                            text: '🤖 El bot no está activado en este grupo.\nUn *administrador* debe escribir *!bot on* para activarlo.'
                        }, { quoted: msg });
                    }
                }
                const groupConf = groupConfig.active;

                // 2. SISTEMA DE COOLDOWN POR COMANDO
                // RPG: 6 segundos POR USUARIO (no bloquea a otros usuarios del grupo)
                const rpgCmds = ['!pescar', '!minar', '!cazar', '!duelo_real', '!pokemon'];
                if (rpgCmds.includes(start)) {
                    const rpgWait = verificarCooldown(sender, start, 6000);
                    if (rpgWait > 0 && !isAdmin) {
                        return sock.sendMessage(chatId, { text: `⏳ Espera *${rpgWait}s* para volver a usar *${start}*.` }, { quoted: msg });
                    }
                }

                // Multimedia pesados: 8 seg para usuarios normales
                if (!isAdmin) {
                    const heavyCmds = ['!v', '!s', '!sticker', '!trace', '!top', '!waifu', '!kill', '!slap', '!punch', '!toimg'];
                    if (heavyCmds.includes(start)) {
                        const wait = verificarCooldown(sender, start, 8000);
                        if (wait > 0) return sock.sendMessage(chatId, { text: `⏳ Espera ${wait}s para volver a usar *${start}*.` }, { quoted: msg });
                    }
                }

                // 3. Modo Admin (Restricción)
                const isModoAdminActivo = groupConf ? groupConf.modo_admin === 1 : (botState.modoAdmin[chatId] || false);
                if (isGroup && isModoAdminActivo && !isAdmin) {
                    if (VERBOSE_LOGS) console.log(`[SILENT] ${start} ignorado: modo admin activo y sender no es admin`);
                    return;
                }

                // 3.5. Modo Manga (solo comandos de manga + admin)
                const isModoMangaActivo = groupConf ? groupConf.modo_manga === 1 : (botState.mangaMode.get(chatId) || false);
                if (isGroup && isModoMangaActivo) {
                    const mangaAllowed = [
                        '!manga', '!leer', '!catalogo', '!buscar', '!recomanga', '!parar', '!setmanga',
                        '!bot', '!adm', '!menu', '!menu2', '!help', '!ping'
                    ];
                    if (!mangaAllowed.includes(start)) {
                        if (VERBOSE_LOGS) console.log(`[SILENT] ${start} ignorado: modo manga activo`);
                        return; // Silenciosamente ignorar
                    }
                }

                // --- ESTADÍSTICAS Y RACHAS (Write-Behind: acumula en RAM, sincroniza cada 2 min) ---
                batchRegistrarComando(sender);
                batchActualizarRacha(sender);

                // --- SISTEMA ANTI-SPAM (NUEVO - PER GRUPO) ---
                const isAntiSpamActivo = groupConf ? groupConf.antispam === 1 : botState.antiSpam.active;
                if (isAntiSpamActivo && !isAdmin) {
                    const ahora = Date.now();
                    let stats = botState.antiSpam.tracker.get(sender);

                    if (!stats || (ahora - stats.startTime > botState.antiSpam.interval)) {
                        stats = { count: 1, startTime: ahora };
                    } else {
                        stats.count++;
                    }
                    botState.antiSpam.tracker.set(sender, stats);

                    // Límite de tamaño del tracker para evitar memory leak
                    if (botState.antiSpam.tracker.size > 1000) {
                        const oldest = botState.antiSpam.tracker.keys().next().value;
                        botState.antiSpam.tracker.delete(oldest);
                    }

                    if (stats.count > botState.antiSpam.limit) {
                        botState.silenciados.set(sender, ahora + botState.antiSpam.banTime);
                        botState.antiSpam.tracker.delete(sender); // Limpiar rastro tras baneo
                        return sock.sendMessage(chatId, {
                            text: `🚫 *SISTEMA ANTI-SPAM:* Has superado el límite de 100 comandos por hora.\n⚡ Quedarás silenciado por las próximas *2 horas*.\n\n_Diky Bot prefiere calidad antes que cantidad._`
                        }, { quoted: msg });
                    }

                    // Limpieza periódica del Map (para no saturar RAM) - 20% probabilidad
                    if (Math.random() < 0.20) {
                        for (const [uid, s] of botState.antiSpam.tracker.entries()) {
                            if (ahora - s.startTime > botState.antiSpam.interval) botState.antiSpam.tracker.delete(uid);
                        }
                    }
                }

                if (isAdmin && VERBOSE_LOGS) {
                    console.log(`📡 Admin Cmd: ${cmd}`);
                }

                // 4. Reacción inmediata
                let emoji = '⚡';

                // Reacciones temáticas
                switch (start) {
                    case '!menu': case '!menu2': emoji = '📜'; break;
                    case '!ping': emoji = '📡'; break;
                    case '!v': emoji = '🎨'; break;
                    case '!s': case '!sticker': emoji = '🖼️'; break;
                    case '!kill': case '!slap': case '!punch': emoji = '💢'; break;
                    case '!pat': case '!hug': case '!kiss': case '!sonrojar': case '!puchero': emoji = '💕'; break;
                    case '!cry': emoji = '😭'; break;
                    case '!dance': emoji = '💃'; break;
                    case '!bite': emoji = '👄'; break;
                    case '!highfive': emoji = '🙌'; break;
                    case '!fumar': case '!cafe': emoji = '🚬'; break;
                    case '!dormir': emoji = '😴'; break;
                    case '!comiendo': emoji = '😋'; break;
                    case '!aburrido': emoji = '🥱'; break;
                    case '!celebrar': emoji = '🥳'; break;
                    case '!tienda': emoji = '🏷️'; break;
                    case '!vender': emoji = '💰'; break;
                    case '!inventario': emoji = '🎒'; break;
                    case '!mejor': emoji = '🏆'; break;
                    case '!profile': case '!p': case '!perfil': emoji = '👤'; break;
                    case '!ver': emoji = '📸'; break;
                    case '!marry': emoji = '💍'; break;
                    case '!bounty': emoji = '💀'; break;
                    case '!minar': emoji = '⛏️'; break;
                    case '!pescar': emoji = '🎣'; break;
                    case '!cazar': emoji = '🏹'; break;
                    case '!duelo': emoji = '⚔️'; break;
                    case '!apostar': case '!slot': case '!ruleta': emoji = '🎰'; break;
                    case '!bj': case '!poker': emoji = '🃏'; break;
                    case '!minas': emoji = '💣'; break;
                    case '!quiz': case '!quizanime': case '!adivina': case '!bandera': emoji = '❓'; break;
                    case '!robar': emoji = '🦹‍♂️'; break;

                    case '!pedir': emoji = '➕'; break;
                    case '!plantarse': case '!pl': emoji = '✋'; break;
                    case '!bienvenida': case '!setbienvenida': emoji = '👋'; break;
                    case '!waifus': emoji = '🎀'; break;
                    case '!mascotas': emoji = '🐾'; break;
                    case '!comprar_mascota': emoji = '🐕'; break;
                    case '!alimentar': emoji = '🥩'; break;
                    case '!casar': emoji = '💍'; break;
                    case '!divorciar': emoji = '💔'; break;
                    case '!aceptar': emoji = '✅'; break;
                    case '!duelo_real': emoji = '⚔️'; break;
                    // 🐾 Mascotas v2.0
                    case '!dinosaurios': emoji = '🦖'; break;
                    case '!aves': emoji = '🦅'; break;
                    case '!dragones': emoji = '🐉'; break;
                    case '!acuaticos': emoji = '🌊'; break;
                    case '!salvajes': emoji = '🐾'; break;
                    case '!miticos': emoji = '🌟'; break;
                    case '!comprar_mascota': emoji = '🛍️'; break;
                    case '!parque': emoji = '🌳'; break;
                    case '!principal': emoji = '⭐'; break;
                    case '!lucha': emoji = '⚔️'; break;
                    case '!escudo': emoji = '🛡️'; break;
                    case '!aceptar_lucha': emoji = '✅'; break;
                    case '!rechazar_lucha': emoji = '❌'; break;
                }

                // Efecto de Grimorio (Solo si es un comando que suele usar economía)
                if (!esChatLento(chatId) && ['!menu', '!tienda', '!minar', '!perfil', '!p'].includes(start)) {
                    db.obtenerUsuario(sender).then(u => {
                        if (u && u.inventario) {
                            try {
                                const inv = JSON.parse(u.inventario);
                                if (inv.grimorio > 0) sock.sendMessage(chatId, { react: { text: '🔮', key: msg.key } }).catch(() => { });
                            } catch (e) { }
                        }
                    }).catch(() => { });
                }

                if (!esChatLento(chatId)) {
                    sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } }).catch(() => { });
                }

                // 5. EJECUTAR COMANDO MODULAR
                const args = txt.split(' ').slice(1);

                // Proxy de sock: intercepta sendMessage y lo pasa por la cola de salida
                // Esto hace que TODOS los módulos usen la cola automáticamente sin cambiar nada en ellos.
                const sockProxy = new Proxy(sock, {
                    get(target, prop) {
                        if (prop === 'sendMessage') {
                            return (jid, content, opts) => enviarConCola(target, jid, content, opts);
                        }
                        return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
                    }
                });

                const extras = {
                    start, cmd, txt, args, sender, pushName, isGroup, isAdmin, isGlobalAdmin,
                    botState, db, delay, FFMPEG_PATH, ADMIN_NUM,
                    traducirConCache, convertirAWebp, downloadMediaMessage,
                    quotedMsgId, quotedParticipant, msgType,
                    sockOriginal: sock // Para comandos express que necesitan bypass de cola
                };

                // isHeavy: comandos que usan FFmpeg o descargas pesadas y por tanto deben
                // respetar el limite de procesos concurrentes (esperarSlotHeavy). Se agregaron
                // las reacciones sociales (usan FFmpeg para convertir GIF->MP4) y !waifus
                // (descarga hasta 10 imagenes), que antes evadian este limite en Render.
                const isHeavy = [
                    '!v', '!s', '!sticker', '!trace', '!toimg',
                    '!pat', '!hug', '!kill', '!kiss', '!slap', '!punch', '!cry', '!dance', '!bite', '!highfive',
                    '!fumar', '!cafe', '!puchero', '!sonrojar', '!baka', '!dormir', '!comiendo', '!pensar',
                    '!patear', '!celebrar', '!aburrido', '!risa', '!smug', '!stare',
                    '!waifus'
                ].includes(start);
                if (isHeavy) {
                    const gotSlot = await esperarSlotHeavy();
                    if (!gotSlot) {
                        return sock.sendMessage(chatId, { text: '⏳ Hay muchas tareas en espera. Intenta en unos segundos.' }, { quoted: msg });
                    }
                }

                try {
                    const cmdStartTime = Date.now();
                    const mExecuted = await handler.handleCommand(start, sockProxy, chatId, msg, args, extras);
                    const cmdDuration = Date.now() - cmdStartTime;
                    // Log comandos lentos (>1s) para identificar bottlenecks
                    if (cmdDuration > 1000) {
                        console.log(`[SLOW CMD] ${start}: ${cmdDuration}ms - posible bottleneck`);
                    }
                    if (mExecuted) return;
                } catch (e) {
                    console.error(`Error en handler ${start}:`, e.message);
                } finally {
                    // SIEMPRE liberar el slot, sin importar si hubo error o no
                    if (isHeavy) liberarSlotHeavy();
                }
            }
        }

    } catch (e) {
        console.error('❌ Error fatal en procesarMensaje:', e.message);
    }
}

// ============================================================
//                     ¡ARRANCAR! 🚀
// ============================================================
console.log('😺 Iniciando Diky Bot V3...');
startBot();

// --- CIERRE LIMPIO (FLUSH DB) ---
process.on('SIGINT', async () => {
    console.log('🛑 [Shutdown] Guardando datos...');
    if (db.flushPendingUpdates) await db.flushPendingUpdates();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('🛑 [Shutdown] Guardando datos...');
    if (db.flushPendingUpdates) await db.flushPendingUpdates();
    process.exit(0);
});

// --- MANEJO DE ERRORES GLOBALES (Para evitar crashes silenciosos en Render) ---
process.on('uncaughtException', (err) => {
    console.error('❌ [FATAL ERROR] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ [FATAL ERROR] Unhandled Rejection:', reason?.message || reason);
});

// HF Re-trigger build log
