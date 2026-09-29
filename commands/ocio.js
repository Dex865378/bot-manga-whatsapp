/**
 * 🎲 MÓDULO OCIO Y GRUPO — comandos livianos (texto + 1 imagen chica como
 * máximo). Sin descargas pesadas para no afectar los 512MB de Render.
 *
 *   !emojimix 😂❤️  → sticker mezclando 2 emojis (Emoji Kitchen, gratis)
 *   !ttt @user      → tres en raya contra otro miembro (!ttt si / !ttt 5)
 *   !warn @user     → advertencia de admin (3 = expulsión)
 *   !unwarn @user   → quitar advertencias
 *   !warns [@user]  → ver advertencias
 *   !afk [motivo]   → marcarse ausente (se quita al volver a escribir)
 *   !encuesta p, o1, o2 → encuesta nativa de WhatsApp
 *   !topactivos     → ranking de los que más hablan en el grupo
 *   !recordar 10m <texto> → aviso futuro (s/m/h/d, máx 10 por usuario)
 *   !recordatorios  → ver/borrar los propios (!recordatorios borrar <n>)
 */
const axios = require('axios');

const NUMEMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const TTT_GANAR = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function pintarTTT(t) {
    let r = '';
    for (let i = 0; i < 9; i++) {
        r += t[i] === 'X' ? '❌' : t[i] === 'O' ? '⭕' : NUMEMOJI[i];
        r += (i % 3 === 2) ? '\n' : ' ';
    }
    return r;
}

function ganadorTTT(t) {
    for (const [a, b, c] of TTT_GANAR) {
        if (t[a] && t[a] === t[b] && t[a] === t[c]) return t[a];
    }
    return t.every(x => x) ? 'E' : null; // E = empate
}

// Extrae hasta 2 emojis del texto (por codepoint, sin VS16)
function extraerEmojis(texto) {
    const fuera = [];
    for (const ch of Array.from(texto || '')) {
        if (ch === '️' || ch.trim() === '') continue;
        fuera.push(ch);
        if (fuera.length === 2) break;
    }
    return fuera;
}
const cpHex = (ch) => ch.codePointAt(0).toString(16);

function parseDuracion(s) {
    const m = /^(\d+)(s|m|h|d)$/.exec((s || '').toLowerCase());
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    if (n <= 0 || n > 720) return 0;
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
    return n * mult;
}

