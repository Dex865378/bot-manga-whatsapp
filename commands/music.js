const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');

// ─────────────────────────────────────────────────────────────
//  🎵 DIKY BOT - MÚSICA EN CASCADA (3 FUENTES)
//
//  FUENTE 1: yt-dlp  (binario en /usr/local/bin/yt-dlp)
//  FUENTE 2: cobalt.tools  (API pública y gratuita)
//  FUENTE 3: loader.to  (API legado, como último recurso)
//
//  Si una fuente falla → pasa a la siguiente automáticamente.
// ─────────────────────────────────────────────────────────────

// Detecta la ruta del binario yt-dlp según el sistema
const YTDLP_BIN = (() => {
    const candidates = [
        '/usr/local/bin/yt-dlp',   // HuggingFace / Linux Docker
        '/usr/bin/yt-dlp',         // Algunos Linuxes
        'yt-dlp',                  // PATH del sistema (Windows dev)
    ];
    for (const c of candidates) {
        try {
            if (c !== 'yt-dlp' && fs.existsSync(c)) return c;
        } catch { /* continuar */ }
    }
    return 'yt-dlp'; // fallback: busca en PATH
})();

// ─────────────────────────────────────────────────────────────
// MENSAJES ALEATORIOS
// ─────────────────────────────────────────────────────────────
const MSG_BUSCANDO = [
    '🎵 Buscando *"{q}"*... dame un momento 🎶',
    '⏳ Procesando tu canción: *"{q}"*...',
    '🎧 Ya casi... preparando *"{q}"*...',
    '🔍 Encontré *"{q}"*, cargando el audio...',
    '🎼 Consiguiendo *"{q}"* de los mejores servidores...',
];
const MSG_REINTENTO = [
    '⚡ Probando servidor alternativo para *"{q}"*...',
    '🔄 Cambiando de fuente... aguanta un momento...',
    '🌐 Reconectando con otro servidor de audio...',
];
const MSG_ERROR = [
    '😢 No pude descargar esa canción. Intenta de nuevo más tarde.',
    '❌ Hubo un error en todos los servidores. Prueba con otro nombre.',
    '⚠️ Los tres servidores fallaron. Intenta con *!play {q} audio*',
];

function rand(arr, q = '') {
    return arr[Math.floor(Math.random() * arr.length)].replace('{q}', q);
}

// ─────────────────────────────────────────────────────────────
// FUENTE 1: yt-dlp (binario del sistema)
// ─────────────────────────────────────────────────────────────
async function descargarConYtDlp(ytUrl) {
    const tmpId = crypto.randomBytes(8).toString('hex');
    // yt-dlp usa %(ext)s entonces el output puede ser .mp3 u otro
    const tmpTemplate = path.join(os.tmpdir(), `music_${tmpId}.%(ext)s`);
    const tmpMp3 = path.join(os.tmpdir(), `music_${tmpId}.mp3`);
    const tmpWebm = path.join(os.tmpdir(), `music_${tmpId}.webm`);
    const tmpM4a = path.join(os.tmpdir(), `music_${tmpId}.m4a`);

    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '5',      // calidad media (0=mejor, 9=peor)
                '-o', tmpTemplate,
                '--no-playlist',
                '--no-warnings',
                '--quiet',
                '--socket-timeout', '30',
                '--retries', '3',
                ytUrl,
            ];

            console.log(`[MUSIC:YTDLP] Ejecutando: ${YTDLP_BIN} ${args.slice(-3).join(' ')}`);
            const proc = spawn(YTDLP_BIN, args);

            let stderr = '';
            proc.stderr.on('data', d => { stderr += d.toString(); });
            proc.stdout.on('data', d => { /* silenciar stdout */ });

            const timeout = setTimeout(() => {
                proc.kill('SIGTERM');
                reject(new Error('yt-dlp timeout (90s)'));
            }, 90_000);

            proc.on('close', code => {
                clearTimeout(timeout);
                if (code === 0) resolve();
                else reject(new Error(`yt-dlp falló (código ${code}): ${stderr.slice(-300)}`));
            });

            proc.on('error', err => {
                clearTimeout(timeout);
                reject(new Error(`No se pudo ejecutar yt-dlp: ${err.message}`));
            });
        });

        // Buscar el archivo generado (puede ser .mp3, .m4a, .webm, etc.)
        let finalFile = tmpMp3;
        if (!fs.existsSync(tmpMp3)) {
            // Buscar cualquier archivo temporal con nuestro ID
            const tmpDir = os.tmpdir();
            const archivos = fs.readdirSync(tmpDir).filter(f => f.startsWith(`music_${tmpId}`));
            if (archivos.length === 0) throw new Error('yt-dlp no generó ningún archivo');
            finalFile = path.join(tmpDir, archivos[0]);
        }

        const buffer = fs.readFileSync(finalFile);
        if (buffer.length < 50_000) throw new Error('Archivo demasiado pequeño (posiblemente corrupto)');
        console.log(`[MUSIC:YTDLP] ✅ OK — ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
        return buffer;

    } finally {
        // Limpiar archivos temporales pase lo que pase
        const tmpDir = os.tmpdir();
        const archivos = fs.readdirSync(tmpDir).filter(f => f.startsWith(`music_${tmpId}`));
        for (const f of archivos) {
            try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignorar */ }
        }
    }
}

// ─────────────────────────────────────────────────────────────
// FUENTE 2: cobalt.tools (API pública gratuita)
// ─────────────────────────────────────────────────────────────
async function descargarConCobalt(ytUrl) {
    console.log(`[MUSIC:COBALT] Iniciando...`);

    // Cobalt API v10+
    const res = await axios.post('https://api.cobalt.tools/', {
        url: ytUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3',
        filenameStyle: 'basic',
    }, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        timeout: 20_000,
    });

    const { status, url, tunnel } = res.data;
    const downloadUrl = url || tunnel;

    if (!downloadUrl) {
        throw new Error(`Cobalt status inesperado: "${status}" — ${JSON.stringify(res.data).slice(0, 200)}`);
    }

    console.log(`[MUSIC:COBALT] URL conseguida, descargando...`);

    const mp3Res = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 90_000,
        maxContentLength: 30 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    const buffer = Buffer.from(mp3Res.data);
    if (buffer.length < 50_000) throw new Error('Cobalt: buffer demasiado pequeño');
    console.log(`[MUSIC:COBALT] ✅ OK — ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    return buffer;
}

