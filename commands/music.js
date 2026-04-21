const axios = require('axios');
const yts = require('yt-search');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════
//  🎵 DIKY BOT — COMANDO DE MÚSICA (yt-search + yt-dlp)
//  Usa yt-search para buscar y yt-dlp para descargar
// ═══════════════════════════════════════════════════════════════

// Detectar plataforma para usar yt-dlp correcto
const YTDLP_PATH = process.platform === 'win32'
    ? path.join(__dirname, '..', 'yt-dlp.exe')
    : 'yt-dlp';

// Mapa para trackear descargas en progreso (evita duplicados)
const descargasActivas = new Map();

module.exports = {
    name: 'music',
    isMultiple: true,
    names: ['!play', '!musica', '!cancion', '!audio', '!mp3'],

    async execute(sock, chatId, msg, args) {
        const query = args.join(' ').trim();
        const userId = msg.key.participant || msg.key.remoteJid;

        if (!query) {
            return sock.sendMessage(chatId, {
                text: '🎵 *Uso:* !play <nombre de la canción>\n_Ejemplo: !play Traicionera Sebastian Yatra_'
            }, { quoted: msg });
        }

        // Verificar si ya hay una descarga activa para este usuario
        if (descargasActivas.has(userId)) {
            return sock.sendMessage(chatId, { 
                text: '⏳ Ya estás descargando una canción. Espera a que termine.' 
            }, { quoted: msg });
        }

        const tempFile = path.join(__dirname, '..', `temp_${Date.now()}.m4a`);
        descargasActivas.set(userId, tempFile);

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
            console.log('[MUSIC] Paso 1: Buscando con yt-search...');

            // 1. Buscar en YouTube (rápido, no bloquea)
            const search = await yts(query);
            const video = search.videos[0];

            if (!video) {
                descargasActivas.delete(userId);
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: '❌ No encontré la canción. Intenta con otro nombre.' }, { quoted: msg });
            }

            console.log(`[MUSIC] Encontrado: ${video.title} (${video.videoId})`);

            // 2. Límite de duración: 12 minutos
            if (video.seconds > 720) {
                descargasActivas.delete(userId);
                await sock.sendMessage(chatId, { react: { text: '⚠️', key: msg.key } });
                return sock.sendMessage(chatId, { text: '⚠️ La canción es demasiado larga (máx. 12 min).' }, { quoted: msg });
            }

            const videoId = video.videoId;
            const title = video.title;

            console.log('[MUSIC] Iniciando descarga en segundo plano...');
            
            // 3. Enviar mensaje inicial y liberar el comando
            const statusMsg = await sock.sendMessage(chatId, { 
                text: `🎧 *${title}*\n⏳ Descargando en segundo plano...\n_Esto puede tardar 30-60 segundos. El bot sigue funcionando._` 
            }, { quoted: msg });

            // 4. DESCARGA NO BLOQUEANTE con spawn
            const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const cookiesPath = path.join(__dirname, '..', 'cookies.txt');
            
            const ytdlpArgs = [
                ...(fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : []),
                '--js-runtimes', 'deno',
                '-f', 'bestaudio[ext=m4a]/bestaudio',
                '-o', tempFile,
                ytUrl
            ];

            console.log('[MUSIC] Spawn yt-dlp:', YTDLP_PATH, ytdlpArgs.join(' '));
            
            const ytdlpProcess = spawn(YTDLP_PATH, ytdlpArgs, {
                detached: false,
                stdio: 'pipe'
            });

            let stdoutData = '';
            let stderrData = '';

            ytdlpProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            ytdlpProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            // Manejar cuando termina la descarga
            ytdlpProcess.on('close', async (code) => {
                descargasActivas.delete(userId);
                
                if (code !== 0) {
                    console.error('[MUSIC] yt-dlp error:', stderrData);
                    await sock.sendMessage(chatId, { 
                        text: `❌ Error al descargar: ${stderrData.slice(0, 200)}` 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    return;
                }

                console.log('[MUSIC] yt-dlp completado, enviando audio...');

                try {
                    // Verificar archivo
                    if (!fs.existsSync(tempFile)) {
                        throw new Error('No se generó el archivo de audio');
                    }

                    const stats = fs.statSync(tempFile);
                    if (stats.size < 50000) {
                        throw new Error('Archivo de audio demasiado pequeño');
                    }

                    console.log('[MUSIC] Archivo generado:', stats.size, 'bytes');

                    // Leer y enviar
                    const buffer = fs.readFileSync(tempFile);
                    
                    await sock.sendMessage(chatId, {
                        audio: buffer,
                        mimetype: 'audio/mp4',
                        ptt: false,
                        fileName: `${title}.m4a`
                    }, { quoted: msg });

                    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                    console.log('[MUSIC] Audio enviado exitosamente');

                } catch (e) {
                    console.error('[MUSIC ERROR envío]:', e.message);
                    await sock.sendMessage(chatId, { 
                        text: `❌ Error enviando audio: ${e.message}` 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                } finally {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                }
            });

            ytdlpProcess.on('error', async (err) => {
                descargasActivas.delete(userId);
                console.error('[MUSIC] Spawn error:', err);
                await sock.sendMessage(chatId, { 
                    text: `❌ Error iniciando descarga: ${err.message}` 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            });

            // Retornar inmediatamente - el proceso sigue en background
            return;

        } catch (e) {
            descargasActivas.delete(userId);
            console.error('[MUSIC ERROR]:', e.message);
            console.error('[MUSIC ERROR STACK]:', e.stack);
            await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(chatId, { text: `❌ ${e.message || 'Error al descargar la música. Intenta más tarde.'}` }, { quoted: msg });
        }
    }
};
