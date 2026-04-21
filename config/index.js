/**
 * ⚙️ CONFIGURACIÓN CENTRALIZADA
 * Todas las configuraciones del bot en un solo lugar
 */

require('dotenv').config();
const path = require('path');

const CONFIG = {
    // Server
    PORT: process.env.PORT || 7860,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Paths
    AUTH_DIR: path.join(__dirname, '..', '.bot_session'),
    MANGAS_DIR: path.join(__dirname, '..', 'mangas'),
    COMMANDS_DIR: path.join(__dirname, '..', 'commands'),
    
    // Bot Identity
    ADMIN_NUM: process.env.NUMERO_ADMIN,
    BOT_NUMBER: process.env.NUMERO_BOT || process.env.NUMERO_ADMIN,
    RENDER_URL: process.env.RENDER_EXTERNAL_URL,
    
    // External Services
    TURSO: {
        URL: process.env.TURSO_DATABASE_URL,
        TOKEN: process.env.TURSO_AUTH_TOKEN
    },
    
    // AI Keys
    AI: {
        GOOGLE_KEY: process.env.GEMINI_KEY || process.env.GOOGLE_AI_KEY,
        OPENROUTER_KEYS: (process.env.OPENROUTER_KEY || '')
            .split(',')
            .map(k => k.trim())
            .filter(Boolean)
    },
    
    // Cache Settings
    CACHE: {
        TRADUCCIONES: { max: 500, ttl: 24 * 60 * 60 * 1000 },      // 24h
        MANGA_INFO: { max: 200, ttl: 60 * 60 * 1000 },             // 1h
        SILENCIADOS: { max: 1000, ttl: null },                     // Sin TTL
        GROUP_CONFIG: { max: 200, ttl: 15 * 60 * 1000 },            // 15min (aumentado para mejor rendimiento)
        ADMIN_CACHE: { max: 100, ttl: 10 * 60 * 1000 },            // 10min
        API_CACHE: { max: 100, ttl: 30 * 60 * 1000 },             // 30min
        USER_CACHE: { max: 500, ttl: 30 * 1000 }                   // 30seg
    },
    
    // Rate Limits (por usuario/grupo)
    LIMITS: {
        AI_CONCURRENT: 2,        // Máximo 2 llamadas AI simultáneas
        HEAVY_CONCURRENT: 5,     // Máximo 5 tareas pesadas simultáneas
        MAX_FILES_PER_READ: 15,  // Máximo archivos en !leer
        MAX_HISTORY_LENGTH: 10   // Historial de mensajes para contexto AI
    },
    
    // Cooldowns (ms)
    COOLDOWNS: {
        DEFAULT: 3000,           // 3 segundos default
        HEAVY: 10000,            // 10 segundos comandos pesados
        MEDIA: 5000,             // 5 segundos media
        AI: 5000,                // 5 segundos AI
        LEER: 30000,             // 30 segundos !leer
        TAG: 60000,              // 1 minuto !tag
        RULETA: 60000            // 1 minuto !ruleta
    },
    
    // Game Settings
    GAMES: {
        TRIVIA_TIMEOUT: 30000,       // 30 seg para responder trivia
        AHORCADO_MAX_ATTEMPTS: 6,    // Intentos máximos ahorcado
        DUEL_TIMEOUT: 60000,         // 1 minuto para aceptar duelo
        SLOT_WIN_CHANCE: 0.15      // 15% chance de ganar slot
    },
    
    // Economy Settings
    ECONOMY: {
        DAILY_REWARD: 500,
        WORK_REWARD: 1000,
        WORK_COOLDOWN: 60 * 60 * 1000,      // 1 hora
        SLUT_REWARD: 500,
        SLUT_COOLDOWN: 20 * 60 * 1000,      // 20 minutos
        PRESTIGIO_MULTIPLIER: 0.1,         // +10% por prestigio
        MAX_MASCOTAS: 50,
        MASCOTA_EVOLUCION: 100            // Comidas para evolución
    },
    
    // Feature Flags
    FEATURES: {
        AI_REPLY: true,
        WELCOME_MSG: true,
        ANTI_SPAM: true,
        FLASH_ENABLED: false
    }
};

// Validación de config requerida
function validateConfig() {
    const required = [
        'ADMIN_NUM',
        'TURSO.URL',
        'TURSO.TOKEN'
    ];
    
    const missing = required.filter(key => {
        const keys = key.split('.');
        let value = CONFIG;
        for (const k of keys) {
            value = value[k];
            if (!value) return true;
        }
        return !value;
    });
    
    if (missing.length > 0) {
        console.warn('⚠️ [CONFIG] Variables faltantes:', missing.join(', '));
    }
    
    return missing.length === 0;
}

module.exports = {
    CONFIG,
    validateConfig
};