// ─────────────────────────────────────────────────────────────
// FUENTE 3: loader.to (API legado, último recurso)
// ─────────────────────────────────────────────────────────────
async function descargarConLoaderTo(ytUrl) {
    console.log(`[MUSIC:LOADER] Iniciando...`);

    const jobRes = await axios.get('https://loader.to/ajax/download.php', {
        params: { format: 'mp3', url: ytUrl, start: 'false' },
        timeout: 15_000,
    });

    const jobId = jobRes.data?.id;
    if (!jobId) throw new Error('loader.to no devolvió job ID');
    console.log(`[MUSIC:LOADER] Job ID: ${jobId}`);

    let downloadUrl = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await axios.get('https://loader.to/ajax/progress.php', {
            params: { id: jobId },
            timeout: 10_000,
        });
        const data = poll.data;
        console.log(`[MUSIC:LOADER] Poll ${i + 1}/20 → ${data?.progress}%`);
        if (data?.success === 1 && data?.download_url) {
            downloadUrl = data.download_url;
            break;
        }
    }

    if (!downloadUrl) throw new Error('loader.to timeout: el servidor tardó demasiado');

    const mp3Res = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: 25 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://loader.to/',
        },
    });

    const buffer = Buffer.from(mp3Res.data);
    if (buffer.length < 50_000) throw new Error('loader.to: buffer demasiado pequeño');
    console.log(`[MUSIC:LOADER] ✅ OK — ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    return buffer;
}

// ─────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL: Cascada de fuentes
// ─────────────────────────────────────────────────────────────
const FUENTES = [
    { nombre: 'yt-dlp (binario)',  fn: descargarConYtDlp   },
    { nombre: 'cobalt.tools (API)', fn: descargarConCobalt  },
    { nombre: 'loader.to (legado)', fn: descargarConLoaderTo },
];

async function descargarMP3(ytUrl, onRetry) {
    const errores = [];

    for (let i = 0; i < FUENTES.length; i++) {
        const fuente = FUENTES[i];
        try {
            console.log(`\n[MUSIC] ▶ Intentando fuente ${i + 1}/${FUENTES.length}: ${fuente.nombre}`);
            const buffer = await fuente.fn(ytUrl);
            console.log(`[MUSIC] ✅ Éxito con fuente: ${fuente.nombre}`);
            return { buffer, fuente: fuente.nombre };

        } catch (err) {
            const msg = err.message || String(err);
            errores.push(`${fuente.nombre}: ${msg}`);
            console.error(`[MUSIC] ❌ Falló "${fuente.nombre}": ${msg}`);

            // Notificar al usuario que estamos reintentando (solo si no es la última)
            if (i < FUENTES.length - 1 && onRetry) {
                await onRetry(i + 1);
            }
        }
    }

    throw new Error(`Todas las fuentes fallaron:\n${errores.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`);
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR COMANDO
// ─────────────────────────────────────────────────────────────
module.exports = {
    name: 'music',
    isMultiple: true,
    names: ['!play', '!musica', '!cancion', '!audio', '!mp3'],

    async execute(sock, chatId, msg, args) {
        const query = args.join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: '🎵 *Uso:* !play <nombre de la canción>\n_Ejemplo: !play Bad Bunny Tití Me Preguntó_'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            // 1. Buscar en YouTube
            const search = await yts(query);
            const video = search.videos[0];

            if (!video) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: '❌ No encontré ninguna canción con ese nombre. Intenta siendo más específico.'
                }, { quoted: msg });
            }

            // 2. Límite de duración: 10 minutos
            if (video.seconds > 600) {
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } });
                return sock.sendMessage(chatId, {
                    text: `⚠️ La canción dura *${video.timestamp}* y el límite es 10:00. Busca una más corta.`
                }, { quoted: msg });
            }

            // 3. Notificar inicio
            const msgBuscando = await sock.sendMessage(chatId, {
                text: rand(MSG_BUSCANDO, video.title)
            }, { quoted: msg });

            // 4. Descargar con sistema en cascada
            const onRetry = async (intentoNum) => {
                try {
                    await sock.sendMessage(chatId, {
                        text: rand(MSG_REINTENTO, video.title)
                    }, { quoted: msg });
                } catch { /* ignorar errores de mensajería durante reintento */ }
            };

            const { buffer, fuente } = await descargarMP3(video.url, onRetry);

            // 5. Enviar al chat de WhatsApp
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${video.title}.mp3`,
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } });

            const mb = (buffer.length / 1024 / 1024).toFixed(1);
            console.log(`✅ [MUSIC] "${video.title}" enviado — ${mb} MB — via ${fuente}`);

        } catch (e) {
            console.error('[MUSIC ERROR FATAL]:', e.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, {
                text: rand(MSG_ERROR, query)
            }, { quoted: msg });
        }
    }
};
