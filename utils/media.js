/**
 * 🎞️ DETECCIÓN DE FORMATO DE MEDIA
 * Identifica el formato real de un buffer por su firma (magic bytes), sin
 * depender del mime que reporte WhatsApp ni de la extensión del archivo.
 * Se usa para elegir la ruta correcta de ffmpeg sin convertir dos veces.
 */

function esGif(buffer) {
    return !!buffer && buffer.length > 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // GIF8
}

function esWebp(buffer) {
    if (!buffer || buffer.length < 12) return false;
    return buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buffer.subarray(8, 12).toString('latin1') === 'WEBP';
}

// Un WebP animado lleva el chunk 'ANIM' en la cabecera (después de VP8X).
function esWebpAnimado(buffer) {
    if (!esWebp(buffer)) return false;
    const cabecera = buffer.subarray(0, Math.min(buffer.length, 64)).toString('latin1');
    return cabecera.includes('ANIM');
}

function esMp4(buffer) {
    return !!buffer && buffer.length > 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp';
}

function esBufferAnimado(buffer) {
    return esGif(buffer) || esWebpAnimado(buffer) || esMp4(buffer);
}

// Extensión con la que conviene guardar el temporal para que el demuxer de
// ffmpeg no tenga que adivinar. `comoVideo` = ruta animada.
function extParaBuffer(buffer, comoVideo) {
    if (!comoVideo) return 'png';
    if (esGif(buffer)) return 'gif';
    if (esWebp(buffer)) return 'webp';
    return 'mp4';
}

module.exports = { esGif, esWebp, esWebpAnimado, esMp4, esBufferAnimado, extParaBuffer };
