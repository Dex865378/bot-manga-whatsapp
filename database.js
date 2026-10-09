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
        `CREATE TABLE IF NOT EXISTS grupos_despedida (chat_id TEXT PRIMARY KEY, mensaje TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS portadas (clave TEXT PRIMARY KEY, imagen BLOB, mime TEXT DEFAULT 'image/jpeg', updated_at BIGINT)`,
        `CREATE TABLE IF NOT EXISTS portadas_grupo (chat_id TEXT NOT NULL, clave TEXT NOT NULL, imagen BLOB, mime TEXT DEFAULT 'image/jpeg', updated_at BIGINT, PRIMARY KEY (chat_id, clave))`,
        `CREATE TABLE IF NOT EXISTS premios_log (user_id TEXT NOT NULL, ts BIGINT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS antifarma_off (chat_id TEXT PRIMARY KEY, desactivado_por TEXT, updated_at BIGINT)`,
        `CREATE TABLE IF NOT EXISTS warns (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, count INTEGER DEFAULT 0, updated_at BIGINT, PRIMARY KEY (chat_id, user_id))`,
        `CREATE TABLE IF NOT EXISTS afk (user_id TEXT PRIMARY KEY, motivo TEXT DEFAULT '', ts BIGINT)`,
        `CREATE TABLE IF NOT EXISTS actividad (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, total INTEGER DEFAULT 0, PRIMARY KEY (chat_id, user_id))`,
        `CREATE TABLE IF NOT EXISTS stickers_usuario (user_id TEXT NOT NULL, nombre TEXT NOT NULL, sticker BLOB NOT NULL, created_at BIGINT, PRIMARY KEY (user_id, nombre))`,
        `CREATE TABLE IF NOT EXISTS reglas_grupo (chat_id TEXT PRIMARY KEY, texto TEXT NOT NULL, puesto_por TEXT, updated_at BIGINT)`,
        `CREATE TABLE IF NOT EXISTS recordatorios (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, user_id TEXT, texto TEXT, execute_at BIGINT, creado BIGINT)`,
        `CREATE TABLE IF NOT EXISTS records (juego TEXT NOT NULL, user_id TEXT NOT NULL, mejor INTEGER NOT NULL, updated_at BIGINT, PRIMARY KEY (juego, user_id))`,
        `CREATE TABLE IF NOT EXISTS usuarios (
            user_id TEXT PRIMARY KEY, nombre TEXT, edad INTEGER, nacimiento TEXT, altura TEXT, descripcion TEXT, superpoder TEXT, 
            manga_fav TEXT, anime_fav TEXT, waifu_husbando TEXT, pareja TEXT, titulo TEXT, 
            monedas INTEGER DEFAULT 100, xp INTEGER DEFAULT 0, nivel INTEGER DEFAULT 1, 
            duelos_ganados INTEGER DEFAULT 0, duelos_perdidos INTEGER DEFAULT 0,
            racha_diaria INTEGER DEFAULT 0, ultima_actividad_racha INTEGER DEFAULT 0,
            total_comandos INTEGER DEFAULT 0, shenlong_invocado INTEGER DEFAULT 0,
            karma INTEGER DEFAULT 0, pocion_exp_fin INTEGER DEFAULT 0, cazarrecompensas_fin INTEGER DEFAULT 0,
            last_daily INTEGER DEFAULT 0, last_work INTEGER DEFAULT 0, last_slut INTEGER DEFAULT 0, last_robar INTEGER DEFAULT 0,
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
        )`,
        `CREATE TABLE IF NOT EXISTS mascotas_usuario (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       TEXT    NOT NULL,
            tipo          TEXT    NOT NULL,
            categoria     TEXT    NOT NULL,
            nombre        TEXT    DEFAULT '',
            version       INTEGER DEFAULT 0,
            comidas_total INTEGER DEFAULT 0,
            hambre        INTEGER DEFAULT 100,
            es_principal  INTEGER DEFAULT 0,
            cantidad      INTEGER DEFAULT 1,
            escudo_activo INTEGER DEFAULT 0,
            escudo_expira BIGINT  DEFAULT 0
        )`
    ];
    try {
        for (const sql of tablas) await dbClient.execute(sql);

        // Limpieza IA (irreversible, decisión del dueño): las tablas de IA ya
        // no se crean arriba; se dropean si existen de instalaciones previas.
        try { await dbClient.execute('DROP TABLE IF EXISTS grupos_ai'); } catch (_) {}
        try { await dbClient.execute('DROP TABLE IF EXISTS perfiles_ia'); } catch (_) {}

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
            'ALTER TABLE usuarios ADD COLUMN last_robar INTEGER DEFAULT 0',
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
            'ALTER TABLE grupos_activados ADD COLUMN modo_admin INTEGER DEFAULT 0',
            'ALTER TABLE grupos_activados ADD COLUMN modo_manga INTEGER DEFAULT 0',
            // Tablas creadas en versiones viejas sin esta columna (el CREATE TABLE
            // IF NOT EXISTS no la agrega a tablas ya existentes en Turso).
            'ALTER TABLE grupos_bienvenida ADD COLUMN mensaje TEXT'
        ];
        for (const sql of allCols) {
            try { await dbClient.execute(sql); } catch (e) { }
        }
        // Migración automática (UNA SOLA VEZ): pasar mascota vieja
        // (usuarios.mascota_tipo) a mascotas_usuario. Antes hacía full scan
        // + N queries en CADA arranque; ahora queda registrada en la tabla
        // migraciones y se salta en boots siguientes.
        try {
            await dbClient.execute('CREATE TABLE IF NOT EXISTS migraciones (nombre TEXT PRIMARY KEY, aplicada_en BIGINT)');
            const ya = await dbClient.execute({ sql: 'SELECT 1 FROM migraciones WHERE nombre = ?', args: ['mascota_legacy_v1'] });
            if (ya.rows.length === 0) {
                const old = await dbClient.execute("SELECT user_id, mascota_tipo, mascota_nombre, mascota_hambre FROM usuarios WHERE mascota_tipo IS NOT NULL");
                for (const row of old.rows) {
                    const exists = await dbClient.execute({ sql: 'SELECT id FROM mascotas_usuario WHERE user_id = ? AND tipo = ?', args: [row.user_id, row.mascota_tipo] });
                    if (exists.rows.length === 0) {
                        await dbClient.execute({
                            sql: 'INSERT INTO mascotas_usuario (user_id, tipo, categoria, nombre, hambre, es_principal) VALUES (?, ?, ?, ?, ?, 1)',
                            args: [row.user_id, row.mascota_tipo, 'legacy', row.mascota_nombre || '', row.mascota_hambre || 100]
                        });
                    }
                }
                await dbClient.execute({ sql: 'INSERT INTO migraciones (nombre, aplicada_en) VALUES (?, ?)', args: ['mascota_legacy_v1', Date.now()] });
                console.log(`📦 [DB] Migración mascota_legacy_v1 aplicada (${old.rows.length} filas revisadas).`);
            }
        } catch(_) {}
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
        // LIMIT de seguridad: el intervalo las revisa cada 60s, no hay caso
        // real con más de unas pocas activas; evita SELECT * sin tope.
        const rs = await dbClient.execute("SELECT * FROM auctions WHERE status = 'active' ORDER BY end_time ASC LIMIT 50");
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
    if (!connected) return null;
    const cached = userCache.get(userId);
    if (cached && (Date.now() - cached.time < 30000)) return cached.data; // 30 seg cache

    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM usuarios WHERE user_id = ?', args: [userId] });
        let data = rs.rows.length > 0 ? rs.rows[0] : null;
        if (!data) {
            await dbClient.execute({
                sql: 'INSERT INTO usuarios (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING',
                args: [userId]
            });
            const created = await dbClient.execute({ sql: 'SELECT * FROM usuarios WHERE user_id = ?', args: [userId] });
            data = created.rows[0] || null;
        }
        if (data) userCache.set(userId, { data, time: Date.now() });
        return data;
    } catch (e) { return null; }
}

