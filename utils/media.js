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

// --- WebP animado → primer frame como WebP FIJO ---
// Ninguna versión de ffmpeg (5.1, 6.0, 7.0) sabe decodificar WebP animado, y
// dwebp tampoco. Pero cada frame de la animación es un WebP normal dentro del
// contenedor RIFF: se extrae el primero y se reempaqueta como archivo fijo,
// que sí se puede pasar por ffmpeg. Sin librerías ni binarios extra.
function chunksWebp(buffer, desde = 0) {
    const out = [];
    let off = desde;
    while (off + 8 <= buffer.length) {
        const id = buffer.toString('latin1', off, off + 4);
        const size = buffer.readUInt32LE(off + 4);
        const start = off + 8;
        if (size < 0 || start + size > buffer.length) break;
        out.push({ id, size, data: buffer.subarray(start, start + size) });
        off = start + size + (size % 2); // los chunks van alineados a 2 bytes
    }
    return out;
}

function primerFrameWebp(buffer) {
    if (!buffer || buffer.length < 20) return null;
    if (buffer.toString('latin1', 0, 4) !== 'RIFF' || buffer.toString('latin1', 8, 12) !== 'WEBP') return null;
    const anmf = chunksWebp(buffer, 12).find(c => c.id === 'ANMF');
    if (!anmf || anmf.data.length < 17) return null;
    const d = anmf.data;
    const ancho = d.readUIntLE(6, 3) + 1;
    const alto = d.readUIntLE(9, 3) + 1;
    const frame = d.subarray(16); // salta la cabecera de 16 bytes del ANMF
    const tieneAlpha = chunksWebp(frame, 0).some(c => c.id === 'ALPH');
    const partes = [];
    if (tieneAlpha) {
        // Sin VP8X, los decodificadores ignoran el canal alfa del frame.
        const vp8x = Buffer.alloc(18);
        vp8x.write('VP8X', 0, 'latin1');
        vp8x.writeUInt32LE(10, 4);
        vp8x[8] = 0x10; // flag de alpha
        vp8x.writeUIntLE(ancho - 1, 12, 3);
        vp8x.writeUIntLE(alto - 1, 15, 3);
        partes.push(vp8x);
    }
    partes.push(frame);
    const cuerpo = Buffer.concat(partes);
    const cabecera = Buffer.alloc(12);
    cabecera.write('RIFF', 0, 'latin1');
    cabecera.writeUInt32LE(cuerpo.length + 4, 4);
    cabecera.write('WEBP', 8, 'latin1');
    return Buffer.concat([cabecera, cuerpo]);
}

// Extensión con la que conviene guardar el temporal para que el demuxer de
// ffmpeg no tenga que adivinar. `comoVideo` = ruta animada.
function extParaBuffer(buffer, comoVideo) {
    if (!comoVideo) return 'png';
    if (esGif(buffer)) return 'gif';
    if (esWebp(buffer)) return 'webp';
    return 'mp4';
}

module.exports = { esGif, esWebp, esWebpAnimado, esMp4, esBufferAnimado, extParaBuffer, primerFrameWebp };
