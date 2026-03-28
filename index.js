/**
 * 🤖 DIKY BOT V2 - RENDER + TURSO EDITION
 * Motor: Baileys v7 | DB: Turso Cloud | Deploy: Render
 */
require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    downloadMediaMessage,
    getContentType,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const express = require('express');
const axios = require('axios');
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
// MangaDex removido (no necesario para funcionalidad core)
const execFileAsync = promisify(execFile);

// --- CONFIG ---
const PORT = process.env.PORT || 10000;
const AUTH_DIR = path.join(__dirname, '.bot_session');
const ADMIN_NUM = process.env.NUMERO_ADMIN; // El Jefe (Permisos)
const BOT_NUMBER = process.env.NUMERO_BOT || ADMIN_NUM; // El Bot (Vinculación)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

let FFMPEG_PATH = 'ffmpeg';
try { FFMPEG_PATH = require('@ffmpeg-installer/ffmpeg').path; } catch (e) { }

// Punto 4: Caché de Administradores para máximo rendimiento
const adminCache = new Map();
const TTL_ADMIN = 10 * 60 * 1000; // 10 minutos
const cooldowns = new Map(); // ESCUDO ANTI-SPAM
let procesosActivos = 0; // LIMITADOR DE HARDWARE
const MAX_PROCESOS = 5; // Máximo de tareas pesadas simultáneas (subido de 3 a 5)
const colaHeavy = []; // Cola para tareas pesadas en espera
const MAX_COLA = 10; // Máximo de tareas encoladas

