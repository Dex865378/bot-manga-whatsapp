/**
 * 🖼️ PORTADAS — imagen de !menu / bienvenida / despedida (solo admins).
 *
 * Uso:
 *   !setportada menu|bienvenida|despedida   (con foto adjunta o respondiendo a una foto)
 *   !setportada ver                          (muestra las 3 actuales)
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
    names: ['!setportada'],
    category: 'Admin',
    async execute(sock, chatId, msg, args, extras) {
        const { isGroup, isAdmin, isGlobalAdmin, db, FFMPEG_PATH, downloadMediaMessage } = extras;
        if (!isGroup && !isGlobalAdmin) {
            return sock.sendMessage(chatId, { text: 'Este comando solo funciona en grupos.' }, { quoted: msg });
        }
        if (!isAdmin && !isGlobalAdmin) {
            return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
        }

        const sub = (args[0] || '').toLowerCase();

        // !setportada ver — muestra las 3 portadas actuales
        if (sub === 'ver') {
            for (const clave of ['menu', 'bienvenida', 'despedida']) {
                const img = await db.getPortada(clave).catch(() => null);
                if (img) {
                    await sock.sendMessage(chatId, { image: img, caption: `🖼️ Portada actual: *${clave}*` }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: `🖼️ Portada *${clave}*: _(no configurada, se usa la imagen por defecto)_` }, { quoted: msg });
                }
            }
            return;
        }

        if (!['menu', 'bienvenida', 'despedida'].includes(sub)) {
            return sock.sendMessage(chatId, {
                text: '🖼️ *Uso:*\n• *!setportada menu* + foto\n• *!setportada bienvenida* + foto\n• *!setportada despedida* + foto\n• *!setportada ver*\n\nManda el comando con la foto adjunta o respondiendo a una foto.'
            }, { quoted: msg });
        }

        // Foto adjunta o respondida
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const media = msg.message?.imageMessage || quoted?.imageMessage;
        if (!media) {
            return sock.sendMessage(chatId, { text: `❌ Adjunta una foto o responde a una foto con *!setportada ${sub}*.` }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { text: '⏳ Comprimiendo y guardando portada...' }, { quoted: msg });
            const buffer = await downloadMediaMessage(quoted?.imageMessage ? { message: quoted } : msg, 'buffer', {});
            const comprimida = await comprimirPortada(buffer, FFMPEG_PATH);
            const antes = (buffer.length / 1024).toFixed(0);
            const despues = (comprimida.length / 1024).toFixed(0);
            const r = await db.setPortada(sub, comprimida);
            if (!r.ok) {
                return sock.sendMessage(chatId, { text: `❌ No se pudo guardar: ${r.error || 'error'}` }, { quoted: msg });
            }
            return sock.sendMessage(chatId, {
                image: comprimida,
                caption: `✅ Portada de *${sub}* actualizada.\n📦 ${antes}KB → ${despues}KB (comprimida sin pérdida visible).`
            }, { quoted: msg });
        } catch (e) {
            console.error('[SETPORTADA] Error:', e.message);
            return sock.sendMessage(chatId, { text: '❌ No pude descargar esa imagen. Intenta con otra foto.' }, { quoted: msg });
        }
    }
};
