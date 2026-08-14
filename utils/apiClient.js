/**
 * 🌐 Cliente API con Retry + Circuit Breaker
 * Evita fallos por API caída o rate limits
 */

const axios = require('axios');

class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureThreshold = threshold;
        this.timeout = timeout;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit Breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            console.warn(`🔴 Circuit Breaker OPEN - API falló ${this.failureCount} veces`);
        }
    }
}

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    const domain = (() => {
        try { return new URL(url).hostname; } catch (_) { return 'default'; }
    })();
    const circuitBreaker = getCircuitBreaker(domain);
    const { body, data, method = 'GET', headers: callerHeaders, ...axiosOptions } = options;
    const requestConfig = {
        url,
        method: method.toUpperCase(),
        timeout: 10000,
        // User-Agent de navegador por defecto: axios manda "axios/1.x.x" si
        // no se especifica, lo cual muchas APIs publicas gratuitas rechazan
        // automaticamente con 403 por parecer trafico de bot/script en vez
        // de un navegador real. callerHeaders (si la llamada especifica trae
        // headers propios) se aplica DESPUES, para poder sobreescribir el
        // User-Agent si hace falta sin perder el default en el caso comun.
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            ...(callerHeaders || {})
        },
        ...axiosOptions
    };

    if (data !== undefined) {
        requestConfig.data = data;
    } else if (body !== undefined) {
        try {
            requestConfig.data = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (_) {
            requestConfig.data = body;
        }
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            return await circuitBreaker.execute(() => axios(requestConfig));
        } catch (error) {
            const isLastAttempt = i === retries - 1;
            
            // No reintentar en errores 4xx (cliente)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                throw error;
            }

            if (isLastAttempt) {
                console.error(`❌ API failed after ${retries} attempts: ${url}`);
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = backoff * Math.pow(2, i);
            console.warn(`⚠️ API attempt ${i + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Circuit breakers por dominio (para no mezclar fallos de APIs distintas)
const circuitBreakers = new Map();

function getCircuitBreaker(domain) {
    if (!circuitBreakers.has(domain)) {
        circuitBreakers.set(domain, new CircuitBreaker());
    }
    return circuitBreakers.get(domain);
}

async function safeApiCall(domain, fn) {
    const cb = getCircuitBreaker(domain);
    return cb.execute(fn);
}

module.exports = { 
    fetchWithRetry, 
    CircuitBreaker, 
    safeApiCall 
};
