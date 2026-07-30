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

        // Usamos %(ext)s para que yt-dlp escriba la extensión real del formato
        // descargado (m4a, webm, etc.) en vez de forzar .m4a y arriesgar un
        // contenedor incorrecto cuando el fallback trae otro formato de audio.
        const tempFileBase = path.join(__dirname, '..', `temp_${Date.now()}`);
        const tempFileTemplate = `${tempFileBase}.%(ext)s`;
        descargasActivas.set(userId, tempFileBase);

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
            const cookiesPath = path.join(process.cwd(), 'cookies.txt');
            
            const ytdlpArgs = [
                '--no-warnings',
                // 🔑 Lista de clientes en orden de preferencia: si "ios" no expone
                // formatos válidos para un video puntual (pasa en algunos casos),
                // yt-dlp prueba automáticamente con "android" y luego "web" antes
                // de rendirse. Mantiene ios primero para evitar el check de bot.
                '--extractor-args', 'youtube:player_client=ios,android,web',
                // Cookies para autenticación (si existen)
                ...(fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : []),
                // Reintentos reducidos: en RAM limitada, cada reintento mantiene
                // el proceso vivo consumiendo memoria; mejor fallar rápido y reintentar el comando
                '--retries', '3',
                '--fragment-retries', '3',
                // 1 solo fragmento a la vez: evita picos de RAM por buffers paralelos
                '--concurrent-fragments', '1',
                // No verificar certificados SSL (evita errores en algunos entornos)
                '--no-check-certificates',
                // Audio puro, con preferencia por formatos livianos (m4a/webm <=128kbps)
                // pero terminando SIEMPRE en "bestaudio" sin filtros para no fallar
                // si el cliente iOS no expone esas variantes exactas para este video
                '-f', 'bestaudio[abr<=128]/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
                // Sin thumbnails ni metadata extra (más rápido)
                '--no-playlist',
                '--no-continue',
                // Sin archivos .part intermedios: escribe directo, menos I/O y limpieza
                '--no-part',
                '-o', tempFileTemplate,
                ytUrl
            ];

            console.log('[MUSIC] Spawn yt-dlp:', YTDLP_PATH, ytdlpArgs.join(' '));
            
            const ytdlpProcess = spawn(YTDLP_PATH, ytdlpArgs, {
                detached: false,
                stdio: 'pipe'
            });

            let stdoutData = '';
            let stderrData = '';

            // Timeout de seguridad: si yt-dlp se cuelga (red lenta, bloqueo de YouTube, etc.)
            // lo matamos a los 90s para no dejar procesos zombis consumiendo CPU/RAM en Render.
            let timedOut = false;
            const YTDLP_TIMEOUT_MS = 90000;
            const killTimer = setTimeout(() => {
                timedOut = true;
                console.warn('[MUSIC] yt-dlp excedió el tiempo límite, matando proceso...');
                try { ytdlpProcess.kill('SIGKILL'); } catch (e) { }
            }, YTDLP_TIMEOUT_MS);

            ytdlpProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            ytdlpProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            // Manejar cuando termina la descarga
            ytdlpProcess.on('close', async (code) => {
                clearTimeout(killTimer);
                descargasActivas.delete(userId);

                // Buscar el archivo real generado por yt-dlp (la extensión final
                // la decide el formato descargado: m4a, webm, opus, etc.), o cualquier
                // resto parcial si el proceso fue matado por timeout.
                const dir = path.dirname(tempFileBase);
                const baseName = path.basename(tempFileBase);
                let archivoFinal = null;
                try {
                    const candidatos = fs.readdirSync(dir).filter(f => f.startsWith(baseName));
                    if (candidatos.length > 0) {
                        archivoFinal = path.join(dir, candidatos[0]);
                    }
                } catch (e) { }

                if (timedOut) {
                    await sock.sendMessage(chatId, {
                        text: '⏳ La descarga tardó demasiado y fue cancelada. Intenta de nuevo o con otra canción.'
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    if (archivoFinal && fs.existsSync(archivoFinal)) { try { fs.unlinkSync(archivoFinal); } catch (e) { } }
                    return;
                }

                if (code !== 0) {
                    console.error('[MUSIC] yt-dlp error:', stderrData);
                    await sock.sendMessage(chatId, { 
                        text: `❌ Error al descargar: ${stderrData.slice(0, 500)}` 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    if (archivoFinal && fs.existsSync(archivoFinal)) fs.unlinkSync(archivoFinal);
                    return;
                }

                console.log('[MUSIC] yt-dlp completado, enviando audio...');

                try {
                    // Verificar archivo
                    if (!archivoFinal || !fs.existsSync(archivoFinal)) {
                        throw new Error('No se generó el archivo de audio');
                    }

                    const stats = fs.statSync(archivoFinal);
                    if (stats.size < 50000) {
                        throw new Error('Archivo de audio demasiado pequeño');
                    }

                    console.log('[MUSIC] Archivo generado:', archivoFinal, stats.size, 'bytes');

                    // Detectar extensión real para mimetype y nombre correctos
                    const extReal = path.extname(archivoFinal).replace('.', '') || 'm4a';
                    const mimePorExt = { m4a: 'audio/mp4', webm: 'audio/webm', opus: 'audio/ogg', mp3: 'audio/mpeg' };
                    const mimetype = mimePorExt[extReal] || 'audio/mp4';

                    // Leer y enviar
                    const buffer = fs.readFileSync(archivoFinal);
                    
                    await sock.sendMessage(chatId, {
                        audio: buffer,
                        mimetype,
                        ptt: false,
                        fileName: `${title}.${extReal}`
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
                    if (archivoFinal && fs.existsSync(archivoFinal)) {
                        fs.unlinkSync(archivoFinal);
                    }
                }
            });

            ytdlpProcess.on('error', async (err) => {
                clearTimeout(killTimer);
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
