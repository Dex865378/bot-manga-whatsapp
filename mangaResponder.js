/**
 * 📚 MANEJADOR DE SESIONES INTERACTIVAS DE MANGA
 * Permite la navegación paso a paso (1, 2, 3, etc.) sin escribir comandos largos.
 */
const handler = require('./commandHandler');

function normalizeInput(txt) {
    if (!txt) return '';
    const raw = txt.trim().toLowerCase();
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    if (raw === '1' || clean === '1' || clean === 'uno' || clean === 'opcion1' || clean.includes('capitulo')) return '1';
    if (raw === '2' || clean === '2' || clean === 'dos' || clean === 'opcion2' || clean === 'all' || clean.includes('todo') || clean.includes('descargar')) return '2';
    if (raw === '3' || clean === '3' || clean === 'tres' || clean === 'opcion3' || ['otro', 'otra', 'recomendar', 'siguiente', 'mas', 'cambiar', 'recomienda'].some(w => clean.includes(w))) return '3';
    if (raw === '0' || clean === '0' || clean === 'cero' || ['cancelar', 'salir', 'cancel', 'cerrar'].some(w => clean.includes(w))) return '0';
    return clean;
}

async function handleMangaSession(sock, msg, context) {
    const { chatId, sender, txt, botState, db, isCommand, isGroup, isAdmin, isGlobalAdmin, pushName, downloadMediaMessage, traducirConCache, FFMPEG_PATH, ADMIN_NUM, quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI } = context;

    if (!botState.mangaSessions) return false;

    // Normalizar JID para eliminar sufijos de dispositivo (:14@s.whatsapp.net)
    const senderClean = (sender || '').split('@')[0].split(':')[0];
    const sessionKey = `${chatId}_${senderClean}`;
    const session = botState.mangaSessions.get(sessionKey);
    if (!session) return false;

    // Limpieza periódica de sesiones expiradas (5 minutos)
    const TTL_MANGA_SESSION = 5 * 60 * 1000;
    if (Math.random() < 0.1) {
        const now = Date.now();
        for (const [key, s] of botState.mangaSessions.entries()) {
            if (now - s.ts > TTL_MANGA_SESSION) botState.mangaSessions.delete(key);
        }
    }

    // Expiración a los 5 minutos para esta sesión
    if (Date.now() - session.ts > TTL_MANGA_SESSION) {
        botState.mangaSessions.delete(sessionKey);
        return false;
    }

    const input = normalizeInput(txt);

    // Si el usuario escribe "0" o "cancelar" -> salir
    if (input === '0' || input === 'cancelar' || input === 'salir') {
        botState.mangaSessions.delete(sessionKey);
        await sock.sendMessage(chatId, { text: '❌ *Menú interactivo de manga cerrado.*' }, { quoted: msg });
        return true;
    }

    // Helper interno para ejecutar un comando como si el usuario lo hubiera escrito
    const runCmd = async (commandStr) => {
        const parts = commandStr.split(' ');
        const start = parts[0];
        const args = parts.slice(1);
        const extras = {
            start, cmd: start, txt: commandStr, args, sender, pushName, isGroup, isAdmin, isGlobalAdmin,
            botState, db, delay: (ms) => new Promise(r => setTimeout(r, ms)), FFMPEG_PATH, ADMIN_NUM,
            traducirConCache, convertirAWebp: null, downloadMediaMessage,
            quotedMsgId, quotedParticipant, msgType, chatWithLiquidAI,
            sockOriginal: sock
        };
        await handler.handleCommand(start, sock, chatId, msg, args, extras);
    };

    // ── PASO 1: Menú principal de recomendación ──
    if (session.step === 'MAIN_MENU') {
        if (input === '1') {
            session.step = 'LISTING_CHAPTERS';
            session.ts = Date.now();
            await runCmd(`!leer ${session.tempCode}`);
            await sock.sendMessage(chatId, {
                text: `🔢 *Pasos siguientes para "${session.titulo}":*\n\n` +
                      `• Responde con el *número de capítulo* para leerlo (ej: *1*, *5*)\n` +
                      `• Responde *2* o *all* para descargar todos los capítulos\n` +
                      `• Responde *3* para ver otra recomendación\n` +
                      `• Responde *0* para salir`
            });
            return true;
        }

        if (input === '2' || input === 'all') {
            session.ts = Date.now();
            await runCmd(`!leer ${session.tempCode} all`);
            return true;
        }

        if (input === '3') {
            botState.mangaSessions.delete(sessionKey);
            const cmdStr = session.genero ? `!recomanga ${session.genero}` : '!recomanga';
            await runCmd(cmdStr);
            return true;
        }
    }

    // ── PASO 2: Lista de capítulos ──
    if (session.step === 'LISTING_CHAPTERS') {
        if (input === '3') {
            botState.mangaSessions.delete(sessionKey);
            const cmdStr = session.genero ? `!recomanga ${session.genero}` : '!recomanga';
            await runCmd(cmdStr);
            return true;
        }

        if (input === '2' || input === 'all') {
            session.ts = Date.now();
            await runCmd(`!leer ${session.tempCode} all`);
            return true;
        }

        // Si mandó un número de capítulo (ej: 1, 5, 12, 1.5)
        if (/^\d+(\.\d+)?$/.test(input)) {
            session.ts = Date.now();
            await runCmd(`!leer ${session.tempCode} ${input}`);
            await sock.sendMessage(chatId, {
                text: `💡 *Tip interactivo:*\n` +
                      `• Responde con otro *número de capítulo* (ej: *${Number(input) + 1}*)\n` +
                      `• Responde *all* para descargar todo\n` +
                      `• Responde *3* para otro manga\n` +
                      `• Responde *0* para salir`
            });
            return true;
        }
    }

    return false;
}

module.exports = { handleMangaSession };