async function obtenerUsuariosBatch(userIds) {
    if (!connected || !userIds || userIds.length === 0) return {};
    
    // Filtrar duplicados y normalizar
    const uniqueIds = [...new Set(userIds)].filter(id => id);
    if (uniqueIds.length === 0) return {};
    
    // Verificar caché primero
    const resultados = {};
    const idsToFetch = [];
    const ahora = Date.now();
    
    for (const id of uniqueIds) {
        const cached = userCache.get(id);
        if (cached && (ahora - cached.time < 30000)) {
            resultados[id] = cached.data;
        } else {
            idsToFetch.push(id);
        }
    }
    
    if (idsToFetch.length === 0) return resultados;
    
    // Batch query con IN clause
    try {
        const placeholders = idsToFetch.map(() => '?').join(', ');
        const rs = await dbClient.execute({
            sql: `SELECT * FROM usuarios WHERE user_id IN (${placeholders})`,
            args: idsToFetch
        });
        
        for (const row of rs.rows) {
            userCache.set(row.user_id, { data: row, time: ahora });
            resultados[row.user_id] = row;
        }
        
        // Evicción LRU gradual: eliminar los más viejos si pasa de 500
        while (userCache.size > 500) {
            const oldest = userCache.keys().next().value;
            userCache.delete(oldest);
        }
        
        return resultados;
    } catch (e) {
        console.error('❌ [DB] Error en batch query:', e.message);
        return resultados;
    }
}

