const yts = require('yt-search');
const axios = require('axios');

/**
 * 🎵 COMANDO DE MÚSICA - loader.to API (funciona sin auth)
 * Flujo: yt-search → loader.to download job → polling → descargar MP3 → enviar
 */

const MSG_BUSCANDO = [
    '🎵 Buscando *"{q}"*... dame un momento 🎶',
    '⏳ Procesando tu canción: *"{q}"*...',
    '🎧 Ya casi... descargando *"{q}"* desde los servidores...',
    '🔍 Encontré *"{q}"*, preparando el audio...',
];
const MSG_ERROR = [
    '😢 No pude descargar esa canción. Intenta de nuevo más tarde.',
    '❌ Hubo un error al procesar el audio. Prueba con otro nombre.',
    '⚠️ El servidor está ocupado. Intenta con *!play {q} audio*',
];

function rand(arr, q = '') {
    return arr[Math.floor(Math.random() * arr.length)].replace('{q}', q);
}

/**
 * Descarga un MP3 de YouTube usando loader.to
 * @param {string} ytUrl - URL de YouTube
 * @returns {Buffer|null} - Buffer MP3 o null si falló
 */
async function descargarMP3(ytUrl) {
    // Paso 1: Iniciar el job de conversión en loader.to
    const jobRes = await axios.get('https://loader.to/ajax/download.php', {
        params: {
            format: 'mp3',
            url: ytUrl,
            start: 'false',
        },
        timeout: 15000,
    });

    const jobId = jobRes.data?.id;
    if (!jobId) throw new Error('loader.to no devolvió un job ID');
    console.log(`[MUSIC] Job iniciado: ${jobId}`);

    // Paso 2: Polling hasta que el job termine (máx 20 intentos × 3s = 60s)
    let downloadUrl = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const pollRes = await axios.get('https://loader.to/ajax/progress.php', {
            params: { id: jobId },
            timeout: 10000,
        });

        const data = pollRes.data;
        console.log(`[MUSIC] Poll ${i + 1}/20 → progress: ${data?.progress}, success: ${data?.success}`);

        if (data?.success === 1 && data?.download_url) {
            downloadUrl = data.download_url;
            break;
        }
    }

    if (!downloadUrl) throw new Error('Timeout: el servidor tardó demasiado en procesar el audio');
    console.log(`[MUSIC] URL de descarga obtenida: ${downloadUrl.slice(0, 60)}...`);

    // Paso 3: Descargar el MP3 a memoria RAM
    const mp3Res = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 25 * 1024 * 1024, // 25 MB máx
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://loader.to/',
        },
    });

    const buffer = Buffer.from(mp3Res.data);
    if (buffer.length < 10000) throw new Error('Buffer MP3 demasiado pequeño (archivo corrupto)');

    console.log(`[MUSIC] Buffer descargado: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    return buffer;
}

module.exports = {
    name: 'music',
    isMultiple: true,
    names: ['!play', '!musica', '!cancion', '!audio'],
    async execute(sock, chatId, msg, args) {
        const query = args.join(' ').trim();
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '🎵 *Uso:* !play <nombre de la canción>\n_Ejemplo: !play La Bebe Remix_'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            // 1. Buscar en YouTube para obtener URL y metadatos
            const search = await yts(query);
            const video = search.videos[0];
            if (!video) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: '❌ No encontré ninguna canción con ese nombre.'
                }, { quoted: msg });
            }

            // 2. Límite: máx 10 minutos
            if (video.seconds > 600) {
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: '⚠️ La canción dura más de 10 minutos. Busca una más corta.'
                }, { quoted: msg });
            }

            // 3. Notificar al usuario
            await sock.sendMessage(chatId, {
                text: rand(MSG_BUSCANDO, video.title)
            }, { quoted: msg });

            // 4. Descargar el MP3
            const buffer = await descargarMP3(video.url);

            // 5. Enviar al chat de WhatsApp
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${video.title}.mp3`,
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } });
            console.log(`✅ [MUSIC] Enviado: "${video.title}" (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);

        } catch (e) {
            console.error('[MUSIC ERROR]:', e.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: rand(MSG_ERROR, query)
            }, { quoted: msg });
        }
    }
};
