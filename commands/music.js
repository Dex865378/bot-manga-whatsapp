const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * 🎵 COMANDO DE MÚSICA (YT -> MP3) - DIKY BOT V2
 * Basado en la estabilidad de Neko Bot
 */

module.exports = {
    name: 'music',
    isMultiple: true,
    names: ['!play', '!musica', '!music', '!ytmp3', '!play2'],
    async execute(sock, chatId, msg, args, { FFMPEG_PATH }) {
        const query = args.join(' ');
        if (!query) return sock.sendMessage(chatId, { text: '🎵 *Uso:* !play <nombre de la canción>' }, { quoted: msg });

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            // 1. Buscar en YouTube
            const search = await yts(query);
            const video = search.videos[0];
            if (!video) return sock.sendMessage(chatId, { text: '❌ No se encontró la canción.' });

            // Notificación rápida
            await sock.sendMessage(chatId, { text: `🎵 *Preparando:* _"${video.title}"_...\nEspera unos segundos.` }, { quoted: msg });

            // 2. Rutas temporales
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const inputPath = path.join(tmpDir, `yt_${timestamp}.mp4`);
            const outputPath = path.join(tmpDir, `music_${timestamp}.mp3`);

            // 3. Descargar (Optimizado para evitar bloqueos)
            const options = {
                quality: 'highestaudio',
                filter: 'audioonly',
                highWaterMark: 1 << 25, // Buffer de 32MB para evitar cortes
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    }
                }
            };

            // Usar cookies si existen (pero sin presionar al usuario)
            if (process.env.YT_COOKIES) {
                try {
                    options.agent = ytdl.createAgent(JSON.parse(process.env.YT_COOKIES));
                } catch (e) { }
            }

            const stream = ytdl(video.url, options);
            const fileStream = fs.createWriteStream(inputPath);
            stream.pipe(fileStream);

            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
                stream.on('error', reject);
            });

            // 4. Convertir a MP3 ultra rápido (128k es perfecto)
            await execFileAsync(FFMPEG_PATH, [
                '-i', inputPath,
                '-vn',
                '-ab', '128k',
                '-ar', '44100',
                '-y',
                outputPath
            ]);

            // 5. Enviar audio DIRECTO para reproducir en WhatsApp
            await sock.sendMessage(chatId, { 
                audio: fs.readFileSync(outputPath), 
                mimetype: 'audio/mpeg', // MPEG suele forzar el reproductor
                ptt: false, // Asegurar que sea audio, no nota de voz
                fileName: `${video.title}.mp3`
            }, { quoted: msg });

            // 6. Limpiar y reaccionar
            try {
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
            } catch (e) { }

        } catch (e) {
            console.error('❌ [MUSIC ERROR]:', e);
            let msgF = '❌ No pude descargar esta canción. YouTube bloqueó el acceso.';
            if (e.message.includes('Sign in')) msgF = '❌ YouTube bloqueó este link por *Restricción de Edad*.\n_Prueba con una versión que no sea el video oficial o busca por nombre._';
            
            return sock.sendMessage(chatId, { text: msgF }, { quoted: msg });
        }
    }


};