async function actualizarUsuario(userId, campos) {
    // Actualizar caché para respuesta inmediata
    if (userCache.has(userId)) {
        const cached = userCache.get(userId);
        userCache.set(userId, {
            data: { ...(cached?.data || {}), ...campos },
            time: Date.now()
        });
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

// OPTIMIZACIÓN: Incremento atómico sin SELECT previo (más rápido, 1 query en lugar de 2)
// Usar para operaciones simples donde no se necesita el valor actual
async function incrementarCampo(userId, campo, valor) {
    if (!connected) return false;
    try {
        await dbClient.execute({
            sql: `UPDATE usuarios SET ${campo} = ${campo} + ? WHERE user_id = ?`,
            args: [valor, userId]
        });
        // Invalidar caché ya que el valor cambió en DB
        userCache.delete(userId);
        return true;
    } catch (e) {
        console.error(`❌ [DB] Error incrementarCampo:`, e.message);
        return false;
    }
}

// Mutex por usuario: encadena operaciones de saldo/XP del mismo user_id para
// que dos premios concurrentes no lean el mismo valor viejo y se pisen
// (eso borraba diky: caché decía 1000, real 5000, +50 → escribía 1050).
const userMutex = new Map(); // userId -> Promise (cola)
function conMutex(userId, fn) {
    const prev = userMutex.get(userId) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    const tracked = next.catch(() => {});
    userMutex.set(userId, tracked);
    // Limpieza: si nadie más se encoló detrás, borrar la llave
    next.finally(() => {
        if (userMutex.get(userId) === tracked) userMutex.delete(userId);
    }).catch(() => {});
    return next;
}

async function sumarMonedas(userId, cantidad) {
    if (!connected) return false;
    // Asegurar que la fila exista (obtenerUsuario la crea si falta). El valor
    // leído NO se usa: el UPDATE de abajo es atómico en SQL.
    await obtenerUsuario(userId);
    try {
        // UPDATE atómico en SQL: lee y escribe en la misma sentencia, así dos
        // premios al mismo tiempo ya no se pisan. El multiplicador de
        // prestigio (+10% por nivel, solo ganancias) se calcula en SQL.
        // El balance nunca baja de 0.
        if (cantidad > 0) {
            await dbClient.execute({
                sql: `UPDATE usuarios SET monedas = max(0, monedas + CAST(? * (1 + COALESCE(prestigio,0)*0.1) AS INTEGER)) WHERE user_id = ?`,
                args: [cantidad, userId]
            });
        } else {
            await dbClient.execute({
                sql: `UPDATE usuarios SET monedas = max(0, monedas + ?) WHERE user_id = ?`,
                args: [cantidad, userId]
            });
        }
        userCache.delete(userId);
        return true;
    } catch (e) {
        console.error(`❌ [DB] Error sumarMonedas:`, e.message);
        return false;
    }
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

function deducirMonedas(userId, cantidad) {
    // Serializado por usuario: el chequeo de saldo y el descuento ocurren sin
    // que otro descuento/premio se meta en medio (evita sobregiros y pisadas).
    return conMutex(userId, async () => {
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
    });
}

function sumarXP(userId, cantidad) {
    // Serializado por usuario: evita que dos XP concurrentes lean el mismo
    // valor viejo y uno borre el avance del otro.
    return conMutex(userId, async () => {
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
    });
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
    if (!u) return { ok: false, restante: 0 };
    let inv = {};
    try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }
    const current = (inv[itemName.toLowerCase()] || 0);
    if (current < cantidad) return { ok: false, restante: current };
    inv[itemName.toLowerCase()] = current - cantidad;
    const restante = inv[itemName.toLowerCase()];
    if (restante <= 0) delete inv[itemName.toLowerCase()];
    const ok = await actualizarUsuario(userId, { inventario: JSON.stringify(inv) });
    return { ok, restante: ok ? restante : current };
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
        return { ok: true };
    } catch (e) {
        console.error('❌ [DB] Error setMensajeBienvenida:', e.message);
        return { ok: false, error: e.message };
    }
}

async function tieneDespedida(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT mensaje FROM grupos_despedida WHERE chat_id = ?', args: [chatId] });
        if (rs.rows.length > 0) return { activa: true, mensaje: rs.rows[0].mensaje };
        return { activa: false };
    } catch (e) { return { activa: false }; }
}

async function activarDespedida(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'INSERT INTO grupos_despedida (chat_id) VALUES (?) ON CONFLICT(chat_id) DO NOTHING', args: [chatId] }); return true; } catch (e) { return false; }
}

async function desactivarDespedida(chatId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'DELETE FROM grupos_despedida WHERE chat_id = ?', args: [chatId] }); return true; } catch (e) { return false; }
}

async function setMensajeDespedida(chatId, mensaje) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'INSERT INTO grupos_despedida (chat_id, mensaje) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET mensaje = ?',
            args: [chatId, mensaje, mensaje]
        });
        return { ok: true };
    } catch (e) {
        console.error('❌ [DB] Error setMensajeDespedida:', e.message);
        return { ok: false, error: e.message };
    }
}

// --- Portadas (imágenes de !menu / bienvenida / despedida) ---
// POR GRUPO: cada grupo tiene su propia portada (tabla portadas_grupo).
// La tabla global `portadas` queda como imagen por defecto para los grupos
// que aún no ponen la suya. Caché RAM por (chat, clave).
const portadaCache = new Map(); // `${chatId||'global'}::${clave}` -> Buffer|null
const PORTADAS_VALIDAS = ['menu', 'bienvenida', 'despedida', 'sticker_bienvenida'];

function portadaCacheKey(clave, chatId) { return `${chatId || 'global'}::${clave}`; }

async function getPortada(clave, chatId) {
    if (!PORTADAS_VALIDAS.includes(clave)) return null;
    const key = portadaCacheKey(clave, chatId);
    if (portadaCache.has(key)) return portadaCache.get(key);
    let buf = null;
    try {
        if (!connected) await init();
        // 1. Portada propia del grupo
        if (chatId) {
            const rs = await dbClient.execute({ sql: 'SELECT imagen FROM portadas_grupo WHERE chat_id = ? AND clave = ?', args: [chatId, clave] });
            if (rs.rows.length > 0 && rs.rows[0].imagen) buf = Buffer.from(rs.rows[0].imagen);
        }
        // 2. Si el grupo no tiene, imagen global por defecto
        if (!buf) {
            const rs = await dbClient.execute({ sql: 'SELECT imagen FROM portadas WHERE clave = ?', args: [clave] });
            if (rs.rows.length > 0 && rs.rows[0].imagen) buf = Buffer.from(rs.rows[0].imagen);
        }
    } catch (e) { buf = null; }
    portadaCache.set(key, buf);
    return buf;
}

