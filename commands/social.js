/**
 * 🛠️ MÓDULO DE CONFIGURACIÓN Y UTILIDADES DE GRUPO
 */
module.exports = {
    name: 'utilities',
    isMultiple: true,
    names: ['!config', '!kick', '!promover', '!news', '!sorteo'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, sender, isGroup, isAdmin, isGlobalAdmin, db, botState, delay, ADMIN_NUM }) {

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
        //  !promover @usuario — Promover/Degradar admin
        // ==========================================
        if (start === '!promover') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: '🚫 Solo *administradores* pueden hacer esto.' }, { quoted: msg });
            if (!isGroup) return sock.sendMessage(chatId, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: msg });

            const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mencionados.length === 0) {
                return sock.sendMessage(chatId, { text: '👑 Menciona al usuario al que quieres dar/quitar admin.\nEjemplo: *!promover @usuario*\n_Para quitar: !promover @usuario remove_' }, { quoted: msg });
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
