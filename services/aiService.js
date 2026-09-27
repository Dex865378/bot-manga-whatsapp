/**
 * 🤖 SERVICIO DE IA - Integración con múltiples proveedores
 * Soporta: Google Generative AI, Groq, Cerebras, OpenRouter
 *
 * Orden de la cascada (chatWithAI, modo 'auto'):
 *   1. Google Gemini    (gemini-1.5-flash)
 *   2. Groq              (llama-3.3-70b-versatile)  ~14,400 req/dia gratis
 *   3. Cerebras          (llama3.3-70b)              ~1M tokens/dia gratis
 *   4. OpenRouter         (fallback final)
 *
 * Si un proveedor falla o no tiene key configurada, se salta al siguiente
 * automaticamente. Esto evita que el bot se quede "mudo" cuando un solo
 * proveedor gratuito agota su limite diario.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { fetchWithRetry } = require('../utils');

// Configuración
const CONFIG = {
    // Límite de llamadas concurrentes
    MAX_CONCURRENT_AI: 2,

    // Timeout por proveedor
    TIMEOUT_GOOGLE: 15000,
    TIMEOUT_GROQ: 15000,
    TIMEOUT_CEREBRAS: 15000,
    TIMEOUT_OPENROUTER: 20000,

    // Rotación de claves OpenRouter
    OPENROUTER_KEYS: (process.env.OPENROUTER_KEY || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean),

    // Groq y Cerebras: soportan claves separadas por coma tambien, por si
    // en el futuro Diky quiere rotar entre varias cuentas gratuitas
    GROQ_KEYS: (process.env.GROQ_API_KEY || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean),
    CEREBRAS_KEYS: (process.env.CEREBRAS_API_KEY || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
};

// Estado de llamadas concurrentes POR PROVEEDOR (antes un contador global:
// 2 llamadas a Google bloqueaban a Groq/Cerebras aunque estuvieran libres,
// y el aviso de "ocupado" cortaba la cascada sin probar el siguiente proveedor).
const aiCalls = { google: 0, groq: 0, cerebras: 0, openrouter: 0 };
// Timestamp de la última vez que un proveedor estuvo saturado: sirve para
// distinguir "todos fallaron" de "había cola" al final de la cascada.
let aiBusyAt = 0;

function aiAcquire(name) {
    if (aiCalls[name] >= CONFIG.MAX_CONCURRENT_AI) { aiBusyAt = Date.now(); return false; }
    aiCalls[name]++;
    return true;
}
function aiRelease(name) { aiCalls[name] = Math.max(0, aiCalls[name] - 1); }

// Cliente Google reutilizado (evita new por mensaje → menos GC en 512MB)
let googleClient = null;
let googleClientKey = null;
function getGoogleClient(key) {
    if (!googleClient || googleClientKey !== key) {
        googleClient = new GoogleGenerativeAI(key);
        googleClientKey = key;
    }
    return googleClient;
}

/**
 * Genera respuesta usando Google AI
 */
async function chatWithGoogleAI(prompt, retries = 2) {
    const key = process.env.GEMINI_KEY || process.env.GOOGLE_AI_KEY;
    if (!key) return null;

    // Control de concurrencia (solo cuenta este proveedor)
    if (!aiAcquire('google')) return null;

    try {
        const genAI = getGoogleClient(key);
        // gemini-1.5-flash: gemini-pro (la version anterior usada aqui) fue
        // retirado por Google y ya no responde de forma confiable, lo que
        // causaba que este proveedor fallara casi siempre y cayera a los
        // siguientes de la cascada innecesariamente.
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await Promise.race([
            model.generateContent(prompt),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), CONFIG.TIMEOUT_GOOGLE)
            )
        ]);

        const response = await result.response;
        return response.text();
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return chatWithGoogleAI(prompt, retries - 1);
        }
        console.error('❌ [AI] Google AI Error:', e.message);
        return null;
    } finally {
        aiRelease('google');
    }
}

/**
 * Genera respuesta usando Groq (API compatible con OpenAI).
 * Modelo llama-3.3-70b-versatile: ~14,400 peticiones/dia gratis, 30/minuto.
 */
async function chatWithGroq(prompt, retries = 2) {
    const keys = CONFIG.GROQ_KEYS;
    if (keys.length === 0) return null;

    if (!aiAcquire('groq')) return null;

    const apiKey = keys[Math.floor(Math.random() * keys.length)];

    try {
        const response = await fetchWithRetry(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500,
                    timeout: CONFIG.TIMEOUT_GROQ
                })
            },
            retries,
            1500
        );

        return response.data.choices[0].message.content;
    } catch (e) {
        console.error('❌ [AI] Groq Error:', e.message);
        return null;
    } finally {
        aiRelease('groq');
    }
}

