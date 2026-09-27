/**
 * 📝 Sistema de Logs Estructurado con Pino
 * Niveles: error, warn, info, debug
 */

const pino = require('pino');

// Configuración basada en entorno
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: isProduction ? 'info' : 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
        level: (label) => {
            return { level: label };
        },
        bindings: () => ({}), // Sin bindings por defecto
        log: (obj) => {
            // En producción, no loguear datos sensibles
            if (isProduction && obj.sensitive) {
                const { sensitive, ...rest } = obj;
                return rest;
            }
            return obj;
        }
    },
    // Logs JSON en producción, pretty print opcional en dev (sin pino-pretty)
    transport: undefined  // Usar output JSON estándar
});

// Wrapper con contexto para módulos específicos.
// Solo propaga args[0] si es un objeto plano; antes un string creaba {0,1..} gigante.
function createLogger(moduleName) {
    const meta = (args) => (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args[0] : {});
    return {
        error: (msg, ...args) => logger.error({ module: moduleName, ...meta(args) }, msg),
        warn: (msg, ...args) => logger.warn({ module: moduleName, ...meta(args) }, msg),
        info: (msg, ...args) => logger.info({ module: moduleName, ...meta(args) }, msg),
        debug: (msg, ...args) => logger.debug({ module: moduleName, ...meta(args) }, msg)
    };
}

// Log específico para comandos (para análisis de uso)
function logCommand(userId, commandName, args, duration, success) {
    logger.info({
        type: 'command',
        userId,
        command: commandName,
        argCount: args.length,
        duration,
        success,
        timestamp: Date.now()
    }, `Command ${commandName} executed`);
}

// Métricas de rendimiento
function logPerformance(operation, duration, details = {}) {
    logger.info({
        type: 'performance',
        operation,
        duration,
        ...details
    }, `Performance: ${operation} took ${duration}ms`);
}

module.exports = {
    logger,
    createLogger,
    logCommand,
    logPerformance
};
