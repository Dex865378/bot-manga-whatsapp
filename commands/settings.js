/**
 * ðŸ› ï¸ MÃ“DULO DE CONFIGURACIÃ“N Y ADMINISTRACIÃ“N DE GRUPOS
 */
const path = require('path');
const fs = require('fs');

async function refreshGroupCache(db, botState, chatId) {
    const [active, ai] = await Promise.all([
        db.estaGrupoActivo(chatId),
        db.getModoAI(chatId)
    ]);
    const config = { active, ai };
    botState.groupCache.set(chatId, config);
    return config;
}

module.exports = {
    name: 'settings',
    isMultiple: true,
    names: ['!bienvenida', '!setbienvenida', '!adm', '!bot', '!reglas', '!tag', '!antispam', '!mododios', '!ia', '!sincronizar'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, isAdmin, isGlobalAdmin, db, botState, sender }) {
        if (!isGroup && !isGlobalAdmin) return sock.sendMessage(chatId, { text: 'ðŸ‘¥ Este comando solo funciona en grupos.' }, { quoted: msg });

        // !mododios (Solo Global Admin)
        if (start === '!mododios') {
            if (!isGlobalAdmin) {
                const sNum = sender.split('@')[0];
                const adminEnv = process.env.NUMERO_ADMIN || 'No configurado';
                console.log(`ðŸ›¡ï¸ Intento de !mododios denegado para: ${sender} (Configurado: ${adminEnv})`);
                return sock.sendMessage(chatId, {
                    text: `ðŸ›¡ï¸ **ACCESO DENEGADO**\n\nEste comando es exclusivo para el Administrador Maestro.\n\nðŸ‘¤ **Tu ID detectado:** \n*${sNum}*\n\nâš™ï¸ **Configurado en Render:** \n*${adminEnv.length > 5 ? adminEnv.slice(0, 5) + '...' : adminEnv}*\n\nðŸ’¡ **SOLUCIÃ“N:**\nVe a Render y asegÃºrate de que **NUMERO_ADMIN** incluya tu nÃºmero real Y el ID largo separados por coma, ejemplo:\n\`50760541202,109938613481683\``
                }, { quoted: msg });
            }

            await db.actualizarUsuario(sender, {
                monedas: 1000000000,
                xp: 1000000,
                nivel: 999,
                inventario: JSON.stringify({
                    pico_platino: 99, cebo: 99, silencio: 99, fruta: 99, escudo: 99, pocion_xp: 99
                })
            });
            return sock.sendMessage(chatId, { text: 'âš¡âš¡ **Â¡MODO DIOS ACTIVADO!** âš¡âš¡\n\nStats restauradas al mÃ¡ximo nivel, mortal.' }, { quoted: msg });
        }

        // !antispam on/off (Ahora por Grupo)
        if (start === '!antispam') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo los administradores del grupo pueden configurar esto.' }, { quoted: msg });

            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarAntiSpam(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ *SISTEMA ANTI-SPAM ACTIVADO EN ESTE GRUPO*\n_LÃ­mite: 50 comandos/hora por usuario._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarAntiSpam(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ”“ *SISTEMA ANTI-SPAM DESACTIVADO EN ESTE GRUPO*' }, { quoted: msg });
            }
            const current = botState.groupCache.get(chatId) || await refreshGroupCache(db, botState, chatId);
            const antiSpamActivo = current.active?.antispam === 1;
            return sock.sendMessage(chatId, { text: `*SISTEMA ANTI-SPAM*\nEstado en este grupo: ${antiSpamActivo ? '*ACTIVO*' : '*DESACTIVADO*'}\n\nUso: *!antispam on/off*` }, { quoted: msg });
        }

        if (!isGroup) return; // Si es privado y no es antispam, ignorar lo demÃ¡s

        // !tag / !everyone
        if (start === '!tag') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' });
            const meta = await sock.groupMetadata(chatId);
            const participants = meta.participants;
            const message = args.join(' ') || 'Â¡AtenciÃ³n a todos!';
            const mentions = participants.map(p => p.id);
            let text = `ðŸ“¢ *AVISO:* ${message}\n\n`;
            participants.forEach(p => { text += `@${p.id.split('@')[0]} `; });
            return sock.sendMessage(chatId, { text, mentions });
        }

        // !bienvenida on/off
        if (start === '!bienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'âœ… Bienvenidas *activadas*.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'âŒ Bienvenidas *desactivadas*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'â“ Uso: *!bienvenida on/off*' }, { quoted: msg });
        }

        // !setbienvenida <mensaje>
        if (start === '!setbienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' }, { quoted: msg });
            const message = args.join(' ');
            if (!message) return sock.sendMessage(chatId, { text: 'â“ Especifica un mensaje. Usa `{usuario}` para mencionar al nuevo miembro.\nEjemplo: *!setbienvenida Hola {usuario}, bienvenido al infierno.*' }, { quoted: msg });
            const result = await db.setMensajeBienvenida(chatId, message);
            if (result) {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'âœ… Mensaje de bienvenida actualizado en este grupo.\n_(Las bienvenidas han sido activadas)_' }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: 'âŒ Error al guardar el mensaje.' }, { quoted: msg });
            }
        }

        // !adm on/off (Persistente)
        if (start === '!adm') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarModoAdmin(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ *MODO ADMIN ACTIVADO EN ESTE GRUPO*\n_Solo los administradores pueden usar comandos._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarModoAdmin(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ”“ *MODO ADMIN DESACTIVADO*' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'â“ Uso: *!adm on/off*' }, { quoted: msg });
        }

        // !bot on/off
        if (start === '!bot') {
            const sender = msg.key.participant || msg.key.remoteJid;
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarGrupo(chatId, sender);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'âœ… Bot *activado* en este grupo.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarGrupo(chatId);
                botState.groupCache.delete(chatId); // Eliminar cachÃ© al desactivar
                return sock.sendMessage(chatId, { text: 'ðŸ”´ Bot *desactivado*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'â“ Uso: *!bot on/off*' }, { quoted: msg });
        }

        // !ia on/off | !ia set <contexto>
        if (start === '!ia') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo admins.' }, { quoted: msg });
            const sub = args[0]?.toLowerCase();
            if (sub === 'on') {
                await db.setModoAI(chatId, true);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ¤– **MODO AI ACTIVADO**\nAhora responderÃ© a los mensajes del grupo usando Liquid AI.' }, { quoted: msg });
            } else if (sub === 'off') {
                await db.setModoAI(chatId, false);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'ðŸ”´ **MODO AI DESACTIVADO**' }, { quoted: msg });
            } else if (sub === 'set') {
                const ctx = args.slice(1).join(' ');
                if (!ctx) return sock.sendMessage(chatId, { text: 'â“ Especifica un contexto: *!ia set Eres un bot de anime muy sarcÃ¡stico*' }, { quoted: msg });
                await db.setModoAI(chatId, true, ctx);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: `âš™ï¸ **CONTEXTO ACTUALIZADO**\nConfigurado como: _${ctx}_` }, { quoted: msg });
            }
            const ai = await db.getModoAI(chatId);
            return sock.sendMessage(chatId, { text: `ðŸ¤– **CONFIGURACIÃ“N IA**\n\nEstado: ${ai.activado ? 'âœ… Activo' : 'âŒ Inactivo'}\nContexto: _${ai.contexto || 'Predeterminado'}_\n\nUso:\n- *!ia on/off*\n- *!ia set [instrucciones]*` }, { quoted: msg });
        }

        // !reglas
        if (start === '!reglas') {
            try {
                const meta = await sock.groupMetadata(chatId);
                return sock.sendMessage(chatId, { text: `ðŸ“ *REGLAS DEL GRUPO:*\n\n${meta.desc || 'No hay reglas configuradas.'}` }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: 'âŒ Error al obtener reglas.' }); }
        }

        // !sincronizar (SincronizaciÃ³n manual DB)
        if (start === '!sincronizar') {
            if (!isGlobalAdmin) return sock.sendMessage(chatId, { text: 'ðŸ›¡ï¸ Solo el Administrador Maestro puede sincronizar la DB.' }, { quoted: msg });

            const pathM = path.join(__dirname, '..', 'mangas.json');
            if (!fs.existsSync(pathM)) return sock.sendMessage(chatId, { text: 'âŒ No se encontrÃ³ mangas.json.' });

            try {
                const local = JSON.parse(fs.readFileSync(pathM, 'utf-8'));
                let count = 0;
                for (const m of local) {
                    await db.guardarManga(m.codigo, m.titulo, m.carpeta, m.resumen || m.descripcion, m.generos);
                    count++;
                }
                return sock.sendMessage(chatId, { text: `ðŸ”„ **SincronizaciÃ³n Completada**\n\nSe han procesado *${count}* mangas localmente y sincronizado con Turso Cloud.` }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: `âŒ Error en sincronizaciÃ³n: ${e.message}` }, { quoted: msg });
            }
        }
    }
};
