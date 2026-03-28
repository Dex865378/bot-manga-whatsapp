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
        if (!query) return sock.sendMessage(chatId, { text: '🎵 *Uso:* !play <nombre de la canción o link de YouTube>' }, { quoted: msg });

        try {
            await sock.sendMessage(chatId, { react: { text: '🎵', key: msg.key } });

            // 1. Buscar en YouTube
            const search = await yts(query);
            const video = search.videos[0];
            if (!video) return sock.sendMessage(chatId, { text: '❌ No encontré resultados para esa búsqueda.' });

            // Mostrar el preview (Stunning Aesthetics)
            const infoTxt = `🎵 *REPRODUCIENDO:*
📌 *Título:* ${video.title}
⏳ *Duración:* ${video.timestamp}
📺 *Canal:* ${video.author.name}
🔗 *Link:* ${video.url}

_Descargando audio, espera un momento..._`;

            await sock.sendMessage(chatId, { 
                image: { url: video.thumbnail }, 
                caption: infoTxt 
            }, { quoted: msg });

            // 2. Definir rutas temporales
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const inputPath = path.join(tmpDir, `yt_${timestamp}.mp4`);
            const outputPath = path.join(tmpDir, `music_${timestamp}.mp3`);

            // 3. Descargar stream (Audio only para ser más rápido)
            // CONFIGURACIÓN DE COOKIES PARA BYPASS DE RESTRICCIÓN DE EDAD
            let options = {
                quality: 'highestaudio',
                filter: 'audioonly',
            };

            // Intentar usar cookies si existen en los Secrets de Hugging Face
            if (process.env.YT_COOKIES) {
                try {
                    const cookies = JSON.parse(process.env.YT_COOKIES);
                    options.agent = ytdl.createAgent(cookies);
                    console.log('✅ Utilizando cookies de YouTube para bypass.');
                } catch (e) {
                    console.error('❌ Error parseando YT_COOKIES:', e.message);
                }
            }

            const stream = ytdl(video.url, options);

            // Guardar stream temporalmente
            const fileStream = fs.createWriteStream(inputPath);
            stream.pipe(fileStream);

            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
                stream.on('error', reject);
            });

            // 4. Convertir a MP3 usando FFMPEG (Estabilidad Premium)
            await execFileAsync(FFMPEG_PATH, [
                '-i', inputPath,
                '-vn',
                '-ab', '128k',
                '-ar', '44100',
                '-y',
                outputPath
            ]);

            // 5. Enviar el audio
            await sock.sendMessage(chatId, { 
                audio: fs.readFileSync(outputPath), 
                mimetype: 'audio/mp4',
                fileName: `${video.title}.mp3`
            }, { quoted: msg });

            // 6. Limpieza
            try {
                fs.unlinkSync(inputPath);
                fs.unlinkSync(outputPath);
            } catch (e) { }

        } catch (e) {
            console.error('❌ [MUSIC ERROR]:', e);
            let errMsg = '❌ Ocurrió un error al descargar la música.';
            if (e.message.includes('403')) {
                errMsg = '❌ *Error 403:* YouTube bloqueó la descarga.\n💡 *Solución:* Añade tus *YouTube Cookies* en los Secrets del Bot para saltar el bloqueo.';
            } else if (e.message.includes('Sign in') || e.message.includes('age restricted')) {
                errMsg = '🔞 *RESTRICCIÓN DE EDAD:*\nYouTube requiere iniciar sesión para este video.\n\n🛠️ *¿Cómo solucionarlo?*\nSigue estos pasos para subir tus cookies a Hugging Face:\n1. Usa la extensión "Get cookies.txt" en tu PC.\n2. Exporta las cookies de YouTube en formato JSON.\n3. Añade un Secret en Hugging Face llamado *YT_COOKIES* con ese contenido.';
            }
            
            return sock.sendMessage(chatId, { text: errMsg }, { quoted: msg });
        }
    }

};
