/**
 * 🗄️ MÓDULO DE BASE DE DATOS - TURSO (Optimizado y Estable)
 * Bot Manga v11.0 - Neko Engine
 */
const { createClient } = require('@libsql/client');
require('dotenv').config();

let dbClient = null;
let connected = false;

// Caché de usuarios para evitar consultas redundantes (Lectura ultra rápida)
const userCache = new Map();

async function init() {
    if (connected && dbClient) return true;
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url || !token) {
        console.warn('⚠️ [DB] Sin credenciales de Turso.');
        return false;
    }
    try {
        dbClient = createClient({ url, authToken: token });
        await dbClient.execute('SELECT 1');
        connected = true;
        console.log('✅ [DB] Conectado a Turso Cloud.');
        await crearTablas();
        return true;
    } catch (e) {
        console.error('❌ [DB] Error de conexión:', e.message);
        connected = false;
        return false;
    }
}

async function crearTablas() {
    if (!connected) return;
    const tablas = [
        `CREATE TABLE IF NOT EXISTS auth_keys (id TEXT PRIMARY KEY, data TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS mangas (codigo TEXT PRIMARY KEY, titulo TEXT, carpeta TEXT, descripcion TEXT, generos TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS grupos_activados (chat_id TEXT PRIMARY KEY, activado_por TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS grupos_bienvenida (chat_id TEXT PRIMARY KEY, mensaje TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS grupos_ai (chat_id TEXT PRIMARY KEY, activado INTEGER DEFAULT 0, contexto TEXT, last_reply INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS usuarios (
            user_id TEXT PRIMARY KEY, nombre TEXT, edad INTEGER, nacimiento TEXT, altura TEXT, descripcion TEXT, superpoder TEXT, 
            manga_fav TEXT, anime_fav TEXT, waifu_husbando TEXT, pareja TEXT, titulo TEXT, 
            monedas INTEGER DEFAULT 100, xp INTEGER DEFAULT 0, nivel INTEGER DEFAULT 1, 
            duelos_ganados INTEGER DEFAULT 0, duelos_perdidos INTEGER DEFAULT 0,
            racha_diaria INTEGER DEFAULT 0, ultima_actividad_racha INTEGER DEFAULT 0,
            total_comandos INTEGER DEFAULT 0, shenlong_invocado INTEGER DEFAULT 0,
            karma INTEGER DEFAULT 0, pocion_exp_fin INTEGER DEFAULT 0, cazarrecompensas_fin INTEGER DEFAULT 0,
            last_daily INTEGER DEFAULT 0, last_work INTEGER DEFAULT 0, last_slut INTEGER DEFAULT 0,
            record_pesca TEXT, inventario TEXT DEFAULT '{}', nombre_wa TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS auctions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id TEXT,
            chat_id TEXT,
            item_name TEXT,
            start_price INTEGER,
            current_bid INTEGER,
            highest_bidder_id TEXT,
            end_time INTEGER,
            status TEXT DEFAULT 'active'
        )`
    ];
    try {
        for (const sql of tablas) await dbClient.execute(sql);

        // Migraciones básicas
        const allCols = [
            'ALTER TABLE auctions ADD COLUMN chat_id TEXT',
            'ALTER TABLE usuarios ADD COLUMN inventario TEXT DEFAULT \'{}\'',
            'ALTER TABLE usuarios ADD COLUMN duelos_ganados INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN duelos_perdidos INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN racha_diaria INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN ultima_actividad_racha INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN total_comandos INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN shenlong_invocado INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN karma INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN pocion_exp_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN cazarrecompensas_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN record_pesca TEXT',
            'ALTER TABLE usuarios ADD COLUMN xp INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN nivel INTEGER DEFAULT 1',
            'ALTER TABLE usuarios ADD COLUMN monedas INTEGER DEFAULT 100',
            'ALTER TABLE usuarios ADD COLUMN pareja TEXT',
            'ALTER TABLE usuarios ADD COLUMN nombre_wa TEXT',
            'ALTER TABLE usuarios ADD COLUMN last_daily INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN last_work INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN last_slut INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN clase TEXT DEFAULT "Novato"',
            'ALTER TABLE usuarios ADD COLUMN logros TEXT DEFAULT "{}"',
            'ALTER TABLE usuarios ADD COLUMN recompensa INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN prestigio INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN escudo_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN guardaespalda_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN cebo_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN pico_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN pico_usos INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN cebo_usos INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN brujula_usos INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN clase_fin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN last_bounty INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN historial TEXT DEFAULT "[]"',
            'ALTER TABLE usuarios ADD COLUMN antispam INTEGER DEFAULT 1',
            'ALTER TABLE usuarios ADD COLUMN modo_admin INTEGER DEFAULT 0',
            'ALTER TABLE usuarios ADD COLUMN pareja TEXT DEFAULT NULL',
            'ALTER TABLE usuarios ADD COLUMN mascota_tipo TEXT DEFAULT NULL',
            'ALTER TABLE usuarios ADD COLUMN mascota_nombre TEXT DEFAULT "Mascota"',
            'ALTER TABLE usuarios ADD COLUMN mascota_hambre INTEGER DEFAULT 100',
            'ALTER TABLE usuarios ADD COLUMN mascota_last_fed BIGINT DEFAULT 0',
            'ALTER TABLE grupos_activados ADD COLUMN flash_enabled INTEGER DEFAULT 0',
            'ALTER TABLE grupos_activados ADD COLUMN antispam INTEGER DEFAULT 1',
            'ALTER TABLE grupos_activados ADD COLUMN modo_admin INTEGER DEFAULT 0'
        ];
        for (const sql of allCols) {
            try { await dbClient.execute(sql); } catch (e) { }
        }
        console.log('📦 [DB] Estructura verificada.');
    } catch (e) { console.error('❌ [DB] Error en tablas:', e.message); }
}

