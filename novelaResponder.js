/**
 * 📖 MANEJADOR DE SESIONES INTERACTIVAS DE NOVELA (!reconovela)
 * Permite la navegación paso a paso (1, 2, 3, etc.) tras una recomendación,
 * igual que mangaResponder.js pero apuntando a !novela para la descarga real.
 */
const handler = require('./commandHandler');

function normalizeInput(txt) {
    if (!txt) return '';
    const raw = txt.trim().toLowerCase();
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    // Comparaciones EXACTAS, no .includes() sobre frases libres - mismo motivo
    // que en mangaResponder.js: evitar que un mensaje casual dispare el menu.
    const exact1 = ['1', 'uno', 'opcion1', 'descargar', 'leer'];
    const exact2 = ['2', 'dos', 'opcion2', 'otro', 'otra', 'recomendar', 'siguiente', 'mas', 'cambiar', 'recomienda'];
    const exact0 = ['0', 'cero', 'cancelar', 'salir', 'cancel', 'cerrar'];

    if (exact1.includes(clean)) return '1';
    if (exact2.includes(clean)) return '2';
    if (exact0.includes(clean)) return '0';
    return clean;
}

function findNovelaSession(botState, chatId, sender, pushName, msg) {
    if (!botState.novelaSessions) return null;
    const TTL = 5 * 60 * 1000;
    const now = Date.now();
    const senderClean = (sender || '').split('@')[0].split(':')[0];

    const directKey = `${chatId}_${senderClean}`;
    const directSession = botState.novelaSessions.get(directKey);
    if (directSession && (now - directSession.ts <= TTL)) {
        return { key: directKey, session: directSession };
    }

    const chatSessions = [];
    for (const [key, session] of botState.novelaSessions.entries()) {
        if (key.startsWith(`${chatId}_`)) {
            if (now - session.ts > TTL) {
                botState.novelaSessions.delete(key);
            } else {
                chatSessions.push({ key, session });
            }
        }
    }

    if (chatSessions.length === 0) return null;

    if (pushName && pushName.length > 1) {
        const found = chatSessions.find(s => s.session.pushName && s.session.pushName.toLowerCase() === pushName.toLowerCase());
        if (found) return found;
    }

    const isQuotedBot = msg?.message?.extendedTextMessage?.contextInfo?.participant;
    if (isQuotedBot && chatSessions.length > 0) {
        chatSessions.sort((a, b) => b.session.ts - a.session.ts);
        return chatSessions[0];
    }

    if (chatSessions.length === 1) {
        return chatSessions[0];
    }

    // 🔒 Multiples sesiones activas sin coincidencia explicita: no adivinar
    return null;
}

async function handleNovelaSession(sock, msg, context) {
    const { chatId, sender, txt, botState, db, isGroup, isAdmin, isGlobalAdmin, pushName, quotedMsgId, quotedParticipant, msgType } = context;

    if (!botState.novelaSessions) return false;

    const matched = findNovelaSession(botState, chatId, sender, pushName, msg);
    if (!matched) return false;

    const { key: sessionKey, session } = matched;
    const input = normalizeInput(txt);

    if (input === '0') {
        botState.novelaSessions.delete(sessionKey);
        await sock.sendMessage(chatId, { text: '❌ *Menú de novela cerrado.*' }, { quoted: msg });
        return true;
    }

    const runCmd = async (commandStr) => {
        const parts = commandStr.split(' ');
        const start = parts[0];
        const args = parts.slice(1);
        const extras = {
            start, cmd: start, txt: commandStr, args, sender, pushName, isGroup, isAdmin, isGlobalAdmin,
            botState, db, delay: (ms) => new Promise(r => setTimeout(r, ms)),
            quotedMsgId, quotedParticipant, msgType,
            sockOriginal: sock
        };
        await handler.handleCommand(start, sock, chatId, msg, args, extras);
    };

    if (session.step === 'MAIN_MENU') {
        // Opcion 1: descargar (rango por defecto 1-15, definido dentro de !novela)
        if (input === '1') {
            botState.novelaSessions.delete(sessionKey);
            await runCmd(`!novela ${session.titulo}`);
            return true;
        }

        // Opcion 2: otra recomendacion
        if (input === '2') {
            botState.novelaSessions.delete(sessionKey);
            const cmdStr = session.generoEs ? `!reconovela ${session.generoEs}` : '!reconovela';
            await runCmd(cmdStr);
            return true;
        }
    }

    return false;
}

module.exports = { handleNovelaSession };
