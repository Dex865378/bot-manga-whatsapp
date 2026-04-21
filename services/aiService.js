/**
 * 🤖 SERVICIO DE IA - Integración con múltiples proveedores
 * Soporta: Google Generative AI, OpenRouter
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { fetchWithRetry } = require('../utils');

// Configuración
const CONFIG = {
    // Límite de llamadas concurrentes
    MAX_CONCURRENT_AI: 2,
    
    // Timeout por proveedor
    TIMEOUT_GOOGLE: 15000,
    TIMEOUT_OPENROUTER: 20000,
    
    // Rotación de claves OpenRouter
    OPENROUTER_KEYS: (process.env.OPENROUTER_KEY || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
};

// Estado de llamadas concurrentes
let currentAiCalls = 0;

/**
 * Genera respuesta usando Google AI
 */
async function chatWithGoogleAI(prompt, retries = 2) {
    const key = process.env.GEMINI_KEY || process.env.GOOGLE_AI_KEY;
    if (!key) return null;
    
    // Control de concurrencia
    if (currentAiCalls >= CONFIG.MAX_CONCURRENT_AI) {
        return '⏳ El sistema de IA está muy ocupado. Intenta en unos segundos.';
    }
    
    currentAiCalls++;
    
    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
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
        currentAiCalls--;
    }
}

/**
 * Genera respuesta usando OpenRouter
 */
async function chatWithOpenRouter(prompt, retries = 2) {
    const keys = CONFIG.OPENROUTER_KEYS;
    if (keys.length === 0) return null;
    
    // Control de concurrencia
    if (currentAiCalls >= CONFIG.MAX_CONCURRENT_AI) {
        return '⏳ El sistema de IA está muy ocupado. Intenta en unos segundos.';
    }
    
    currentAiCalls++;
    
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
        currentAiCalls--;
    }
}

/**
 * Intenta múltiples proveedores de IA en orden
 */
async function chatWithAI(prompt, preferredProvider = 'auto') {
    // Si hay preferencia específica
    if (preferredProvider === 'google') {
        return await chatWithGoogleAI(prompt);
    }
    if (preferredProvider === 'openrouter') {
        return await chatWithOpenRouter(prompt);
    }
    
    // Auto: Intentar en orden
    let response = await chatWithGoogleAI(prompt);
    if (response) return response;
    
    response = await chatWithOpenRouter(prompt);
    if (response) return response;
    
    return '❌ Los servicios de IA no están disponibles en este momento.';
}

/**
 * Verifica el estado de los servicios de IA
 */
async function checkAIHealth() {
    const results = {
        google: false,
        openrouter: false
    };
    
    // Verificar Google
    if (process.env.GOOGLE_AI_KEY) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            await model.generateContent('test');
            results.google = true;
        } catch (e) {
            // Ignorar error de contenido, solo verificar conexión
            if (e.message.includes('400') || e.message.includes('permission')) {
                results.google = true;
            }
        }
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
    chatWithOpenRouter,
    checkAIHealth,
    CONFIG
};