async function setPortada(clave, buffer, chatId) {
    if (!PORTADAS_VALIDAS.includes(clave)) return { ok: false, error: 'clave invalida' };
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return { ok: false, error: 'imagen vacia' };
    if (buffer.length > 2 * 1024 * 1024) return { ok: false, error: 'imagen muy pesada (>2MB)' };
    portadaCache.set(portadaCacheKey(clave, chatId), buffer);
    try {
        if (!connected) await init();
        if (chatId) {
            // Portada solo de ESTE grupo (no afecta a los demás)
            await dbClient.execute({
                sql: 'INSERT INTO portadas_grupo (chat_id, clave, imagen, mime, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(chat_id, clave) DO UPDATE SET imagen = ?, mime = ?, updated_at = ?',
                args: [chatId, clave, buffer, 'image/jpeg', Date.now(), buffer, 'image/jpeg', Date.now()]
            });
        } else {
            // Sin grupo: imagen global por defecto
            await dbClient.execute({
                sql: 'INSERT INTO portadas (clave, imagen, mime, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(clave) DO UPDATE SET imagen = ?, mime = ?, updated_at = ?',
                args: [clave, buffer, 'image/jpeg', Date.now(), buffer, 'image/jpeg', Date.now()]
            });
        }
        return { ok: true, bytes: buffer.length };
    } catch (e) {
        console.error('❌ [DB] Error setPortada:', e.message);
        return { ok: false, error: e.message };
    }
}

function limpiarCachePortada(clave, chatId) {
    if (clave) {
        if (chatId) portadaCache.delete(portadaCacheKey(clave, chatId));
        else for (const k of [...portadaCache.keys()]) if (k.endsWith(`::${clave}`)) portadaCache.delete(k);
    }
    else portadaCache.clear();
}

// --- Anti-farma: tope de premios FIJOS por hora y por usuario ---
// Evita que dos compinches se turnen ganando 100 partidas seguidas para
// farmear diky gratis (ej: 100 x !ttt = 5000). NO aplica a devolución de
// apuestas (mentiroso, !apostar) ni a juegos de un jugador contra el bot.
// Límite: 5 premios por hora. Fail-open: si la DB falla, permite el premio.
const MAX_PREMIOS_POR_HORA = 5;
const VENTANA_PREMIOS_MS = 60 * 60 * 1000;

async function puedePremiar(userId) {
    if (!connected) return true;
    try {
        const desde = Date.now() - VENTANA_PREMIOS_MS;
        // Podar entradas viejas (barato: tabla chica, corre solo al premiar)
        await dbClient.execute({ sql: 'DELETE FROM premios_log WHERE ts < ?', args: [desde] }).catch(() => {});
        const rs = await dbClient.execute({
            sql: 'SELECT COUNT(*) AS n FROM premios_log WHERE user_id = ? AND ts >= ?',
            args: [userId, desde]
        });
        const n = rs.rows[0]?.n ?? 0;
        if (n >= MAX_PREMIOS_POR_HORA) return false;
        await dbClient.execute({
            sql: 'INSERT INTO premios_log (user_id, ts) VALUES (?, ?)',
            args: [userId, Date.now()]
        });
        return true;
    } catch (e) {
        return true; // fail-open: mejor regalar que romper el juego
    }
}

// Premio con tope anti-farma: el XP siempre se paga; los diky pasan por
// puedePremiar (5 premios/hora). Devuelve true si los diky se pagaron.
// Las restas/devoluciones (monedas <= 0) no pasan por el gate.
// chatId (opcional): si el grupo tiene el anti-farma DESACTIVADO con
// !antifarma off (grupo 100% juego), los diky se pagan directo sin gate.
async function premiarConLimite(userId, monedas, xp, chatId = null) {
    if (xp) { try { await sumarXP(userId, xp); } catch (_) {} }
    if (!monedas || monedas <= 0) {
        if (monedas < 0) { try { await sumarMonedas(userId, monedas); } catch (_) {} }
        return true;
    }
    try {
        if (chatId && !(await antifarmaActivo(chatId))) {
            await sumarMonedas(userId, monedas);
            return true;
        }
        if (await puedePremiar(userId)) {
            await sumarMonedas(userId, monedas);
            return true;
        }
    } catch (_) {}
    return false;
}

// --- Anti-farma por grupo: !antifarma off exime al grupo del tope ---
// Por defecto el anti-farma está ACTIVO en todos los grupos; la tabla solo
// guarda los grupos exentos (opt-out). Caché RAM con TTL 5 min, fail-open.
const antifarmaOffCache = new Map(); // chatId -> { off: bool, ts }
const TTL_ANTIFARMA_CACHE = 5 * 60 * 1000;

