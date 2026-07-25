/**
 * 🏠 MÓDULO PRINCIPAL
 */
module.exports = {
    name: 'main',
    isMultiple: true,
    names: ['!menu', '!menu2', '!help', '!ping', '!s', '!sticker', '!toimg'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, sender, pushName, downloadMediaMessage, convertirAWebp, FFMPEG_PATH, botState }) {

        // !ping
        if (start === '!ping') {
            const pick = (v) => v[Math.floor(Math.random() * v.length)];
            const variants = [
                '🏓 *PONG!* El bot está activo y listo.',
                '📡 *EN LÍNEA!* Conexión estable.',
                '🚀 *A TODA MÁQUINA!* Listos para la acción.',
                '⚡ *VELOCIDAD RAYO!* El bot responde.',
                '🤖 *DIKY ACTIVO!* ¿Qué necesitas hoy?',
                '📶 *SEÑAL FUERTE!* Latencia mínima detectada.',
                '✅ *OPERATIVO!* Todos los sistemas al 100%.',
                '🟢 *VERDE!* Diky Bot está en su mejor momento.',
                '🌟 *LISTO Y BRILLANTE!* Esperando tus órdenes.',
                '🛠️ *MANTENIMIENTO 0%!* Funcionando perfectamente.'
            ];
            return sock.sendMessage(chatId, { text: pick(variants) }, { quoted: msg });
        }

        // !menu / !menu2 (REDiseño TOTAL PROFESIONAL Y EXHAUSTIVO)
        if (start === '!menu' || start === '!menu2' || start === '!help') {
            const pick = (v) => v[Math.floor(Math.random() * v.length)];
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

            let mText = `✨ *DIKY BOT V2 - PANEL MAESTRO* ✨\n`;
            mText += `📜 _"${pick(mottos)}"_\n`;
            mText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            mText += `👤 *USUARIO:* ${pushName}\n`;
            mText += `🕒 *UPTIME:* ${h}h ${m}m\n`;
            mText += `💰 *MONEDA:* diky\n\n`;
            mText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            mText += `👑 *[ ADMINISTRACIÓN ]*\n`;
            mText += `• !bot <on/off>\n`;
            mText += `• !adm <on/off>\n`;
            mText += `• !antispam <on/off>\n`;
            mText += `• !tag (Mencionar a todos)\n`;
            mText += `• !kick (Eliminar usuario)\n`;
            mText += `• !bienvenida (Configurar)\n`;
            mText += `• !setbienvenida (Msj personal)\n`;
            mText += `• !reglas (Ver/Configurar)\n`;
            mText += `• !sorteo (Azar por comas)\n\n`;

            mText += `👤 *[ PERFIL Y SOCIAL ]*\n`;
            mText += `• !perfil / !p / !profile\n`;
            mText += `• !config (bio/nombre/edad)\n`;
            mText += `• !prestigio (Ascender Lvl 500)\n`;
            mText += `• !mejor (Top global nivel/riqueza)\n`;
            mText += `• !dar <monto> @usuario\n`;
            mText += `• !canjear <monto> (Diky -> XP)\n`;
            mText += `• !marry @usuario / !divorce\n`;
            mText += `• !clase (Elegir profesión)\n`;
            mText += `• !inventario\n`;
            mText += `• !bounty (Ver recompensas)\n\n`;

            mText += `⚖️ *[ MERCADO Y SUBASTAS ]*\n`;
            mText += `• !subastar <item> <precio>\n`;
            mText += `• !subastas (Ver activas)\n`;
            mText += `• !ofertar <id> <monto>\n`;
            mText += `• !vender <item> / todo\n\n`;

            mText += `💰 *[ ECONOMÍA ]*\n`;
            mText += `• !daily (Recompensa de 24h)\n`;
            mText += `• !loteria (Participar/Ver)\n`;
            mText += `• !w (Trabajar - 1h de CO)\n`;
            mText += `• !slut (Ganancia rápida)\n`;
            mText += `• !robar (75-250 diky / 15min)\n`;
            mText += `• !tienda (Ver lista de items)\n`;
            mText += `• !comprar <número>\n\n`;

            mText += `🎰 *[ CASINO DIKY ]*\n`;
            mText += `• !bj (Blackjack)\n`;
            mText += `• !poker (Duelo de dados)\n`;
            mText += `• !minas (Buscaminas)\n`;
            mText += `• !slot (Tragamonedas)\n`;
            mText += `• !ruleta (Rusa)\n`;
            mText += `• !apostar (Rojo/Blanco)\n`;
            mText += `• !dado / !moneda / !ppt\n\n`;

            mText += `⚔️ *[ AVENTURA ]*\n`;
            mText += `• !minar (Explorar la cueva)\n`;
            mText += `• !pescar (Probar suerte en el mar)\n`;
            mText += `• !cazar (Explorar el bosque)\n`;
            mText += `• !duelo @usuario (Combate)\n`;
            mText += `• !pokemon (Atrapar uno)\n`;
            mText += `• !puente (Cruzar el cristal)\n`;
            mText += `• !mazmorra (Incursión por salas)\n`;
            mText += `• !cofre / !bomba / !carta / !donde\n\n`;

            mText += `🧠 *[ JUEGOS Y TRIVIA ]*\n`;
            mText += `• !trivia / !quiz / !quizanime\n`;
            mText += `• !adivina (Adivinar palabra)\n`;
            mText += `• !matematicas (Cálculos)\n`;
            mText += `• !bandera [pais/provincia/capitales]\n`;
            mText += `• !ahorcado\n`;
            mText += `• !carrera / !suelten (Carreras)\n\n`;

            mText += `🎬 *[ ANIME Y MEDIA ]*\n`;
            mText += `• !manga <nombre> / !leer\n`;
            mText += `• !buscar (Buscador de mangas)\n`;
            mText += `• !catalogo / !anime / !waifu\n`;
            mText += `• !anime reto (Desafío memoria)\n`;
            mText += `• !personaje / !personaje random\n`;
            mText += `• !estrenos / !temporada\n`;
            mText += `• !trace (Buscar por imagen)\n`;
            mText += `• !proximo / !estudio\n`;
            mText += `• !news (Noticias anime)\n\n`;

            mText += `🎀 *[ WAIFUS ]*\n`;
            mText += `• !waifus top (Tu top waifus)\n`;
            mText += `• !waifus @user (Ver de otro)\n`;
            mText += `• !waifus set <lista> (Agregar)\n`;
            mText += `• !waifus config <#> <nombre>\n`;
            mText += `• !waifus reset (Borrar lista)\n`;
            mText += `• !waifus random (10 random)\n`;
            mText += `• !waifus reto (Desafío memoria)\n\n`;

            mText += `🎭 *[ DIVERSIÓN Y HUMOR ]*\n`;
            mText += `• !ship @user @user\n`;
            mText += `• !love @user\n`;
            mText += `• !gay / !iq / !suerte\n`;
            mText += `• !top <tema> (Ranking del grupo)\n`;
            mText += `• !horoscopo / !8ball\n`;
            mText += `• !roast / !cumplido @user\n`;
            mText += `• !hacker @user\n`;
            mText += `• !chiste / !reto / !verdad\n`;
            mText += `• !seria (¿Qué preferirías?)\n\n`;

            mText += `✨ *[ REACCIONES ANIME ]*\n`;
            mText += `• !pat / !hug / !kiss / !slap\n`;
            mText += `• !punch / !kill / !cry / !dance\n`;
            mText += `• !bite / !highfive / !fumar / !cafe\n`;
            mText += `• !puchero / !sonrojar / !baka / !dormir\n`;
            mText += `• !comiendo / !pensar / !patear / !risa\n`;
            mText += `• !celebrar / !aburrido / !smug / !stare\n\n`;

            mText += `🛠️ *[ HERRAMIENTAS ]*\n`;
            mText += `• !s (Hecho de imagen/video)\n`;
            mText += `• !toimg (Convertir a foto)\n`;
            mText += `• !decir <texto> (Voz de bot)\n`;
            mText += `• !wiki <texto> / !ascii <texto>\n`;
            mText += `• !v <texto> (Sticker con texto)\n`;
            mText += `• !ver @usuario (Foto de perfil)\n`;
            mText += `• !ping (Estado real del bot)\n\n`;

            mText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            mText += `> _Escribe un comando para empezar._\n`;
            mText += `> _Diky Bot V2 - El bot más completo._`;

            return sock.sendMessage(chatId, { text: mText }, { quoted: msg });
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