// ========== FUNCIONES DE SUBASTAS ==========

async function crearSubasta(sellerId, chatId, itemName, startPrice, durationMs) {
    if (!connected) return null;
    try {
        const endTime = Date.now() + durationMs;
        const res = await dbClient.execute({
            sql: 'INSERT INTO auctions (seller_id, chat_id, item_name, start_price, current_bid, end_time) VALUES (?, ?, ?, ?, ?, ?)',
            args: [sellerId, chatId, itemName, startPrice, startPrice, endTime]
        });
        return res.lastInsertRowid;
    } catch (e) {
        console.error('❌ [DB] Error crearSubasta:', e.message);
        return null;
    }
}

async function obtenerSubastasActivas() {
    if (!connected) return [];
    try {
        const rs = await dbClient.execute("SELECT * FROM auctions WHERE status = 'active'");
        return rs.rows;
    } catch (e) { return []; }
}

async function pujarSubasta(auctionId, bidderId, amount) {
    if (!connected) return false;
    try {
        await dbClient.execute({
            sql: 'UPDATE auctions SET current_bid = ?, highest_bidder_id = ? WHERE id = ?',
            args: [amount, bidderId, auctionId]
        });
        return true;
    } catch (e) { return false; }
}

async function finalizarSubasta(auctionId) {
    if (!connected) return false;
    try {
        await dbClient.execute({
            sql: "UPDATE auctions SET status = 'finished' WHERE id = ?",
            args: [auctionId]
        });
        return true;
    } catch (e) { return false; }
}

async function obtenerSubasta(id) {
    if (!connected) return null;
    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM auctions WHERE id = ?', args: [id] });
        return rs.rows[0] || null;
    } catch (e) { return null; }
}

// ========== FUNCIONES DE USUARIO (EL CORAZÓN) ==========

async function obtenerUsuario(userId) {
    // LRU: si existe, mover al final (más reciente)
    if (userCache.has(userId)) {
        const val = userCache.get(userId);
        userCache.delete(userId);
        userCache.set(userId, val);
        return val;
    }
    if (!connected) return null;

    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM usuarios WHERE user_id = ?', args: [userId] });
        let user;
        if (rs.rows.length > 0) {
            user = rs.rows[0];
        } else {
            console.log(`🆕 [DB] Creando usuario: ${userId}`);
            await dbClient.execute({
                sql: 'INSERT INTO usuarios (user_id, monedas, xp, nivel) VALUES (?, 100, 0, 1)',
                args: [userId]
            });
            const nuevo = await dbClient.execute({ sql: 'SELECT * FROM usuarios WHERE user_id = ?', args: [userId] });
            user = nuevo.rows[0];
        }

        if (user) {
            userCache.set(userId, user);
            // Evicción LRU gradual: eliminar los más viejos si pasa de 500
            while (userCache.size > 500) {
                const oldest = userCache.keys().next().value;
                userCache.delete(oldest);
            }
        }
        return user;
    } catch (e) {
        console.error(`❌ [DB] Error obtenerUsuario (${userId}):`, e.message);
        return null;
    }
}

