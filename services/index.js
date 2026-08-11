/**
 * 🔧 SERVICES INDEX - Exportaciones centralizadas
 * Servicios de negocio del bot
 */

const aiService   = require('./aiService');
const mangadex    = require('./mangadex');
const anilist     = require('./anilist');

module.exports = {
    aiService,
    mangadex,
    anilist
};
