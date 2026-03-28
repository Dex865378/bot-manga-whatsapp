/**
 * 🔐 ADAPTADOR DE AUTENTICACIÓN PARA TURSO
 * Guarda la sesión de WhatsApp en la nube (Turso)
 * Compatible con la API de Baileys
 */
const db = require('./database');

let initAuthCreds, BufferJSON;
try {
    const baileys = require('@whiskeysockets/baileys');
    initAuthCreds = baileys.initAuthCreds;
    BufferJSON = baileys.BufferJSON;
} catch (e) {
    console.error('❌ [Auth] No se pudo importar utilidades de Baileys');
}

async function useTursoAuthState() {
    // Si no hay DB o no hay utilidades de Baileys, señalar fallback
    if (!db.isConnected() || !initAuthCreds || !BufferJSON) {
        console.warn('⚠️ [Auth] Turso no disponible, se usará auth local.');
        return null;
    }

    // Cargar credenciales desde Turso
    let creds;
    const credsData = await db.getAuthKey('creds');
    if (credsData) {
        try {
            creds = JSON.parse(credsData, BufferJSON.reviver);
            console.log('🔑 [Auth] Sesión recuperada de Turso.');
        } catch (e) {
            console.warn('⚠️ [Auth] Credenciales corruptas, creando nuevas.');
            creds = initAuthCreds();
        }
    } else {
        console.log('🆕 [Auth] Primera vez, creando credenciales nuevas.');
        creds = initAuthCreds();
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    const dbIds = ids.map(id => `${type}-${id}`);
                    const results = await db.getAuthKeys(dbIds);

                    for (const id of ids) {
                        const raw = results[`${type}-${id}`];
                        if (raw) {
                            try { data[id] = JSON.parse(raw, BufferJSON.reviver); } catch (e) { }
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(db.saveAuthKey(key, JSON.stringify(value, BufferJSON.replacer)));
                            } else {
                                tasks.push(db.deleteAuthKey(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            try {
                await db.saveAuthKey('creds', JSON.stringify(creds, BufferJSON.replacer));
            } catch (e) {
                console.error('❌ [Auth] Error crítico al guardar credenciales:', e.message);
            }
        }
    };
}

module.exports = { useTursoAuthState };