async function actualizarUsuario(userId, campos) {
    // Actualizar caché para respuesta inmediata
    if (userCache.has(userId)) {
        userCache.set(userId, { ...userCache.get(userId), ...campos });
    }

    if (!connected) return false;
    try {
        const keys = Object.keys(campos);
        if (keys.length === 0) return true;
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const args = [...Object.values(campos), userId];
        await dbClient.execute({ sql: `UPDATE usuarios SET ${setClause} WHERE user_id = ?`, args });
        return true;
    } catch (e) {
        console.error(`❌ [DB] Error actualizarUsuario:`, e.message);
        return false;
    }
}

async function sumarMonedas(userId, cantidad) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    
    // El multiplicador de prestigio solo debe aplicar a las GANANCIAS, no a las pérdidas/restas.
    const mult = cantidad > 0 ? (1 + ((u.prestigio || 0) * 0.1)) : 1;
    const final = Math.floor(cantidad * mult);
    
    // Asegurar que el balance nunca baje de 0
    const nuevas = Math.max(0, (u.monedas || 0) + final);
    return await actualizarUsuario(userId, { monedas: nuevas });
}

async function obtenerBalance(userId) {
    const u = await obtenerUsuario(userId);
    if (!u) return 0;
    let total = u.monedas || 0;
    if (u.pareja) {
        const p = await obtenerUsuario(u.pareja);
        if (p) total += (p.monedas || 0);
    }
    return total;
}

async function deducirMonedas(userId, cantidad) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;

    let totalDisponible = u.monedas || 0;
    let tienePareja = false;
    let partner = null;

    if (u.pareja) {
        partner = await obtenerUsuario(u.pareja);
        if (partner) {
            totalDisponible += (partner.monedas || 0);
            tienePareja = true;
        }
    }

    if (totalDisponible < cantidad) return false;

    let resto = cantidad;
    let misMonedas = u.monedas || 0;

    if (misMonedas >= resto) {
        return await sumarMonedas(userId, -resto);
    } else {
        // Gastar todo lo mío y el resto del partner
        await actualizarUsuario(userId, { monedas: 0 });
        resto -= misMonedas;
        if (tienePareja && partner) {
            return await sumarMonedas(u.pareja, -resto);
        }
    }
    return false;
}

async function sumarXP(userId, cantidad) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;

    let nx = (u.xp || 0);
    let nl = u.nivel || 1;
    let subio = false;

    // Bono de Poción de Sabiduría (2x XP)
    let cantidadFinal = cantidad;
    if (u.pocion_exp_fin && u.pocion_exp_fin > Date.now() && cantidad > 0) {
        cantidadFinal = cantidad * 2;
    }

    // Bono de Clase Sacerdote (+50% XP)
    if (u.clase === 'Sacerdote' && cantidad > 0) {
        cantidadFinal = Math.floor(cantidadFinal * 1.5);
    }

    // ✅ FIX: Sumar el XP al acumulado actual
    nx += cantidadFinal;

    // ✅ FIX: Calcular subida de nivel (cada nivel requiere nivel*100 XP)
    const xpParaSiguienteNivel = () => nl * 100;
    while (nx >= xpParaSiguienteNivel()) {
        nx -= xpParaSiguienteNivel();
        nl++;
        subio = true;
    }
    if (nx < 0) nx = 0; // Nunca negativo

    await actualizarUsuario(userId, { xp: nx, nivel: nl });
    return subio; // true si subió de nivel
}

async function registrarVictoriaDuelo(userId) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    const n = (u.duelos_ganados || 0) + 1;
    return await actualizarUsuario(userId, { duelos_ganados: n });
}

async function registrarDerrotaDuelo(userId) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    const n = (u.duelos_perdidos || 0) + 1;
    return await actualizarUsuario(userId, { duelos_perdidos: n });
}

async function agregarItem(userId, itemName, cantidad = 1) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    let inv = {};
    try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }
    inv[itemName.toLowerCase()] = (inv[itemName.toLowerCase()] || 0) + cantidad;
    return await actualizarUsuario(userId, { inventario: JSON.stringify(inv) });
}

async function removerItem(userId, itemName, cantidad = 1) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    let inv = {};
    try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }
    const current = (inv[itemName.toLowerCase()] || 0);
    if (current < cantidad) return false;
    inv[itemName.toLowerCase()] = current - cantidad;
    if (inv[itemName.toLowerCase()] <= 0) delete inv[itemName.toLowerCase()];
    return await actualizarUsuario(userId, { inventario: JSON.stringify(inv) });
}

async function registrarComando(userId) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    const n = (u.total_comandos || 0) + 1;
    return await actualizarUsuario(userId, { total_comandos: n });
}

