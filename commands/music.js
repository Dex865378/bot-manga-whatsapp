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
            await sock.sendMessage(chatId, { text: `🔍 *Buscando:* _"${query}"_...` });

            // 1. Buscar en YouTube
            const search = await yts(query);
            const video = search.videos[0];
            if (!video) return sock.sendMessage(chatId, { text: '❌ No encontré resultados para esa búsqueda.' });

            const infoStr = `🎵 **DESCARGANDO MÚSICA** 🎵\n━━━━━━━━━━━━━━\n📌 **Título:** ${video.title}\n👤 **Canal:** ${video.author.name}\n⏱️ **Duración:** ${video.timestamp}\n👁️ **Vistas:** ${video.views.toLocaleString()}\n━━━━━━━━━━━━━━\n🚀 _Procesando audio en MP3..._`;

            await sock.sendMessage(chatId, { 
                image: { url: video.thumbnail }, 
                caption: infoStr 
            }, { quoted: msg });

            // 2. Definir rutas temporales
            const tmpDir = os.tmpdir();
            const timestamp = Date.now();
            const inputPath = path.join(tmpDir, `yt_${timestamp}.mp4`);
            const outputPath = path.join(tmpDir, `music_${timestamp}.mp3`);

            // 3. Descargar stream (Audio only para ser más rápido)
            // @distube/ytdl-core es más resistente a los bloqueos 403
            const stream = ytdl(video.url, {
                quality: 'highestaudio',
                filter: 'audioonly',
            });

            // Guardar stream temporalmente
            const fileStream = fs.createWriteStream(inputPath);
            stream.pipe(fileStream);

            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
                stream.on('error', reject);
            });

            // 4. Convertir a MP3 usando el FFMPEG que instalamos en el sistema
            // Usamos 128k para que el archivo sea ligero y se envíe rápido
            await execFileAsync(FFMPEG_PATH, [
                '-i', inputPath,
                '-vn',
                '-ab', '128k',
                '-ar', '44100',
                '-y',
                outputPath
            ]);

            // 5. Enviar el audio (Formato música, no PTT)
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
            if (e.message.includes('403')) errMsg = '❌ Error 403: YouTube bloqueó la petición. Intentando regenerar sesión...';
            if (e.message.includes('Sign in')) errMsg = '❌ Este video tiene restricción de edad y no puedo descargarlo.';
            
            return sock.sendMessage(chatId, { text: errMsg }, { quoted: msg });
        }
    }
};
