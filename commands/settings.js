/**
 * 🛠️ MÓDULO DE CONFIGURACIÓN Y ADMINISTRACIÓN DE GRUPOS
 */
module.exports = {
    name: 'settings',
    isMultiple: true,
    names: ['!bienvenida', '!setbienvenida', '!adm', '!bot', '!reglas', '!tag', '!antispam', '!mododios', '!ia', '!sincronizar'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, isAdmin, isGlobalAdmin, db, botState, sender }) {
        if (!isGroup && !isGlobalAdmin) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });

        // !mododios (Solo Global Admin)
        if (start === '!mododios') {
            if (!isGlobalAdmin) {
                const sNum = sender.split('@')[0];
                const adminEnv = process.env.NUMERO_ADMIN || 'No configurado';
                console.log(`🛡️ Intento de !mododios denegado para: ${sender} (Configurado: ${adminEnv})`);
                return sock.sendMessage(chatId, {
                    text: `🛡️ **ACCESO DENEGADO**\n\nEste comando es exclusivo para el Administrador Maestro.\n\n👤 **Tu ID detectado:** \n*${sNum}*\n\n⚙️ **Configurado en Render:** \n*${adminEnv.length > 5 ? adminEnv.slice(0, 5) + '...' : adminEnv}*\n\n💡 **SOLUCIÓN:**\nVe a Render y asegúrate de que **NUMERO_ADMIN** incluya tu número real Y el ID largo separados por coma, ejemplo:\n\`50760541202,109938613481683\``
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
            return sock.sendMessage(chatId, { text: '⚡⚡ **¡MODO DIOS ACTIVADO!** ⚡⚡\n\nStats restauradas al máximo nivel, mortal.' }, { quoted: msg });
        }

        // !antispam on/off (Ahora por Grupo)
        if (start === '!antispam') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo los administradores del grupo pueden configurar esto.' }, { quoted: msg });

            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarAntiSpam(chatId);
                const conf = await db.estaGrupoActivo(chatId);
                botState.groupCache.set(chatId, conf);
                return sock.sendMessage(chatId, { text: '🛡️ *SISTEMA ANTI-SPAM ACTIVADO EN ESTE GRUPO*\n_Límite: 50 comandos/hora por usuario._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarAntiSpam(chatId);
                const conf = await db.estaGrupoActivo(chatId);
                botState.groupCache.set(chatId, conf);
                return sock.sendMessage(chatId, { text: '🔓 *SISTEMA ANTI-SPAM DESACTIVADO EN ESTE GRUPO*' }, { quoted: msg });
            }
            const current = botState.groupCache.get(chatId);
            return sock.sendMessage(chatId, { text: `🛡️ *SISTEMA ANTI-SPAM*\nEstado en este grupo: ${current?.antispam === 1 ? '*ACTIVO* ✅' : '*DESACTIVADO* ❌'}\n\nUso: *!antispam on/off*` }, { quoted: msg });
        }

        if (!isGroup) return; // Si es privado y no es antispam, ignorar lo demás

        // !tag / !everyone
        if (start === '!tag') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' });
            const meta = await sock.groupMetadata(chatId);
            const participants = meta.participants;
            const message = args.join(' ') || '¡Atención a todos!';
            const mentions = participants.map(p => p.id);
            let text = `📢 *AVISO:* ${message}\n\n`;
            participants.forEach(p => { text += `@${p.id.split('@')[0]} `; });
            return sock.sendMessage(chatId, { text, mentions });
        }

        // !bienvenida on/off
        if (start === '!bienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: '✅ Bienvenidas *activadas*.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: '❌ Bienvenidas *desactivadas*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '❓ Uso: *!bienvenida on/off*' }, { quoted: msg });
        }

        // !setbienvenida <mensaje>
        if (start === '!setbienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' }, { quoted: msg });
            const message = args.join(' ');
            if (!message) return sock.sendMessage(chatId, { text: '❓ Especifica un mensaje. Usa `{usuario}` para mencionar al nuevo miembro.\nEjemplo: *!setbienvenida Hola {usuario}, bienvenido al infierno.*' }, { quoted: msg });
            const result = await db.setMensajeBienvenida(chatId, message);
            if (result) {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: '✅ Mensaje de bienvenida actualizado en este grupo.\n_(Las bienvenidas han sido activadas)_' }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: '❌ Error al guardar el mensaje.' }, { quoted: msg });
            }
        }

        // !adm on/off (Persistente)
        if (start === '!adm') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarModoAdmin(chatId);
                const conf = await db.estaGrupoActivo(chatId);
                botState.groupCache.set(chatId, conf);
                return sock.sendMessage(chatId, { text: '🛡️ *MODO ADMIN ACTIVADO EN ESTE GRUPO*\n_Solo los administradores pueden usar comandos._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarModoAdmin(chatId);
                const conf = await db.estaGrupoActivo(chatId);
                botState.groupCache.set(chatId, conf);
                return sock.sendMessage(chatId, { text: '🔓 *MODO ADMIN DESACTIVADO*' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '❓ Uso: *!adm on/off*' }, { quoted: msg });
        }

        // !bot on/off
        if (start === '!bot') {
            const sender = msg.key.participant || msg.key.remoteJid;
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarGrupo(chatId, sender);
                const conf = await db.estaGrupoActivo(chatId);
                botState.groupCache.set(chatId, conf);
                return sock.sendMessage(chatId, { text: '✅ Bot *activado* en este grupo.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarGrupo(chatId);
                botState.groupCache.delete(chatId); // Eliminar caché al desactivar
                return sock.sendMessage(chatId, { text: '🔴 Bot *desactivado*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '❓ Uso: *!bot on/off*' }, { quoted: msg });
        }

        // !ia on/off | !ia set <contexto>
        if (start === '!ia') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo admins.' }, { quoted: msg });
            const sub = args[0]?.toLowerCase();
            if (sub === 'on') {
                await db.setModoAI(chatId, true);
                return sock.sendMessage(chatId, { text: '🤖 **MODO AI ACTIVADO**\nAhora responderé a los mensajes del grupo usando Liquid AI.' }, { quoted: msg });
            } else if (sub === 'off') {
                await db.setModoAI(chatId, false);
                return sock.sendMessage(chatId, { text: '🔴 **MODO AI DESACTIVADO**' }, { quoted: msg });
            } else if (sub === 'set') {
                const ctx = args.slice(1).join(' ');
                if (!ctx) return sock.sendMessage(chatId, { text: '❓ Especifica un contexto: *!ia set Eres un bot de anime muy sarcástico*' }, { quoted: msg });
                await db.setModoAI(chatId, true, ctx);
                return sock.sendMessage(chatId, { text: `⚙️ **CONTEXTO ACTUALIZADO**\nConfigurado como: _${ctx}_` }, { quoted: msg });
            }
            const ai = await db.getModoAI(chatId);
            return sock.sendMessage(chatId, { text: `🤖 **CONFIGURACIÓN IA**\n\nEstado: ${ai.activado ? '✅ Activo' : '❌ Inactivo'}\nContexto: _${ai.contexto || 'Predeterminado'}_\n\nUso:\n- *!ia on/off*\n- *!ia set [instrucciones]*` }, { quoted: msg });
        }

        // !reglas
        if (start === '!reglas') {
            try {
                const meta = await sock.groupMetadata(chatId);
                return sock.sendMessage(chatId, { text: `📝 *REGLAS DEL GRUPO:*\n\n${meta.desc || 'No hay reglas configuradas.'}` }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error al obtener reglas.' }); }
        }

        // !sincronizar (Sincronización manual DB)
        if (start === '!sincronizar') {
            if (!isGlobalAdmin) return sock.sendMessage(chatId, { text: '🛡️ Solo el Administrador Maestro puede sincronizar la DB.' }, { quoted: msg });

            const pathM = path.join(__dirname, '..', 'mangas.json');
            if (!fs.existsSync(pathM)) return sock.sendMessage(chatId, { text: '❌ No se encontró mangas.json.' });

            try {
                const local = JSON.parse(fs.readFileSync(pathM, 'utf-8'));
                let count = 0;
                for (const m of local) {
                    await db.guardarManga(m.codigo, m.titulo, m.carpeta, m.resumen || m.descripcion, m.generos);
                    count++;
                }
                return sock.sendMessage(chatId, { text: `🔄 **Sincronización Completada**\n\nSe han procesado *${count}* mangas localmente y sincronizado con Turso Cloud.` }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: `❌ Error en sincronización: ${e.message}` }, { quoted: msg });
            }
        }
    }
};