async function actualizarRacha(userId) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;

    const ahora = Date.now();
    const unDia = 24 * 60 * 60 * 1000;
    const ultima = u.ultima_actividad_racha || 0;

    let racha = u.racha_diaria || 0;

    if (ahora - ultima > unDia * 2) {
        racha = 1; // Se perdió la racha
    } else if (ahora - ultima > unDia) {
        racha++; // Pasó un día, aumenta
    } else if (ultima === 0) {
        racha = 1; // Primera vez
    }
    // Si fue hace menos de un día, no hacemos nada a la racha pero actualizamos el timer si queremos precisión día a día
    // Pero solo actualizamos racha una vez por día real.

    if (ahora - ultima > unDia || ultima === 0) {
        return await actualizarUsuario(userId, { racha_diaria: racha, ultima_actividad_racha: ahora });
    }
    return true;
}


async function sumarKarma(userId, cantidad) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    const n = (u.karma || 0) + cantidad;
    return await actualizarUsuario(userId, { karma: n });
}

async function registrarHistorial(userId, mensaje) {
    const u = await obtenerUsuario(userId);
    if (!u) return false;
    let hist = [];
    try { hist = JSON.parse(u.historial || '[]'); } catch (e) { }
    hist.unshift({ m: mensaje, t: Date.now() });
    if (hist.length > 10) hist = hist.slice(0, 10); // Límite de 10 entradas
    return await actualizarUsuario(userId, { historial: JSON.stringify(hist) });
}

// ========== OTRAS FUNCIONES ==========

async function nukeSession() {
    if (!connected) return false;
    try { await dbClient.execute('DELETE FROM auth_keys'); return true; } catch (e) { return false; }
}

async function getAuthKey(id) {
    if (!connected) return null;
    try {
        const rs = await dbClient.execute({ sql: 'SELECT data FROM auth_keys WHERE id = ?', args: [id] });
        return rs.rows.length > 0 ? rs.rows[0].data : null;
    } catch (e) { return null; }
}

async function getAuthKeys(ids) {
    if (!connected || !ids.length) return {};
    try {
        const placeholders = ids.map(() => '?').join(', ');
        const rs = await dbClient.execute({
            sql: `SELECT id, data FROM auth_keys WHERE id IN (${placeholders})`,
            args: ids
        });
        const result = {};
        rs.rows.forEach(row => { result[row.id] = row.data; });
        return result;
    } catch (e) { return {}; }
}

async function saveAuthKey(id, data) {
    if (!connected) return false;
    try {
        await dbClient.execute({
            sql: 'INSERT INTO auth_keys (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = CURRENT_TIMESTAMP',
            args: [id, data, data]
        });
        return true;
    } catch (e) { return false; }
}

async function deleteAuthKey(id) {
    if (!connected) return false;
    try { await dbClient.execute({ sql: 'DELETE FROM auth_keys WHERE id = ?', args: [id] }); return true; } catch (e) { return false; }
}

async function guardarManga(codigo, titulo, carpeta, descripcion = '', generos = '') {
    if (!connected) return false;
    try {
        await dbClient.execute({
            sql: 'INSERT INTO mangas (codigo, titulo, carpeta, descripcion, generos) VALUES (?, ?, ?, ?, ?) ON CONFLICT(codigo) DO UPDATE SET titulo = ?, carpeta = ?, descripcion = ?, generos = ?',
            args: [codigo, titulo, carpeta, descripcion, generos, titulo, carpeta, descripcion, generos]
        });
        return true;
    } catch (e) { return false; }
}

async function obtenerMangas() {
    if (!connected) return [];
    try { const rs = await dbClient.execute('SELECT * FROM mangas'); return rs.rows; } catch (e) { return []; }
}

async function buscarMangas(query) {
    if (!connected) return [];
    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM mangas WHERE LOWER(titulo) LIKE ?', args: [`%${query.toLowerCase()}%`] });
        return rs.rows;
    } catch (e) { return []; }
}

async function estaGrupoActivo(chatId) {
    if (!connected) await init();
    try {
        const res = await dbClient.execute({
            sql: 'SELECT * FROM grupos_activados WHERE chat_id = ?',
            args: [chatId]
        });
        return res.rows[0] || null;
    } catch (e) { return null; }
}

async function activarGrupo(chatId, activadoPor) {
    if (!connected) await init();
    try {
        await dbClient.execute({ sql: 'INSERT INTO grupos_activados (chat_id, activado_por) VALUES (?, ?) ON CONFLICT(chat_id) DO NOTHING', args: [chatId, activadoPor] });
        return true;
    } catch (e) { return false; }
}