async function antifarmaActivo(chatId) {
    if (!chatId) return true;
    const c = antifarmaOffCache.get(chatId);
    if (c && Date.now() - c.ts < TTL_ANTIFARMA_CACHE) return !c.off;
    try {
        if (!connected) await init();
        const rs = await dbClient.execute({ sql: 'SELECT chat_id FROM antifarma_off WHERE chat_id = ?', args: [chatId] });
        const off = rs.rows.length > 0;
        antifarmaOffCache.set(chatId, { off, ts: Date.now() });
        return !off;
    } catch (_) { return true; }
}

async function setAntifarma(chatId, on, por = '') {
    try {
        if (!connected) await init();
        if (on) await dbClient.execute({ sql: 'DELETE FROM antifarma_off WHERE chat_id = ?', args: [chatId] });
        else await dbClient.execute({ sql: 'INSERT OR REPLACE INTO antifarma_off (chat_id, desactivado_por, updated_at) VALUES (?, ?, ?)', args: [chatId, por, Date.now()] });
        antifarmaOffCache.set(chatId, { off: !on, ts: Date.now() });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
}

const NOTA_ANTIFARMA = '\n⏳ _Límite anti-farma (5 premios/hora): los diky de este premio quedan pendientes._';

async function obtenerTopMonedas(limit = 10) {
    if (!connected) await init();
    try { const rs = await dbClient.execute({ sql: `SELECT user_id, nombre, nombre_wa, monedas FROM usuarios ORDER BY monedas DESC LIMIT ?`, args: [limit] }); return rs.rows; } catch (e) { return []; }
}

async function obtenerTopNivel(limit = 10) {
    if (!connected) await init();
    try { const rs = await dbClient.execute({ sql: `SELECT user_id, nombre, nombre_wa, nivel, xp FROM usuarios ORDER BY nivel DESC, xp DESC LIMIT ?`, args: [limit] }); return rs.rows; } catch (e) { return []; }
}

// --- Warns (advertencias por grupo, 3 = expulsión) ---
async function addWarn(chatId, userId) {
    if (!connected) await init();
    try {
        const cur = await dbClient.execute({ sql: 'SELECT count FROM warns WHERE chat_id = ? AND user_id = ?', args: [chatId, userId] });
        const n = ((cur.rows[0]?.count) || 0) + 1;
        await dbClient.execute({
            sql: 'INSERT INTO warns (chat_id, user_id, count, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET count = ?, updated_at = ?',
            args: [chatId, userId, n, Date.now(), n, Date.now()]
        });
        return n;
    } catch (e) { return 0; }
}

async function getWarns(chatId, userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT count FROM warns WHERE chat_id = ? AND user_id = ?', args: [chatId, userId] });
        return (rs.rows[0]?.count) || 0;
    } catch (e) { return 0; }
}

async function resetWarns(chatId, userId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'DELETE FROM warns WHERE chat_id = ? AND user_id = ?', args: [chatId, userId] }); } catch (e) {}
}

// --- AFK ---
async function setAFK(userId, motivo) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'INSERT INTO afk (user_id, motivo, ts) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET motivo = ?, ts = ?',
            args: [userId, motivo || '', Date.now(), motivo || '', Date.now()]
        });
        return true;
    } catch (e) { return false; }
}

async function getAFK(userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT motivo, ts FROM afk WHERE user_id = ?', args: [userId] });
        return rs.rows[0] || null;
    } catch (e) { return null; }
}

async function clearAFK(userId) {
    if (!connected) await init();
    try { await dbClient.execute({ sql: 'DELETE FROM afk WHERE user_id = ?', args: [userId] }); } catch (e) {}
}

// --- Actividad (ranking de más activos por grupo, con flush en lote) ---
async function sumarActividadBatch(items) {
    if (!connected || !items || items.length === 0) return;
    try {
        for (const [chatId, userId, n] of items) {
            await dbClient.execute({
                sql: 'INSERT INTO actividad (chat_id, user_id, total) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET total = actividad.total + ?',
                args: [chatId, userId, n, n]
            });
        }
    } catch (e) {}
}

async function topActivos(chatId, limit = 10) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT user_id, total FROM actividad WHERE chat_id = ? ORDER BY total DESC LIMIT ?', args: [chatId, limit] });
        return rs.rows;
    } catch (e) { return []; }
}

// Mapa user_id -> total de mensajes (para !fantasmas: incluye ceros por fuera)
async function actividadPorChat(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT user_id, total FROM actividad WHERE chat_id = ?', args: [chatId] });
        const mapa = {};
        for (const r of rs.rows || []) mapa[r.user_id] = r.total;
        return mapa;
    } catch (e) { return {}; }
}

// --- Banco de stickers (!gstick / !stick) ---
async function guardarSticker(userId, nombre, buffer) {
    if (!connected) await init();
    try {
        if (!buffer || buffer.length > 2 * 1024 * 1024) return { ok: false, error: 'sticker muy pesado (máx 2MB)' };
        const c = await dbClient.execute({ sql: 'SELECT COUNT(*) AS n FROM stickers_usuario WHERE user_id = ?', args: [userId] });
        if ((c.rows[0]?.n || 0) >= 30) return { ok: false, error: 'banco lleno (máx 30)' };
        await dbClient.execute({
            sql: 'INSERT INTO stickers_usuario (user_id, nombre, sticker, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, nombre) DO UPDATE SET sticker = excluded.sticker, created_at = excluded.created_at',
            args: [userId, nombre, buffer, Date.now()]
        });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
}

async function obtenerSticker(userId, nombre) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT sticker FROM stickers_usuario WHERE user_id = ? AND nombre = ?', args: [userId, nombre] });
        if (rs.rows.length > 0 && rs.rows[0].sticker) return Buffer.from(rs.rows[0].sticker);
        return null;
    } catch (e) { return null; }
}

