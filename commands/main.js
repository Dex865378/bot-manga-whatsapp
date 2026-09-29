/**
 * 🏠 MÓDULO PRINCIPAL
 */
const { helpData } = require('./help');
const fs = require('fs');
const path = require('path');

// Portada del menú: configurada con !setportada menu (cacheada en RAM por
// db.getPortada) o la imagen por defecto del bot. Así el menú sale como UN
// solo mensaje: imagen pegada al texto (caption), como hacen los bots.
let _menuDefaultImg = null;
function getMenuDefaultImg() {
    if (_menuDefaultImg) return _menuDefaultImg;
    try {
        const f = path.join(__dirname, '..', 'imagen_bienvenida.png');
        if (fs.existsSync(f)) _menuDefaultImg = fs.readFileSync(f);
    } catch (_) { }
    return _menuDefaultImg;
}

async function enviarMenuConPortada(sock, chatId, msg, db, texto) {
    let img = null;
    try { img = await db.getPortada('menu', chatId); } catch (_) { }
    if (!img) img = getMenuDefaultImg();
    if (img) {
        return sock.sendMessage(chatId, { image: img, caption: texto }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: texto }, { quoted: msg });
}

module.exports = {
    name: 'main',
    isMultiple: true,
    names: ['!menu', '!menu2', '!help', '!s', '!sticker', '!toimg'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, sender, pushName, downloadMediaMessage, convertirAWebp, FFMPEG_PATH, botState, db }) {

        // !ping esta manejado por commands/ping.js (mide latencia real con timestamp).
        // Se elimino la version duplicada de aqui, que nunca se ejecutaba (ping.js
        // se carga despues alfabeticamente y sobrescribe el registro de este comando).

        // !help <comando> - Ayuda detallada de un comando especifico
        // (!help sin argumento sigue cayendo al menu general de abajo, sin cambios)
        if (start === '!help' && args[0]) {
            const commandName = args[0].startsWith('!') ? args[0] : '!' + args[0];
            const help = helpData[commandName];

            if (!help) {
                return sock.sendMessage(chatId, {
                    text: `❌ No tengo ayuda detallada para *${commandName}*.\n\nUsa *!menu* para ver todos los comandos disponibles.`
                }, { quoted: msg });
            }

            let response = `❓ *AYUDA: ${commandName}*\n\n`;
            response += `📖 *Descripción:*\n${help.desc}\n\n`;
            response += `📝 *Uso:*\n\`\`\`${help.usage}\`\`\`\n\n`;
            response += `💡 *Ejemplo:*\n${help.ejemplo}\n\n`;
            response += `📋 *Argumentos:* ${help.args}\n`;
            response += `⏱️ *Cooldown:* ${help.cooldown}`;
            if (help.alias) response += `\n🔁 *Alias:* ${help.alias}`;

            return sock.sendMessage(chatId, { text: response }, { quoted: msg });
        }

        // !menu / !menu2 (REDiseño TOTAL PROFESIONAL Y EXHAUSTIVO)
        if (start === '!menu' || start === '!menu2' || start === '!help') {
            const pick = (v) => v[Math.floor(Math.random() * v.length)];

            // ── MODO MANGA: menú reducido ──
            let isMangaActive = isGroup && botState.mangaMode?.get(chatId);
            if (isGroup && !isMangaActive && db) {
                const gConf = await db.estaGrupoActivo(chatId);
                if (gConf && gConf.modo_manga === 1) {
                    isMangaActive = true;
                    botState.mangaMode?.set(chatId, true);
                }
            }

            if (isMangaActive) {
                const up = Math.floor((Date.now() - botState.startTime) / 1000);
                const h = Math.floor(up / 3600), mn = Math.floor((up % 3600) / 60);

                let mt = `📚 *DIKY BOT — MODO MANGA* 📚\n`;
                mt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                mt += `👤 *USUARIO:* ${pushName}\n`;
                mt += `🕒 *UPTIME:* ${h}h ${mn}m\n\n`;
                mt += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

                mt += `📖 *[ COMANDOS DE MANGA ]*\n\n`;

                mt += `• *!catalogo*\n`;
                mt += `└ _Lista los mangas disponibles con sus códigos._\n`;
                mt += `• *!manga <nombre o código>*\n`;
                mt += `└ _Ver portada e información de un manga._\n`;
                mt += `• *!leer <código>*\n`;
                mt += `└ _Ver lista de capítulos disponibles._\n`;
                mt += `• *!leer <código> <número>*\n`;
                mt += `└ _Descargar un capítulo en PDF._\n`;
                mt += `• *!leer <código> all*\n`;
                mt += `└ _Descargar todos los capítulos seguidos._\n`;
                mt += `• *!buscar <nombre>*\n`;
                mt += `└ _Buscar un manga por su título._\n`;
                mt += `• *!recomanga*\n`;
                mt += `└ _Recomienda un manga aleatorio en español._\n`;
                mt += `• *!recomanga <género>*\n`;
                mt += `└ _Recomienda un manga del género elegido (ej: terror)._\n`;
                mt += `• *!recomanga generos*\n`;
                mt += `└ _Ver la lista de géneros disponibles._\n`;
                mt += `• *!parar*\n`;
                mt += `└ _Detener una descarga masiva en curso._\n\n`;

                mt += `⚙️ *[ ADMINISTRACIÓN ]*\n\n`;

                mt += `• *!bot <on/off>*\n`;
                mt += `└ _Encender o apagar el bot en el grupo._\n`;
                mt += `• *!adm <on/off>*\n`;
                mt += `└ _Permitir comandos solo a administradores._\n`;
                mt += `• *!manga off*\n`;
                mt += `└ _Desactivar modo manga y restaurar todo el bot._\n\n`;

                mt += `━━━━━━━━━━━━━━━━━━━━━━\n`;
                mt += `> _Modo manga activo. Solo comandos de manga._\n`;
                mt += `> _Usa *!manga off* para volver al modo normal._`;

                return enviarMenuConPortada(sock, chatId, msg, db, mt);
            }

            // ── MENÚ COMPLETO (modo normal) ──
            const mottos = [
                "¡Tu compañero digital definitivo!",
                "¡El bot más loco de WhatsApp!",
                "¡Divirtiéndote desde el primer día!",
                "¡Llevando el grupo al siguiente nivel!",
                "¡Economía, juegos y mucha diversión!",
                "¡El bot que tu grupo merece!",
                "¡Diky Bot: Potencia y Estilo!",
                "¡Donde la tecnología encuentra la risa!"
            ];
            const up = Math.floor((Date.now() - botState.startTime) / 1000);
            const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);

            let mText = `✨ *DIKY BOT V3 - PANEL MAESTRO* ✨\n`;
            mText += `📜 _"${pick(mottos)}"_\n`;
            mText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            mText += `👤 *USUARIO:* ${pushName}\n`;
            mText += `🕒 *UPTIME:* ${h}h ${m}m\n`;
            mText += `💰 *MONEDA:* diky\n\n`;
            mText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            mText += `👑 *[ ADMINISTRACIÓN ]*\n`;
            mText += `• *!bot <on/off>*\n`;
            mText += `└ _Encender o apagar el bot en el grupo._\n`;
            mText += `• *!adm <on/off>*\n`;
            mText += `└ _Solo admins pueden usar comandos._\n`;
            mText += `• *!antispam <on/off>*\n`;
            mText += `└ _Activar protección anti-spam._\n`;
            mText += `• *!tag*\n`;
            mText += `└ _Mencionar a todos los miembros._\n`;
            mText += `• *!kick*\n`;
            mText += `└ _Eliminar un usuario del grupo._\n`;
            mText += `• *!bienvenida <on/off/ver/test>*\n`;
            mText += `└ _Configurar el mensaje de bienvenida._\n`;
            mText += `• *!setbienvenida <mensaje>*\n`;
            mText += `└ _Guardar mensaje personalizado ({usuario})._\n`;
            mText += `• *!despedida <on/off/ver/test>*\n`;
            mText += `└ _Mensaje cuando alguien sale del grupo._\n`;
            mText += `• *!setdespedida <mensaje>*\n`;
            mText += `└ _Guardar despedida personalizada ({usuario})._\n`;
            mText += `• *!setportada*\n`;
            mText += `└ _Portada de ESTE grupo (menú, bienvenida y despedida)._\n`;
            mText += `• *!reglas*\n`;
            mText += `└ _Ver o configurar reglas del grupo._\n`;
            mText += `• *!sorteo*\n`;
            mText += `└ _Elegir un miembro random del grupo._\n`;
            mText += `• *!encuesta <preg> | <op1> | <op2>*\n`;
            mText += `└ _Crear encuesta de WhatsApp._\n`;
            mText += `• *!warn @usuario [motivo]*\n`;
            mText += `└ _Advertir (3 = expulsión)._\n`;
            mText += `• *!unwarn / !warns @usuario*\n`;
            mText += `└ _Quitar o ver advertencias._\n`;
            mText += `• *!afk [motivo]*\n`;
            mText += `└ _Marcarse ausente._\n`;
            mText += `• *!topactivos*\n`;
            mText += `└ _Ranking de los que más hablan._\n`;
            mText += `• *!recordar <tiempo> <texto>*\n`;
            mText += `└ _Aviso futuro (s/m/h/d)._\n\n`;

            mText += `👤 *[ PERFIL Y SOCIAL ]*\n`;
            mText += `• *!perfil*\n`;
            mText += `└ _Ver tu perfil, nivel y estadísticas._\n`;
            mText += `• *!config*\n`;
            mText += `└ _Configurar tu bio, nombre y edad._\n`;
            mText += `• *!prestigio*\n`;
            mText += `└ _Ascender al llegar a nivel 500._\n`;
            mText += `• *!mejor*\n`;
            mText += `└ _Top global de nivel y riqueza._\n`;
            mText += `• *!dar <monto> @usuario*\n`;
            mText += `└ _Regalar diky a otro usuario._\n`;
            mText += `• *!canjear <monto>*\n`;
            mText += `└ _Convertir diky en XP._\n`;
            mText += `• *!marry @usuario / !divorce*\n`;
            mText += `└ _Matrimonio formal / divorciarse._\n`;
            mText += `• *!clase*\n`;
            mText += `└ _Elegir tu profesión._\n`;
            mText += `• *!inventario*\n`;
            mText += `└ _Ver tus items y mascotas._\n`;
            mText += `• *!bounty*\n`;
            mText += `└ _Ver recompensas activas._\n\n`;

            mText += `⚖️ *[ MERCADO Y SUBASTAS ]*\n`;
            mText += `• *!subastar <item> <precio>*\n`;
            mText += `└ _Poner un item en subasta._\n`;
            mText += `• *!subastas*\n`;
            mText += `└ _Ver subastas activas._\n`;
            mText += `• *!ofertar <id> <monto>*\n`;
            mText += `└ _Pujar en una subasta._\n`;
            mText += `• *!vender <item> / todo*\n`;
            mText += `└ _Vender items por diky._\n\n`;

            mText += `💰 *[ ECONOMÍA ]*\n`;
            mText += `• *!daily*\n`;
            mText += `└ _Recompensa gratis cada 24 horas._\n`;
            mText += `• *!loteria*\n`;
            mText += `└ _Participar o ver la lotería._\n`;
            mText += `• *!w*\n`;
            mText += `└ _Trabajar (1h de espera)._\n`;
            mText += `• *!slut*\n`;
            mText += `└ _Ganancia rápida de diky._\n`;
            mText += `• *!robar*\n`;
            mText += `└ _Robar 75-250 diky (cada 15 min)._\n`;
            mText += `• *!tienda*\n`;
            mText += `└ _Ver lista de items en venta._\n`;
            mText += `• *!comprar <número>*\n`;
            mText += `└ _Comprar un item de la tienda._\n\n`;

            mText += `🎰 *[ CASINO DIKY ]*\n`;
            mText += `• *!bj*\n`;
            mText += `└ _Jugar Blackjack._\n`;
            mText += `• *!poker*\n`;
            mText += `└ _Duelo de dados._\n`;
            mText += `• *!minas*\n`;
            mText += `└ _Juego del buscaminas._\n`;
            mText += `• *!slot*\n`;
            mText += `└ _Tragamonedas._\n`;
            mText += `• *!ruleta*\n`;
            mText += `└ _Ruleta rusa._\n`;
            mText += `• *!apostar*\n`;
            mText += `└ _Apostar a rojo o blanco._\n`;
            mText += `• *!dado / !moneda*\n`;
            mText += `└ _Lanzar dado o moneda._\n`;
            mText += `• *!ppt / !pptx*\n`;
            mText += `└ _Piedra-papel-tijera (clásico / 9 elementos)._\n\n`;

            mText += `⚔️ *[ AVENTURA ]*\n`;
            mText += `• *!minar*\n`;
            mText += `└ _Explorar la cueva._\n`;
            mText += `• *!pescar*\n`;
            mText += `└ _Probar suerte en el mar._\n`;
            mText += `• *!cazar*\n`;
            mText += `└ _Explorar el bosque._\n`;
            mText += `• *!duelo @usuario*\n`;
            mText += `└ _Retar a combate a alguien._\n`;
            mText += `• *!pokemon*\n`;
            mText += `└ _Atrapar un pokémon._\n`;
            mText += `• *!puente*\n`;
            mText += `└ _Cruzar el puente de cristal._\n`;
            mText += `• *!mazmorra*\n`;
            mText += `└ _Incursión por salas._\n`;
            mText += `• *!cofre / !bomba / !carta / !donde*\n`;
            mText += `└ _Mini-juegos de suerte._\n\n`;

            mText += `🧠 *[ JUEGOS Y TRIVIA ]*\n`;
            mText += `• *!trivia / !quiz / !quizanime*\n`;
            mText += `└ _Preguntas de trivia y anime._\n`;
            mText += `• *!adivina*\n`;
            mText += `└ _Adivinar la palabra oculta._\n`;
            mText += `• *!matematicas*\n`;
            mText += `└ _Resolver cálculos contra reloj._\n`;
            mText += `• *!bandera [pais/provincia/capitales]*\n`;
            mText += `└ _Adivinar banderas o capitales._\n`;
            mText += `• *!ahorcado*\n`;
            mText += `└ _Juego del ahorcado._\n`;
            mText += `• *!carrera / !suelten*\n`;
            mText += `└ _Carreras del grupo._\n`;
            mText += `• *!ttt @usuario*\n`;
            mText += `└ _Tres en raya contra alguien._\n`;
            mText += `• *!pptpvp @usuario*\n`;
            mText += `└ _Piedra-papel-tijera con mapas secretos._\n`;
            mText += `• *!c4 @usuario*\n`;
            mText += `└ _Conecta 4 contra alguien._\n`;
            mText += `• *!quizduelo @usuario*\n`;
            mText += `└ _Duelo de preguntas, el más rápido gana._\n`;
            mText += `• *!bingo*\n`;
            mText += `└ _Bingo grupal con cartones._\n`;
            mText += `• *!emojimix 😂❤️*\n`;
            mText += `└ _Sticker mezclando 2 emojis._\n\n`;

            mText += `🎬 *[ ANIME Y MEDIA ]*\n`;
            mText += `• *!manga <nombre> / !leer*\n`;
            mText += `└ _Ver ficha o capítulos de un manga._\n`;
            mText += `• *!buscar <nombre>*\n`;
            mText += `└ _Buscador de mangas._\n`;
            mText += `• *!catalogo / !anime / !waifu*\n`;
            mText += `└ _Catálogo, info de anime e imágenes._\n`;
            mText += `• *!anime reto*\n`;
            mText += `└ _Desafío de memoria de anime._\n`;
            mText += `• *!personaje / !personaje random*\n`;
            mText += `└ _Info de personajes de anime._\n`;
            mText += `• *!estrenos / !temporada*\n`;
            mText += `└ _Estrenos y anime de temporada._\n`;
            mText += `• *!trace*\n`;
            mText += `└ _Buscar anime por imagen._\n`;
            mText += `• *!proximo / !estudio*\n`;
            mText += `└ _Próximos estrenos e info de estudios._\n`;
            mText += `• *!news*\n`;
            mText += `└ _Noticias de anime._\n\n`;

            mText += `🎀 *[ WAIFUS ]*\n`;
            mText += `• *!waifus top*\n`;
            mText += `└ _Ver tu top de waifus._\n`;
            mText += `• *!waifus @user*\n`;
            mText += `└ _Ver el top de otro usuario._\n`;
            mText += `• *!waifus set <lista>*\n`;
            mText += `└ _Agregar waifus a tu top._\n`;
            mText += `• *!waifus config <#> <nombre>*\n`;
            mText += `└ _Editar una posición de tu top._\n`;
            mText += `• *!waifus reset*\n`;
            mText += `└ _Borrar tu lista._\n`;
            mText += `• *!waifus random*\n`;
            mText += `└ _10 waifus aleatorias._\n`;
            mText += `• *!waifus reto*\n`;
            mText += `└ _Desafío de memoria._\n\n`;

            mText += `🎭 *[ DIVERSIÓN Y HUMOR ]*\n`;
            mText += `• *!ship @user @user*\n`;
            mText += `└ _Compatibilidad amorosa entre dos._\n`;
            mText += `• *!love @user*\n`;
            mText += `└ _Cuánto te quiere el bot._\n`;
            mText += `• *!gay / !iq / !suerte*\n`;
            mText += `└ _Medidores divertidos._\n`;
            mText += `• *!top <tema>*\n`;
            mText += `└ _Ranking del grupo con el tema que pongas._\n`;
            mText += `• *!horoscopo / !8ball*\n`;
            mText += `└ _Horóscopo y bola mágica._\n`;
            mText += `• *!roast / !cumplido @user*\n`;
            mText += `└ _Insulto o cumplido gracioso._\n`;
            mText += `• *!hacker @user*\n`;
            mText += `└ _Hackeo falso a un usuario._\n`;
            mText += `• *!chiste / !reto / !verdad*\n`;
            mText += `└ _Chistes y retos de verdad o reto._\n`;
            mText += `• *!seria*\n`;
            mText += `└ _¿Qué preferirías?_\n`;
            mText += `• *!rifa <opc1, opc2, ...>*\n`;
            mText += `└ _Sorteo por texto entre opciones._\n\n`;

            mText += `✨ *[ REACCIONES ANIME ]*\n`;
            mText += `• *!pat / !hug / !kiss / !slap*\n`;
            mText += `• *!punch / !kill / !cry / !dance*\n`;
            mText += `• *!bite / !highfive / !fumar / !cafe*\n`;
            mText += `• *!puchero / !sonrojar / !baka / !dormir*\n`;
            mText += `• *!comiendo / !pensar / !patear / !risa*\n`;
            mText += `• *!celebrar / !aburrido / !smug / !stare*\n`;
            mText += `└ _Gifs de reacción (menciona a alguien)._\n\n`;

            mText += `🛠️ *[ HERRAMIENTAS ]*\n`;
            mText += `• *!s*\n`;
            mText += `└ _Crear sticker de imagen o video._\n`;
            mText += `• *!toimg*\n`;
            mText += `└ _Convertir sticker a foto._\n`;
            mText += `• *!decir <texto>*\n`;
            mText += `└ _El bot lo dice con voz grave._\n`;
            mText += `• *!setdecir*\n`;
            mText += `└ _Ver los 15 idiomas de !decir._\n`;
            mText += `• *!wiki <texto> / !ascii <texto>*\n`;
            mText += `└ _Buscar en wiki o arte ASCII._\n`;
            mText += `• *!v <texto>*\n`;
            mText += `└ _Sticker con texto._\n`;
            mText += `• *!ver @usuario*\n`;
            mText += `└ _Ver foto de perfil de alguien._\n`;
            mText += `• *!ping*\n`;
            mText += `└ _Estado real del bot._\n\n`;

            mText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            mText += `> _Escribe un comando para empezar._\n`;
            mText += `> _Diky Bot V3 - El bot más completo._`;

            return enviarMenuConPortada(sock, chatId, msg, db, mText);
        }

        // !sticker / !s
        if (start === '!sticker' || start === '!s') {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const media = msg.message?.imageMessage || msg.message?.videoMessage || quoted?.imageMessage || quoted?.videoMessage;
            if (!media) {
                return sock.sendMessage(chatId, { 
                    text: '*Como usar el sticker maker:*\n\nResponde a una imagen/video con *!s*.\n\nVideos maximo 10 segundos.' 
                }, { quoted: msg });
            }

            // Validación estricta: Limitar videos a 10 segundos
            const videoInfo = msg.message?.videoMessage || quoted?.videoMessage;
            if (videoInfo && videoInfo.seconds > 10) {
                return sock.sendMessage(chatId, { text: '⚠️ *El video es demasiado largo.*\n\nSolo puedes convertir videos de hasta *10 segundos* en stickers.' }, { quoted: msg });
            }

            try {
                const buffer = await downloadMediaMessage(quoted ? { message: quoted } : msg, 'buffer', {});
                const stiker = await convertirAWebp(buffer, !!(msg.message?.videoMessage || quoted?.videoMessage));
                if (stiker) return sock.sendMessage(chatId, { sticker: stiker }, { quoted: msg });
            } catch (e) { 
                console.error('[STICKER] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al crear sticker.' }); 
            }
        }

        // !toimg
        if (start === '!toimg') {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const stickerMsg = msg.message?.stickerMessage || quoted?.stickerMessage;
            if (!stickerMsg) return sock.sendMessage(chatId, { text: '🖼️ Responde a un *sticker* con *!toimg* para convertirlo a imagen.' }, { quoted: msg });

            try {
                const buffer = await downloadMediaMessage(
                    quoted?.stickerMessage ? { message: quoted } : msg,
                    'buffer', {}
                );

                // Convertir WebP a PNG usando ffmpeg
                const tmpIn = require('path').join(require('os').tmpdir(), `toimg_in_${Date.now()}.webp`);
                const tmpOut = require('path').join(require('os').tmpdir(), `toimg_out_${Date.now()}.png`);
                const fs = require('fs');
                fs.writeFileSync(tmpIn, buffer);

                const { execFile } = require('child_process');
                const { promisify } = require('util');
                const execFileAsync = promisify(execFile);

                await execFileAsync(FFMPEG_PATH, ['-i', tmpIn, '-y', tmpOut], { timeout: 15000, windowsHide: true });
                const imgBuffer = fs.readFileSync(tmpOut);

                // Limpiar archivos temporales
                try { fs.unlinkSync(tmpIn); } catch (e) { }
                try { fs.unlinkSync(tmpOut); } catch (e) { }

                return sock.sendMessage(chatId, { image: imgBuffer, caption: '🖼️ Sticker convertido a imagen.' }, { quoted: msg });
            } catch (e) {
                console.error('❌ [toimg] Error:', e.message);
                return sock.sendMessage(chatId, { text: '❌ Error al convertir el sticker a imagen.' }, { quoted: msg });
            }
        }
    }
};