/**
 * Genera respuesta usando Cerebras (API compatible con OpenAI).
 * Modelo llama3.3-70b: ~1M tokens/dia gratis, contexto limitado a 8K en el
 * tier gratuito (mas que suficiente para un solo mensaje de chat de grupo).
 */
async function chatWithCerebras(prompt, retries = 2) {
    const keys = CONFIG.CEREBRAS_KEYS;
    if (keys.length === 0) return null;

    if (!aiAcquire('cerebras')) return null;

    const apiKey = keys[Math.floor(Math.random() * keys.length)];

    try {
        const response = await fetchWithRetry(
            'https://api.cerebras.ai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama3.3-70b',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500
                })
            },
            retries,
            1500
        );

        return response.data.choices[0].message.content;
    } catch (e) {
        console.error('❌ [AI] Cerebras Error:', e.message);
        return null;
    } finally {
        aiRelease('cerebras');
    }
}

/**
 * Genera respuesta usando OpenRouter
 */
async function chatWithOpenRouter(prompt, retries = 2) {
    const keys = CONFIG.OPENROUTER_KEYS;
    if (keys.length === 0) return null;

    // Control de concurrencia (solo cuenta este proveedor)
    if (!aiAcquire('openrouter')) return null;

    // Rotación de claves
    const keyIndex = Math.floor(Math.random() * keys.length);
    const apiKey = keys[keyIndex];

    try {
        const response = await fetchWithRetry(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.BOT_URL || 'https://localhost'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500
                })
            },
            retries,
            1500
        );

        return response.data.choices[0].message.content;
    } catch (e) {
        console.error('❌ [AI] OpenRouter Error:', e.message);
        return null;
    } finally {
        aiRelease('openrouter');
    }
}

/**
 * Intenta múltiples proveedores de IA en orden (cascada anti-limite-diario)
 */
async function chatWithAI(prompt, preferredProvider = 'auto') {
    // Si hay preferencia específica
    if (preferredProvider === 'google') return await chatWithGoogleAI(prompt);
    if (preferredProvider === 'groq') return await chatWithGroq(prompt);
    if (preferredProvider === 'cerebras') return await chatWithCerebras(prompt);
    if (preferredProvider === 'openrouter') return await chatWithOpenRouter(prompt);

    // Auto: Intentar en orden. Cada proveedor devuelve null si fallo, no tiene
    // key o está saturado (la saturación ya no corta la cascada: se prueba el
    // siguiente proveedor y solo al final se avisa si había cola).
    let sawBusy = false;
    const paso = async (fn) => {
        const r = await fn(prompt);
        if (r) return r;
        if (Date.now() - aiBusyAt < 30000) sawBusy = true;
        return null;
    };

    let response = await paso(chatWithGoogleAI);
    if (response) return response;

    response = await paso(chatWithGroq);
    if (response) return response;

    response = await paso(chatWithCerebras);
    if (response) return response;

    response = await paso(chatWithOpenRouter);
    if (response) return response;

    if (sawBusy) return '⏳ El sistema de IA está muy ocupado. Intenta en unos segundos.';
    return '❌ Los servicios de IA no están disponibles en este momento.';
}

/**
 * Verifica el estado de los servicios de IA
 */
async function checkAIHealth() {
    const results = {
        google: false,
        groq: false,
        cerebras: false,
        openrouter: false
    };

    // Verificar Google
    if (process.env.GEMINI_KEY || process.env.GOOGLE_AI_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || process.env.GOOGLE_AI_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('test');
            results.google = true;
        } catch (e) {
            // Ignorar error de contenido, solo verificar conexión
            if (e.message.includes('400') || e.message.includes('permission')) {
                results.google = true;
            }
        }
    }

    // Verificar Groq
    if (CONFIG.GROQ_KEYS.length > 0) {
        try {
            await fetchWithRetry(
                'https://api.groq.com/openai/v1/models',
                { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEYS[0]}` } },
                1,
                5000
            );
            results.groq = true;
        } catch (e) { }
    }

    // Verificar Cerebras
    if (CONFIG.CEREBRAS_KEYS.length > 0) {
        try {
            await fetchWithRetry(
                'https://api.cerebras.ai/v1/models',
                { headers: { 'Authorization': `Bearer ${CONFIG.CEREBRAS_KEYS[0]}` } },
                1,
                5000
            );
            results.cerebras = true;
        } catch (e) { }
    }

    // Verificar OpenRouter
    if (CONFIG.OPENROUTER_KEYS.length > 0) {
        try {
            await fetchWithRetry(
                'https://openrouter.ai/api/v1/models',
                { headers: { 'Authorization': `Bearer ${CONFIG.OPENROUTER_KEYS[0]}` } },
                1,
                5000
            );
            results.openrouter = true;
        } catch (e) {
            // Falló
        }
    }

    return results;
}

module.exports = {
    chatWithAI,
    chatWithGoogleAI,
    chatWithGroq,
    chatWithCerebras,
    chatWithOpenRouter,
    checkAIHealth,
    CONFIG
};