async function misStickers(userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT nombre FROM stickers_usuario WHERE user_id = ? ORDER BY nombre LIMIT 30', args: [userId] });
        return (rs.rows || []).map(r => r.nombre);
    } catch (e) { return []; }
}

async function borrarSticker(userId, nombre) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'DELETE FROM stickers_usuario WHERE user_id = ? AND nombre = ?', args: [userId, nombre] });
        return (rs.rowsAffected || 0) > 0;
    } catch (e) { return false; }
}

// --- Reglas del grupo (!setreglas / !reglas) ---
async function setReglas(chatId, texto, puestoPor) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'INSERT INTO reglas_grupo (chat_id, texto, puesto_por, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET texto = excluded.texto, puesto_por = excluded.puesto_por, updated_at = excluded.updated_at',
            args: [chatId, texto, puestoPor || '', Date.now()]
        });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
}

async function getReglas(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT texto FROM reglas_grupo WHERE chat_id = ?', args: [chatId] });
        return rs.rows.length > 0 ? rs.rows[0].texto : null;
    } catch (e) { return null; }
}

async function borrarReglas(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'DELETE FROM reglas_grupo WHERE chat_id = ?', args: [chatId] });
        return (rs.rowsAffected || 0) > 0;
    } catch (e) { return false; }
}

// --- Recordatorios ---
async function crearRecordatorio(chatId, userId, texto, executeAt) {
    if (!connected) await init();
    try {
        const c = await dbClient.execute({ sql: 'SELECT COUNT(*) AS n FROM recordatorios WHERE user_id = ?', args: [userId] });
        if ((c.rows[0]?.n || 0) >= 10) return { ok: false, error: 'límite' };
        await dbClient.execute({
            sql: 'INSERT INTO recordatorios (chat_id, user_id, texto, execute_at, creado) VALUES (?, ?, ?, ?, ?)',
            args: [chatId, userId, texto, executeAt, Date.now()]
        });
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
}

async function misRecordatorios(chatId, userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT id, texto, execute_at FROM recordatorios WHERE chat_id = ? AND user_id = ? ORDER BY execute_at LIMIT 20', args: [chatId, userId] });
        return rs.rows;
    } catch (e) { return []; }
}

async function borrarRecordatorio(id, userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'DELETE FROM recordatorios WHERE id = ? AND user_id = ?', args: [id, userId] });
        return (rs.rowsAffected || 0) > 0;
    } catch (e) { return false; }
}

async function recordatoriosVencidos(ahora, limit = 10) {
    if (!connected) return [];
    try {
        const rs = await dbClient.execute({ sql: 'SELECT id, chat_id, user_id, texto FROM recordatorios WHERE execute_at <= ? ORDER BY execute_at LIMIT ?', args: [ahora, limit] });
        const rows = rs.rows || [];
        for (const r of rows) {
            await dbClient.execute({ sql: 'DELETE FROM recordatorios WHERE id = ?', args: [r.id] });
        }
        return rows;
    } catch (e) { return []; }
}

// --- Récords de minijuegos solo (reflejos/maraton: menor es mejor; simon: mayor) ---
async function getRecord(juego, userId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({ sql: 'SELECT mejor FROM records WHERE juego = ? AND user_id = ?', args: [juego, userId] });
        return rs.rows.length ? rs.rows[0].mejor : null;
    } catch (e) { return null; }
}

async function saveRecord(juego, userId, valor, menorEsMejor = true) {
    if (!connected) await init();
    try {
        const anterior = await getRecord(juego, userId);
        const esMejor = anterior === null || (menorEsMejor ? valor < anterior : valor > anterior);
        if (esMejor) {
            await dbClient.execute({
                sql: 'INSERT INTO records (juego, user_id, mejor, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(juego, user_id) DO UPDATE SET mejor = ?, updated_at = ?',
                args: [juego, userId, valor, Date.now(), valor, Date.now()]
            });
        }
        return { nuevo: esMejor, anterior };
    } catch (e) { return { nuevo: false, anterior: null }; }
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

async function activarModoManga(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET modo_manga = 1 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

async function desactivarModoManga(chatId) {
    if (!connected) await init();
    try {
        await dbClient.execute({
            sql: 'UPDATE grupos_activados SET modo_manga = 0 WHERE chat_id = ?',
            args: [chatId]
        });
        return true;
    } catch (e) { return false; }
}

// ========== FUNCIONES DE MASCOTAS ==========

async function getMascotasUsuario(userId) {
    if (!connected) return [];
    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM mascotas_usuario WHERE user_id = ? ORDER BY es_principal DESC, id ASC', args: [userId] });
        return rs.rows;
    } catch (e) { return []; }
}

// Caché para mascota principal (reduce consultas a Turso)
const mascotaPrincipalCache = new Map();
const TTL_MASCOTA_PRINCIPAL = 60 * 1000; // 1 minuto

async function getMascotaPrincipal(userId) {
    if (!connected) return null;
    
    // Verificar caché
    const cached = mascotaPrincipalCache.get(userId);
    if (cached && (Date.now() - cached.time < TTL_MASCOTA_PRINCIPAL)) {
        return cached.data;
    }
    
    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM mascotas_usuario WHERE user_id = ? AND es_principal = 1 LIMIT 1', args: [userId] });
        const data = rs.rows[0] || null;
        
        // Guardar en caché
        mascotaPrincipalCache.set(userId, { data, time: Date.now() });
        
        // Limpiar caché si crece demasiado
        if (mascotaPrincipalCache.size > 500) {
            const oldest = mascotaPrincipalCache.keys().next().value;
            mascotaPrincipalCache.delete(oldest);
        }
        
        return data;
    } catch (e) { return null; }
}