// Helper: esperar turno en la cola de tareas pesadas
function esperarSlotHeavy() {
    return new Promise((resolve) => {
        if (procesosActivos < MAX_PROCESOS) {
            procesosActivos++;
            return resolve(true);
        }
        if (colaHeavy.length >= MAX_COLA) {
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

// Flush automático cada 2 minutos
setInterval(flushStatsBatch, 2 * 60 * 1000);

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

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// --- IA CONFIG ---
const genAI = process.env.GEMINI_KEY ? new GoogleGenerativeAI(process.env.GEMINI_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// --- ESTADO GLOBAL ---
const botState = {
    pairingCode: null,
    status: 'Iniciando...',
    isConnected: false,
    startTime: Date.now(),
    msgCount: 0,
    juegos: {},       // Para trivias y ahorcado
    modoAdmin: {},    // Grupos con modo solo-admins activo
    configIA: {},      // Caché de configuración de IA por grupo
    cacheTrad: {},     // Caché de traducciones
    mangaInfo: {},     // Caché de descripciones de mangas
    silenciados: {},   // Usuarios silenciados por tiempo { userId: endTime }
    antiSpam: {
        active: true, // Activado por defecto
        limit: 100,    // 100 comandos
        interval: 60 * 60 * 1000, // 1 hora
        banTime: 2 * 60 * 60 * 1000, // 2 horas
        tracker: new Map() // { userId: { count, startTime } }
    },
    seConectoAlgunaVez: false, // Flag para evitar nukear sesiones vivas
    instanceId: Math.random().toString(36).substring(7).toUpperCase(),
    bounties: {},
    escudos: {},
    groupCache: new Map(), // Caché de configuración de grupos
    adminCache: new Map()  // Caché de administradores
};

const TTL_CONFIG = 5 * 60 * 1000; // 5 minutos para caché de config

// Helper para obtener configuración de grupo con caché agresiva
async function obtenerConfigGrupo(chatId) {
    const ahora = Date.now();
    const cached = botState.groupCache.get(chatId);
    if (cached && (ahora - cached.time < TTL_CONFIG)) return cached.data;

    try {
        const [active, ai] = await Promise.all([
            db.estaGrupoActivo(chatId),
            db.getModoAI(chatId)
        ]);

        const config = { active, ai };
        botState.groupCache.set(chatId, { data: config, time: ahora });
        return config;
    } catch (e) {
        return cached ? cached.data : { active: null, ai: { activado: false } };
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

const MAX_AI_CONCURRENT = 2; // Máximo de llamadas a IA simultáneas
let currentAICalls = 0;

async function chatWithLiquidAI(texto, contexto = '') {
    if (currentAICalls >= MAX_AI_CONCURRENT) {
        return "⚠️ *IA OCUPADA:* Demasiadas peticiones simultáneas. Reintenta en breve.";
    }

    currentAICalls++;
    try {
        const rawKeys = process.env.OPENROUTER_KEY || '';
        const keys = rawKeys.split(',').map(k => k.trim()).filter(k => k);

        if (keys.length === 0) {
            // Si no hay OpenRouter, intentamos Gemini directamente
            if (aiModel) return await chatWithGemini(texto, contexto);
            return "⚠️ Sin llaves de IA configuradas.";
        }

        // Rotación de llaves OpenRouter
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            try {
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'liquid/lfm-2.5-1.2b-thinking:free',
                    messages: [
                        { role: 'system', content: `Eres Diky Bot, un bot de WhatsApp amigable. ${contexto}` },
                        { role: 'user', content: texto }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                }, {
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'HTTP-Referer': `https://github.com/Dex865378/bot-manga-whatsapp`,
                        'X-Title': `Diky Bot V2`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                });

                let content = response.data?.choices?.[0]?.message?.content;
                if (content) {
                    const cleanContent = content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
                    return cleanContent || content;
                }
            } catch (e) {
                console.error(`⚠️ Llave OpenRouter ${i + 1} falló:`, e.response?.data?.error?.message || e.message);
                // Si no es la última llave, continuamos al siguiente intento
                if (i < keys.length - 1) continue;
            }
        }

        // Si todo falla, intentamos con Gemini como respaldo final
        if (aiModel) {
            console.log('🔄 Usando Gemini como respaldo...');
            return await chatWithGemini(texto, contexto);
        }

    } finally {
        currentAICalls = Math.max(0, currentAICalls - 1);
    }
}

// Función de respaldo con Gemini
async function chatWithGemini(texto, contexto = '') {
    try {
        const prompt = `Eres Diky Bot, un bot de WhatsApp divertido. Instrucciones: ${contexto}\n\nUsuario dice: ${texto}`;
        const result = await aiModel.generateContent(prompt);
        return (await result.response).text().trim();
    } catch (e) {
        console.error('❌ Error Gemini:', e.message);
        return "❌ Error total: OpenRouter y Gemini están fuera de servicio.";
    }
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
    <div class="sb">${statusHtml}</div>
    <div class="st">
        <p>⏱️ <b>Uptime:</b> ${h}h ${m}m ${s}s</p>
        <p>📨 <b>Mensajes:</b> ${botState.msgCount}</p>
        <p>☁️ <b>DB:</b> ${dbBadge}</p>
        <p>🔧 <b>Admin:</b> ${ADMIN_NUM || '⚠️'}</p>
    </div></div></body></html>`);
});

app.get('/health', (req, res) => res.json({ ok: true, connected: botState.isConnected }));
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
        const vf = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
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
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version: waVersion,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false, // Ahorra CPU y RAM
        getMessage: async () => undefined // No retener mensajes viejos en RAM
    });

    const needsPairing = !sock.authState.creds.registered && BOT_NUMBER;
    let pairingRequested = false;

    // PRIMERO registrar event handlers
    sock.ev.on('creds.update', saveCreds);

    // --- CONEXIÓN ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Si recibimos QR y necesitamos pairing, pedirlo ahora
        if (qr && needsPairing && !pairingRequested) {
            // Si ya tenemos un código activo, no pedir otro tan rápido
            if (botState.pairingCode) {
                console.log('♻️ Usando código existente:', botState.pairingCode);
                botState.status = `Vincula con: ${botState.pairingCode}`;
                return;
            }

            pairingRequested = true;
            const phoneClean = BOT_NUMBER.replace(/[^0-9]/g, '');
            console.log(`📱 Solicitando código de vinculación para: ${phoneClean}...`);
            botState.status = `Generando para ${phoneClean}...`;

            try {
                // Esperar 5 segundos para asegurar que el socket esté totalmente listo
                await delay(5000);
                const code = await sock.requestPairingCode(phoneClean);
                botState.pairingCode = code;
                console.log('🔑 ¡NUEVO CÓDIGO GENERADO!:', code);
                botState.status = `VINCULAR CON: ${code}`;
            } catch (e) {
                console.error('❌ Error al solicitar código:', e.message);
                pairingRequested = false;
                botState.status = `Error: ${e.message.split(' ')[0]}. Reintentando...`;

                // Si hay rate limit, esperamos más tiempo
                if (e.message.includes('rate-overlimit')) {
                    console.log('⏳ Bloqueo por exceso de intentos. Esperando 1 minuto...');
                    await delay(60000);
                }
            }
        }

        if (connection === 'open') {
            console.log('✅ BOT CONECTADO');
            botState.isConnected = true;
            botState.pairingCode = null;
            botState.status = 'Online';
            botState.seConectoAlgunaVez = true; // Marcar que SÍ logró conectarse
            errores401 = 0; // Reset del contador de errores al conectar exitosamente

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
                    await db.nukeSession().catch(() => { });
                    if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    fs.mkdirSync(AUTH_DIR, { recursive: true });
                    botState.pairingCode = null;
                    console.log('🔄 Reiniciando en 10s con sesión limpia...');
                    setTimeout(startBot, 10000);
                    return;
                }

                // Reconectar con espera gradual
                const waitTime = errores401 * 10000;
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
                botState.pairingCode = null;
                setTimeout(startBot, 5000);
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
        const messages = upsert.messages || [];
        const ahora = Math.floor(Date.now() / 1000);

        for (const msg of messages) {
            if (!msg.message) continue;

            // IGNORAR mensajes extremadamente viejos (más de 1 hora) para evitar lag
            const msgTime = msg.messageTimestamp;
            if (ahora - msgTime > 3600) continue;

            const fromMe = msg.key.fromMe;
            if (fromMe) {
                const tipo = getContentType(msg.message);
                let texto = '';
                if (tipo === 'conversation') texto = msg.message.conversation || '';
                else if (tipo === 'extendedTextMessage') texto = msg.message.extendedTextMessage?.text || '';
                if (!texto.trim().startsWith('!')) continue;
            }

            // PROCESAMIENTO CONCURRENTE: No esperamos a que termine uno para empezar el otro
            // Esto reduce drásticamente el lag cuando llegan varios mensajes a la vez
            procesarMensaje(sock, msg)
                .then(() => { botState.msgCount++; })
                .catch(e => console.error('❌ Error procesando mensaje:', e.message));
        }
    });

    // --- BIENVENIDAS ---
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        console.log(`👥 Evento grupo: ${action} en ${id} para ${participants.length} usuarios`);
        if (action !== 'add') return;
        try {
            const conf = await db.tieneBienvenida(id);
            console.log(`✨ Bienvenida en ${id}: ${conf.activa}`);
            if (!conf.activa) return;
            for (const p of participants) {
                const nombre = p.split('@')[0];

                let defaultMsg = `¡Hola @${nombre}! 🎉\nBienvenid@ al grupo.\n\n📜 Escribe *!menu* para ver todos los comandos.\n🎮 Hay juegos, stickers, anime y mucho más.\n\n¡Diviértete! 🐱✨`;
                let customMsg = conf.mensaje || defaultMsg;
                // Reemplazar {usuario} o {user} por el @ y el número
                customMsg = customMsg.replace(/{usuario}/gi, `@${nombre}`).replace(/{user}/gi, `@${nombre}`);

                // Si el mensaje custom NO incluye el @nombre, se lo agregamos al principio para mencionarlo forzosamente
                if (!customMsg.includes(`@${nombre}`)) {
                    customMsg = `¡Hola @${nombre}!\n\n` + customMsg;
                }

                // 1. Enviar imagen de bienvenida con descripción
                const imgPath = path.join(__dirname, 'imagen_bienvenida.png');
                if (fs.existsSync(imgPath)) {
                    try {
                        const captionFinal = `╔══════════════════════╗\n║    😺 *¡BIENVENID@!* 😺    ║\n╚══════════════════════╝\n\n${customMsg}`;
                        await sock.sendMessage(id, {
                            image: fs.readFileSync(imgPath),
                            caption: captionFinal,
                            mentions: [p]
                        });
                        console.log(`📸 Imagen de bienvenida enviada a ${nombre}`);
                    } catch (eImg) {
                        console.error(`❌ Error enviando imagen de bienvenida:`, eImg.message);
                        // Fallback: solo texto si la imagen falla
                        await sock.sendMessage(id, {
                            text: customMsg,
                            mentions: [p]
                        });
                    }
                } else {
                    // Sin imagen: solo texto
                    await sock.sendMessage(id, {
                        text: customMsg,
                        mentions: [p]
                    });
                }

                // 2. Pausa para evitar bloqueo de WhatsApp
                await delay(1500);

                // 3. Enviar sticker de bienvenida
                const stickerPath = path.join(__dirname, 'sticker_bienvenida.webp');
                if (fs.existsSync(stickerPath)) {
                    try {
                        await sock.sendMessage(id, { sticker: fs.readFileSync(stickerPath) });
                        console.log(`🏷️ Sticker de bienvenida enviado a ${nombre}`);
                    } catch (eStk) {
                        console.error(`❌ Error enviando sticker de bienvenida:`, eStk.message);
                    }
                }

                // 4. Pausa entre usuarios si hay varios
                if (participants.length > 1) await delay(2000);
            }
        } catch (e) { console.error('❌ Error bienvenida:', e.message); }
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
        if (botState.silenciados[sender] && Date.now() < botState.silenciados[sender]) return;

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
            const u = await db.obtenerUsuario(sender);
            if (u && u.nombre_wa !== pushName) {
                await db.actualizarUsuario(sender, { nombre_wa: pushName }).catch(() => { });
            }
        }

        // --- FILTRO DE RELEVANCIA (Ahorro de CPU) ---
        const participaEnJuego = juegoActivo && (
            juegoActivo.responder === sender ||
            juegoActivo.pareja === sender ||
            juegoActivo.solicitante === sender ||
            juegoActivo.tipo === 'ahorcado'
        );

        if (!isCommand && !participaEnJuego && !isGroup) return;

        // --- SETUP DE PRIVILEGIOS (Solo si el mensaje es relevante) ---
        const cleanNumber = (n) => (n || '').split('@')[0].replace(/\D/g, '');
        const adminEnv = process.env.NUMERO_ADMIN || '';
        const adminsList = adminEnv.split(',').map(n => cleanNumber(n)).filter(n => (n && n.length >= 7));
        const senderClean = cleanNumber(sender);

        const isGlobalAdmin = adminsList.some(adminClean =>
            senderClean.includes(adminClean) || adminClean.includes(senderClean)
        );
        let isAdmin = isGlobalAdmin;

        if (isGroup && !isAdmin) {
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

        // --- LÓGICA DE RESPUESTA A JUEGOS (Antes de Comandos) ---
        if (botState.juegos[chatId]) {
            const context = { chatId, sender, cmd, txt, quotedMsgId, botState, db, isCommand };
            const wasGameResponse = await handleGameResponse(sock, msg, context);
            if (wasGameResponse) return;
        }

        if (isCommand) {
            const start = cmd.split(' ')[0];
            const comandosValidos = [
                '!menu', '!menu2', '!ping', '!s', '!sticker', '!v', '!toimg', '!ascii',
                '!profile', '!p', '!perfil', '!config', '!marry', '!divorce',
                '!catalogo', '!manga', '!leer', '!buscar',
                '!decir', '!waifu', '!trace', '!personaje', '!anime', '!proximo', '!estrenos', '!temporada', '!wiki', '!estudio', '!recomendar', '!random',
                '!quiz', '!quizanime', '!adivina', '!matematicas', '!bandera', '!ahorcado', '!pescar', '!pokemon', '!duelo',
                '!slot', '!ppt', '!pptx', '!minar', '!apostar', '!dado', '!moneda', '!8ball', '!ruleta',
                '!roast', '!cumplido', '!ship', '!love', '!gay', '!iq', '!suerte', '!top', '!horoscopo', '!seria', '!kill', '!chiste', '!hacker', '!reto', '!verdad',
                '!pat', '!hug', '!kiss', '!slap', '!punch', '!cry', '!dance', '!bite', '!highfive',
                '!fumar', '!cafe', '!puchero', '!sonrojar', '!baka', '!dormir', '!comiendo', '!pensar',
                '!patear', '!celebrar', '!aburrido', '!risa', '!smug', '!stare',
                '!tag', '!reglas', '!kick', '!adm', '!bot', '!bienvenida', '!setbienvenida', '!news', '!sorteo', '!ia',
                '!bj', '!poker', '!minas', '!carta', '!donde', '!deljuego', '!suelten', '!carrera',
                '!puente', '!mazmorra', '!cofre', '!bomba', '!cazar',
                '!tienda', '!comprar', '!vender', '!inventario', '!mejor', '!bounty', '!regalar', '!regalaritem',
                '!antispam', '!mododios',
                '!prestigio', '!loteria', '!clase', '!pedir', '!plantarse', '!pl', '!trivia', '!daily', '!w', '!slut', '!canjear', '!dar',
                '!subastar', '!subastas', '!ofertar',
                '!waifus',
                '!ver'
            ];

            // --- SISTEMA DE ESTABILIDAD: COOLDOWN GLOBAL DE 2 SEGUNDOS ---
            const globalWait = verificarCooldown(sender, 'global', 2000);
            if (globalWait > 0 && !isAdmin) {
                return; // Silencioso para no saturar
            }

            if (comandosValidos.includes(start)) {
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

                // 2. SISTEMA DE COOLDOWN (Prevención de saturación de CPU)
                if (!isAdmin) {
                    const heavyCmds = ['!v', '!s', '!sticker', '!trace', '!top', '!waifu', '!kill', '!slap', '!punch', '!toimg'];
                    if (heavyCmds.includes(start)) {
                        const wait = verificarCooldown(sender, start, 8000); // 8 segundos de cooldown para comandos pesados
                        if (wait > 0) return sock.sendMessage(chatId, { text: `⏳ Espera ${wait}s para volver a usar *${start}*.` }, { quoted: msg });
                    }
                }

                // 3. Modo Admin (Restricción)
                const isModoAdminActivo = groupConf ? groupConf.modo_admin === 1 : (botState.modoAdmin[chatId] || false);
                if (isGroup && isModoAdminActivo && !isAdmin) return;

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

                    if (stats.count > botState.antiSpam.limit) {
                        botState.silenciados[sender] = ahora + botState.antiSpam.banTime;
                        botState.antiSpam.tracker.delete(sender); // Limpiar rastro tras baneo
                        return sock.sendMessage(chatId, {
                            text: `🚫 *SISTEMA ANTI-SPAM:* Has superado el límite de 100 comandos por hora.\n⚡ Quedarás silenciado por las próximas *2 horas*.\n\n_Diky Bot prefiere calidad antes que cantidad._`
                        }, { quoted: msg });
                    }

                    // Limpieza periódica del Map (para no saturar RAM)
                    if (Math.random() < 0.05) { // 5% de probabilidad en cada comando
                        for (const [uid, s] of botState.antiSpam.tracker.entries()) {
                            if (ahora - s.startTime > botState.antiSpam.interval) botState.antiSpam.tracker.delete(uid);
                        }
                    }
                }

                if (isAdmin) {
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
                    case '!pedir': emoji = '➕'; break;
                    case '!plantarse': case '!pl': emoji = '✋'; break;
                    case '!bienvenida': case '!setbienvenida': emoji = '👋'; break;
                    case '!waifus': emoji = '🎀'; break;
                }

                // Efecto de Grimorio (Solo si es un comando que suele usar economía)
                if (['!menu', '!tienda', '!minar', '!perfil', '!p'].includes(start)) {
                    db.obtenerUsuario(sender).then(u => {
                        if (u && u.inventario) {
                            try {
                                const inv = JSON.parse(u.inventario);
                                if (inv.grimorio > 0) sock.sendMessage(chatId, { react: { text: '🔮', key: msg.key } }).catch(() => { });
                            } catch (e) { }
                        }
                    }).catch(() => { });
                }

                sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } }).catch(() => { });

                // 5. EJECUTAR COMANDO MODULAR
                const args = txt.split(' ').slice(1);
                const extras = {
                    start, cmd, txt, args, sender, pushName, isGroup, isAdmin, isGlobalAdmin,
                    botState, db, delay, FFMPEG_PATH, ADMIN_NUM,
                    traducirConCache, convertirAWebp, downloadMediaMessage,
                    quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI
                };

                const isHeavy = ['!v', '!s', '!sticker', '!trace', '!toimg'].includes(start);
                if (isHeavy) {
                    const gotSlot = await esperarSlotHeavy();
                    if (!gotSlot) {
                        return sock.sendMessage(chatId, { text: '⏳ Hay muchas tareas en espera. Intenta en unos segundos.' }, { quoted: msg });
                    }
                }

                try {
                    const mExecuted = await handler.handleCommand(start, sock, chatId, msg, args, extras);
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
        const isTextMessage = ['conversation', 'extendedTextMessage'].includes(msgType);
        if (isGroup && !participaEnJuego && isTextMessage) {
            // Usamos la configuración de la caché cargada previamente si es posible
            const groupConfig = await obtenerConfigGrupo(chatId);
            const aiConfig = groupConfig.ai;

            // Detección de mención robusta
            const botBare = (sock.user?.id || '').split(':')[0];
            if (!botBare) return;
            const botMent = `@${botBare}`;

            const isMentionedByTag = txt.includes(botMent) ||
                (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).some(m => m.includes(botBare));
            const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant?.includes(botBare);
            const isMentionedByName = txt.toLowerCase().includes('diky');

            const isAIRelevant = isMentionedByTag || isReplyToBot || isMentionedByName;

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
        console.error('❌ Error fatal en procesarMensaje:', e);
    }
}

// ============================================================
//                     ¡ARRANCAR! 🚀
// ============================================================
console.log('😺 Iniciando Diky Bot V2...');
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
    console.error('❌ [FATAL ERROR] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ [FATAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});
