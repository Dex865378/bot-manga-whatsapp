/**
 * Modulo de configuracion y administracion de grupos
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
    names: ['!bienvenida', '!setbienvenida', '!adm', '!bot', '!reglas', '!tag', '!antispam', '!mododios', '!ia', '!sincronizar', '!manga'],
    async execute(sock, chatId, msg, args, extras) {
        const { start, isGroup, isAdmin, isGlobalAdmin, db, botState, sender } = extras;
        if (!isGroup && !isGlobalAdmin) return sock.sendMessage(chatId, { text: 'Este comando solo funciona en grupos.' }, { quoted: msg });

        if (start === '!mododios') {
            if (!isGlobalAdmin) {
                const sNum = sender.split('@')[0];
                console.log(`[ADMIN] Intento de !mododios denegado para: ${sender}`);
                return sock.sendMessage(chatId, {
                    text: `**ACCESO DENEGADO**\n\nEste comando es exclusivo para el Administrador Maestro.\n\nTu ID detectado:\n*${sNum}*\n\nSOLUCION:\nSi eres el admin, verifica en Render que **NUMERO_ADMIN** incluya tu numero real Y el ID largo separados por coma.`
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
            return sock.sendMessage(chatId, { text: '**MODO DIOS ACTIVADO**\n\nStats restauradas al maximo nivel, mortal.' }, { quoted: msg });
        }

        if (start === '!antispam') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo los administradores del grupo pueden configurar esto.' }, { quoted: msg });

            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarAntiSpam(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '*SISTEMA ANTI-SPAM ACTIVADO EN ESTE GRUPO*\n_Limite: 100 comandos/hora por usuario._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarAntiSpam(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '*SISTEMA ANTI-SPAM DESACTIVADO EN ESTE GRUPO*' }, { quoted: msg });
            }
            const current = botState.groupCache.get(chatId) || await refreshGroupCache(db, botState, chatId);
            const antiSpamActivo = current.active?.antispam === 1;
            return sock.sendMessage(chatId, { text: `*SISTEMA ANTI-SPAM*\nEstado en este grupo: ${antiSpamActivo ? '*ACTIVO*' : '*DESACTIVADO*'}\n\nUso: *!antispam on/off*` }, { quoted: msg });
        }

        if (!isGroup) return;

        if (start === '!tag') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' });
            const meta = await sock.groupMetadata(chatId);
            const participants = meta.participants;
            const message = args.join(' ') || 'Atencion a todos!';
            const mentions = participants.map(p => p.id);
            let text = `*AVISO:* ${message}\n\n`;
            participants.forEach(p => { text += `@${p.id.split('@')[0]} `; });
            return sock.sendMessage(chatId, { text, mentions });
        }

        if (start === '!bienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'Bienvenidas *activadas*.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'Bienvenidas *desactivadas*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'Uso: *!bienvenida on/off*' }, { quoted: msg });
        }

        if (start === '!setbienvenida') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
            const message = args.join(' ');
            if (!message) return sock.sendMessage(chatId, { text: 'Especifica un mensaje. Usa `{usuario}` para mencionar al nuevo miembro.\nEjemplo: *!setbienvenida Hola {usuario}, bienvenido al infierno.*' }, { quoted: msg });
            const result = await db.setMensajeBienvenida(chatId, message);
            if (result) {
                await db.activarBienvenida(chatId);
                return sock.sendMessage(chatId, { text: 'Mensaje de bienvenida actualizado en este grupo.\n_(Las bienvenidas han sido activadas)_' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'Error al guardar el mensaje.' }, { quoted: msg });
        }

        if (start === '!adm') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarModoAdmin(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '*MODO ADMIN ACTIVADO EN ESTE GRUPO*\n_Solo los administradores pueden usar comandos._' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarModoAdmin(chatId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '*MODO ADMIN DESACTIVADO*' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'Uso: *!adm on/off*' }, { quoted: msg });
        }

        if (start === '!bot') {
            const senderId = msg.key.participant || msg.key.remoteJid;
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                await db.activarGrupo(chatId, senderId);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: 'Bot *activado* en este grupo.' }, { quoted: msg });
            } else if (mode === 'off') {
                await db.desactivarGrupo(chatId);
                botState.groupCache.delete(chatId);
                return sock.sendMessage(chatId, { text: 'Bot *desactivado*.' }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: 'Uso: *!bot on/off*' }, { quoted: msg });
        }

        if (start === '!ia') {
            if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
            const sub = args[0]?.toLowerCase();
            if (sub === 'on') {
                await db.setModoAI(chatId, true);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '**MODO AI ACTIVADO**\nAhora respondere a los mensajes del grupo usando Liquid AI.' }, { quoted: msg });
            } else if (sub === 'off') {
                await db.setModoAI(chatId, false);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: '**MODO AI DESACTIVADO**' }, { quoted: msg });
            } else if (sub === 'set') {
                const ctx = args.slice(1).join(' ');
                if (!ctx) return sock.sendMessage(chatId, { text: 'Especifica un contexto: *!ia set Eres un bot de anime muy sarcastico*' }, { quoted: msg });
                await db.setModoAI(chatId, true, ctx);
                await refreshGroupCache(db, botState, chatId);
                return sock.sendMessage(chatId, { text: `**CONTEXTO ACTUALIZADO**\nConfigurado como: _${ctx}_` }, { quoted: msg });
            }
            const ai = await db.getModoAI(chatId);
            return sock.sendMessage(chatId, { text: `**CONFIGURACION IA**\n\nEstado: ${ai.activado ? 'Activo' : 'Inactivo'}\nContexto: _${ai.contexto || 'Predeterminado'}_\n\nUso:\n- *!ia on/off*\n- *!ia set [instrucciones]*` }, { quoted: msg });
        }

        if (start === '!reglas') {
            try {
                const meta = await sock.groupMetadata(chatId);
                return sock.sendMessage(chatId, { text: `*REGLAS DEL GRUPO:*\n\n${meta.desc || 'No hay reglas configuradas.'}` }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: 'Error al obtener reglas.' }); }
        }

        // !manga on/off - Modo manga exclusivo (desactiva todo menos manga + admin)
        if (start === '!manga') {
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
                await db.activarModoManga(chatId);
                botState.mangaMode.set(chatId, true);
                if (botState.groupCache) botState.groupCache.delete(chatId);

                let mt = `📚 *DIKY BOT — MODO MANGA ACTIVADO* 📚\n`;
                mt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                mt += `Este grupo ahora es exclusivo para lectura de manga.\n\n`;

                mt += `📖 *[ COMANDOS DE MANGA ]*\n\n`;

                mt += `• *!catalogo*\n`;
                mt += `└ _Lista los mangas disponibles con sus códigos._\n\n`;

                mt += `• *!manga <nombre o código>*\n`;
                mt += `└ _Ver portada e información de un manga._\n\n`;

                mt += `• *!leer <código>*\n`;
                mt += `└ _Ver lista de capítulos disponibles._\n\n`;

                mt += `• *!leer <código> <número>*\n`;
                mt += `└ _Descargar un capítulo en PDF._\n\n`;

                mt += `• *!leer <código> all*\n`;
                mt += `└ _Descargar todos los capítulos seguidos._\n\n`;

                mt += `• *!buscar <nombre>*\n`;
                mt += `└ _Buscar un manga por su título._\n\n`;

                mt += `• *!recomanga*\n`;
                mt += `└ _Recomienda un manga aleatorio en español._\n\n`;

                mt += `• *!recomanga <género>*\n`;
                mt += `└ _Recomienda un manga del género elegido (ej: terror)._\n\n`;

                mt += `• *!recomanga generos*\n`;
                mt += `└ _Ver la lista de géneros disponibles._\n\n`;

                mt += `• *!parar*\n`;
                mt += `└ _Detener una descarga masiva en curso._\n\n`;

                mt += `⚙️ *[ ADMINISTRACIÓN ]*\n\n`;

                mt += `• *!bot <on/off>*\n`;
                mt += `└ _Encender o apagar el bot en el grupo._\n\n`;

                mt += `• *!adm <on/off>*\n`;
                mt += `└ _Permitir comandos solo a administradores._\n\n`;

                mt += `• *!manga off*\n`;
                mt += `└ _Desactivar modo manga y restaurar todo el bot._\n\n`;

                mt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                mt += `> _Guarda la configuración en la base de datos._`;

                return sock.sendMessage(chatId, { text: mt }, { quoted: msg });
            } else if (mode === 'off') {
                if (!isAdmin) return sock.sendMessage(chatId, { text: 'Solo admins.' }, { quoted: msg });
                await db.desactivarModoManga(chatId);
                botState.mangaMode.delete(chatId);
                if (botState.groupCache) botState.groupCache.delete(chatId);

                return sock.sendMessage(chatId, {
                    text: '🔓 *MODO MANGA DESACTIVADO*\n\nTodos los comandos del bot vuelven a estar disponibles en este grupo.'
                }, { quoted: msg });
            }
            // Si tiene argumentos que no son on/off (ej: !manga 019 o !manga Solo Leveling) →
            // delegar a media.js, que tiene el handler real de ficha de manga.
            // Necesario porque !manga está registrado en AMBOS módulos y commandHandler.js
            // solo conserva el último registrado (settings.js, por orden alfabético) en su Map,
            // pisando el handler de media.js.
            const mediaModule = require('./media');
            return mediaModule.execute(sock, chatId, msg, args, extras);
        }

        if (start === '!sincronizar') {
            if (!isGlobalAdmin) return sock.sendMessage(chatId, { text: 'Solo el Administrador Maestro puede sincronizar la DB.' }, { quoted: msg });

            const pathM = path.join(__dirname, '..', 'mangas.json');
            if (!fs.existsSync(pathM)) return sock.sendMessage(chatId, { text: 'No se encontro mangas.json.' });

            try {
                const local = JSON.parse(fs.readFileSync(pathM, 'utf-8'));
                let count = 0;
                for (const m of local) {
                    await db.guardarManga(m.codigo, m.titulo, m.carpeta, m.resumen || m.descripcion, m.generos);
                    count++;
                }
                return sock.sendMessage(chatId, { text: `**Sincronizacion Completada**\n\nSe han procesado *${count}* mangas localmente y sincronizado con Turso Cloud.` }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: `Error en sincronizacion: ${e.message}` }, { quoted: msg });
            }
        }
    }
};