async function getCantidadMascota(userId, tipo) {
    if (!connected) return 0;
    try {
        const rs = await dbClient.execute({ sql: 'SELECT cantidad FROM mascotas_usuario WHERE user_id = ? AND tipo = ?', args: [userId, tipo] });
        return rs.rows[0]?.cantidad || 0;
    } catch (e) { return 0; }
}

async function agregarMascota(userId, tipo, categoria, nombre = '') {
    if (!connected) return { ok: false, msg: 'Sin conexión' };
    try {
        // Verificar si ya tiene esa mascota
        const exists = await dbClient.execute({ sql: 'SELECT id, cantidad FROM mascotas_usuario WHERE user_id = ? AND tipo = ?', args: [userId, tipo] });
        if (exists.rows.length > 0) {
            const cant = exists.rows[0].cantidad;
            if (cant >= 50) return { ok: false, msg: `Ya tienes el máximo de 50 *${tipo}*. ¡Es tu límite!` };
            await dbClient.execute({ sql: 'UPDATE mascotas_usuario SET cantidad = cantidad + 1 WHERE user_id = ? AND tipo = ?', args: [userId, tipo] });
        } else {
            // Verificar si no tiene principal → esta será la principal
            const hasPrincipal = await dbClient.execute({ sql: 'SELECT id FROM mascotas_usuario WHERE user_id = ? AND es_principal = 1 LIMIT 1', args: [userId] });
            const esPrincipal = hasPrincipal.rows.length === 0 ? 1 : 0;
            await dbClient.execute({ sql: 'INSERT INTO mascotas_usuario (user_id, tipo, categoria, nombre, es_principal) VALUES (?, ?, ?, ?, ?)', args: [userId, tipo, categoria, nombre, esPrincipal] });
        }
        return { ok: true };
    } catch (e) { return { ok: false, msg: e.message }; }
}

async function setPrincipalMascota(userId, tipo) {
    if (!connected) return false;
    try {
        const exists = await dbClient.execute({ sql: 'SELECT id FROM mascotas_usuario WHERE user_id = ? AND tipo = ?', args: [userId, tipo] });
        if (exists.rows.length === 0) return false;
        await dbClient.execute({ sql: 'UPDATE mascotas_usuario SET es_principal = 0 WHERE user_id = ?', args: [userId] });
        await dbClient.execute({ sql: 'UPDATE mascotas_usuario SET es_principal = 1 WHERE user_id = ? AND tipo = ?', args: [userId, tipo] });
        // Invalidar caché
        mascotaPrincipalCache.delete(userId);
        return true;
    } catch (e) { return false; }
}

async function alimentarMascota(userId, mascotaId) {
    if (!connected) return { ok: false };
    try {
        const rs = await dbClient.execute({ sql: 'SELECT * FROM mascotas_usuario WHERE id = ? AND user_id = ?', args: [mascotaId, userId] });
        if (!rs.rows[0]) return { ok: false, msg: 'Mascota no encontrada' };
        const m = rs.rows[0];
        const nuevoHambre = Math.min(100, (m.hambre || 0) + 20);
        const comidasActuales = (m.comidas_total || 0);
        const nuevasComidas = comidasActuales + 1;
        const versionActual = m.version || 0;
        const nuevaVersion = Math.min(50, versionActual + (nuevasComidas >= 100 ? 1 : 0));
        const evoluciono = nuevaVersion > versionActual;
        // Reiniciar comidas a 0 si evolucionó, si no mantener el conteo
        const comidasFinales = evoluciono ? 0 : nuevasComidas;
        // DEBUG: Log para trackear evolución
        if (comidasActuales >= 90 || evoluciono) {
            console.log(`[EVOLUCION DEBUG] Mascota ${mascotaId}: comidasActuales=${comidasActuales}, nuevasComidas=${nuevasComidas}, comidasFinales=${comidasFinales}, versionActual=${versionActual}, nuevaVersion=${nuevaVersion}, evoluciono=${evoluciono}`);
        }
        await dbClient.execute({
            sql: 'UPDATE mascotas_usuario SET hambre = ?, comidas_total = ?, version = ? WHERE id = ? AND user_id = ?',
            args: [nuevoHambre, comidasFinales, nuevaVersion, mascotaId, userId]
        });
        // Invalidar caché si era la mascota principal (para actualizar hambre en perfil)
        if (m.es_principal === 1) {
            mascotaPrincipalCache.delete(userId);
        }
        return { ok: true, hambre: nuevoHambre, comidas: nuevasComidas, comidasFinales, version: nuevaVersion, evoluciono };
    } catch (e) { return { ok: false, msg: e.message }; }
}

