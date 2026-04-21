/**
 * 🧰 UTILS INDEX - Exportaciones centralizadas
 * Facilita imports: const { LRUCache, fetchWithRetry } = require('./utils');
 */

const { LRUCache } = require('./lruCache');
const { fetchWithRetry, CircuitBreaker } = require('./apiClient');
const { InputValidator, ValidationError } = require('./inputValidator');
const { logger, createLogger, logCommand, logPerformance } = require('./logger');
const { RateLimiter, rateLimiter, rateLimitMiddleware } = require('./rateLimiter');

module.exports = {
    // Cache
    LRUCache,
    
    // API Client
    fetchWithRetry,
    CircuitBreaker,
    
    // Validation
    InputValidator,
    ValidationError,
    
    // Logging
    logger,
    createLogger,
    logCommand,
    logPerformance,
    
    // Rate Limiting (disponible si se necesita en el futuro)
    RateLimiter,
    rateLimiter,
    rateLimitMiddleware
};
