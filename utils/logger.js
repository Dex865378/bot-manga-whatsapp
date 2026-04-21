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

// Wrapper con contexto para módulos específicos
function createLogger(moduleName) {
    return {
        error: (msg, ...args) => logger.error({ module: moduleName, ...args[0] }, msg),
        warn: (msg, ...args) => logger.warn({ module: moduleName, ...args[0] }, msg),
        info: (msg, ...args) => logger.info({ module: moduleName, ...args[0] }, msg),
        debug: (msg, ...args) => logger.debug({ module: moduleName, ...args[0] }, msg)
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
