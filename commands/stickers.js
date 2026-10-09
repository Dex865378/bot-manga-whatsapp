/**
 * 🏦 BANCO DE STICKERS (!gstick / !stick)
 * Guarda tus stickers favoritos con nombre y recupéralos cuando quieras.
 * Responde a un sticker con !gstick <nombre> para guardarlo.
 */
module.exports = {
    name: 'stickers',
    isMultiple: true,
    names: ['!gstick', '!stick', '!misstickers', '!borrastick'],
    async execute(sock, chatId, msg, args, { start, sender, downloadMediaMessage, db }) {

        // !gstick <nombre> (respondiendo a un sticker)
        if (start === '!gstick') {
            const nombre = (args[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
            if (!nombre) return sock.sendMessage(chatId, { text: '🏦 Uso: responde a un *sticker* con *!gstick <nombre>*\nEj: *!gstick risa*' }, { quoted: msg });
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const stickerMsg = msg.message?.stickerMessage || quoted?.stickerMessage;
            if (!stickerMsg) return sock.sendMessage(chatId, { text: '🏦 Responde a un *sticker* con *!gstick <nombre>* para guardarlo.' }, { quoted: msg });
            try {
                const buffer = await downloadMediaMessage(
                    quoted?.stickerMessage ? { message: quoted } : msg,
                    'buffer', {}
                );
                const r = await db.guardarSticker(sender, nombre, buffer);
                if (!r.ok) return sock.sendMessage(chatId, { text: `❌ No se pudo guardar: ${r.error}` }, { quoted: msg });
                return sock.sendMessage(chatId, { text: `🏦 Sticker guardado como *${nombre}*.\nÚsalo con *!stick ${nombre}*` }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ Error al descargar el sticker.' }, { quoted: msg });
            }
        }

        // !stick <nombre>
        if (start === '!stick') {
            const nombre = (args[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
            if (!nombre) return sock.sendMessage(chatId, { text: '🏦 Uso: *!stick <nombre>*\nMira tu banco con *!misstickers*' }, { quoted: msg });
            const buf = await db.obtenerSticker(sender, nombre);
            if (!buf) return sock.sendMessage(chatId, { text: `🏦 No tienes ningún sticker llamado *${nombre}*.\nMira tu banco con *!misstickers*` }, { quoted: msg });
            return sock.sendMessage(chatId, { sticker: buf }, { quoted: msg });
        }

        // !misstickers
        if (start === '!misstickers') {
            const lista = await db.misStickers(sender);
            if (!lista.length) return sock.sendMessage(chatId, { text: '🏦 Tu banco está vacío.\nGuarda uno respondiendo a un sticker con *!gstick <nombre>*' }, { quoted: msg });
            return sock.sendMessage(chatId, { text: `🏦 *TU BANCO (${lista.length}/30)*\n\n${lista.map(n => `• *${n}* → !stick ${n}`).join('\n')}` }, { quoted: msg });
        }

        // !borrastick <nombre>
        if (start === '!borrastick') {
            const nombre = (args[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
            if (!nombre) return sock.sendMessage(chatId, { text: '🏦 Uso: *!borrastick <nombre>*' }, { quoted: msg });
            const ok = await db.borrarSticker(sender, nombre);
            return sock.sendMessage(chatId, { text: ok ? `🗑️ Sticker *${nombre}* borrado.` : `🏦 No tienes ningún sticker llamado *${nombre}*.` }, { quoted: msg });
        }
    }
};
