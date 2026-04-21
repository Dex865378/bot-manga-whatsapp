/**
 * 🧠 Sistema de Caché LRU (Least Recently Used)
 * Evita memory leaks limitando el tamaño máximo
 */

class LRUCache {
    constructor(maxSize, defaultTTL = null) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL; // milisegundos, null = sin expiración
        this.cache = new Map();
        this.timestamps = new Map(); // Para TTL
    }

    get(key) {
        const value = this.cache.get(key);
        if (value === undefined) return undefined;

        // Verificar TTL
        if (this.defaultTTL) {
            const timestamp = this.timestamps.get(key);
            if (timestamp && (Date.now() - timestamp > this.defaultTTL)) {
                this.delete(key);
                return undefined;
            }
        }

        // Mover al final (más reciente)
        this.cache.delete(key);
        this.cache.set(key, value);
        if (this.defaultTTL) {
            this.timestamps.delete(key);
            this.timestamps.set(key, Date.now());
        }

        return value;
    }

    set(key, value) {
        // Si ya existe, eliminar primero para reordenar
        if (this.cache.has(key)) {
            this.cache.delete(key);
            if (this.defaultTTL) this.timestamps.delete(key);
        }

        // Evicción LRU: eliminar el más viejo si superamos el límite
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.delete(oldestKey);
        }

        this.cache.set(key, value);
        if (this.defaultTTL) {
            this.timestamps.set(key, Date.now());
        }
    }

    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
    }

    has(key) {
        if (!this.cache.has(key)) return false;
        
        // Verificar TTL antes de decir que existe
        if (this.defaultTTL) {
            const timestamp = this.timestamps.get(key);
            if (timestamp && (Date.now() - timestamp > this.defaultTTL)) {
                this.delete(key);
                return false;
            }
        }
        return true;
    }

    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    get size() {
        return this.cache.size;
    }

    // Limpieza manual de entradas expiradas
    cleanup() {
        if (!this.defaultTTL) return 0;
        
        const now = Date.now();
        let cleaned = 0;
        for (const [key, timestamp] of this.timestamps.entries()) {
            if (now - timestamp > this.defaultTTL) {
                this.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    }

    // Estadísticas
    stats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            memoryEstimate: `${(this.cache.size * 0.5).toFixed(1)}KB (aprox)`
        };
    }
}

module.exports = { LRUCache };
