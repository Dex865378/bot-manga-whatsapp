/**
 * 🖼️ PORTADA DEL GRUPO — imagen del !menu, bienvenida y despedida (solo admins).
 *
 * Uso (en el grupo):
 *   !setportada   (con foto adjunta o respondiendo a una foto)
 *   !setsticker   (respondiendo a un sticker: nuevo sticker de bienvenida)
 *
 * Cada grupo tiene SU propia portada: lo que se ponga aquí solo se ve en
 * este grupo, los demás grupos no se enteran. Si el grupo aún no pone una,
 * se usa la imagen global por defecto (la que pone el dueño por privado).
 *
 * La imagen se comprime a JPEG (máx 1024px, calidad alta) para que pese poco
 * y se guarde/envíe rápido, sin pérdida visible. Se guarda en Turso y se
 * cachea en RAM: el envío después es instantáneo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Compresor: re-encode a JPEG liviano. Si falla, se usa el original.
async function comprimirPortada(buffer, ffmpegPath) {
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpIn = path.join(os.tmpdir(), `port_in_${uid}`);
    const tmpOut = path.join(os.tmpdir(), `port_out_${uid}.jpg`);
    fs.writeFileSync(tmpIn, buffer);
    try {
        await execFileAsync(ffmpegPath || 'ffmpeg', [
            '-i', tmpIn,
            '-vf', "scale='min(1024,iw)':-2",
            '-q:v', '3', '-map_metadata', '-1', '-y', tmpOut
        ], { timeout: 20000, windowsHide: true });
        const out = fs.readFileSync(tmpOut);
        if (out && out.length > 0 && out.length <= buffer.length) return out;
        return buffer;
    } catch (e) {
        return buffer;
    } finally {
        try { fs.unlinkSync(tmpIn); } catch (_) { }
        try { fs.unlinkSync(tmpOut); } catch (_) { }
    }
}

module.exports = {
    name: 'portadas',
    isMultiple: true,
    names: ['!setportada', '!setsticker'],
    category: 'Admin',
    async execute(sock, chatId, msg, args, extras) {
        const { start, isGroup, isAdmin, isGlobalAdmin, db, FFMPEG_PATH, downloadMediaMessage } = extras;
        if (!isGroup && !isGlobalAdmin) {
            return sock.sendMessage(chatId, { text: 'Este comando solo funciona en grupos.' }, { quoted: msg });
        }
        if (!isAdmin && !isGlobalAdmin) {
            return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
        }

        // !setsticker (respondiendo a un sticker): guarda ese sticker como
        // sticker de bienvenida. Se guarda TAL CUAL en webp (sin comprimir:
        // recomprimir mataría la animación). Por grupo o global del dueño.
        if (start === '!setsticker') {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const stk = msg.message?.stickerMessage || quoted?.stickerMessage;
            if (!stk) {
                return sock.sendMessage(chatId, { text: '❌ Responde a un sticker con *!setsticker*.' }, { quoted: msg });
            }
            try {
                const buffer = await downloadMediaMessage(quoted?.stickerMessage ? { message: quoted } : msg, 'buffer', {});
                if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
                    return sock.sendMessage(chatId, { text: '❌ No pude descargar ese sticker. Intenta con otro.' }, { quoted: msg });
                }
                const miChat = isGroup ? chatId : null;
                const r = await db.setPortada('sticker_bienvenida', buffer, miChat);
                if (!r.ok) {
                    return sock.sendMessage(chatId, { text: `❌ No se pudo guardar: ${r.error || 'error'}` }, { quoted: msg });
                }
                await sock.sendMessage(chatId, { sticker: buffer });
                return sock.sendMessage(chatId, {
                    text: isGroup
                        ? `✅ Sticker de bienvenida de ESTE GRUPO actualizado.\n💡 Los demás grupos conservan el suyo.`
                        : `✅ Sticker de bienvenida global actualizado.\n💡 Se usa en los grupos que no tienen uno propio.`
                }, { quoted: msg });
            } catch (e) {
                console.error('[SETSTICKER] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ No pude descargar ese sticker. Intenta con otro.' }, { quoted: msg });
            }
        }

        // Foto adjunta o respondida (sin subcomandos: una sola portada para todo)
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const media = msg.message?.imageMessage || quoted?.imageMessage;
        if (!media) {
            return sock.sendMessage(chatId, { text: '❌ Adjunta una foto o responde a una foto con *!setportada*.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { text: '⏳ Comprimiendo y guardando portada...' }, { quoted: msg });
            const buffer = await downloadMediaMessage(quoted?.imageMessage ? { message: quoted } : msg, 'buffer', {});
            const comprimida = await comprimirPortada(buffer, FFMPEG_PATH);
            const antes = (buffer.length / 1024).toFixed(0);
            const despues = (comprimida.length / 1024).toFixed(0);
            // Portada propia de ESTE grupo (menú + bienvenida + despedida).
            // En grupo se guarda por chat_id: no afecta a los demás grupos.
            // Por privado (dueño) se guarda como imagen global por defecto.
            const miChat = isGroup ? chatId : null;
            for (const clave of ['menu', 'bienvenida', 'despedida']) {
                const r = await db.setPortada(clave, comprimida, miChat);
                if (!r.ok) {
                    return sock.sendMessage(chatId, { text: `❌ No se pudo guardar: ${r.error || 'error'}` }, { quoted: msg });
                }
            }
            return sock.sendMessage(chatId, {
                image: comprimida,
                caption: isGroup
                    ? `✅ Portada de ESTE GRUPO actualizada (menú + bienvenida + despedida).\n📦 ${antes}KB → ${despues}KB (comprimida sin pérdida visible).\n💡 Los demás grupos conservan la suya.`
                    : `✅ Imagen global por defecto actualizada (menú + bienvenida + despedida).\n📦 ${antes}KB → ${despues}KB (comprimida sin pérdida visible).\n💡 Se usa solo en grupos que aún no ponen su propia portada.`
            }, { quoted: msg });
        } catch (e) {
            console.error('[SETPORTADA] Error:', e.message);
            return sock.sendMessage(chatId, { text: '❌ No pude descargar esa imagen. Intenta con otra foto.' }, { quoted: msg });
        }
    }
};
