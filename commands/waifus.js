/**
 * 🎀 MÓDULO DE WAIFUS
 * Comandos: !waifus top | !waifus set | !waifus random | !waifus @usuario
 */
const axios = require('axios');

module.exports = {
    name: 'waifus',
    isMultiple: true,
    names: ['!waifus'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, sender, db, delay, botState }) {

        const subCmd = (args[0] || '').toLowerCase();

        // ═══════════════════════════════════════
        // !waifus set <waifu1>, <waifu2>, ... (AGREGA sin borrar las existentes, max 10, sin repetidos)
        // ═══════════════════════════════════════
        if (subCmd === 'set') {
            // Todo lo que viene después de "set" es la lista
            const raw = args.slice(1).join(' ');
            if (!raw) {
                return sock.sendMessage(chatId, {
                    text: `🎀 *¡CONFIGURA TUS WAIFUS!* 🎀\n\n` +
                        `Uso: *!waifus set* <waifu1>, <waifu2>, ...\n\n` +
                        `📌 *Ejemplo:*\n` +
                        `!waifus set Rem, Emilia, Zero Two\n\n` +
                        `⚠️ Separa cada waifu con una *coma (,)*.\n` +
                        `📊 Puedes tener hasta *10 waifus*.\n` +
                        `🔄 Las nuevas se *agregan* a las que ya tienes.\n` +
                        `🚫 No se permiten *repetidas*.`
                }, { quoted: msg });
            }

            // Parsear las waifus nuevas separadas por coma
            const newWaifus = raw.split(',')
                .map(w => w.trim())
                .filter(w => w.length > 0);

            if (newWaifus.length === 0) {
                return sock.sendMessage(chatId, {
                    text: '❌ No detecté ninguna waifu válida. Sepáralas con comas.\n\nEjemplo: *!waifus set Rem, Emilia, Zero Two*'
                }, { quoted: msg });
            }

            // Obtener datos del usuario
            const u = await db.obtenerUsuario(sender);
            if (!u) return sock.sendMessage(chatId, { text: '❌ Error al obtener tu perfil.' }, { quoted: msg });

            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }

            // Obtener lista actual (o vacía si no existe)
            const currentList = Array.isArray(inv['mis_waifus']) ? inv['mis_waifus'] : [];

            // Verificar cuántos espacios quedan
            const espaciosLibres = 10 - currentList.length;

            if (espaciosLibres <= 0) {
                return sock.sendMessage(chatId, {
                    text: `❌ Ya tienes *10/10* waifus. Tu lista está llena.\n\n` +
                        `💡 Si quieres cambiarlas, usa:\n` +
                        `*!waifus reset* para borrar todas y empezar de cero.`
                }, { quoted: msg });
            }

            // Filtrar duplicados (comparar en minúsculas para evitar "Rem" vs "rem")
            const currentLower = currentList.map(w => w.toLowerCase());
            const duplicadas = [];
            const agregadas = [];

            for (const w of newWaifus) {
                if (agregadas.length + currentList.length >= 10) break; // ya no caben más

                if (currentLower.includes(w.toLowerCase()) || agregadas.map(a => a.toLowerCase()).includes(w.toLowerCase())) {
                    duplicadas.push(w);
                } else {
                    agregadas.push(w);
                }
            }

            if (agregadas.length === 0 && duplicadas.length > 0) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ Todas las waifus que pusiste ya están en tu lista:\n` +
                        duplicadas.map(d => `• *${d}*`).join('\n') +
                        `\n\n💡 Usa *!waifus top* para ver tu lista actual.`
                }, { quoted: msg });
            }

            // Fusionar: las existentes + las nuevas
            const finalList = [...currentList, ...agregadas];
            inv['mis_waifus'] = finalList;

            await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });

            // Construir mensaje bonito
            let response = `🎀 *¡WAIFUS ACTUALIZADAS!* 🎀\n`;
            response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            const medals = ['👑', '💎', '🌟', '✨', '🎀', '💕', '🌸', '🎭', '💫', '🔮'];
            finalList.forEach((w, i) => {
                const isNew = agregadas.includes(w);
                response += `${medals[i] || '•'} *${i + 1}.* ${w}${isNew ? ' 🆕' : ''}\n`;
            });

            response += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            response += `📊 Total: *${finalList.length}/10* waifus.\n`;
            response += `✅ Agregadas: *${agregadas.length}*`;

            if (duplicadas.length > 0) {
                response += `\n⚠️ Repetidas (ignoradas): ${duplicadas.map(d => `*${d}*`).join(', ')}`;
            }

            if (finalList.length < 10) {
                response += `\n💡 Te faltan *${10 - finalList.length}* más. Usa *!waifus set* de nuevo.`;
            }

            return sock.sendMessage(chatId, { text: response }, { quoted: msg });
        }

        // ═══════════════════════════════════════
        // !waifus reset - Borrar tu lista y empezar de cero
        // ═══════════════════════════════════════
        if (subCmd === 'reset') {
            const u = await db.obtenerUsuario(sender);
            if (!u) return sock.sendMessage(chatId, { text: '❌ Error al obtener tu perfil.' }, { quoted: msg });

            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }

            if (!inv['mis_waifus'] || inv['mis_waifus'].length === 0) {
                return sock.sendMessage(chatId, { text: '❌ No tienes waifus guardadas para borrar.' }, { quoted: msg });
            }

            delete inv['mis_waifus'];
            await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });

            return sock.sendMessage(chatId, {
                text: `🗑️ *Lista de waifus reseteada.*\n\nUsa *!waifus set* para crear una nueva.`
            }, { quoted: msg });
        }

        // ═══════════════════════════════════════
        // !waifus config <pos> <nombre>, <pos> <nombre>, ...
        // Cambiar waifus en posiciones específicas
        // ═══════════════════════════════════════
        if (subCmd === 'config') {
            const raw = args.slice(1).join(' ');
            if (!raw) {
                return sock.sendMessage(chatId, {
                    text: `⚙️ *CONFIGURAR WAIFUS* ⚙️\n\n` +
                        `Cambia waifus por posición sin tocar las demás.\n\n` +
                        `📌 *Un cambio:*\n` +
                        `!waifus config 5 Rias Gremory\n\n` +
                        `📌 *Varios cambios:*\n` +
                        `!waifus config 5 Rias, 9 Hinata, 1 Hana\n\n` +
                        `⚠️ Separa cada cambio con *coma (,)*.\n` +
                        `📊 Las posiciones van del *1 al 10*.\n` +
                        `🚫 No se permiten waifus *repetidas*.`
                }, { quoted: msg });
            }

            const u = await db.obtenerUsuario(sender);
            if (!u) return sock.sendMessage(chatId, { text: '❌ Error al obtener tu perfil.' }, { quoted: msg });

            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }

            const currentList = Array.isArray(inv['mis_waifus']) ? [...inv['mis_waifus']] : [];

            if (currentList.length === 0) {
                return sock.sendMessage(chatId, {
                    text: `❌ No tienes waifus guardadas.\n\nPrimero usa *!waifus set* para crear tu lista.`
                }, { quoted: msg });
            }

            // Parsear los cambios: "5 Rias, 9 Hinata, 1 Hana"
            const cambios = raw.split(',').map(c => c.trim()).filter(c => c.length > 0);
            const cambiosAplicados = [];
            const errores = [];

            for (const cambio of cambios) {
                // Separar el número de la posición del nombre
                const match = cambio.match(/^(\d+)\s+(.+)$/);
                if (!match) {
                    errores.push(`"${cambio}" → Formato inválido (usa: número nombre)`);
                    continue;
                }

                const pos = parseInt(match[1]);
                const nombre = match[2].trim();

                // Validar posición
                if (pos < 1 || pos > currentList.length) {
                    errores.push(`"${cambio}" → Posición *${pos}* no existe (tu lista tiene ${currentList.length})`);
                    continue;
                }

                // Verificar que no se repita con otra waifu existente (ignorar la posición que se va a cambiar)
                const listaSinPosActual = currentList.filter((_, i) => i !== pos - 1);
                // También verificar contra los cambios ya aplicados en este mismo comando
                const yaEnCambios = cambiosAplicados.map(c => c.nombre.toLowerCase());

                if (listaSinPosActual.some(w => w.toLowerCase() === nombre.toLowerCase()) ||
                    yaEnCambios.includes(nombre.toLowerCase())) {
                    errores.push(`"${nombre}" → Ya existe en tu lista (no se permiten repetidas)`);
                    continue;
                }

                cambiosAplicados.push({ pos, nombre, anterior: currentList[pos - 1] });
                currentList[pos - 1] = nombre;
            }

            if (cambiosAplicados.length === 0) {
                let errorMsg = `❌ No se pudo aplicar ningún cambio.\n\n`;
                if (errores.length > 0) {
                    errorMsg += `⚠️ *Errores:*\n`;
                    errores.forEach(e => errorMsg += `• ${e}\n`);
                }
                errorMsg += `\n📌 Formato correcto: *!waifus config 5 Rias, 9 Hinata*`;
                return sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
            }

            // Guardar la lista actualizada
            inv['mis_waifus'] = currentList;
            await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });

            // Construir mensaje de respuesta
            let response = `⚙️ *WAIFUS CONFIGURADAS* ⚙️\n`;
            response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            response += `📋 *Cambios realizados:*\n`;
            cambiosAplicados.forEach(c => {
                response += `  #${c.pos}: *${c.anterior}* → *${c.nombre}* ✅\n`;
            });

            if (errores.length > 0) {
                response += `\n⚠️ *Errores:*\n`;
                errores.forEach(e => response += `  • ${e}\n`);
            }

            response += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            response += `📊 *Tu lista actualizada:*\n\n`;

            const medals = ['👑', '💎', '🌟', '✨', '🎀', '💕', '🌸', '🎭', '💫', '🔮'];
            const posicionesCambiadas = cambiosAplicados.map(c => c.pos);
            currentList.forEach((w, i) => {
                const fueEditado = posicionesCambiadas.includes(i + 1);
                response += `${medals[i] || '•'} *${i + 1}.* ${w}${fueEditado ? ' ✏️' : ''}\n`;
            });

            return sock.sendMessage(chatId, { text: response }, { quoted: msg });
        }

        // ═══════════════════════════════════════
        // !waifus top / !waifus / !waifus @usuario
        // ═══════════════════════════════════════
        if (subCmd === 'top' || !subCmd || subCmd.startsWith('@')) {
            // Determinar si estamos viendo las waifus de otro usuario o las propias
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            let targetUser = sender;
            let isOtherUser = false;

            // Si mencionó a alguien con @ (puede ser !waifus @user o !waifus top @user)
            if (mentionedJids.length > 0) {
                targetUser = mentionedJids[0];
                isOtherUser = targetUser !== sender;
            }

            const u = await db.obtenerUsuario(targetUser);
            if (!u) return sock.sendMessage(chatId, { text: '❌ Error al obtener el perfil.' }, { quoted: msg });

            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { inv = {}; }

            const waifuList = inv['mis_waifus'];

            if (!waifuList || !Array.isArray(waifuList) || waifuList.length === 0) {
                if (isOtherUser) {
                    return sock.sendMessage(chatId, {
                        text: `😿 *@${targetUser.split('@')[0]}* no tiene waifus guardadas.`,
                        mentions: [targetUser]
                    }, { quoted: msg });
                }
                return sock.sendMessage(chatId, {
                    text: `😿 *¡NO TIENES WAIFUS GUARDADAS!*\n\n` +
                        `Usa *!waifus set* para configurar tu top.\n\n` +
                        `📌 Ejemplo:\n` +
                        `!waifus set Rem, Emilia, Zero Two`
                }, { quoted: msg });
            }

            const pushName = u.nombre_wa || targetUser.split('@')[0];

            let response = `🏆 *TOP WAIFUS DE ${pushName.toUpperCase()}* 🏆\n`;
            response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            const podium = ['👑 𝟏𝐬𝐭', '💎 𝟐𝐧𝐝', '🌟 𝟑𝐫𝐝'];
            waifuList.forEach((w, i) => {
                if (i < 3) {
                    response += `${podium[i]} ║ *${w}*\n`;
                } else {
                    const num = `${i + 1}`.padStart(2, ' ');
                    const icons = ['✨', '🎀', '💕', '🌸', '🎭', '💫', '🔮'];
                    response += `${icons[i - 3] || '•'} ${num}. ${w}\n`;
                }
            });

            response += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            response += `📊 *${waifuList.length}/10* waifus en la lista.\n`;
            response += `> _El buen gusto se nota._`;

            const mentions = isOtherUser ? [targetUser] : [];
            return sock.sendMessage(chatId, { text: response, mentions }, { quoted: msg });
        }

        // ═══════════════════════════════════════
        // !waifus random - 10 waifus random de internet
        // ═══════════════════════════════════════
        if (subCmd === 'random') {
            await sock.sendMessage(chatId, { text: '🎲 *Buscando 10 waifus aleatorias...* ⏳' }, { quoted: msg });

            const categories = ['waifu', 'neko', 'shinobu', 'megumin', 'waifu', 'neko', 'waifu', 'waifu', 'neko', 'waifu'];

            // Obtener 10 imágenes en paralelo para velocidad
            const promises = categories.map(async (cat, index) => {
                try {
                    const res = await axios.get(`https://api.waifu.pics/sfw/${cat}`, { timeout: 8000 });
                    return { index, url: res.data.url, ok: true };
                } catch (e) {
                    return { index, ok: false };
                }
            });

            const results = await Promise.all(promises);
            const successful = results.filter(r => r.ok).sort((a, b) => a.index - b.index);

            if (successful.length === 0) {
                return sock.sendMessage(chatId, { text: '❌ No se pudieron obtener waifus. Intenta de nuevo más tarde.' }, { quoted: msg });
            }

            // Enviar header
            let header = `🎲 *¡${successful.length} WAIFUS ALEATORIAS!* 🎲\n`;
            header += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            header += `_Enviando una por una..._`;
            await sock.sendMessage(chatId, { text: header });

            // Enviar cada waifu como imagen
            let enviadas = 0;
            for (const waifu of successful) {
                try {
                    const imgRes = await axios.get(waifu.url, { responseType: 'arraybuffer', timeout: 10000 });
                    enviadas++;
                    await sock.sendMessage(chatId, {
                        image: Buffer.from(imgRes.data),
                        caption: `🎀 *Waifu #${enviadas}/${successful.length}*`
                    });
                    // Pausa para evitar flood/ban de WhatsApp
                    if (enviadas < successful.length) await delay(1500);
                } catch (e) {
                    console.error(`❌ Error descargando waifu #${waifu.index + 1}:`, e.message);
                }
            }

            // Mensaje final
            await sock.sendMessage(chatId, {
                text: `✅ *¡Listo!* Se enviaron *${enviadas}* waifus aleatorias.\n\n` +
                    `💡 ¿Te gustaron? Guarda tus favoritas con:\n` +
                    `*!waifus set <nombre1>, <nombre2>, ...*`
            });

            return;
        }

        // ═══════════════════════════════════════
        // !waifus reto / !waifus retos - Juego de memorización (10 waifus)
        // ═══════════════════════════════════════
        if (subCmd === 'reto' || subCmd === 'retos') {
            if (botState.juegos[chatId]) {
                return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
            }

            const waifusMaster = [
                'Rem', 'Emilia', 'Zero Two', 'Mikasa Ackerman', 'Hinata Hyuga', 'Nami', 'Boa Hancock', 'Aqua',
                'Megumin', 'Rias Gremory', 'Nezuko Kamado', 'Erza Scarlet', 'Asuna Yuuki', 'Kurumi Tokisaki',
                'Makima', 'Yor Forger', 'Marin Kitagawa', 'Raphtalia', 'Esdeath', 'Lucy', 'Power',
                'Shinobu Kocho', 'Mitsuri Kanroji', 'Saber', 'Rin Tohsaka', 'Violet Evergarden', 'Kaguya Shinomiya',
                'Chika Fujiwara', 'Miku Nakano', 'Nino Nakano', 'Itsuki Nakano', 'Yotsuba Nakano', 'Ichika Nakano',
                'Shouko Komi', 'Tohru', 'Kanna Kamui', 'Holo', 'C.C.', 'Ryuko Matoi', 'Satsuki Kiryuin',
                'Jolyne Cujoh', 'Revy', 'Fujiko Mine', 'Motoko Kusanagi', 'Faye Valentine', 'Winry Rockbell',
                'Olivier Mira Armstrong', 'Tsunade', 'Sakura Haruno', 'Rukia Kuchiki', 'Orihime Inoue',
                'Rangiku Matsumoto', 'Yoruichi Shihoin', 'Bulma', 'Android 18', 'Videl', 'Kushina Uzumaki',
                'Temari', 'Shizune', 'Konan', 'Ino Yamanaka', 'Nico Robin', 'Nefertari Vivi', 'Perona',
                'Reiju Vinsmoke', 'Tashigi', 'Hiyori Kozuki', 'Yamato', 'Carrot', 'Lucy Heartfilia',
                'Juvia Lockser', 'Wendy Marvell', 'Mirajane Strauss', 'Cana Alberona', 'Mavis Vermillion',
                'Kagura', 'Tsukuyo', 'Nobume Imai', 'Kyuubei Yagyuu', 'Sarutobi Sacchan', 'Elizabeth Liones',
                'Diane', 'Merlin', 'Elaine', 'Touka Kirishima', 'Rize Kamishiro', 'Akira Mado', 'Eto Yoshimura',
                'Hinami Fueguchi', 'Morgiana', 'Kougyoku Ren', 'Sheba', 'Hakuei Ren', 'Neferpitou',
                'Bisky', 'Shizuku', 'Machi', 'Pakunoda', 'Alluka Zoldyck', 'Ochaco Uraraka',
                'Tsuyu Asui', 'Momo Yaoyorozu', 'Kyoka Jiro', 'Mina Ashido', 'Nejire Hado', 'Mirko',
                'Midnight', 'Mount Lady', 'Ryukyu', 'Himiko Toga', 'Lady Nagant', 'Ram', 'Beatrice',
                'Frederica Baumann', 'Petra Leyte', 'Crusch Karsten', 'Priscilla Barielle', 'Anastasia Hoshin',
                'Felt', 'Echidna', 'Darkness', 'Wiz', 'Yunyun', 'Eris', 'Filo', 'Melty Q Melromarc',
                'Mirellia Q Melromarc', 'Rishia Ivyred', 'Roxy Migurdia', 'Sylphiette', 'Eris Boreas Greyrat',
                'Ghislaine Dedoldia', 'Zenith Greyrat', 'Lilia', 'Elinalise Dragonroad', 'Nanahoshi Shizuka',
                'Hestia', 'Ais Wallenstein', 'Ryuu Lion', 'Liliuka Arde', 'Syr Flover', 'Freya',
                'Tiona Hiryute', 'Tione Hiryute', 'Lefiya Viridis', 'Haruhime Sanjouno', 'Eina Tulle',
                'Mikoto Yamato', 'Anya Fromel', 'Chloe Lolo', 'Alise Lovell', 'Kaguya Houraisan'
            ];

            // Mezclar y elegir 10
            const chosen = [...waifusMaster].sort(() => 0.5 - Math.random()).slice(0, 10);

            let followUp = `🏆 *DESAFÍO BLIND RANKING* 🏆\n`;
            followUp += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            followUp += `Te daré 10 waifus, una por una. Tienes que darles una posición del 1 al 10 sin saber cuáles siguen.\n\n`;
            followUp += `🎀 *1/10:* ${chosen[0]}\n\n`;
            followUp += `👉 ¿Qué posición le das?\n`;
            followUp += `🔢 Disponibles: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`;

            const sentMsg = await sock.sendMessage(chatId, { text: followUp }, { quoted: msg });

            // Iniciar juego
            botState.juegos[chatId] = {
                tipo: 'reto_waifus',
                responder: sender,
                lista: chosen,
                currentIndex: 0,
                userRankings: {},
                availableNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                msgId: sentMsg.key.id,
                startTime: Date.now(),
                timer: setTimeout(async () => {
                    if (botState.juegos[chatId] && botState.juegos[chatId].msgId === sentMsg.key.id) {
                        delete botState.juegos[chatId];
                        await sock.sendMessage(chatId, { text: `⏰ *TIEMPO AGOTADO* ⏰\n@${sender.split('@')[0]} tardó demasiado en elegir.`, mentions: [sender] });
                    }
                }, 180000) // 3 minutos
            };
            return;
        }

        // Si el subcomando no es reconocido, mostrar ayuda
        return sock.sendMessage(chatId, {
            text: `🎀 *SISTEMA DE WAIFUS* 🎀\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📋 *Comandos disponibles:*\n\n` +
                `🏆 *!waifus top*\n` +
                `_→ Ver tu top de waifus._\n\n` +
                `🏆 *!waifus* @usuario\n` +
                `_→ Ver las waifus de alguien._\n\n` +
                `📝 *!waifus set* <lista>\n` +
                `_→ Agregar waifus a tu lista._\n` +
                `_Se agregan a las existentes, sin repetir._\n` +
                `_Ejemplo: !waifus set Rem, Emilia, Zero Two_\n\n` +
                `⚙️ *!waifus config* <pos> <nombre>\n` +
                `_→ Cambiar waifus en posiciones específicas._\n` +
                `_Ejemplo: !waifus config 5 Rias, 9 Hinata_\n\n` +
                `🗑️ *!waifus reset*\n` +
                `_→ Borrar tu lista y empezar de cero._\n\n` +
                `🎲 *!waifus random*\n` +
                `_→ 10 waifus aleatorias de internet._\n\n` +
                `🏆 *!waifus reto*\n` +
                `_→ Juego de memorización y rapidez._\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }
};
