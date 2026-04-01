/**
 * 🛠️ MÓDULO DE CONFIGURACIÓN Y UTILIDADES DE GRUPO
 */
module.exports = {
    name: 'utilities',
    isMultiple: true,
    names: ['!config', '!tag', '!reglas', '!kick', '!adm', '!bot', '!bienvenida', '!setbienvenida', '!news', '!sorteo'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, sender, isGroup, isAdmin, isGlobalAdmin, db, botState, delay, ADMIN_NUM }) {

        // ==========================================
        //  !bot on/off — Activar/Desactivar bot
        // ==========================================
        if (start === '!bot') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });
            const op = args[0]?.toLowerCase();

            if (op === 'on') {
                await db.activarGrupo(chatId, sender);
                return sock.sendMessage(chatId, {
                    text: `✅ *Bot activado en este grupo.*\n\n🤖 Ya puedo responder comandos aquí.\nEscribe *!menu* para ver todo lo que puedo hacer.`
                }, { quoted: msg });
            }
            if (op === 'off') {
                await db.desactivarGrupo(chatId);
                return sock.sendMessage(chatId, {
                    text: `🔴 *Bot desactivado en este grupo.*\n\nYa no responderé comandos aquí hasta que un admin use *!bot on*.`
                }, { quoted: msg });
            }
            return sock.sendMessage(chatId, {
                text: `🤖 *CONTROL DEL BOT*\n━━━━━━━━━━━━━━\n• *!bot on* — Activar bot en el grupo\n• *!bot off* — Desactivar bot en el grupo`
            }, { quoted: msg });
        }

        // ==========================================
        //  !bienvenida on/off — Sistema de bienvenida
        // ==========================================
        if (start === '!bienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });
            const op = args[0]?.toLowerCase();

            if (op === 'on') {
                await db.activarBienvenida(chatId);
                const conf = await db.tieneBienvenida(chatId);
                const msgActual = conf.mensaje || '(mensaje por defecto)';
                return sock.sendMessage(chatId, {
                    text: `✅ *Bienvenidas ACTIVADAS.*\n\n📝 Mensaje actual:\n_${msgActual}_\n\n💡 Personaliza con *!setbienvenida <texto>*\nUsa *{usuario}* para mencionar al nuevo miembro.`
                }, { quoted: msg });
            }
            if (op === 'off') {
                await db.desactivarBienvenida(chatId);
                return sock.sendMessage(chatId, {
                    text: `🔴 *Bienvenidas DESACTIVADAS.*\n\nYa no enviaré mensajes cuando alguien entre al grupo.`
                }, { quoted: msg });
            }
            // Sin argumento: mostrar estado actual
            const conf = await db.tieneBienvenida(chatId);
            return sock.sendMessage(chatId, {
                text: `👋 *SISTEMA DE BIENVENIDA*\n━━━━━━━━━━━━━━\n📊 Estado: *${conf.activa ? '✅ ACTIVADO' : '🔴 DESACTIVADO'}*\n📝 Mensaje: _${conf.mensaje || 'predeterminado'}_\n━━━━━━━━━━━━━━\n• *!bienvenida on* — Activar\n• *!bienvenida off* — Desactivar\n• *!setbienvenida <texto>* — Personalizar mensaje`
            }, { quoted: msg });
        }

        // ==========================================
        //  !setbienvenida <mensaje> — Personalizar mensaje
        // ==========================================
        if (start === '!setbienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });

            const mensaje = args.join(' ').trim();
            if (!mensaje) {
                return sock.sendMessage(chatId, {
                    text: `📝 *PERSONALIZAR BIENVENIDA*\n━━━━━━━━━━━━━━\nUso: *!setbienvenida <tu mensaje>*\n\n🔠 Variables disponibles:\n• *{usuario}* — Menciona al nuevo miembro\n\nEjemplo:\n_!setbienvenida ¡Bienvenid@ {usuario}! 🎉 Aquí somos una familia._`
                }, { quoted: msg });
            }

            await db.setMensajeBienvenida(chatId, mensaje);

            return sock.sendMessage(chatId, {
                text: `✅ *¡Mensaje de bienvenida guardado!*\n\n📝 Nuevo mensaje:\n_${mensaje}_\n\n⚠️ Las bienvenidas ya están *activadas*.\nSe enviará este mensaje cuando alguien entre al grupo.`
            }, { quoted: msg });
        }

        // ==========================================
        //  !kick @usuario — Expulsar del grupo
        // ==========================================
        if (start === '!kick') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden expulsar miembros.' }, { quoted: msg });
            if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });

            const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mencionados.length === 0) {
                return sock.sendMessage(chatId, { text: '❌ Menciona al usuario que quieres expulsar.\nEjemplo: *!kick @usuario*' }, { quoted: msg });
            }

            for (const jid of mencionados) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [jid], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `👢 @${jid.split('@')[0]} ha sido *expulsado del grupo*.`,
                        mentions: [jid]
                    });
                    await delay(500);
                } catch (e) {
                    await sock.sendMessage(chatId, {
                        text: `❌ No pude expulsar a @${jid.split('@')[0]}. ¿Soy admin con permisos suficientes?`,
                        mentions: [jid]
                    });
                }
            }
            return;
        }

        // ==========================================
        //  !adm @usuario — Promover/Degradar admin
        // ==========================================
        if (start === '!adm') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });
            if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });

            const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mencionados.length === 0) {
                return sock.sendMessage(chatId, { text: '👑 Menciona al usuario al que quieres dar/quitar admin.\nEjemplo: *!adm @usuario*' }, { quoted: msg });
            }

            const action = args[1]?.toLowerCase() === 'remove' ? 'demote' : 'promote';
            const verb = action === 'promote' ? 'promovido a *administrador*' : 'removido de los *administradores*';

            for (const jid of mencionados) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [jid], action);
                    await sock.sendMessage(chatId, {
                        text: `👑 @${jid.split('@')[0]} ha sido ${verb}.`,
                        mentions: [jid]
                    });
                } catch (e) {
                    await sock.sendMessage(chatId, { text: `❌ No pude cambiar el rol de @${jid.split('@')[0]}.`, mentions: [jid] });
                }
            }
            return;
        }

        // ==========================================
        //  !tag — Mencionar a todos
        // ==========================================
        if (start === '!tag') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden usar esto.' }, { quoted: msg });
            if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });

            try {
                const meta = await sock.groupMetadata(chatId);
                const participants = meta.participants.map(p => p.id);
                const mentions = participants;
                const mensaje = args.join(' ').trim() || '📢 *Atención a todos*';
                const texto = `${mensaje}\n\n` + participants.map(p => `@${p.split('@')[0]}`).join(' ');

                return sock.sendMessage(chatId, { text: texto, mentions });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ No pude obtener la lista de miembros del grupo.' }, { quoted: msg });
            }
        }

        // ==========================================
        //  !reglas — Mostrar/Establecer reglas
        // ==========================================
        if (start === '!reglas') {
            if (!isGroup) return;

            const texto = args.join(' ').trim();
            if (texto && isAdmin) {
                // Guardar reglas en botState (en RAM — se reinicia con el bot)
                if (!botState.reglas) botState.reglas = {};
                botState.reglas[chatId] = texto;
                return sock.sendMessage(chatId, {
                    text: `📜 *Reglas del grupo actualizadas.*\n\n${texto}`
                }, { quoted: msg });
            }

            const reglas = botState.reglas?.[chatId] || 'No hay reglas definidas. Un admin puede establecerlas con *!reglas <texto>*.';
            return sock.sendMessage(chatId, {
                text: `📜 *REGLAS DEL GRUPO*\n━━━━━━━━━━━━━━\n${reglas}`
            });
        }

        // ==========================================
        //  !config — Perfil personal + config de grupo (flash)
        // ==========================================
        if (start === '!config') {
            const type = args[0]?.toLowerCase();

            // --- Configuración de grupo: !config flash on/off (solo admins) ---
            if (type === 'flash') {
                if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo administradores pueden cambiar esto.' }, { quoted: msg });
                const on = args[1]?.toLowerCase() === 'on';
                try { await db.alternarFlash(chatId, on); } catch (e) { /* alternarFlash puede no existir aún */ }
                return sock.sendMessage(chatId, { text: `⚡ Eventos Flash: *${on ? '✅ ACTIVADOS' : '🔴 DESACTIVADOS'}*` }, { quoted: msg });
            }

            // --- Configuración de perfil personal ---
            const MAPPER = {
                'bio': 'descripcion', 'descripcion': 'descripcion',
                'nombre': 'nombre_wa',
                'edad': 'edad',
                'nacimiento': 'nacimiento',
                'altura': 'altura',
                'anime': 'anime_fav',
                'manga': 'manga_fav',
                'power': 'superpoder', 'poder': 'superpoder'
            };

            // Soporte especial: !config fav manga/anime <texto>
            let field = MAPPER[type];
            let val = args.slice(1).join(' ').trim();

            if (!field && type === 'fav') {
                const sub = args[1]?.toLowerCase();
                if (sub === 'manga') { field = 'manga_fav'; val = args.slice(2).join(' ').trim(); }
                else if (sub === 'anime') { field = 'anime_fav'; val = args.slice(2).join(' ').trim(); }
            }

            if (!type || !field || !val) {
                return sock.sendMessage(chatId, {
                    text: `⚙️ *CONFIGURACIÓN DE PERFIL*\n━━━━━━━━━━━━━━\n• *!config bio <texto>*\n• *!config nombre <texto>*\n• *!config edad <número>*\n• *!config nacimiento <fecha>*\n• *!config altura <texto>*\n• *!config anime <texto>*\n• *!config manga <texto>*\n• *!config power <texto>*\n━━━━━━━━━━━━━━\n📡 _Admin:_ !config flash [on/off]`
                }, { quoted: msg });
            }

            let finalVal = val;
            if (field === 'edad') {
                finalVal = parseInt(val);
                if (isNaN(finalVal) || finalVal < 1 || finalVal > 120)
                    return sock.sendMessage(chatId, { text: '❌ La edad debe ser un número válido (1-120).' }, { quoted: msg });
            }

            const ok = await db.actualizarUsuario(sender, { [field]: finalVal });
            if (ok) return sock.sendMessage(chatId, { text: `✅ Tu *${type.toUpperCase()}* fue actualizado correctamente.` }, { quoted: msg });
            else return sock.sendMessage(chatId, { text: '❌ Error al guardar en la base de datos.' }, { quoted: msg });
        }

        // ==========================================
        //  !news <mensaje> — Enviar noticia (solo admin global)
        // ==========================================
        if (start === '!news') {
            if (!isGlobalAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo el admin global puede usar esto.' }, { quoted: msg });
            const texto = args.join(' ').trim();
            if (!texto) return sock.sendMessage(chatId, { text: '📰 Uso: *!news <mensaje>*' }, { quoted: msg });

            return sock.sendMessage(chatId, {
                text: `📰 *NOTICIAS DEL BOT* 📰\n━━━━━━━━━━━━━━\n${texto}\n━━━━━━━━━━━━━━\n🤖 _Diky Bot_`
            });
        }

        // ==========================================
        //  !sorteo — Elegir ganador aleatorio del grupo
        // ==========================================
        if (start === '!sorteo') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer sorteos.' }, { quoted: msg });
            if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });

            try {
                const meta = await sock.groupMetadata(chatId);
                const participantes = meta.participants.filter(p => !p.admin);
                if (participantes.length === 0) return sock.sendMessage(chatId, { text: '❌ No hay participantes para el sorteo.' }, { quoted: msg });

                const ganador = participantes[Math.floor(Math.random() * participantes.length)];
                const num = ganador.id.split('@')[0];

                return sock.sendMessage(chatId, {
                    text: `🎉 *¡SORTEO!* 🎉\n━━━━━━━━━━━━━━\n🎊 El ganador es:\n\n👑 *@${num}* 👑\n━━━━━━━━━━━━━━\n¡Felicidades! 🥳`,
                    mentions: [ganador.id]
                });
            } catch (e) {
                return sock.sendMessage(chatId, { text: '❌ No pude obtener los miembros del grupo.' }, { quoted: msg });
            }
        }
    }
};