function haceCuanto(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `hace ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
}

module.exports = {
    name: 'ocio',
    isMultiple: true,
    names: ['!emojimix', '!ttt', '!warn', '!unwarn', '!warns', '!afk', '!encuesta', '!topactivos', '!recordar', '!recordatorios'],
    category: 'Ocio',
    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, pushName, isGroup, isAdmin, db, botState, convertirAWebp, delay } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
            || msg.message?.imageMessage?.contextInfo?.mentionedJid || [];

        // ==========================================
        //  !emojimix 😂❤️ — sticker de 2 emojis mezclados
        // ==========================================
        if (start === '!emojimix') {
            const emojis = extraerEmojis(args.join(' '));
            if (emojis.length < 2) {
                return sock.sendMessage(chatId, { text: '😜 Uso: *!emojimix* <emoji1><emoji2>\nEjemplo: *!emojimix* 😂❤️' }, { quoted: msg });
            }
            const a = cpHex(emojis[0]), b = cpHex(emojis[1]);
            await sock.sendMessage(chatId, { text: '⏳ Cocinando tu emoji...' }, { quoted: msg });
            // La cocina es direccional: probar ambos órdenes
            const urls = [
                `https://emojik.vercel.app/s/${a}_${b}?size=256`,
                `https://emojik.vercel.app/s/${b}_${a}?size=256`
            ];
            let img = null;
            for (const url of urls) {
                try {
                    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000, maxContentLength: 3 * 1024 * 1024, maxBodyLength: 3 * 1024 * 1024 });
                    if (res.data && res.data.length > 1000) { img = Buffer.from(res.data); break; }
                } catch (_) {}
            }
            if (!img) {
                return sock.sendMessage(chatId, { text: `❌ Esa combinación no existe en la cocina. Prueba con otros emojis.\n💡 Tip: *!emojimix* 😎🔥` }, { quoted: msg });
            }
            try {
                const webp = convertirAWebp ? await convertirAWebp(img) : null;
                if (webp) return sock.sendMessage(chatId, { sticker: webp }, { quoted: msg });
                return sock.sendMessage(chatId, { image: img, caption: `${emojis[0]}+${emojis[1]}` }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ No pude armar el sticker. Intenta de nuevo.' }, { quoted: msg });
            }
        }

        // ==========================================
        //  !ttt — tres en raya contra otro miembro
        // ==========================================
        if (start === '!ttt') {
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });
            const sub = (args[0] || '').toLowerCase();
            const juego = botState.juegos[chatId];

            // Retar: !ttt @usuario
            if (mencionados.length > 0 && !['si', 'no'].includes(sub)) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '❌ No puedes retarte a ti mismo.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'ttt', fase: 'reto', jugadorX: sender, jugadorO: rival, turno: 'X', tablero: Array(9).fill(''), _ts: Date.now() };
                return sock.sendMessage(chatId, {
                    text: `⭕❌ *¡RETO DE TRES EN RAYA!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n${nom(rival)} escribe *!ttt si* para aceptar o *!ttt no* para rechazar.`,
                    mentions: [sender, rival]
                });
            }

            if (!juego || juego.tipo !== 'ttt') {
                return sock.sendMessage(chatId, { text: '❌ No hay partida activa. Reta con *!ttt @usuario*.' }, { quoted: msg });
            }
            const soyX = sender === juego.jugadorX, soyO = sender === juego.jugadorO;
            if (!soyX && !soyO) return sock.sendMessage(chatId, { text: '👀 Esa partida es de otros dos. Reta con *!ttt @usuario*.' }, { quoted: msg });

            // Responder al reto
            if (juego.fase === 'reto') {
                if (sub === 'no' && soyO) {
                    delete botState.juegos[chatId];
                    return sock.sendMessage(chatId, { text: `😅 ${nom(sender)} rechazó el reto.`, mentions: [sender] });
                }
                if (sub === 'si' && soyO) {
                    juego.fase = 'juego';
                    juego._ts = Date.now();
                    return sock.sendMessage(chatId, {
                        text: `⭕❌ *¡QUE EMPIECE EL JUEGO!*\n━━━━━━━━━━━━━━\n❌ ${nom(juego.jugadorX)}  vs  ⭕ ${nom(juego.jugadorO)}\n\n${pintarTTT(juego.tablero)}\n👉 Turno de ${nom(juego.jugadorX)}: escribe *!ttt <1-9>*`,
                        mentions: [juego.jugadorX, juego.jugadorO]
                    });
                }
                return sock.sendMessage(chatId, { text: `⏳ Esperando a ${nom(juego.jugadorO)}: *!ttt si* o *!ttt no*.`, mentions: [juego.jugadorO] });
            }

            // Jugar: !ttt <1-9>
            const pos = parseInt(sub, 10);
            if (!pos || pos < 1 || pos > 9) {
                return sock.sendMessage(chatId, { text: `🎯 Tu turno: *!ttt <1-9>*\n\n${pintarTTT(juego.tablero)}` }, { quoted: msg });
            }
            const marca = soyX ? 'X' : 'O';
            const turnoMarca = juego.turno;
            if ((turnoMarca === 'X') !== soyX) {
                return sock.sendMessage(chatId, { text: '⏳ No es tu turno.' }, { quoted: msg });
            }
            if (juego.tablero[pos - 1]) {
                return sock.sendMessage(chatId, { text: '🚫 Casilla ocupada. Elige otra.' }, { quoted: msg });
            }
            juego.tablero[pos - 1] = marca;
            juego._ts = Date.now();
            const g = ganadorTTT(juego.tablero);
            if (g === 'X' || g === 'O') {
                const ganador = g === 'X' ? juego.jugadorX : juego.jugadorO;
                delete botState.juegos[chatId];
                const subio = await db.sumarXP(ganador, 20).catch(() => false);
                const pagado = await db.premiarConLimite(ganador, 50, 0).catch(() => true);
                return sock.sendMessage(chatId, {
                    text: `🏆 *¡${nom(ganador)} GANA!*\n━━━━━━━━━━━━━━\n${pintarTTT(juego.tablero)}\n💰 +50 diky | ✨ +20 XP${subio ? '\n🆙 ¡SUBIÓ DE NIVEL!' : ''}${pagado ? '' : db.NOTA_ANTIFARMA}`,
                    mentions: [ganador]
                });
            }
            if (g === 'E') {
                delete botState.juegos[chatId];
                return sock.sendMessage(chatId, { text: `🤝 *¡EMPATE!*\n━━━━━━━━━━━━━━\n${pintarTTT(juego.tablero)}\nBuena partida, vuelvan a retarse con *!ttt @usuario*.` });
            }
            juego.turno = juego.turno === 'X' ? 'O' : 'X';
            const toca = juego.turno === 'X' ? juego.jugadorX : juego.jugadorO;
            return sock.sendMessage(chatId, {
                text: `${pintarTTT(juego.tablero)}\n👉 Turno de ${nom(toca)}: *!ttt <1-9>*`,
                mentions: [toca]
            });
        }

        // ==========================================
        //  !warn / !unwarn / !warns — advertencias (admin)
        // ==========================================
        if (start === '!warn' || start === '!unwarn' || start === '!warns') {
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });
            const obj = mencionados.length > 0 ? mencionados[0] : (start === '!warns' ? sender : null);
            if (!obj) {
                return sock.sendMessage(chatId, { text: `⚠️ Uso: *${start} @usuario*${start === '!warn' ? ' [motivo]' : ''}` }, { quoted: msg });
            }
            if (start === '!warns') {
                const n = await db.getWarns(chatId, obj).catch(() => 0);
                return sock.sendMessage(chatId, { text: n === 0 ? `✅ ${nom(obj)} no tiene advertencias.` : `⚠️ ${nom(obj)} tiene *${n}/3* advertencias.`, mentions: [obj] });
            }
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });
            if (start === '!unwarn') {
                await db.resetWarns(chatId, obj).catch(() => {});
                return sock.sendMessage(chatId, { text: `🧹 Advertencias de ${nom(obj)} eliminadas.`, mentions: [obj] });
            }
            // !warn
            const motivo = args.slice(1).join(' ').slice(0, 120);
            const n = await db.addWarn(chatId, obj).catch(() => 0);
            if (n >= 3) {
                await db.resetWarns(chatId, obj).catch(() => {});
                let expulsado = false;
                try {
                    await sock.groupParticipantsUpdate(chatId, [obj], 'remove');
                    expulsado = true;
                } catch (e) {}
                return sock.sendMessage(chatId, {
                    text: `🚨 ${nom(obj)} llegó a *3/3 advertencias*${motivo ? `\n📌 Motivo: ${motivo}` : ''}\n${expulsado ? '👢 Fue *expulsado del grupo*.' : '⚠️ No pude expulsarlo (¿soy admin?). Sus warns se reiniciaron.'}`,
                    mentions: [obj]
                });
            }
            return sock.sendMessage(chatId, {
                text: `⚠️ *Advertencia ${n}/3* para ${nom(obj)}${motivo ? `\n📌 Motivo: ${motivo}` : ''}\n_A las 3 será expulsado._`,
                mentions: [obj]
            });
        }

        // ==========================================
        //  !afk — marcarse ausente
        // ==========================================
        if (start === '!afk') {
            const motivo = args.join(' ').slice(0, 120) || 'sin motivo';
            const ok = await db.setAFK(sender, motivo).catch(() => false);
            if (!ok) return sock.sendMessage(chatId, { text: '❌ No pude guardar tu AFK.' }, { quoted: msg });
            if (botState.afkCache) botState.afkCache.set(sender, { motivo, ts: Date.now() });
            return sock.sendMessage(chatId, { text: `💤 ${nom(sender)} ahora está *AFK*.\n📌 ${motivo}\n_(Se quita solo cuando vuelvas a escribir.)_`, mentions: [sender] });
        }

        // ==========================================
        //  !encuesta — encuesta nativa de WhatsApp
        // ==========================================
        if (start === '!encuesta') {
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });
            const partes = args.join(' ').split(',').map(p => p.trim()).filter(Boolean);
            if (partes.length < 3) {
                return sock.sendMessage(chatId, { text: '📊 Uso: *!encuesta* <pregunta>, <opción1>, <opción2> [, opción3...]\nEjemplo: *!encuesta* ¿Soy hombre?, Sí, No' }, { quoted: msg });
            }
            if (partes.length > 13) {
                return sock.sendMessage(chatId, { text: '❌ Máximo 12 opciones.' }, { quoted: msg });
            }
            try {
                await sock.sendMessage(chatId, {
                    poll: { name: `${pushName || 'Encuesta'}: ${partes[0].slice(0, 255)}`, values: partes.slice(1, 13).map(o => o.slice(0, 100)), selectableCount: 1 }
                });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ No pude crear la encuesta.' }, { quoted: msg });
            }
            return;
        }

        // ==========================================
        //  !topactivos — ranking de los que más hablan
        // ==========================================
        if (start === '!topactivos') {
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });
            const rows = await db.topActivos(chatId, 10).catch(() => []);
            if (!rows || rows.length === 0) {
                return sock.sendMessage(chatId, { text: '📊 Aún no hay actividad registrada en este grupo. ¡Escriban algo!' }, { quoted: msg });
            }
            const medallas = ['🥇', '🥈', '🥉'];
            let out = `📊 *TOP ACTIVOS DEL GRUPO*\n━━━━━━━━━━━━━━\n`;
            rows.forEach((r, i) => {
                out += `${medallas[i] || `${i + 1}.`} @${(r.user_id || '').split('@')[0]} — ${r.total} mensajes\n`;
            });
            return sock.sendMessage(chatId, { text: out, mentions: rows.map(r => r.user_id) });
        }

        // ==========================================
        //  !recordar / !recordatorios — avisos futuros
        // ==========================================
        if (start === '!recordar') {
            const ms = parseDuracion(args[0]);
            const texto = args.slice(1).join(' ').slice(0, 300);
            if (!ms || !texto) {
                return sock.sendMessage(chatId, { text: '⏰ Uso: *!recordar* <tiempo> <texto>\nTiempo: número + s/m/h/d (máx 720).\nEjemplo: *!recordar* 2h Tomar la medicina' }, { quoted: msg });
            }
            const r = await db.crearRecordatorio(chatId, sender, texto, Date.now() + ms).catch(() => ({ ok: false }));
            if (!r.ok) {
                return sock.sendMessage(chatId, { text: r.error === 'límite' ? '❌ Ya tienes 10 recordatorios pendientes. Borra uno con *!recordatorios*.' : '❌ No pude guardar el recordatorio.' }, { quoted: msg });
            }
            const f = new Date(Date.now() + ms);
            return sock.sendMessage(chatId, { text: `⏰ Te avisaré el ${f.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.\n📌 ${texto}` }, { quoted: msg });
        }

        if (start === '!recordatorios') {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'borrar' || sub === 'del') {
                const id = parseInt(args[1], 10);
                if (!id) return sock.sendMessage(chatId, { text: '❌ Uso: *!recordatorios borrar <número>*' }, { quoted: msg });
                const ok = await db.borrarRecordatorio(id, sender).catch(() => false);
                return sock.sendMessage(chatId, { text: ok ? `🗑️ Recordatorio #${id} borrado.` : '❌ No encontré ese recordatorio (¿es tuyo?).' }, { quoted: msg });
            }
            const rows = await db.misRecordatorios(chatId, sender).catch(() => []);
            if (!rows || rows.length === 0) {
                return sock.sendMessage(chatId, { text: '📭 No tienes recordatorios en este chat.\nCrea uno con *!recordar 10m <texto>*.' }, { quoted: msg });
            }
            let out = `⏰ *TUS RECORDATORIOS*\n━━━━━━━━━━━━━━\n`;
            for (const r of rows) {
                const f = new Date(r.execute_at);
                out += `#${r.id} — ${f.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}\n└ ${r.texto}\n`;
            }
            out += `\n🗑️ Borrar: *!recordatorios borrar <número>*`;
            return sock.sendMessage(chatId, { text: out }, { quoted: msg });
        }
    }
};
