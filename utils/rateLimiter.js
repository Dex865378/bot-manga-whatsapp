/**
 * 🚦 SISTEMA DE RATE LIMITING GLOBAL
 * Protege APIs externas y previene abuso del bot
 */

const { LRUCache } = require('./lruCache');

class RateLimiter {
    constructor() {
        // Límites por categoría
        this.limits = {
            // APIs externas (Jikan, etc.)
            'api:jikan': { max: 30, window: 60000 },      // 30 req/min
            'api:openai': { max: 20, window: 60000 },     // 20 req/min
            'api:openrouter': { max: 10, window: 60000 }, // 10 req/min
            
            // Comandos por usuario
            'user:default': { max: 30, window: 60000 },   // 30 cmd/min por usuario
            'user:heavy': { max: 5, window: 60000 },      // 5 cmd/min comandos pesados
            'user:ai': { max: 10, window: 60000 },        // 10 AI calls/min
            
            // Grupo completo
            'group:default': { max: 60, window: 60000 },    // 60 cmd/min por grupo
            'group:heavy': { max: 10, window: 60000 },    // 10 pesados/min por grupo
        };
        
        // Almacén de ventanas deslizantes
        this.windows = new LRUCache(10000, 120000); // 10k entries, 2min TTL
    }
    
    /**
     * Verifica si una acción puede ejecutarse
     * @param {string} category - Categoría del rate limit
     * @param {string} key - Identificador único (userId, groupId, etc.)
     * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
     */
    check(category, key) {
        const limit = this.limits[category];
        if (!limit) {
            return { allowed: true, remaining: Infinity, resetTime: 0 };
        }
        
        const windowKey = `${category}:${key}`;
        const now = Date.now();
        
        // Obtener ventana actual
        let window = this.windows.get(windowKey);
        if (!window) {
            window = { requests: [], count: 0 };
        }
        
        // Limpiar requests antiguos fuera de la ventana
        const cutoff = now - limit.window;
        window.requests = window.requests.filter(time => time > cutoff);
        window.count = window.requests.length;
        
        // Verificar límite
        if (window.count >= limit.max) {
            const oldestRequest = window.requests[0];
            const resetTime = oldestRequest + limit.window;
            
            return {
                allowed: false,
                remaining: 0,
                resetTime,
                retryAfter: Math.ceil((resetTime - now) / 1000)
            };
        }
        
        // Permitir y registrar
        window.requests.push(now);
        window.count++;
        this.windows.set(windowKey, window);
        
        return {
            allowed: true,
            remaining: limit.max - window.count,
            resetTime: now + limit.window
        };
    }
    
    /**
     * Incrementa el contador sin verificar (para llamadas exitosas)
     */
    increment(category, key) {
        const limit = this.limits[category];
        if (!limit) return;
        
        const windowKey = `${category}:${key}`;
        const now = Date.now();
        
        let window = this.windows.get(windowKey);
        if (!window) {
            window = { requests: [], count: 0 };
        }
        
        const cutoff = now - limit.window;
        window.requests = window.requests.filter(time => time > cutoff);
        window.requests.push(now);
        window.count = window.requests.length;
        
        this.windows.set(windowKey, window);
    }
    
    /**
     * Obtiene estado actual del rate limit
     */
    getStatus(category, key) {
        const limit = this.limits[category];
        if (!limit) return null;
        
        const windowKey = `${category}:${key}`;
        const now = Date.now();
        
        let window = this.windows.get(windowKey);
        if (!window) {
            return {
                limit: limit.max,
                remaining: limit.max,
                used: 0,
                resetTime: now + limit.window
            };
        }
        
        const cutoff = now - limit.window;
        window.requests = window.requests.filter(time => time > cutoff);
        
        const used = window.requests.length;
        const oldest = window.requests[0];
        
        return {
            limit: limit.max,
            remaining: Math.max(0, limit.max - used),
            used,
            resetTime: oldest ? oldest + limit.window : now + limit.window
        };
    }
    
    /**
     * Limpia ventanas expiradas (llamar periódicamente)
     */
    cleanup() {
        // LRU ya maneja expiración automática
        const stats = this.windows.stats();
        return {
            size: stats.size,
            maxSize: stats.maxSize
        };
    }
}

// Instancia global
const rateLimiter = new RateLimiter();

// Middleware para comandos
function rateLimitMiddleware(category, keyExtractor) {
    return async (ctx, next) => {
        const key = keyExtractor(ctx);
        const result = rateLimiter.check(category, key);
        
        if (!result.allowed) {
            const minutes = Math.ceil(result.retryAfter / 60);
            const msg = minutes > 1 
                ? `⏳ Rate limit alcanzado. Espera ${minutes} minutos.`
                : `⏳ Rate limit alcanzado. Espera ${result.retryAfter} segundos.`;
            
            return ctx.reply(msg);
        }
        
        // Continuar con el comando
        const startTime = Date.now();
        try {
            await next();
            // Solo incrementar si fue exitoso
            rateLimiter.increment(category, key);
        } catch (e) {
            throw e;
        }
    };
}

module.exports = {
    RateLimiter,
    rateLimiter,
    rateLimitMiddleware
};