async function activarEscudoMascota(userId) {
    if (!connected) return false;
    try {
        const expira = Date.now() + 24 * 60 * 60 * 1000;
        await dbClient.execute({ sql: 'UPDATE mascotas_usuario SET escudo_activo = 1, escudo_expira = ? WHERE user_id = ? AND es_principal = 1', args: [expira, userId] });
        return true;
    } catch (e) { return false; }
}

async function tieneEscudoActivo(userId) {
    if (!connected) return false;
    try {
        const rs = await dbClient.execute({ sql: 'SELECT escudo_activo, escudo_expira FROM mascotas_usuario WHERE user_id = ? AND es_principal = 1 LIMIT 1', args: [userId] });
        const m = rs.rows[0];
        if (!m || !m.escudo_activo) return false;
        if (Date.now() > m.escudo_expira) {
            await dbClient.execute({ sql: 'UPDATE mascotas_usuario SET escudo_activo = 0 WHERE user_id = ?', args: [userId] });
            return false;
        }
        return true;
    } catch (e) { return false; }
}

async function getMascotasPaginadas(userId, pagina = 1, porPagina = 8) {
    if (!connected) return { mascotas: [], total: 0, paginas: 0 };
    try {
        const countRs = await dbClient.execute({ sql: 'SELECT COUNT(*) as total FROM mascotas_usuario WHERE user_id = ?', args: [userId] });
        const total = countRs.rows[0]?.total || 0;
        const offset = (pagina - 1) * porPagina;
        const rs = await dbClient.execute({ sql: 'SELECT * FROM mascotas_usuario WHERE user_id = ? ORDER BY es_principal DESC, version DESC, id ASC LIMIT ? OFFSET ?', args: [userId, porPagina, offset] });
        return { mascotas: rs.rows, total, paginas: Math.ceil(total / porPagina) };
    } catch (e) { return { mascotas: [], total: 0, paginas: 0 }; }
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

// ========== CONFIGURACIÓN DE GRUPOS (FLASH) ==========

async function alternarFlash(chatId, activar) {
    if (!connected) await init();
    try {
        // Asegurar que existe la tabla
        await dbClient.execute(`
            CREATE TABLE IF NOT EXISTS config_grupos (
                group_id TEXT PRIMARY KEY,
                flash_enabled INTEGER DEFAULT 0
            )
        `);
        await dbClient.execute({
            sql: 'INSERT INTO config_grupos (group_id, flash_enabled) VALUES (?, ?) ON CONFLICT(group_id) DO UPDATE SET flash_enabled = ?',
            args: [chatId, activar ? 1 : 0, activar ? 1 : 0]
        });
        return true;
    } catch (e) { console.error('[DB] Error alternarFlash:', e); return false; }
}

async function obtenerFlashStatus(chatId) {
    if (!connected) await init();
    try {
        const rs = await dbClient.execute({
            sql: 'SELECT flash_enabled FROM config_grupos WHERE group_id = ?',
            args: [chatId]
        });
        return rs.rows[0]?.flash_enabled === 1;
    } catch (e) { return false; }
}

module.exports = {
    init, isConnected: () => connected, nukeSession,
    getAuthKey, getAuthKeys, saveAuthKey, deleteAuthKey,
    guardarManga, obtenerMangas, buscarMangas,
    estaGrupoActivo, activarGrupo, desactivarGrupo,
    tieneBienvenida, activarBienvenida, desactivarBienvenida, setMensajeBienvenida,
    tieneDespedida, activarDespedida, desactivarDespedida, setMensajeDespedida,
    getPortada, setPortada, limpiarCachePortada, PORTADAS_VALIDAS,
    obtenerUsuario, obtenerUsuariosBatch, actualizarUsuario, incrementarCampo, sumarMonedas, sumarXP, obtenerBalance, deducirMonedas, puedePremiar, premiarConLimite, NOTA_ANTIFARMA, antifarmaActivo, setAntifarma,
    registrarVictoriaDuelo, registrarDerrotaDuelo, registrarComando, actualizarRacha,
    agregarItem, removerItem,
    sumarKarma, obtenerTopMonedas, obtenerTopNivel, registrarHistorial,
    addWarn, getWarns, resetWarns,
    setAFK, getAFK, clearAFK,
    sumarActividadBatch, topActivos, actividadPorChat,
    guardarSticker, obtenerSticker, misStickers, borrarSticker,
    setReglas, getReglas, borrarReglas,
    crearRecordatorio, misRecordatorios, borrarRecordatorio, recordatoriosVencidos,
    getRecord, saveRecord,
    crearSubasta, obtenerSubastasActivas, pujarSubasta, finalizarSubasta, obtenerSubasta,
    activarAntiSpam, desactivarAntiSpam, activarModoAdmin, desactivarModoAdmin,
    activarModoManga, desactivarModoManga,
    getMascotasUsuario, getMascotaPrincipal, getCantidadMascota, agregarMascota,
    setPrincipalMascota, alimentarMascota, activarEscudoMascota, tieneEscudoActivo,
    getMascotasPaginadas,
    alternarFlash, obtenerFlashStatus, obtenerGruposConFlash
};
