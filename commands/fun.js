const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

module.exports = {
    name: 'fun',
    isMultiple: true,
    names: ['!ship', '!love', '!gay', '!iq', '!suerte', '!horoscopo', '!8ball', '!ppt', '!dado', '!moneda', '!top', '!reto', '!verdad', '!chiste', '!hacker', '!pokemon', '!carrera', '!suelten', '!sorteo', '!seria', '!cumplido', '!roast', '!ascii', '!v', '!deljuego'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, sender, db, botState, delay, convertirAWebp, FFMPEG_PATH }) {

        // !seria
        if (start === '!seria') {
            if (botState.juegos[chatId]) {
                return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero o usa *!deljuego*.' }, { quoted: msg });
            }
            const opt = [
                ['Volar pero solo a 5km/h', 'Ser invisible pero solo cuando nadie te mira'],
                ['Sin internet por un año', 'Sin aire acondicionado por un año'],
                ['Tener brazos de espagueti', 'Tener piernas de gelatina'],
                ['Escuchar la misma canción por siempre', 'No poder escuchar música nunca más'],
                ['Saber cómo vas a morir', 'Saber cuándo vas a morir'],
                ['Poder leer mentes', 'Poder volar'],
                ['Ser el más inteligente pero pobre', 'Ser el más rico pero tonto'],
                ['Vivir 200 años en soledad', 'Vivir 50 años con tus seres queridos'],
                ['Tener poderes pero ser villano', 'Ser héroe sin poderes'],
                ['Saber todos los idiomas', 'Saber tocar todos los instrumentos']
            ];
            const o = opt[Math.floor(Math.random() * opt.length)];
            const sentMsg = await sock.sendMessage(chatId, {
                text: `🤔 *¿QUÉ PREFERIRÍAS?*\n━━━━━━━━━━━━━━\n\n🔴 *A:* ${o[0]}\n⚪ *B:* ${o[1]}\n\n━━━━━━━━━━━━━━\n👉 Responde con *A* o *B*`
            }, { quoted: msg });

            botState.juegos[chatId] = {
                tipo: 'seria',
                responder: sender,
                opciones: o,
                msgId: sentMsg.key.id,
                timer: setTimeout(async () => {
                    if (botState.juegos[chatId]?.tipo === 'seria' && botState.juegos[chatId]?.msgId === sentMsg.key.id) {
                        delete botState.juegos[chatId];
                        await sock.sendMessage(chatId, { text: '⏰ Tiempo agotado. Nadie eligió.' });
                    }
                }, 60000)
            };
            return;
        }

        // !cumplido
        if (start === '!cumplido') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = ment[0] ? `@${ment[0].split('@')[0]}` : 'amig@';
            const c = [
                `${target}, tu sonrisa ilumina todo.`,
                `${target}, eres genial.`,
                `${target}, tienes una energía increíble.`,
                `${target}, eres de esas personas que hacen el mundo mejor.`,
                `${target}, me encanta tu forma de ser.`,
                `${target}, eres una persona muy especial.`,
                `${target}, tienes un corazón de oro.`,
                `${target}, eres la definición de elegancia.`,
                `${target}, siempre sabes qué decir.`,
                `${target}, eres una inspiración para los demás.`,
                `${target}, tu inteligencia es admirable.`,
                `${target}, eres luz en medio de la oscuridad.`
            ];
            return sock.sendMessage(chatId, { text: c[Math.floor(Math.random() * c.length)], mentions: ment });
        }

        // !roast
        if (start === '!roast') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = ment[0] ? `@${ment[0].split('@')[0]}` : 'tú';
            const r = [
                `${target}, tienes menos carisma que una piedra.`,
                `${target}, eres un relleno de anime.`,
                `${target}, tu cara es la razón por la que el shampoo tiene instrucciones.`,
                `${target}, eres como un lunes por la mañana: nadie te quiere.`,
                `${target}, si la estupidez doliera, estarías gritando todo el día.`,
                `${target}, eres la prueba de que Dios tiene sentido del humor.`,
                `${target}, tu IQ es menor que la temperatura de un congelador.`,
                `${target}, hablas tanto que hasta los sordos se quejan.`,
                `${target}, tienes el cerebro tan nuevo que aún tiene el plástico puesto.`,
                `${target}, eres como una moneda de chocolate: te derrites bajo presión y no vales nada.`,
                `${target}, mi teclado tiene más personalidad que tú.`
            ];
            return sock.sendMessage(chatId, { text: `🔥 *ROAST:* ${r[Math.floor(Math.random() * r.length)]}`, mentions: ment });
        }

        // !ascii
        if (start === '!ascii') {
            const texto = args.join(' ').toUpperCase().substring(0, 8);
            if (!texto) return sock.sendMessage(chatId, { text: '🔤 !ascii <texto>' });
            // Simplified ascii logic (just a placeholder or reuse if possible)
            return sock.sendMessage(chatId, { text: '```\n' + texto + '\n```' });
        }

        // !v (Sticker de texto) - Optimizado: genera webp directo en 1 paso
        if (start === '!v') {
            let fullTxt = args.join(' ');
            if (!fullTxt) return sock.sendMessage(chatId, { text: '🎨 Uso: !v <texto>' });

            const FFMPEG = FFMPEG_PATH || 'ffmpeg';
            const tmpOut = path.join(os.tmpdir(), `vtxt_${Date.now()}.webp`);

            try {
                // Generar sticker webp directamente en UN solo paso (antes eran 2 pasos)
                const safeText = fullTxt.replace(/'/g, "\u2019").replace(/:/g, "\\:");
                const argsF = [
                    '-f', 'lavfi',
                    '-i', `color=c=black@0.0:s=512x512:d=1,format=rgba`,
                    '-vf',
                    `drawtext=text='${safeText}':fontsize=50:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2:text_shaping=1`,
                    '-frames:v', '1',
                    '-quality', '75',
                    '-compression_level', '4',
                    '-y', tmpOut
                ];
                await execFileAsync(FFMPEG, argsF, { timeout: 10000, windowsHide: true });
                const webp = fs.readFileSync(tmpOut);
                if (webp) await sock.sendMessage(chatId, { sticker: webp }, { quoted: msg });
            } catch (e) {
                console.error('❌ [!v]', e.message);
                await sock.sendMessage(chatId, { text: '❌ Error al crear sticker de texto.' }, { quoted: msg });
            } finally {
                try { fs.unlinkSync(tmpOut); } catch (e) { }
            }
            return;
        }

        // !deljuego
        if (start === '!deljuego') {
            delete botState.juegos[chatId];
            return sock.sendMessage(chatId, { text: '✅ Juego cancelado.' });
        }
        // !8ball
        if (start === '!8ball') {
            const r = [
                'Sí', 'No', 'Probablemente', 'No lo sé', 'Tal vez', 'Definitivamente sí', 'Ni lo sueñes', 
                'Pregunta más tarde', 'Claro que sí', 'Para nada', 'Mis fuentes dicen que no', 
                'Mejor no decirte ahora', 'Concéntrate y pregunta de nuevo', 'Es cierto',
                'Como yo lo veo, sí', 'Muy dudoso', 'Sin duda alguna', 'Puedes confiar en ello'
            ];
            const q = args.join(' ');
            if (!q) return sock.sendMessage(chatId, { text: '🎱 ¡Hazme una pregunta!' });
            return sock.sendMessage(chatId, { text: `🎱 *8-BALL* 🎱\n\n*Pregunta:* ${q}\n*Respuesta:* ${r[Math.floor(Math.random() * r.length)]}` });
        }

        // !dado
        if (start === '!dado') {
            const d = Math.floor(Math.random() * 6) + 1;
            const e = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1];
            return sock.sendMessage(chatId, { text: `🎲 Lanzaste un dado y salió: *${d}* ${e}` });
        }

        // !moneda
        if (start === '!moneda') {
            const r = Math.random() < 0.5 ? 'CARA' : 'CRUZ';
            return sock.sendMessage(chatId, { text: `🪙 Lanzaste una moneda y salió: *${r}*` });
        }

        // !ship, !love
        if (start === '!ship' || start === '!love') {
            const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (m.length < 2) return sock.sendMessage(chatId, { text: '💕 Menciona a dos personas para unirlas.' });
            const p = Math.floor(Math.random() * 101);
            let c = '💔'; if (p > 30) c = '☁️'; if (p > 60) c = '💖'; if (p > 85) c = '🔥';
            return sock.sendMessage(chatId, { text: `💞 *LOVE TEST* 💞\n━━━━━━━━━━━━━━\n👤 @${m[0].split('@')[0]}\n👤 @${m[1].split('@')[0]}\n━━━━━━━━━━━━━━\n💗 Compatibilidad: *${p}%*\n${c} _${p > 80 ? '¡Pareja perfecta!' : p > 50 ? 'Podría funcionar.' : 'Mejor como amigos.'}_`, mentions: m });
        }

        // !gay, !iq, !suerte
        if (['!gay', '!iq', '!suerte'].includes(start)) {
            const p = Math.floor(Math.random() * 101);
            const t = start === '!gay' ? 'GAY-O-METRO 🏳️‍🌈' : start === '!iq' ? 'TEST DE IQ 🧠' : 'SUERTE DIARIA 🍀';
            const m = start === '!gay' ? `${p}% gay.` : start === '!iq' ? `Tu IQ es de ${p + 50}.` : `Tienes un ${p}% de suerte hoy.`;
            return sock.sendMessage(chatId, { text: `📊 *${t}*\n\nResultado: *${m}*` });
        }

        // !horoscopo
        if (start === '!horoscopo') {
            const h = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
            const norm = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const sign = norm(args[0]);
            const found = h.find(s => norm(s) === sign);
            if (!found) return sock.sendMessage(chatId, { text: `♈ *HORÓSCOPO* ♈\n\nUso: !horoscopo <signo>\nEjemplo: !horoscopo Leo\n\n📋 *Signos:* ${h.join(', ')}` }, { quoted: msg });
            const predicciones = [
                'Hoy será un gran día para el amor. 💕 Las estrellas favorecen los encuentros.',
                'Ten cuidado con los gastos inesperados. 💸 Ahorra para lo importante.',
                'Una sorpresa llegará pronto. 🎁 Mantén los ojos abiertos.',
                'Mantén la calma en el trabajo. 🧘 La paciencia será tu aliada.',
                'Salud estable, sigue así. 💪 Cuida lo que comes hoy.',
                'El color de hoy es el azul. 🔵 Úsalo para atraer buena energía.',
                'Un viejo amigo te buscará. 📱 La nostalgia trae buenos momentos.',
                'Hoy es buen día para empezar algo nuevo. 🌟 Confía en tu instinto.',
                'Evita discusiones innecesarias. 🕊️ La paz mental vale más.',
                'Tu creatividad está al máximo. 🎨 Aprovecha para crear algo especial.',
                'El universo te prepara una lección importante. 📖 Aprende de ella.',
                'Tu suerte en el amor mejora hoy. 💘 Deja que fluya.'
            ];
            const suerte = Math.floor(Math.random() * 100) + 1;
            const emoji_suerte = suerte > 75 ? '🍀' : suerte > 50 ? '⭐' : suerte > 25 ? '🌙' : '☁️';
            return sock.sendMessage(chatId, { text: `✨ *HORÓSCOPO: ${found.toUpperCase()}* ✨\n━━━━━━━━━━━━━━\n\n🔮 ${predicciones[Math.floor(Math.random() * predicciones.length)]}\n\n${emoji_suerte} *Suerte del día:* ${suerte}%\n━━━━━━━━━━━━━━` }, { quoted: msg });
        }
        // !top
        if (start === '!top') {
            const tema = args.join(' ');
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg });
            if (!tema) return sock.sendMessage(chatId, { text: '🏆 Uso: *!top <tema>*' }, { quoted: msg });
            try {
                const metadata = await sock.groupMetadata(chatId);
                const participants = metadata.participants.map(p => p.id);
                const shuffled = participants.sort(() => 0.5 - Math.random());
                const top = shuffled.slice(0, 5);
                let response = `🏆 *TOP 5: ${tema.toUpperCase()}* 🏆\n\n`;

                for (let i = 0; i < top.length; i++) {
                    const u = await db.obtenerUsuario(top[i]);
                    const name = u.nombre_wa || u.nombre || `@${top[i].split('@')[0]}`;
                    response += `${i + 1}. ${name}\n`;
                }
                return sock.sendMessage(chatId, { text: response, mentions: top }, { quoted: msg });
            } catch (e) { return sock.sendMessage(chatId, { text: '❌ Error al crear el top.' }); }
        }

        // !reto
        if (start === '!reto') {
            const retos = [
                'Envía un audio cantando el coro de tu canción favorita.',
                'Envía una captura de tu última búsqueda en Google.',
                'Ponte de foto de perfil la imagen que te envíe el bot por 1 hora.',
                'Escribe "Soy un pato" en tu estado de WhatsApp por 2 horas.',
                'Llama a un amigo y dile que te vas a casar.',
                'Envía un sticker de anime al azar.',
                'Escríbele a tu ex un "Hola, te extraño" y borra el mensaje a los 5 segundos (manda captura si puedes).',
                'Hazle un cumplido a la persona que más te caiga mal del grupo.',
                'Publica en tus estados: "Amo a Diky Bot" por 1 hora.',
                'Habla como un pirata por los próximos 10 minutos.',
                'Manda una foto de lo que estés comiendo ahora.',
                'Cuenta un secreto que nadie en el grupo sepa.'
            ];
            return sock.sendMessage(chatId, { text: `🎭 *RETO DIKY* 🎭\n\nTu reto es: *${retos[Math.floor(Math.random() * retos.length)]}*` }, { quoted: msg });
        }

        // !verdad
        if (start === '!verdad') {
            const verdades = [
                '¿Quién es tu crush en este grupo?',
                '¿Cuál es tu secreto más vergonzoso?',
                '¿Alguna vez has mentido para salir de una cita?',
                '¿Qué es lo más asqueroso que has hecho?',
                '¿A quién del grupo eliminarías si fuera necesario?',
                '¿Qué es lo peor que has hecho por dinero?',
                '¿Has revisado el celular de alguien sin permiso?',
                '¿Qué es lo más raro de lo que te has reído?',
                '¿Quién te cae peor de este chat?',
                '¿Cuál es tu mayor inseguridad?',
                '¿Alguna vez te has enamorado de un dibujo animado?',
                '¿Qué es lo más ilegal que has hecho?'
            ];
            return sock.sendMessage(chatId, { text: `🃏 *VERDAD O RETO* 🃏\n\nResponde con la verdad: *${verdades[Math.floor(Math.random() * verdades.length)]}*` }, { quoted: msg });
        }

        // !chiste
        if (start === '!chiste') {
            const chistes = [
                '— ¿Nivel de inglés? — Alto. — Traduzca "fiesta". — Party. — Úselo en una frase. — Me party de la risa.',
                '— Jaimito, ¿si tengo 5 botellas en una mano y 6 en la otra, qué tengo? — Un problema con el alcohol, profesora.',
                '¿Por qué los pájaros vuelan al sur? Porque caminar es muy cansado.',
                '— ¡Papá, ya sé lo que quiero ser de mayor! — ¿Qué, hijo? — ¡Quiero ser repartidor de pizzas! — ¿Por qué? — ¡Para comer pizza gratis todos los días!',
                '¿Qué le dice un jaguar a otro jaguar? — Jaguar you.',
                '— Doctor, doctor, ¡tengo un hueso fuera! — Pues dígale que pase, que no se quede ahí esperando.',
                '¿Por qué los esqueletos no se pelean? Porque no tienen agallas.',
                '— Mamá, en el colegio me llaman Facebook. — ¿Y tú qué les dices? — ¡Me gusta!',
                '¿Qué hace una abeja en el gimnasio? Zuma.',
                '¿Cuál es el último pez? El del-fín.'
            ];
            return sock.sendMessage(chatId, { text: `😂 *CHISTE DIKY* 😂\n\n${chistes[Math.floor(Math.random() * chistes.length)]}` }, { quoted: msg });
        }

        // !hacker
        if (start === '!hacker') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = ment.length > 0 ? `@${ment[0].split('@')[0]}` : 'Tú';
            const exito = Math.random() < 0.7;

            if (exito) {
                const hallazgos = [
                    'Encontré una foto tuya en calzones... ¡Qué horror! Mis circuitos se quemaron. 🤮',
                    'Descargando historial de búsqueda... ¿Por qué buscaste "cómo ser un gato"? 🐱',
                    'Accediendo a tu cuenta bancaria... Error: Saldo insuficiente ($0.25). Eres pobre. 💸',
                    'Viendo tu galería secreta... Tienes una obsesión extraña con los pies. 🦶',
                    'Leyendo tus chats... Le debes dinero a medio grupo y no piensas pagar. 🤥',
                    'Encontré tu colección de fotos de My Little Pony. No juzgaré, pero es raro. 🦄',
                    'Hackeando tu cámara... Estás haciendo caras raras frente al espejo ahora mismo. 🤳',
                    'Robando tus diamantes de Minecraft... ¡Ahora soy el bot más rico! 💎',
                    'Veo que tienes guardado un pack de stickers prohibidos. ¡Te voy a acusar! 👮',
                    'Tu fondo de pantalla es una foto tuya dándote un beso a ti mismo. Qué narcisista. 🤳',
                    'Descubrí que ocultas este chat de tu mamá. ¡Qué rebelde! 😎',
                    'Veo que pasas 8 horas al día en TikTok. Busca un hobby. 📱'
                ];
                const h = hallazgos[Math.floor(Math.random() * hallazgos.length)];
                return sock.sendMessage(chatId, { text: `💻 *INICIANDO PROTOCOLO HACKER* 💻\n\n🔓 Objetivo: ${target}\n📡 Vulnerabilidad: Encontrada\n📂 Extrayendo archivos: 100%\n✨ *HACKEO EXITOSO*\n\n *Hallazgo:* ${h}`, mentions: ment }, { quoted: msg });
            } else {
                const fallos = [
                    '⚠️ ¡ERROR! Tu firewall es de la NASA. Me atraparon y me metieron preso. 🚓',
                    '⚠️ El FBI está tocando mi puerta. ¡Borrando historial de Diky! 🏃💨',
                    '⚠️ Intenté entrar, pero tu antivirus me confundió con un meme de gatitos y me borró. 🐱',
                    '⚠️ Me dio pereza hackearte, mejor me fui a ver anime. 📺',
                    '⚠️ Tu celular es tan viejo que mi software de hackeo no es compatible con Android 2.0. 📱',
                    '⚠️ ¡ALERTA! Tu mamá me vio entrando a tu carpeta y me regañó. 😰',
                    '⚠️ Se me cayó el internet justo cuando estaba robando tus fotos. Qué mala suerte. 🌐',
                    '⚠️ Intenté hackearte pero me dio mucha tristeza lo pobre que eres. 😭',
                    '⚠️ Error 404: Cerebro no encontrado. No se puede hackear el vacío. 🧠❌',
                    '⚠️ Tu contraseña es "123456" pero el sistema me pidió un captcha de semáforos y fallé. 🚦'
                ];
                const f = fallos[Math.floor(Math.random() * fallos.length)];
                return sock.sendMessage(chatId, { text: `💻 *INTENTO DE HACKEO FALLIDO* 💻\n\n🚫 Objetivo: ${target}\n❌ *Resultado:* ${f}`, mentions: ment }, { quoted: msg });
            }
        }

        // !pokemon
        if (start === '!pokemon') {
            const u = await db.obtenerUsuario(sender);
            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }

            if (!inv.pokebola || inv.pokebola <= 0) {
                return sock.sendMessage(chatId, { text: '❌ No tienes Pokebolas. Compra una en la tienda (!comprar 14).' }, { quoted: msg });
            }

            const pokes = [
                'Pikachu ⚡', 'Charizard 🔥', 'Blastoise 💧', 'Mewtwo 🔮', 'Bulbasaur 🍃', 'Gengar 👻',
                'Lucario 👊', 'Rayquaza 🐲', 'Greninja 🐸', 'Arceus ✨', 'Eevee 🦊', 'Snorlax 💤',
                'Lugia 🌪️', 'Kyogre 🌊', 'Groudon 🌋', 'Darkrai 🌑', 'Latias 🔴', 'Latios 🔵',
                'Dragonite 🐉', 'Mew 🧿', 'Celebi 🌿', 'Jirachi ⭐', 'Deoxys 🧬', 'Zoroark 🌑',
                'Sceptile 🍃', 'Blaziken 🔥', 'Swampert 🌊', 'Gardevoir 🧚', 'Gallade ⚔️', 'Salamence 🐲',
                'Metagross 🤖', 'Garchomp 鯊', 'Togekiss 🕊️', 'Giratina 👻', 'Dialga ⏳', 'Palkia 🌌',
                'Zekrom ⚡', 'Reshiram ⚪', 'Kyurem ❄️', 'Xerneas 🦌', 'Yveltal 🦅', 'Zygarde 🐍',
                'Squirtle 🐢', 'Charmander 🦎', 'Psyduck 🦆', 'Meowth 🪙', 'Jigglypuff 🎤', 'Machamp 💪',
                'Alakazam 🥄', 'Gyarados 🐉', 'Lapras 🦕', 'Ditto 🟣', 'Scyther ⚔️', 'Electabuzz ⚡',
                'Magmar 🔥', 'Pinsir 🪲', 'Tauros 🐂', 'Vaporeon 💧', 'Jolteon ⚡', 'Flareon 🔥',
                'Porygon 📐', 'Aerodactyl 🦅', 'Articuno ❄️', 'Zapdos ⚡', 'Moltres 🔥', 'Chikorita 🍃',
                'Cyndaquil 🔥', 'Totodile 🐊', 'Togepi 🥚', 'Ampharos 💡', 'Umbreon 🌑', 'Espeon 🔮',
                'Scizor ✂️', 'Heracross 🪲', 'Tyranitar 🦖', 'Ho-Oh 🌈', 'Treecko 🦎', 'Torchic 🐥',
                'Mudkip 🐟', 'Slaking 🦥', 'Aggron 🛡️', 'Flygon 🦟', 'Milotic 🧜‍♀️', 'Absol 🌙',
                'Infernape 🐵', 'Empoleon 🐧', 'Torterra 🐢', 'Staraptor 🦅', 'Luxray 🦁', 'Riolu 🐺',
                'Weavile ❄️', 'Electivire ⚡', 'Magmortar 🔥', 'Glaceon ❄️', 'Leafeon 🍃', 'Sylveon 🎀'
            ];
            const poke = pokes[Math.floor(Math.random() * pokes.length)];

            // Recompensas
            let premio = Math.floor(Math.random() * 500) + 100;
            const xp = 150;

            const pokeName = `Pokemon: ${poke}`;
            const curr = inv[pokeName.toLowerCase()] || 0;

            let limitMsg = '';
            await db.removerItem(sender, 'pokebola', 1);

            if (curr >= 10) {
                const extraMoney = premio + 500; // Un poco más de dinero
                await db.sumarMonedas(sender, extraMoney);
                limitMsg = `\n⚠️ *Límite de inventario (10)*.\nLo has vendido extra por *${extraMoney}* diky.`;
            } else {
                await db.agregarItem(sender, pokeName, 1);
                await db.sumarMonedas(sender, premio);
                limitMsg = `\n📦 _Guardado en tu inventario (${curr + 1}/10)._`;
            }

            await db.sumarXP(sender, xp);

            return sock.sendMessage(chatId, { text: `🔴 ¡GOTCHA! Atrapaste un *${poke}*!\n\n💰 Recompensa normal: *${premio}* diky\n✨ XP: *${xp}*${limitMsg}` }, { quoted: msg });
        }

        // !carrera
        if (start === '!carrera') {
            const corredores = [
                { emoji: '🐎', nombre: 'Caballo' }, { emoji: '🐢', nombre: 'Tortuga' }, { emoji: '🐈', nombre: 'Gato' },
                { emoji: '🐕', nombre: 'Perro' }, { emoji: '🦖', nombre: 'Dino' }, { emoji: '🐌', nombre: 'Caracol' }
            ];
            const posiciones = corredores.map(c => ({
                ...c, pos: Math.floor(Math.random() * 10) + 1
            })).sort((a, b) => b.pos - a.pos);
            let pista = '🏁 *¡CARRERA DIKY!* 🏁\n\n';
            posiciones.forEach((c, i) => {
                const barra = '▓'.repeat(c.pos) + '░'.repeat(10 - c.pos);
                const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                pista += `${medalla} ${c.emoji} ${barra} ${c.nombre}\n`;
            });
            pista += `\n🏆 *¡${posiciones[0].emoji} ${posiciones[0].nombre} GANA LA CARRERA!*`;
            return sock.sendMessage(chatId, { text: pista }, { quoted: msg });
        }

        // !suelten
        if (start === '!suelten') {
            const miAnimal = args.join(' ').toLowerCase();
            if (!miAnimal) return sock.sendMessage(chatId, { text: '🏃 Uso: *!suelten <nombre_animal>*' }, { quoted: msg });
            const animalPool = [
                { e: '🐢', n: 'tortuga' }, { e: '🐎', n: 'caballo' }, { e: '🐇', n: 'conejo' },
                { e: '🦊', n: 'zorro' }, { e: '🐆', n: 'leopardo' }, { e: '🐌', n: 'caracol' },
                { e: '🐘', n: 'elefante' }, { e: '🦖', n: 'dino' }, { e: '🦄', n: 'unicornio' }
            ];
            let userRunner = animalPool.find(a => a.n.includes(miAnimal) || miAnimal.includes(a.n));
            if (!userRunner) userRunner = { e: '🐾', n: miAnimal };
            const otros = animalPool.filter(a => a.n !== userRunner.n).sort(() => 0.5 - Math.random()).slice(0, 4);
            const competidores = [userRunner, ...otros].sort(() => 0.5 - Math.random());
            const resultados = competidores.map(c => ({
                ...c, dist: Math.floor(Math.random() * 10) + 1
            })).sort((a, b) => b.dist - a.dist);
            let m = `🏁 *¡GRAN CARRERA: SUELTEN A LOS ANIMALES!* 🏁\n\n`;
            resultados.forEach((c, i) => {
                const carril = '▬'.repeat(c.dist) + c.e + '▬'.repeat(10 - c.dist) + '🏁';
                const puesto = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔸';
                m += `${puesto} | ${carril}\n`;
            });
            const winner = resultados[0];
            m += `\n🏆 *GANADOR:* ${winner.e} ${winner.n.toUpperCase()}\n`;
            if (winner.n === userRunner.n) m += `✨ ¡FELICIDADES! Tu animal dominó la pista. 🎉`;
            else m += `❌ Tu animal quedó en lugar ${resultados.findIndex(r => r.n === userRunner.n) + 1}.`;
            return sock.sendMessage(chatId, { text: m }, { quoted: msg });
        }

        // !sorteo
        if (start === '!sorteo') {
            const opciones = args.join(' ').split(',').map(o => o.trim()).filter(o => o !== '');
            if (opciones.length < 2) return sock.sendMessage(chatId, { text: '🎲 Debes dar al menos 2 opciones separadas por comas.' }, { quoted: msg });
            await sock.sendMessage(chatId, { text: '🎲 *Realizando sorteo...*' });
            await delay(1000);
            const ganador = opciones[Math.floor(Math.random() * opciones.length)];
            return sock.sendMessage(chatId, { text: `✨ El azar ha decidido...\n\n🏆 ¡El ganador es: *${ganador}*! 🎊` }, { quoted: msg });
        }

        // !ppt
        if (start === '!ppt') {
            const choices = ['piedra', 'papel', 'tijera'];
            const userChoice = args[0]?.toLowerCase();
            if (!choices.includes(userChoice)) return sock.sendMessage(chatId, { text: '✊✋✌️ Uso: !ppt <piedra|papel|tijera>' });
            const botChoice = choices[Math.floor(Math.random() * 3)];
            let res = '';
            if (userChoice === botChoice) res = '🤝 ¡EMPATE!';
            else if ((userChoice === 'piedra' && botChoice === 'tijera') || (userChoice === 'papel' && botChoice === 'piedra') || (userChoice === 'tijera' && botChoice === 'papel')) res = '🏆 ¡GANASTE!';
            else res = '❌ ¡PERDISTE!';
            const emojis = { piedra: '✊', papel: '✋', tijera: '✌️' };
            return sock.sendMessage(chatId, { text: `✊✋✌️ *JUEGO PPT* ✊✋✌️\n\n👤 Tú: ${emojis[userChoice]} *${userChoice.toUpperCase()}*\n🤖 Bot: ${emojis[botChoice]} *${botChoice.toUpperCase()}*\n\n👉 *Resultado:* ${res}` });
        }
    }
};
