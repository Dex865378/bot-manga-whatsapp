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
            const outputPath = path.join(tmpDir, `music_${timestamp}.mp3`);

            // 3. Descargar y Convertir usando yt-dlp-exec (Máxima efectividad anti-bloqueos)
            const youtubedl = require('yt-dlp-exec');
            
            const dlOptions = {
                extractAudio: true,
                audioFormat: 'mp3',
                output: outputPath,
                noWarnings: true,
                addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36']
            };

            // Inyectar cookies si existen en HF Secrets (Formato String para yt-dlp)
            if (process.env.YT_COOKIES) {
                // Si el usuario guardó cookies tipo texto en YT_COOKIES
                const cookiePath = path.join(tmpDir, 'cookies.txt');
                fs.writeFileSync(cookiePath, process.env.YT_COOKIES);
                dlOptions.cookies = cookiePath;
            }

            await youtubedl(video.url, dlOptions);

            // 4. Enviar audio DIRECTO para reproducir en WhatsApp
            if (fs.existsSync(outputPath)) {
                await sock.sendMessage(chatId, { 
                    audio: fs.readFileSync(outputPath), 
                    mimetype: 'audio/mpeg', 
                    ptt: false, // Asegurar que sea audio reproducible
                    fileName: `${video.title}.mp3`
                }, { quoted: msg });
                
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                fs.unlinkSync(outputPath); // Limpiar
            } else {
                throw new Error("El archivo no se generó.");
            }

        } catch (e) {
            console.error('❌ [MUSIC ERROR]:', e);
            let msgF = '❌ No pude descargar esta canción porque YouTube bloqueó el acceso (Error de IP en Hugging Face o Restricción de Edad).';
            return sock.sendMessage(chatId, { text: msgF }, { quoted: msg });
        }
    }


};