async function desactivarGrupo(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'DELETE FROM grupos_activados WHERE chat_id = ?', args: [chatId] }); return true; } catch (e) { return false; }
}

async function tieneBienvenida(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT mensaje FROM grupos_bienvenida WHERE chat_id = ?', args: [chatId] });
        if (rs.rows.length > 0) return { activa: true, mensaje: rs.rows[0].mensaje };
        return { activa: false };
    } catch (e) { return { activa: false }; }
}

async function activarBienvenida(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'INSERT INTO grupos_bienvenida (chat_id) VALUES (?) ON CONFLICT(chat_id) DO NOTHING', args: [chatId] }); return true; } catch (e) { return false; }
}

async function desactivarBienvenida(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'DELETE FROM grupos_bienvenida WHERE chat_id = ?', args: [chatId] }); return true; } catch (e) { return false; }
}

async function setMensajeBienvenida(chatId, mensaje) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'INSERT INTO grupos_bienvenida (chat_id, mensaje) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET mensaje = ?',
            args: [chatId, mensaje, mensaje]
        });
        return true;
    } catch (e) { return false; }
}

async function setModoAI(chatId, activado, contexto = '') {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'INSERT INTO grupos_ai (chat_id, activado, contexto) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET activado = ?, contexto = ?',
            args: [chatId, activado ? 1 : 0, contexto, activado ? 1 : 0, contexto]
        });
        return true;
    } catch (e) { return false; }
}

async function getModoAI(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT activado, contexto, last_reply FROM grupos_ai WHERE chat_id = ?', args: [chatId] });
        if (rs.rows.length > 0) return { activado: rs.rows[0].activado === 1, contexto: rs.rows[0].contexto, last_reply: rs.rows[0].last_reply };
    } catch (e) { }
    return { activado: false, contexto: '', last_reply: 0 };
}

async function updateLastAIReply(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'UPDATE grupos_ai SET last_reply = ? WHERE chat_id = ?', args: [Date.now(), chatId] }); return true; } catch (e) { return false; }
}

async function obtenerTopMonedas(limit = 10) {
    if (!connected) await init();
    try { const rs = await dbClient.execute({ sql: `SELECT user_id, nombre, nombre_wa, monedas FROM usuarios ORDER BY monedas DESC LIMIT ?`, args: [limit] }); return rs.rows; } catch (e) { return []; }
}

async function obtenerTopNivel(limit = 10) {
    if (!connected) await init();
    try { const rs = await dbClient.execute({ sql: `SELECT user_id, nombre, nombre_wa, nivel, xp FROM usuarios ORDER BY nivel DESC, xp DESC LIMIT ?`, args: [limit] }); return rs.rows; } catch (e) { return []; }
}

async function activarAntiSpam(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET antispam = 1 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

async function desactivarAntiSpam(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET antispam = 0 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

async function activarModoAdmin(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET modo_admin = 1 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

async function desactivarModoAdmin(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET modo_admin = 0 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

async function obtenerGruposConFlash() {
    if (!connected) await init();
    try {
        const res = await dbClient.execute("SELECT group_id FROM config_grupos WHERE flash_enabled = 1");
        return res.rows.map(r => r.group_id);
    } catch (e) { return []; }
}

async function obtenerUsuariosGrupo(gId) {
    if (!connected) await init();
    try {
        const res = await dbClient.execute("SELECT user_id FROM usuarios WHERE xp > 0 LIMIT 50");
        return res.rows.map(r => r.user_id);
    } catch (e) { return []; }
}

module.exports = {
    init, isConnected: () => connected, nukeSession,
    getAuthKey, getAuthKeys, saveAuthKey, deleteAuthKey,
    guardarManga, obtenerMangas, buscarMangas,
    estaGrupoActivo, activarGrupo, desactivarGrupo,
    tieneBienvenida, activarBienvenida, desactivarBienvenida, setMensajeBienvenida,
    setModoAI, getModoAI, updateLastAIReply,
    obtenerUsuario, actualizarUsuario, sumarMonedas, sumarXP, obtenerBalance, deducirMonedas,
    registrarVictoriaDuelo, registrarDerrotaDuelo, registrarComando, actualizarRacha,
    agregarItem, removerItem,
    sumarKarma, obtenerTopMonedas, obtenerTopNivel, registrarHistorial,
    crearSubasta, obtenerSubastasActivas, pujarSubasta, finalizarSubasta, obtenerSubasta,
    activarAntiSpam, desactivarAntiSpam, activarModoAdmin, desactivarModoAdmin
};
