/**
 * 🤖 DIKY BOT V2 - RENDER + TURSO EDITION
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
const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const db = require('./database');
const { useTursoAuthState } = require('./turso-auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const handler = require('./commandHandler');
const { handleGameResponse } = require('./gameResponder');
const { handleMangaSession } = require('./mangaResponder');
const execFileAsync = promisify(execFile);

// 🧰 Utils modularizados
const { LRUCache, fetchWithRetry, createLogger } = require('./utils');
const { CONFIG } = require('./config');
const { aiService } = require('./services');

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
        ['configIA', botState.configIA], ['cacheTrad', botState.cacheTrad],
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

async function flushStatsBatch() {
    if (!statsBatch.dirty) return;
    const comandosCopy = new Map(statsBatch.comandos);
    const rachasCopy = new Set(statsBatch.rachas);
    statsBatch.comandos.clear();
    statsBatch.rachas.clear();
    statsBatch.dirty = false;

    // Flush comandos en batch
    for (const [userId, incremento] of comandosCopy) {
        try {
            const u = await db.obtenerUsuario(userId);
            if (u) await db.actualizarUsuario(userId, { total_comandos: (u.total_comandos || 0) + incremento });
        } catch (e) { }
    }

    // Flush rachas
    for (const userId of rachasCopy) {
        try { await db.actualizarRacha(userId); } catch (e) { }
    }

    if (comandosCopy.size > 0) console.log(`📊 [Batch] Sincronizados ${comandosCopy.size} usuarios, ${rachasCopy.size} rachas.`);
}

// Flush automático cada 1 minuto (para grupos grandes, que se vea más rápido)
setInterval(flushStatsBatch, 1 * 60 * 1000);

// Flush al apagar el proceso para no perder datos
process.on('SIGTERM', async () => { await flushStatsBatch(); process.exit(0); });
process.on('SIGINT', async () => { await flushStatsBatch(); process.exit(0); });

// Helper para prevenir saturación (Cooldown)
function verificarCooldown(userId, comando, ms = 3000) {
    const key = `${userId}-${comando}`;
    const ahora = Date.now();
    const last = cooldowns.get(key) || 0;
    if (ahora - last < ms) return Math.ceil((ms - (ahora - last)) / 1000);
    cooldowns.set(key, ahora);
    return 0;
}

// ============================================================
//              FUNCIÓN DE BIENVENIDA (Reutilizable)
// ============================================================
// Usada por: group-participants.update (admin) y mensajes de sistema (sin admin)
async function enviarBienvenida(sock, groupId, participantJid) {
    try {
        const conf = await db.tieneBienvenida(groupId);
        if (!conf.activa) return;
        
        const nombre = participantJid.split('@')[0];
        
        let defaultMsg = `¡Hola @${nombre}! 🎉\nBienvenid@ al grupo.\n\n📜 Escribe *!menu* para ver todos los comandos.\n🎮 Hay juegos, stickers, anime y mucho más.\n\n¡Diviértete! 🐱✨`;
        let customMsg = conf.mensaje || defaultMsg;
        
        // Reemplazar variables
        customMsg = customMsg.replace(/{usuario}/gi, `@${nombre}`).replace(/{user}/gi, `@${nombre}`);
        
        // Agregar mención si no existe
        if (!customMsg.includes(`@${nombre}`)) {
            customMsg = `¡Hola @${nombre}!\n\n` + customMsg;
        }
        
        // Enviar imagen de bienvenida
        const imgPath = path.join(__dirname, 'imagen_bienvenida.png');
        if (fs.existsSync(imgPath)) {
            try {
                const captionFinal = `╔══════════════════════╗\n║    😺 *¡BIENVENID@!* 😺    ║\n╚══════════════════════╝\n\n${customMsg}`;
                await sock.sendMessage(groupId, {
                    image: fs.readFileSync(imgPath),
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
        
        // Pausa y sticker
        await delay(1500);
        const stickerPath = path.join(__dirname, 'sticker_bienvenida.webp');
        if (fs.existsSync(stickerPath)) {
            try {
                await sock.sendMessage(groupId, { sticker: fs.readFileSync(stickerPath) });
            } catch (eStk) {
                console.error(`❌ Error sticker bienvenida:`, eStk.message);
            }
        }
    } catch (e) {
        console.error('❌ Error en enviarBienvenida:', e.message);
    }
}

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// --- IA CONFIG ---
const genAI = process.env.GEMINI_KEY ? new GoogleGenerativeAI(process.env.GEMINI_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

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
    modoAdmin: {},    // Grupos con modo solo-admins activo
    
    // 🧠 Cachés LRU con límites desde CONFIG (anti memory-leak)
    configIA: new LRUCache(100, 30 * 60 * 1000),                    // Configuración IA
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
    mangaSessions: new Map() // `${chatId}_${sender}` → { tempCode, titulo, genero, step, ts }
};

const TTL_CONFIG = 5 * 60 * 1000; // 5 minutos para caché de config

// Helper para obtener configuración de grupo con caché LRU
async function obtenerConfigGrupo(chatId) {
    const cached = botState.groupCache.get(chatId);
    if (cached) return cached;

    try {
        const [active, ai] = await Promise.all([
            db.estaGrupoActivo(chatId),
            db.getModoAI(chatId)
        ]);

        const config = { active, ai };
        botState.groupCache.set(chatId, config);
        return config;
    } catch (e) {
        return { active: null, ai: { activado: false } };
    }
}

// --- HELPERS DE IA ---
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

    try {
        let traducido = '';
        if (aiModel) {
            const prompt = `Translate the following ${tipo} into Spanish. Respond ONLY with the Spanish translation. Do not include English text. Content: ${texto.substring(0, 600)}`;
            const result = await aiModel.generateContent(prompt);
            traducido = (await result.response).text().trim();
        } else {
            // Fallback: Google Translate "Free" API
            const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(texto.substring(0, 1000))}`);
            traducido = res.data[0].map(x => x[0]).join('').trim();
        }

        setCacheTrad(cacheKey, traducido);
        return traducido;
    } catch (e) {
        console.error('Error traducción:', e.message);
        return texto.substring(0, 200) + '...';
    }
}

// 🔄 Wrapper del servicio de IA (migrado a services/aiService.js)
async function chatWithLiquidAI(texto, contexto = '') {
    const prompt = contexto 
        ? `Contexto: ${contexto}\n\nUsuario: ${texto}`
        : texto;
    
    const response = await aiService.chatWithAI(prompt, 'auto');
    
    // Limpiar tags de thinking si existen
    if (typeof response === 'string') {
        return response.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    }
    
    return response;
}

// 🔄 Gemini wrapper (delegado a servicio)
async function chatWithGemini(texto, contexto = '') {
    const prompt = contexto
        ? `Eres Diky Bot, un bot de WhatsApp divertido. Instrucciones: ${contexto}\n\nUsuario dice: ${texto}`
        : `Eres Diky Bot, un bot de WhatsApp divertido.\n\nUsuario dice: ${texto}`;
    
    return await aiService.chatWithGoogleAI(prompt);
}

// --- Fallback local para mangas ---
function cargarMangasLocal() {
    try {
        const f = path.join(__dirname, 'mangas.json');
        if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) { }
    return [];
}

// ============================================================
//                     EXPRESS DASHBOARD
// ============================================================
const app = express();

app.get('/', (req, res) => {
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

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Diky Bot</title>
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
    <h1>😺 Diky Bot V2</h1>
    <div class="sb">${statusHtml}${qrHtml}</div>
    <div class="st">
        <p>⏱️ <b>Uptime:</b> ${h}h ${m}m ${s}s</p>
        <p>📨 <b>Mensajes:</b> ${botState.msgCount}</p>
        <p>☁️ <b>DB:</b> ${dbBadge}</p>
        <p>🔧 <b>Admin:</b> ${ADMIN_NUM || '⚠️'}</p>
        <p><b>Ultimo error:</b> ${botState.lastDisconnectCode || '-'} ${botState.lastDisconnectReason || ''}</p>
    </div></div></body></html>`);
});

app.get('/health', (req, res) => {
    const queues = [...colaSalida.entries()].map(([chatId, state]) => ({
        chatId,
        size: state.cola.length,
        procesando: state.procesando,
        slow: esChatLento(chatId),
        errors: state.errors || 0,
        lastSendAgoMs: state.lastSendAt ? Date.now() - state.lastSendAt : null
    }));
    res.json({ ok: true, connected: botState.isConnected, queues });
});

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

app.get('/reset-session', async (req, res) => {
    const token = process.env.RESET_SESSION_TOKEN;
    if (!token || req.query.token !== token) {
        return res.status(403).json({ ok: false, error: 'RESET_SESSION_TOKEN invalido o no configurado' });
    }

    await resetAuthSession('dashboard reset');
    res.json({ ok: true, message: 'Sesion de WhatsApp borrada. Render reiniciara el bot.' });
    setTimeout(() => process.exit(0), 800);
});
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Dashboard en puerto ${PORT}`));

// ============================================================
//                     STICKER UTILS
// ============================================================
async function convertirAWebp(buffer, isVideo = false) {
    const ext = isVideo ? 'mp4' : 'png';
    const tmpIn = path.join(os.tmpdir(), `stk_in_${Date.now()}.${ext}`);
    const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}.webp`);
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
async function startBot() {
    botState.status = 'Cargando motor...';
    console.log('🚀 Iniciando Diky Bot V2...');

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
            setInterval(async () => {
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

            // Sincronización automática de mangas (Silenciosa)
            const local = cargarMangasLocal();
            if (local.length > 0 && db.isConnected()) {
                console.log('🔄 Sincronizando catálogo con la DB...');
                for (const m of local) {
                    await db.guardarManga(m.codigo, m.titulo, m.carpeta, m.resumen, m.generos);
                }
            }
            // Heartbeat: Guardar credenciales cada 10 minutos para asegurar persistencia
            setInterval(async () => {
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
                    setTimeout(startBot, 10000);
                    return;
                }

                // Reconectar con espera gradual más larga para proteger la base de datos
                const waitTime = Math.min(errores401 * 20000, 60000); // Max 1 minuto
                console.log(`🔄 Reintentando conexión en ${waitTime / 1000}s...`);
                botState.status = `Error 401 (${errores401}/5). Reintentando...`;
                setTimeout(startBot, waitTime);
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
                setTimeout(startBot, waitMs);
                return;
            }

            // Reconexión normal para cualquier otro error
            const reason = code || 'Desconocido';
            console.log(`🔄 Reconectando en 8s... (Motivo: ${reason})`);
            botState.status = `Reconectando... (Error: ${reason})`;
            setTimeout(startBot, 8000);
        }
    });

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

            // Detectar mensajes de sistema de unión al grupo (alternativa sin ser admin)
            const isGroupMsg = msg.key.remoteJid?.endsWith('@g.us');
            if (isGroupMsg) {
                const groupNotif = msg.message?.groupParticipantAddMessage || 
                                   msg.message?.groupParticipantAddedMessage;
                if (groupNotif) {
                    const participants = groupNotif.participants || [];
                    const groupId = msg.key.remoteJid;
                    console.log(`👥 [SISTEMA] Detectada entrada de ${participants.length} usuario(s) a ${groupId}`);
                    
                    // Procesar bienvenida para cada participante
                    for (const p of participants) {
                        await enviarBienvenida(sock, groupId, p);
                    }
                    continue; // No procesar como mensaje normal
                }
            }

            const chatId = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const tipo = getContentType(msg.message);
            let texto = '';
            if (tipo === 'conversation') texto = msg.message.conversation || '';
            else if (tipo === 'extendedTextMessage') texto = msg.message.extendedTextMessage?.text || '';
            else if (tipo === 'imageMessage') texto = msg.message.imageMessage?.caption || '';
            else if (tipo === 'videoMessage') texto = msg.message.videoMessage?.caption || '';

            if (fromMe && !texto.trim().startsWith('!')) continue;

            const sender = msg.key.participant || chatId;
            const juegoActivo = botState.juegos[chatId];
            const participaEnJuego = juegoActivo && (
                juegoActivo.tipo === 'ahorcado' ||
                juegoActivo.responder === sender ||
                juegoActivo.pareja === sender ||
                juegoActivo.solicitante === sender
            );
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

    // --- BIENVENIDAS (Evento admin - legacy) ---
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        console.log(`👥 [ADMIN] Evento grupo: ${action} en ${id} para ${participants.length} usuarios`);
        if (action !== 'add') return;
        
        for (const p of participants) {
            await enviarBienvenida(sock, id, p);
            // Pausa entre usuarios si hay varios
            if (participants.length > 1) await delay(2000);
        }
    });

    // Keep-alive para Render
    if (RENDER_URL) {
        setInterval(() => axios.get(RENDER_URL).catch(() => { }), 4 * 60 * 1000);
    }

    // --- MODO DIOS AUTOMÁTICO (Cada 5 horas recarga al Admin) ---
    setInterval(async () => {
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
    setInterval(async () => {
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
        if (silenciadoHasta && Date.now() < silenciadoHasta) return;

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

        // --- REGISTRO INTELIGENTE DE NOMBRE (WhatsApp Nickname) ---
        if (pushName && isCommand) {
            db.obtenerUsuario(sender)
                .then(u => {
                    if (u && u.nombre_wa !== pushName) {
                        return db.actualizarUsuario(sender, { nombre_wa: pushName });
                    }
                })
                .catch(() => { });
        }

        // --- FILTRO DE RELEVANCIA (Ahorro de CPU) ---
        const tieneMangaSesion = botState.mangaSessions && botState.mangaSessions.has(`${chatId}_${sender}`);
        const participaEnJuego = tieneMangaSesion || (juegoActivo && (
            juegoActivo.responder === sender ||
            juegoActivo.pareja === sender ||
            juegoActivo.solicitante === sender ||
            juegoActivo.tipo === 'ahorcado'
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
            const cached = botState.adminCache.get(chatId);
            const ahora = Date.now();
            if (cached && (ahora - cached.time < TTL_ADMIN)) {
                if (cached.admins.includes(sender)) isAdmin = true;
            } else {
                // No bloqueamos todo el bot si groupMetadata tarda
                sock.groupMetadata(chatId).then(metadata => {
                    const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
                    botState.adminCache.set(chatId, { admins, time: ahora });
                }).catch(() => { });

                // Mientras se actualiza, usamos el cache viejo si existe
                if (cached && cached.admins.includes(sender)) isAdmin = true;
            }
        }

        // --- LÓGICA DE RESPUESTA A JUEGOS Y SESIONES INTERACTIVAS ---
        if (botState.juegos[chatId]) {
            const context = { chatId, sender, cmd, txt, quotedMsgId, botState, db, isCommand };
            const wasGameResponse = await handleGameResponse(sock, msg, context);
            if (wasGameResponse) return;
        }

        if (botState.mangaSessions && botState.mangaSessions.has(`${chatId}_${sender}`)) {
            const context = {
                chatId, sender, cmd, txt, msg, botState, db, isCommand, isGroup, isAdmin, isGlobalAdmin,
                pushName, downloadMediaMessage, traducirConCache, FFMPEG_PATH, ADMIN_NUM,
                quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI
            };
            const wasMangaResponse = await handleMangaSession(sock, msg, context);
            if (wasMangaResponse) return;
        }

        if (isCommand) {
            const start = cmd.split(' ')[0];
            // 🔍 DEBUG LOG — Eliminar cuando todo funcione
            if (VERBOSE_LOGS) console.log(`[CMD] ${start} | sender=${sender} | isGlobalAdmin=${isGlobalAdmin} | isGroup=${isGroup} | chatId=${chatId?.slice(-10)}`);
            const comandosValidos = [
                '!menu', '!menu2', '!help', '!ping', '!s', '!sticker', '!v', '!toimg', '!ascii',
                '!profile', '!p', '!perfil', '!config', '!marry', '!divorce',
                '!catalogo', '!manga', '!leer', '!buscar',
                '!decir', '!waifu', '!trace', '!personaje', '!anime', '!proximo', '!estrenos', '!temporada', '!wiki', '!estudio', '!recomendar', '!random',
                '!quiz', '!quizanime', '!adivina', '!matematicas', '!bandera', '!ahorcado', '!pescar', '!pokemon', '!duelo', '!duelo_real', '!aceptar',
                '!slot', '!ruleta', '!ruleta_rusa', '!ppt', '!pptx', '!minar', '!apostar', '!dado', '!moneda', '!8ball',
                '!bj', '!blackjack', '!poker', '!minas', '!carta', '!donde', '!deljuego', '!suelten', '!carrera',
                '!puente', '!mazmorra', '!cofre', '!bomba', '!cazar',
                '!roast', '!cumplido', '!ship', '!love', '!gay', '!iq', '!suerte', '!top', '!horoscopo', '!seria', '!kill', '!chiste', '!hacker', '!reto', '!verdad',
                '!pat', '!hug', '!kiss', '!slap', '!punch', '!cry', '!dance', '!bite', '!highfive',
                '!fumar', '!cafe', '!puchero', '!sonrojar', '!baka', '!dormir', '!comiendo', '!pensar',
                '!patear', '!celebrar', '!aburrido', '!risa', '!smug', '!stare',
                '!tag', '!reglas', '!kick', '!adm', '!promover', '!bot', '!bienvenida', '!setbienvenida', '!news', '!sorteo', '!rifa', '!ia',
                '!tienda', '!comprar', '!vender', '!inventario', '!mejor', '!bounty', '!regalar', '!regalaritem', '!dar',
                '!antispam', '!mododios',
                '!prestigio', '!loteria', '!clase', '!pedir', '!plantarse', '!pl', '!trivia', '!daily', '!w', '!slut', '!robar', '!canjear',
                '!subastar', '!subastas', '!ofertar',
                '!waifus', '!mascotas', '!alimentar', '!casar', '!proponer', '!divorce', '!logros', '!tareas',
                '!ver',
                '!play', '!music', '!musica', '!ytmp3', '!play2', '!cancion', '!audio',
                '!dinosaurios', '!aves', '!dragones', '!acuaticos', '!salvajes', '!miticos',
                '!parque', '!principal', '!lucha', '!escudo',
                '!aceptar_lucha', '!rechazar_lucha'
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
                    quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI,
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
                    const heavyCmds = ['!v', '!s', '!sticker', '!trace', '!top', '!waifu', '!kill', '!slap', '!punch', '!toimg', '!play', '!music', '!musica', '!ytmp3', '!play2', '!cancion', '!audio', '!mp3'];
                    if (heavyCmds.includes(start)) {
                        const wait = verificarCooldown(sender, start, 8000);
                        if (wait > 0) return sock.sendMessage(chatId, { text: `⏳ Espera ${wait}s para volver a usar *${start}*.` }, { quoted: msg });
                    }
                }

                // 3. Modo Admin (Restricción)
                const isModoAdminActivo = groupConf ? groupConf.modo_admin === 1 : (botState.modoAdmin[chatId] || false);
                if (isGroup && isModoAdminActivo && !isAdmin) return;

                // 3.5. Modo Manga (solo comandos de manga + admin)
                if (isGroup && botState.mangaMode.get(chatId)) {
                    const mangaAllowed = [
                        '!manga', '!leer', '!catalogo', '!buscar', '!recomanga', '!parar', '!setmanga',
                        '!bot', '!adm', '!menu', '!menu2', '!help', '!ping'
                    ];
                    if (!mangaAllowed.includes(start)) {
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
                    case '!play': case '!music': case '!musica': case '!ytmp3': case '!play2': emoji = '🎵'; break;
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
                    quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI,
                    sockOriginal: sock // Para comandos express que necesitan bypass de cola
                };

                // isHeavy: comandos que usan FFmpeg o descargas pesadas y por tanto deben
                // respetar el limite de procesos concurrentes (esperarSlotHeavy). Se agregaron
                // las reacciones sociales (usan FFmpeg para convertir GIF->MP4) y !waifus
                // (descarga hasta 10 imagenes), que antes evadian este limite en Render.
                const isHeavy = [
                    '!v', '!s', '!sticker', '!trace', '!toimg', '!play', '!music', '!musica', '!ytmp3', '!play2', '!cancion', '!audio', '!mp3',
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

        // --- MODO AI AUTO-RESPONSE (Si no se ejecutó un comando y es grupo) ---
        if (isCommand) return;

        const isTextMessage = ['conversation', 'extendedTextMessage'].includes(msgType);
        if (isGroup && !participaEnJuego && isTextMessage) {
            // Usamos la configuración de la caché cargada previamente si es posible
            let aiConfig = null;

            // Detección de mención robusta
            const botBare = (sock.user?.id || '').split(':')[0];
            if (!botBare) return;
            const botMent = `@${botBare}`;

            const isMentionedByTag = txt.includes(botMent) ||
                (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).some(m => m.includes(botBare));
            const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant?.includes(botBare);
            const isMentionedByName = txt.toLowerCase().includes('diky');

            const isAIRelevant = isMentionedByTag || isReplyToBot || isMentionedByName;
            const cachedGroupConfig = botState.groupCache.get(chatId);
            if (!isAIRelevant && !cachedGroupConfig) return;

            const groupConfig = cachedGroupConfig || await obtenerConfigGrupo(chatId);
            aiConfig = groupConfig.ai;

            if (aiConfig.activado) {
                const ahora = Date.now();
                const timeSinceLast = ahora - (aiConfig.last_reply || 0);

                if (isAIRelevant || timeSinceLast > 30000) {
                    await sock.sendPresenceUpdate('composing', chatId);
                    const cleanTxtIA = txt.replace(botMent, '').trim();
                    if (!cleanTxtIA && isMentionedByTag) return sock.sendMessage(chatId, { text: '¿En qué puedo ayudarte? 😺' });

                    const resIA = await chatWithLiquidAI(cleanTxtIA || 'Hola', aiConfig.contexto);
                    if (resIA) {
                        await db.updateLastAIReply(chatId);
                        return sock.sendMessage(chatId, { text: resIA }, { quoted: msg });
                    }
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
console.log('😺 Iniciando Diky Bot V2...');

// Log de versión de yt-dlp al arrancar (para diagnosticar sin necesitar Build Logs premium)
try {
    const { execFileSync } = require('child_process');
    const ytdlpPathCheck = process.platform === 'win32'
        ? path.join(__dirname, 'yt-dlp.exe')
        : 'yt-dlp';
    const ver = execFileSync(ytdlpPathCheck, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
    console.log(`🎵 [YT-DLP] Versión instalada: ${ver}`);
} catch (e) {
    console.warn('⚠️ [YT-DLP] No se pudo obtener la versión:', e.message);
}

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
