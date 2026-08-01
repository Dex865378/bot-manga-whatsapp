/**
 * 💰 MÓDULO DE ECONOMÍA Y SOCIAL
 */
const { findPetData, calcATK } = require('./mascotas.js');
module.exports = {
    name: 'economy',
    isMultiple: true,
    names: ['!daily', '!w', '!slut', '!robar', '!perfil', '!p', '!profile', '!tienda', '!comprar', '!inventario', '!mejor', '!bounty', '!dar', '!canjear', '!marry', '!divorce', '!regalaritem', '!regalar', '!clase', '!prestigio', '!loteria'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, sender, isGroup, isGlobalAdmin, db, botState, delay, ADMIN_NUM }) {

        // !clase <nombre>
        if (start === '!clase') {
            const u = await db.obtenerUsuario(sender);
            const classes = {
                'cazador': '🏹 Cazador (+20% recompensas en !cazar)',
                'pescador': '🎣 Pescador (+20% peso en !pescar)',
                'apostador': '🎰 Apostador (+15% premio en !slot)',
                'empresario': '💼 Empresario (+1000 dikys extra en !daily)',
                'hacker': '💻 Hacker (-10% coste en !comprar)',
                'minero': '⛏️ Minero (+15% recompensas en !minar)',
                'guerrero': '⚔️ Guerrero (+10% fuerza en duelos)',
                'mercader': '📦 Mercader (+20% ganar en subastas)',
                'sacerdote': '⛪ Sacerdote (+50% XP en todos los comandos)'
            };

            const chosen = args[0]?.toLowerCase();
            if (!chosen || !classes[chosen]) {
                let m = '🎭 **SISTEMA DE CLASES**\n━━━━━━━━━━━━━━\n';
                Object.entries(classes).forEach(([k, v]) => { m += `• *!clase ${k}*: ${v}\n`; });
                m += '━━━━━━━━━━━━━━\n⚠️ _Cambiar de clase cuesta 20,000 diky. (Gratis la primera vez)_';
                return sock.sendMessage(chatId, { text: m }, { quoted: msg });
            }

            const balance = await db.obtenerBalance(sender);
            if (u.clase !== 'Novato' && u.clase !== null && balance < 20000) {
                return sock.sendMessage(chatId, { text: '💸 Necesitas 20,000 diky para cambiar de clase.' }, { quoted: msg });
            }

            if (u.clase !== 'Novato' && u.clase !== null) {
                const ok = await db.deducirMonedas(sender, 20000);
                if (!ok) return sock.sendMessage(chatId, { text: '❌ No se pudo procesar el pago.' });
            }
            await db.actualizarUsuario(sender, {
                clase: chosen.charAt(0).toUpperCase() + chosen.slice(1),
                clase_fin: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 días
            });
            return sock.sendMessage(chatId, { text: `🎭 ¡Ahora eres un **${chosen.toUpperCase()}**!\n📅 Tu licencia expira en: *7 días*.` }, { quoted: msg });
        }

        // !perfil
        if (['!perfil', '!p', '!profile'].includes(start)) {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const targetId = ment.length > 0 ? ment[0] : sender;
            const [u, mascotaPrincipal] = await Promise.all([
                db.obtenerUsuario(targetId),
                db.getMascotaPrincipal(targetId)
            ]);
            if (!u) return sock.sendMessage(chatId, { text: '❌ Perfil no encontrado.' });

            let logros = {};
            try { logros = JSON.parse(u.logros || '{}'); } catch (e) { }
            let nuevosLogros = false;
            if (!logros.millonario && u.monedas >= 100000) { logros.millonario = true; nuevosLogros = true; }
            if (!logros.leyenda && u.nivel >= 50) { logros.leyenda = true; nuevosLogros = true; }
            if (!logros.gladiador && u.duelos_ganados >= 50) { logros.gladiador = true; nuevosLogros = true; }

            if (nuevosLogros) await db.actualizarUsuario(targetId, { logros: JSON.stringify(logros) });

            const bio = u.descripcion || 'Sin descripción...';
            const winRate = ((u.duelos_ganados || 0) / (((u.duelos_ganados || 0) + (u.duelos_perdidos || 0)) || 1) * 100).toFixed(1);

            let lEmoji = '';
            if (logros.millonario) lEmoji += '💰';
            if (logros.leyenda) lEmoji += '👑';
            if (logros.gladiador) lEmoji += '⚔️';

            const ahora = Date.now();
            if (u.clase !== 'Novato' && u.clase_fin > 0 && ahora > u.clase_fin) {
                await db.actualizarUsuario(targetId, { clase: 'Novato', clase_fin: 0 });
                u.clase = 'Novato';
            }

            let pText = `👤 **PERFIL DE USUARIO** ${lEmoji}\n━━━━━━━━━━━━━━\n`;
            pText += `📛 **Nombre:** ${u.nombre_wa || u.nombre || targetId.split('@')[0]}\n`;

            const diasClase = u.clase_fin > ahora ? Math.ceil((u.clase_fin - ahora) / (24 * 60 * 60 * 1000)) : 0;
            pText += `🎭 **Clase:** ${u.clase || 'Novato'} ${diasClase > 0 ? `(⌛ ${diasClase}d)` : ''}\n`;
            if (u.titulo) pText += `🏅 **Título:** ${u.titulo}\n`;
            if (u.prestigio > 0) pText += `🌌 **Prestigio:** Nivel ${u.prestigio} (Mult. x${(1 + u.prestigio * 0.1).toFixed(1)})\n`;
            if (u.recompensa > 0) pText += `🎯 **Recompensa:** ${u.recompensa} diky\n`;
            if (u.edad) pText += `📅 **Edad:** ${u.edad} años\n`;
            if (u.nacimiento) pText += `🎂 **Nacimiento:** ${u.nacimiento}\n`;
            if (u.altura) pText += `📏 **Altura:** ${u.altura}\n`;
            if (u.superpoder) pText += `⚡ **Poder:** ${u.superpoder}\n`;

            const getRango = (lvl) => {
                if (lvl >= 500) return '🔱 Deidad';
                if (lvl >= 400) return '🌀 Maestro Elemental';
                if (lvl >= 300) return '🔥 Sannin';
                if (lvl >= 200) return '⚡ Kage';
                if (lvl >= 150) return '🔴 Jonin Especial';
                if (lvl >= 100) return '🛡️ Jonin';
                if (lvl >= 50) return '🏹 Chunin';
                if (lvl >= 20) return '🗡️ Genin';
                return '🌱 Estudiante';
            };
            const isGod = u.nivel >= 9999;
            pText += `🏅 **Rango:** ${getRango(u.nivel)} (Lvl ${isGod ? '∞' : u.nivel})\n`;
            pText += `✨ **XP:** ${isGod ? '∞' : (u.xp || 0)}/${isGod ? '∞' : ((u.nivel || 1) * 200)} | 💰 **diky:** ${isGod ? '∞' : u.monedas}\n`;

            if (u.anime_fav) pText += `📺 **Anime Fav:** ${u.anime_fav}\n`;
            if (u.manga_fav) pText += `📖 **Manga Fav:** ${u.manga_fav}\n`;
            if (u.waifu_husbando) pText += `👫 **Waifu/Hus:** ${u.waifu_husbando}\n`;

            // ✨ Apartado de Top 1 Waifu (desde su lista personalizada)
            let invObj = {}; try { invObj = JSON.parse(u.inventario || '{}'); } catch (e) { }
            const miTop = invObj['mis_waifus'];
            if (miTop && Array.isArray(miTop) && miTop.length > 0) {
                pText += `👑 **Top 1 Waifu:** ${miTop[0]}\n`;
            }

            pText += `⚔️ **Duelos:** ${u.duelos_ganados}V | ${u.duelos_perdidos || 0}D (${winRate}%)\n`;

            let tools = [];
            if (u.pico_usos > 0) tools.push(`⛏️ Pico: ${u.pico_usos} usos`);
            if (u.cebo_usos > 0) tools.push(`🎣 Cebo: ${u.cebo_usos} usos`);
            if (u.brujula_usos > 0) tools.push(`🧭 Brújula: ${u.brujula_usos} usos`);
            if (tools.length > 0) pText += `🛠️ **Herramientas:** ${tools.join(' | ')}\n`;

            if (u.record_pesca) pText += `🎣 **Mejor Pesca:** ${u.record_pesca}\n`;
            pText += `💍 **Casad@:** ${u.pareja ? '@' + u.pareja.split('@')[0] : 'Solter@'}\n`;
            
            // --- MOSTRAR MASCOTA (nuevo sistema mascotas_usuario) ---
            if (mascotaPrincipal) {
                const pd = findPetData(mascotaPrincipal.tipo);
                const eV = mascotaPrincipal.version > 0 ? ` v${mascotaPrincipal.version}` : '';
                const esPrincipalLabel = mascotaPrincipal.cantidad > 1 ? ` ×${mascotaPrincipal.cantidad}` : '';
                pText += `🐾 **Mascota:** ${pd?.e || '🐾'} *${mascotaPrincipal.tipo}${eV}*${esPrincipalLabel} | ♥️ ${mascotaPrincipal.hambre || 0}% hambre\n`;
            } else {
                pText += `🐾 **Mascota:** _Ninguna_ (usa *!comprar <nombre>*)\n`;
            }

            pText += `📝 **Bio:** _${bio}_\n`;
            pText += `━━━━━━━━━━━━━━`;

            return sock.sendMessage(chatId, { text: pText, mentions: u.pareja ? [targetId, u.pareja] : [targetId] }, { quoted: msg });
        }

        // !daily
        if (start === '!daily') {
            const pick = (v) => v[Math.floor(Math.random() * v.length)];
            const u = await db.obtenerUsuario(sender);
            const ahora = Date.now();
            const cd = 24 * 60 * 60 * 1000;

            const waitMsgs = [
                '⏳ *¡Paciencia!* Aún no es tiempo de tu tributo diario.',
                '⏳ *Cálmate.* Tus arcas se están llenando, vuelve en unas horas.',
                '⏳ *Vuelve mañana.* El banco de Diky no regala dinero dos veces al día.',
                '⏳ *Shhh...* El recolector de impuestos está durmiendo. Vuelve mañana.',
                '⏳ Todavía no puedes reclamar tu recompensa. ¡Sigue esforzándote!',
                '⏳ No seas avaricioso, espera a que pase el tiempo reglamentario.'
            ];

            if (ahora - (u.last_daily || 0) < cd) return sock.sendMessage(chatId, { text: pick(waitMsgs) }, { quoted: msg });

            let premio = 5000;
            if (u.clase === 'Empresario') premio += 1000;
            await db.sumarMonedas(sender, premio);
            await db.actualizarUsuario(sender, { last_daily: ahora });

            const winMsgs = [
                `💰 *¡RECOMPENSA DIARIA!* 💰\n\nHas recibido *${premio}* diky por ser un ciudadano ejemplar.`,
                ` ✨ *Diky Fortune* ✨\n\n¡Felicidades! Se han depositado *${premio}* diky en tu cuenta personal.`,
                `💴 *Depósito Recibido* 💴\n\nTu recompensa diaria de *${premio}* diky ha sido procesada con éxito.`,
                `💎 *Tesoro Diario* 💎\n\nHas encontrado un pequeño botín de *${premio}* diky en el camino.`,
                `🚀 *Impulso Económico* 🚀\n\n¡Toma estos *${premio}* diky y conquista el mercado!`,
                `🌟 *Bendición de Diky* 🌟\n\nEl dios de la economía te otorga *${premio}* diky por tu constancia.`
            ];
            return sock.sendMessage(chatId, { text: pick(winMsgs) + '\n\n¡Vuelve mañana para más!' }, { quoted: msg });
        }

        // !tienda
        if (start === '!tienda') {
            const itms = [
                '📦 **BÁSICOS**',
                '1. Pico de Platino - ⛏️ 10k (50 usos)',
                '2. Cebo Legendario - 🎣 5k (50 usos)',
                '3. Ticket Lotería - 🎫 1k',
                '\n🛡️ **PROTECCIÓN**',
                '4. Escudo de Oro - 🛡️ 8k (Prot. robos 2h)',
                '5. Guardaespalda - 👤 20k (Inmunidad duelos 2h)',
                '\n🎭 **ESPECIALES**',
                '6. Tarjeta Silencio - 🔇 12k (Callar a alguien 5m)',
                '7. Poción de XP - 🧪 10k (+1000 XP)',
                '8. Fruta del Diablo - 🍎 25k (Efectos variados)',
                '9. Anillo de Bodas - 💍 75k (Necesario p/ casarse)',
                '11. Brújula del Destino - 🧭 12k (50 usos)',
                '12. Poción de Suerte - 🍀 25k (+Luck en juegos 2h)',
                '14. Pokebola - 🔴 2k',
                '15. Comida Mascota - 🥩 500 (Sacia el hambre)',
                '\n💎 **MÍTICOS**',
                '10. Grimorio de Diky - 📖 250k (Poder ancestral)',
                '13. Fragmento Estelar - ✨ 500k (¿?)'
            ];
            return sock.sendMessage(chatId, { text: `🛒 **TIENDA DIKY - STOCK ACTUAL**\n━━━━━━━━━━━━━━\n${itms.join('\n')}\n━━━━━━━━━━━━━━\n💡 !comprar <número>` });
        }

        // !comprar
        if (start === '!comprar') {
            const u = await db.obtenerUsuario(sender);
            const num = parseInt(args[0]);
            const pType = args[0]?.toLowerCase();
            const petTypes = {
                // Perro — múltiples alias
                'comun': { e: '🐶', n: 'Perro', p: 5000 },
                'perro': { e: '🐶', n: 'Perro', p: 5000 },
                'dog': { e: '🐶', n: 'Perro', p: 5000 },
                // Gato
                'gato': { e: '🐱', n: 'Gato', p: 5000 },
                'cat': { e: '🐱', n: 'Gato', p: 5000 },
                // Lobo
                'lobo': { e: '🐺', n: 'Lobo Hunter', p: 15000 },
                'wolf': { e: '🐺', n: 'Lobo Hunter', p: 15000 },
                // Zorro
                'zorro': { e: '🦊', n: 'Zorro Astuto', p: 12000 },
                'fox': { e: '🦊', n: 'Zorro Astuto', p: 12000 },
                // Dragón
                'dragon': { e: '🐲', n: 'Dragón Imperial', p: 100000 },
                'dragón': { e: '🐲', n: 'Dragón Imperial', p: 100000 },
                // Fénix
                'fenix': { e: '🔥', n: 'Fénix Renacido', p: 80000 },
                'fénix': { e: '🔥', n: 'Fénix Renacido', p: 80000 },
                'phoenix': { e: '🔥', n: 'Fénix Renacido', p: 80000 },
                // Pikachu
                'pikachu': { e: '⚡', n: 'Pikachu', p: 50000 },
                'pika': { e: '⚡', n: 'Pikachu', p: 50000 },
                // Mewtwo
                'mewtwo': { e: '👾', n: 'Mewtwo', p: 250000 }
            };

            const balance = await db.obtenerBalance(sender);

            // Normalizar input: quitar tildes y convertir a minúsculas para evitar fallos
            const pTypeNorm = (pType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

            // Si no es número, probar compra de mascota del catálogo
            if (isNaN(num)) {
                const tipoQ = args.join(' ').trim();
                if (!tipoQ) return sock.sendMessage(chatId, { text: '❌ Escribe el nombre de la mascota o el número del item.\n💡 _Ej: !comprar T-Rex_ o _!comprar 15_' }, { quoted: msg });

                const petData = findPetData(tipoQ);
                if (!petData) return sock.sendMessage(chatId, { text: `❌ No encontré *${tipoQ}*. Revisa las categorías con *!mascotas* o usa *!tienda* para ver items.` }, { quoted: msg });

                if ((u?.monedas || 0) < petData.precio) {
                    return sock.sendMessage(chatId, { text: `💸 No tienes suficiente. Necesitas *${petData.precio.toLocaleString()} Diky*.\nTienes: *${(u?.monedas || 0).toLocaleString()}*` }, { quoted: msg });
                }

                const cant = await db.getCantidadMascota(sender, petData.tipo);
                if (cant >= 50) return sock.sendMessage(chatId, { text: `⚠️ Ya tienes 50 *${petData.tipo}*. Ese es el máximo por tipo.` }, { quoted: msg });

                await db.sumarMonedas(sender, -petData.precio);
                const res = await db.agregarMascota(sender, petData.tipo, petData.categoria);
                if (!res.ok) return sock.sendMessage(chatId, { text: `❌ Error: ${res.msg}` }, { quoted: msg });

                return sock.sendMessage(chatId, { text:
`${petData.e} *¡MASCOTA ADOPTADA!*
━━━━━━━━━━━━━━━━━━━━━━
🐾 *${petData.tipo}* se une a tu parque
💰 Pagaste: *${petData.precio.toLocaleString()} Diky*
⚔️ ATK Base: *${petData.atk}* | Tipo: *${petData.atkTipo}*
🍖 Aliéntala con *!alimentar* — cada 100 comidas evoluciona!
━━━━━━━━━━━━━━━━━━━━━━`
                }, { quoted: msg });
            }
            const items = {
                1: { n: 'Pico de Platino', p: 10000, key: 'pico_usos', type: 'uses', amount: 50 },
                2: { n: 'Cebo Legendario', p: 5000, key: 'cebo_usos', type: 'uses', amount: 50 },
                3: { n: 'Ticket Lotería', p: 1000, key: 'loteria', type: 'loteria' },
                4: { n: 'Escudo de Oro', p: 8000, key: 'escudo_fin', type: 'timer', duration: 7200000 },
                5: { n: 'Guardaespalda', p: 20000, key: 'guardaespalda_fin', type: 'timer', duration: 7200000 },
                6: { n: 'Tarjeta Silencio', p: 12000, key: 'silencio', type: 'target_timer' },
                7: { n: 'Poción Sabiduría', p: 10000, key: 'xp', type: 'instant_xp', val: 1000 },
                8: { n: 'Fruta del Diablo', p: 25000, key: 'fruta', type: 'random_effect' },
                9: { n: 'Anillo de Bodas', p: 75000, key: 'anillo', type: 'item' },
                10: { n: 'Grimorio de Diky', p: 250000, key: 'grimorio', type: 'mythic_effect' },
                11: { n: 'Brújula del Destino', p: 12000, key: 'brujula_usos', type: 'uses', amount: 50 },
                12: { n: 'Poción de Suerte', p: 25000, key: 'luck_fin', type: 'timer', duration: 7200000 },
                13: { n: 'Fragmento Estelar', p: 500000, key: 'fragmento', type: 'item' },
                14: { n: 'Pokebola', p: 2000, key: 'pokebola', type: 'item' },
                15: { n: 'Comida Mascota', p: 500, key: 'comida', type: 'item_food' }
            };
            const it = items[num];
            if (!it) return sock.sendMessage(chatId, { text: '❌ Item o mascota no válida. Usa !tienda o !mascotas p/ ver.' });

            let finalPrice = it.p;
            if (u.clase === 'Hacker') finalPrice = Math.floor(it.p * 0.9);

            if (balance < finalPrice) return sock.sendMessage(chatId, { text: '💸 No tienes suficiente capital (ni con tu pareja).' });

            const ok = await db.deducirMonedas(sender, finalPrice);
            if (!ok) return sock.sendMessage(chatId, { text: '❌ Error al procesar el pago bancario.' });

            let logMsg = `✅ ¡Has comprado y activado **${it.n.toUpperCase()}**!`;
            const ahora = Date.now();

            switch (it.type) {
                case 'timer':
                    const currentTimer = u[it.key] > ahora ? u[it.key] : ahora;
                    await db.actualizarUsuario(sender, { [it.key]: currentTimer + it.duration });
                    logMsg += ` ⏳ Duración: 2 horas.`;
                    break;
                case 'uses':
                    const currentUses = u[it.key] || 0;
                    await db.actualizarUsuario(sender, { [it.key]: currentUses + it.amount });
                    logMsg = `✅ ¡Has comprado **${it.n.toUpperCase()}**!\n🔋 Tienes *${currentUses + it.amount}* usos disponibles.`;
                    break;
                case 'item_food':
                    const invF = JSON.parse(u.inventario || '{}');
                    invF.comida = (invF.comida || 0) + 1;
                    await db.actualizarUsuario(sender, { inventario: JSON.stringify(invF) });
                    logMsg = `✅ ¡Has comprado **COMIDA PARA MASCOTA**! Úsala con *!alimentar*.`;
                    break;
                case 'loteria':
                    if (!botState.loteria) botState.loteria = { participantes: [], pozo: 0 };
                    botState.loteria.participantes.push(sender);
                    botState.loteria.pozo += 1000;
                    logMsg = `🎫 ¡Ticket de Lotería activado! Estás participando en el próximo sorteo. Pozo actual: *${botState.loteria.pozo}* diky.`;
                    break;
                case 'instant_xp':
                    await db.sumarXP(sender, it.val);
                    logMsg = `🧪 ¡Poción consumida! Has ganado *${it.val}* XP de inmediato.`;
                    break;
                case 'target_timer':
                    const sMent = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    if (!sMent[0]) {
                        logMsg = `🔇 Compraste la Tarjeta Silencio, pero no mencionaste a nadie. Se ha guardado en tu inventario.`;
                        let invS = JSON.parse(u.inventario || '{}'); invS['silencio'] = (invS['silencio'] || 0) + 1;
                        await db.actualizarUsuario(sender, { inventario: JSON.stringify(invS) });
                    } else {
                        const targetUser = await db.obtenerUsuario(sMent[0]);
                        if (targetUser && targetUser.escudo_fin > ahora) {
                            return sock.sendMessage(chatId, { text: `🛡️ ¡EL ESCUDO DE ORO HA PROTEGIDO A @${sMent[0].split('@')[0]}! La Tarjeta Silencio se ha roto sin efecto.`, mentions: [sMent[0]] }, { quoted: msg });
                        }
                        botState.silenciados[sMent[0]] = ahora + 300000;
                        const tname = sMent[0].split('@')[0];
                        return sock.sendMessage(chatId, { text: `🔇 @${tname} ha sido silenciado por 5 minutos.`, mentions: [sMent[0]] }, { quoted: msg });
                    }
                    break;
                case 'random_effect':
                    const rand = Math.random();
                    if (rand < 0.1) {
                        await db.sumarMonedas(sender, 12000);
                        logMsg = `🍎 ¡FRUTA MÍTICA! Has digerido energía pura. +12,000 diky.`;
                    } else if (rand < 0.25) {
                        await db.sumarXP(sender, 3000);
                        logMsg = `🍎 ¡FRUTA DESPERTA! Tu nivel de poder sube drásticamente. +3000 XP.`;
                    } else if (rand < 0.4) {
                        await db.actualizarUsuario(sender, { titulo: '🔥 Portador del Fuego' });
                        logMsg = `🍎 ¡FRUTA MERA MERA! Has obtenido el título: **Portador del Fuego**.`;
                    } else if (rand < 0.5) {
                        await db.actualizarUsuario(sender, { titulo: '⚡ Rayo Humano' });
                        logMsg = `🍎 ¡FRUTA GORO GORO! Has obtenido el título: **Rayo Humano**.`;
                    } else if (rand < 0.6) {
                        await db.actualizarUsuario(sender, { titulo: '❄️ Corazón de Hielo' });
                        logMsg = `🍎 ¡FRUTA HIE HIE! Has obtenido el título: **Corazón de Hielo**.`;
                    } else if (rand < 0.7) {
                        await db.sumarMonedas(sender, -5000);
                        logMsg = `🤢 ¡FRUTA PODRIDA! Sabía horrible. Perdiste 5,000 diky por gastos médicos.`;
                    } else if (rand < 0.85) {
                        await db.sumarXP(sender, 1200);
                        logMsg = `🍎 ¡FRUTA ZOAN! Te sientes más fuerte. +1200 XP.`;
                    } else {
                        await db.actualizarUsuario(sender, { titulo: '🎭 Usuario de Fruta' });
                        logMsg = `🍎 ¡La Fruta del Diablo era común! Título: **Usuario de Fruta** ganado.`;
                    }
                    break;
                case 'mythic_effect':
                    const mRand = Math.random();
                    if (mRand < 0.2) {
                        await db.sumarMonedas(sender, 60000);
                        logMsg = `📖 **GRIMORIO ANCESTRAL**: Las páginas brillan y tu bolsillo se llena de oro. +60,000 diky.`;
                    } else if (mRand < 0.4) {
                        await db.sumarXP(sender, 15000);
                        logMsg = `📖 **GRIMORIO ANCESTRAL**: Has absorbido conocimientos prohibidos. +15,000 XP.`;
                    } else if (mRand < 0.6) {
                        const prest = (u.prestigio || 0) + 1;
                        await db.actualizarUsuario(sender, { prestigio: prest, nivel: u.nivel + 50 });
                        logMsg = `📖 **GRIMORIO ANCESTRAL**: ¡MAGIA NEGRA! Has ascendido de prestigio y ganado +50 niveles de golpe.`;
                    } else if (mRand < 0.8) {
                        await db.actualizarUsuario(sender, { titulo: '🌌 Archimaggo Supremo' });
                        logMsg = `📖 **GRIMORIO ANCESTRAL**: Te has convertido en una leyenda viviente. Título: **Archimaggo Supremo**.`;
                    } else {
                        await db.sumarMonedas(sender, 30000);
                        await db.sumarXP(sender, 8000);
                        logMsg = `📖 **GRIMORIO ANCESTRAL**: Un equilibrio perfecto de poder y riqueza. +30k diky | +8k XP.`;
                    }
                    break;
                default:
                    let inv = JSON.parse(u.inventario || '{}');
                    inv[it.key] = (inv[it.key] || 0) + 1;
                    await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });
                    break;
            }

            return sock.sendMessage(chatId, { text: logMsg }, { quoted: msg });
        }

        // !prestigio (Dificultad progresiva y COSTOSA)
        if (start === '!prestigio') {
            const u = await db.obtenerUsuario(sender);
            const prestActual = u.prestigio || 0;
            const reqLvl = (prestActual + 1) * 500;
            const reqDiky = (prestActual + 1) * 50000;

            if (u.nivel < reqLvl || u.monedas < reqDiky) {
                return sock.sendMessage(chatId, {
                    text: `👑 **SISTEMA DE PRESTIGIO**\n━━━━━━━━━━━━━━\nSiguiente ascenso (Prestigio ${prestActual + 1}):\n✨ Nivel Requerido: **${reqLvl}**\n💰 Costo: **${reqDiky}** diky\n\n✨ Al ascender:\n1. Nivel se reinicia a 1.\n2. Ganas +1 Rango de Prestigio.\n3. Multiplicador de monedas: **+10%**.\n━━━━━━━━━━━━━━\n🎯 Tienes: Lvl ${u.nivel} | ${u.monedas} diky`
                });
            }

            await db.deducirMonedas(sender, reqDiky);
            const nuevoPrestigio = (u.prestigio || 0) + 1;
            await db.actualizarUsuario(sender, {
                nivel: 1,
                xp: 0,
                prestigio: nuevoPrestigio,
                titulo: `🌌 Ascendente ${nuevoPrestigio}`
            });
            return sock.sendMessage(chatId, { text: `👑 ¡DIOS MÍO! **${u.nombre_wa || sender.split('@')[0]}** ha pagado su tributo y ascendido al Prestigio **${nuevoPrestigio}**.\n\n✨ ¡Título ganado: **🌌 Ascendente ${nuevoPrestigio}**!\n\nReinicias al Lvl 1 con un multiplicador de dikys del **+${nuevoPrestigio * 10}%**.` });
        }

        // !w, !slut
        if (start === '!w' || start === '!slut') {
            const pick = (v) => v[Math.floor(Math.random() * v.length)];
            const u = await db.obtenerUsuario(sender);
            const ahora = Date.now();
            const esW = start === '!w';
            const cd = esW ? 3600000 : 1200000;
            const last = esW ? u.last_work : u.last_slut;

            const waitMsgs = [
                '⏳ Estás agotado. Tómate un respiro antes de seguir.',
                '⏳ Tu cuerpo no da para más. Descansa un poco.',
                '⏳ El sindicato de Diky exige que descanses.',
                '⏳ ¡Hey! No eres una máquina, vuelve en un rato.',
                '⏳ Estás sudando frío del cansancio, espera un poco.',
                '⏳ Recupera energías primero, luego seguimos con el negocio.'
            ];

            if (ahora - (last || 0) < cd) return sock.sendMessage(chatId, { text: pick(waitMsgs) }, { quoted: msg });

            const workScenarios = [
                'Trabajaste limpiando el laboratorio del Dr. Vegapunk',
                'Fuiste guardia de seguridad en el Casino Diky',
                'Ayudaste a Ichiraku a preparar ramen todo el día',
                'Vendiste periódicos en las calles de Central City',
                'Trabajaste como mercenario para la Corporación Cápsula',
                'Fuiste extra en una película de Hollywood',
                'Cocinaste para los Piratas del Sombrero de Paja',
                'Ayudaste a reconstruir Konoha tras un ataque',
                'Trabajaste como desarrollador junior en una startup de scripts',
                'Entregaste paquetes volando en una escoba mágica',
                'Fuiste cazador de recompensas novato en Marte',
                'Ayudaste a Bulma a organizar sus Dragon Radars',
                'Trabajaste como barman en el bar de Quindecim',
                'Fuiste guía turístico en el Mundo Digital',
                'Limpiaste el gimnasio de Saitama por unas monedas'
            ];

            const slutScenarios = [
                'Hiciste un baile exótico en el distrito rojo de Yoshiwara',
                'Fuiste a Kabukicho y encontraste un cliente generoso',
                'Vendiste fotos prohibidas en tu OnlyFans secreto',
                'Fuiste dama de compañía en una fiesta de nobles',
                'Hiciste un streaming picante y llovieron donaciones',
                'Aceptaste un favor "especial" de un desconocido en un callejón',
                'Te pagaron por actuar de pareja falsa en una boda',
                'Fuiste anfitrión/hostess en un club de lujo',
                'Modelaste ropa interior para una marca desconocida',
                'Te pagaron por dejarte humillar en una plaza pública',
                'Cenas con un magnate a cambio de un "postre" privado',
                'Hiciste un ASMR sugerente que se volvió viral',
                'Fuiste a una "reunión privada" con un ejecutivo de alto cargo',
                'Hiciste cosplay H para un fotógrafo pervertido',
                'Vendiste tu tiempo en una app de citas para adultos'
            ];

            const scenario = esW ? pick(workScenarios) : pick(slutScenarios);
            const gan = esW ? 1000 : 500;
            await db.sumarMonedas(sender, gan);
            await db.actualizarUsuario(sender, esW ? { last_work: ahora } : { last_slut: ahora });

            return sock.sendMessage(chatId, { text: `💰 *${scenario}*\n\n📈 Ganancia: *+${gan}* diky.` }, { quoted: msg });
        }

        // !robar — Robar diky con cooldown de 15 minutos
        if (start === '!robar') {
            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
            const ahora = Date.now();
            const COOLDOWN_ROBAR = 15 * 60 * 1000; // 15 minutos

            // Reacción del bot 🦹‍♂️
            await sock.sendMessage(chatId, { react: { text: '🦹‍♂️', key: msg.key } });

            // Obtener datos del usuario (crear si no existe)
            let u = await db.obtenerUsuario(sender);
            if (!u) {
                await db.actualizarUsuario(sender, { monedas: 100, nivel: 1, xp: 0 });
                u = await db.obtenerUsuario(sender);
            }
            const lastRobo = u?.last_robar || 0;
            const tiempoRestante = COOLDOWN_ROBAR - (ahora - lastRobo);

            // Verificar cooldown
            if (tiempoRestante > 0) {
                const mins = Math.ceil(tiempoRestante / 60000);
                const msgsCooldown = [
                    `🚔 *¡LA POLICÍA ESTÁ CERCA!*\n👮 Debes esperar *${mins} minutos* antes de volver a robar.`,
                    `🚨 *¡CALMA LADRÓN!*\n⏳ Espera *${mins} minutos* más. La policía patrulla la zona.`,
                    `🕵️ *LOS DETECTIVES TE BUSCAN*\nEsconde *${mins} minutos* más...`,
                    `🚓 *SIRENAS A LO LEJOS*\nNo puedes robar ahora. Espera *${mins} minutos*.`,
                    `⏱️ *EN TIEMPO MUERTO*\nTu próximo atraco disponible en *${mins} minutos*.`
                ];
                return sock.sendMessage(chatId, { text: pick(msgsCooldown) }, { quoted: msg });
            }

            // Lista blanca de usuarios que no pueden ser robados (owner/dev)
            const LISTA_BLANCA = [
                ADMIN_NUM, // El admin principal
                '50760541202', // Ejemplo de número protegido
                // Agrega más números aquí si es necesario
            ];
            const cleanNumber = (n) => (n || '').split('@')[0].replace(/\D/g, '');
            const senderClean = cleanNumber(sender);

            // Verificar si el usuario está en lista blanca (no puede robar)
            const esListaBlanca = LISTA_BLANCA.some(num => 
                cleanNumber(num).includes(senderClean) || senderClean.includes(cleanNumber(num))
            );

            if (esListaBlanca && !isGlobalAdmin) {
                const msgsListaBlanca = [
                    `🛡️ *PROTECCIÓN DIVINA*\n\nTienes inmunidad total. No puedes usar este comando.`,
                    `✨ *BENDICIÓN ESPECIAL*\n\nLos dioses te protegen de tales actividades...`,
                    `👑 *ESTÁS FUERA DE LÍMITES*\n\nEste comando no está disponible para tu estatus.`
                ];
                return sock.sendMessage(chatId, { text: pick(msgsListaBlanca) }, { quoted: msg });
            }

            // Escenarios de robo exitoso (cortos y divertidos)
            const exitosos = [
                { text: '� *Le robaste la pensión a una abuela*\nPero ella te maldijo. Valió la pena.\n💰 +*{cantidad}* diky', emoji: '👵' },
                { text: '� *Robaste donas de un policía dormido*\nÉl sigue roncando.\n💰 +*{cantidad}* diky', emoji: '🍩' },
                { text: '🐕 *Le quitaste el hueso a un perro*\nEl perro te entendió. Era su último día.\n💰 +*{cantidad}* diky', emoji: '🐕' },
                { text: '🚽 *Vendiste la tapa del baño de un restaurante*\n¿Quién compra eso?\n💰 +*{cantidad}* diky', emoji: '🚽' },
                { text: '🧙 *Estafaste a un mago callejero*\nHizo desaparecer tu culpa.\n💰 +*{cantidad}* diky', emoji: '🧙' },
                { text: '👶 *Un bebé te pagó por cambiarle el pañal*\nUsó tarjeta de crédito.\n💰 +*{cantidad}* diky', emoji: '👶' },
                { text: '� *Robaste los dulces de un niño*\nPero le dejiste un recibo.\n💰 +*{cantidad}* diky', emoji: '🎅' },
                { text: '🦆 *Vendiste patos de un parque*\nSon de plástico. Nadie notó la diferencia.\n💰 +*{cantidad}* diky', emoji: '🦆' },
                { text: '� *Robaste un paquete de Amazon*\nEra una maldición egipcia. Tú ganas.\n💰 +*{cantidad}* diky', emoji: '📦' },
                { text: '🧀 *Robaste queso de una rata*\nLa rata te debe una.\n💰 +*{cantidad}* diky', emoji: '🧀' },
                { text: '🤡 *Le robaste el trabajo a un payaso*\nAhora haces fiestas infantiles.\n💰 +*{cantidad}* diky', emoji: '🤡' },
                { text: '👟 *Vendiste tenis de un atleta olímpico*\nCorrieron solos al comprador.\n💰 +*{cantidad}* diky', emoji: '�' },
                { text: '🍕 *Robaste la propina de un delivery*\nLa pizza llegó fría. Karma.\n💰 +*{cantidad}* diky', emoji: '🍕' },
                { text: '🧸 *Vendiste un oso de peluche maldito*\nEl comprador sonríe diferente ahora.\n💰 +*{cantidad}* diky', emoji: '🧸' },
                { text: '� *Robaste pan a las palomas*\nTe respetan como su líder ahora.\n💰 +*{cantidad}* diky', emoji: '�' }
            ];

            // Escenarios de robo fallido (cortos y divertidos)
            const fallidos = [
                { text: '� *Intentaste robarle a una abuela*\nElla te noqueó. Dignidad perdida.\n💸 -*{perdida}* diky (hospital)', perder: 80 },
                { text: '🐈 *Le robaste a un gato callejero*\nResultó ser el jefe de la mafia local.\n💸 -*{perdida}* diky (protección)', perder: 150 },
                { text: '🧟 *Robaste a un zombie*\nTe contagió deuda.\n💸 -*{perdida}* diky', perder: 60 },
                { text: '🎪 *Intentaste estafar a un payaso*\nTe convenció de que eras el payaso.\n💸 -*{perdida}* diky (terapia)', perder: 100 },
                { text: '🦆 *Robaste a un pato*\nTenía abogado.\n💸 -*{perdida}* diky (juicio)', perder: 200 },
                { text: '👮 *Intentaste robar a un policía*\nEstaba de civil. Y de mal humor.\n💸 -*{perdida}* diky (fianza)', perder: 180 },
                { text: '🍔 *Robaste una hamburguesa*\nTenía salsa de fantasmas. Te poseyeron.\n💸 -*{perdida}* diky (exorcismo)', perder: 120 },
                { text: '🧙‍♀️ *Robaste a una bruja*\nTe convirtió en sapo por 3 minutos.\n💸 -*{perdida}* diky (humillación)', perder: 50 },
                { text: '🤖 *Robaste a un robot*\nSubió tu cara a TikTok.\n💸 -*{perdida}* diky (trending)', perder: 90 },
                { text: '🐝 *Robaste miel*\nLas abejas te hicieron crowdfunding... para tu funeral.\n💸 -*{perdida}* diky ( Funeral )', perder: 70 },
                { text: '🪞 *Intentaste robar tu reflejo*\nTu reflejo te robó la dignidad.\n💸 -*{perdida}* diky', perder: 40 },
                { text: '� *Robaste en una casa embrujada*\nLos fantasmas te cobraron renta.\n💸 -*{perdida}* diky', perder: 110 },
                { text: '🌵 *Intentaste robar un cactus*\nEl cactus te adoptó como espina.\n💸 -*{perdida}* diky (quiropráctico)', perder: 85 },
                { text: '🎮 *Robaste un videojuego*\nEra una simulación de tu arresto.\n💸 -*{perdida}* diky (predicción)', perder: 130 }
            ];

            // 70% éxito, 30% fracaso
            const exito = Math.random() < 0.7;

            if (exito) {
                // ÉXITO: Ganar entre 75-250 diky
                const cantidad = Math.floor(Math.random() * (250 - 75 + 1)) + 75;
                const escenario = pick(exitosos);
                
                await db.sumarMonedas(sender, cantidad);
                await db.actualizarUsuario(sender, { last_robar: ahora });

                return sock.sendMessage(chatId, {
                    text: escenario.text.replace('{cantidad}', cantidad.toLocaleString()) + '\n\n⏰ Próximo atraco disponible en *15 minutos*'
                }, { quoted: msg });
            } else {
                // FRACASO: Posible pérdida de diky
                const escenario = pick(fallidos);
                
                if (escenario.perder > 0) {
                    const balance = await db.obtenerBalance(sender);
                    const perdidaReal = Math.min(escenario.perder, balance);
                    if (perdidaReal > 0) {
                        await db.deducirMonedas(sender, perdidaReal);
                    }
                }
                
                await db.actualizarUsuario(sender, { last_robar: ahora });

                return sock.sendMessage(chatId, {
                    text: escenario.text.replace('{perdida}', escenario.perder.toLocaleString()) + '\n\n⏰ Puedes intentar de nuevo en *15 minutos*'
                }, { quoted: msg });
            }
        }

        if (start === '!inventario') {
            const u = await db.obtenerUsuario(sender);
            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }

            // Filter out items with 0 or less quantity
            const itemsValidos = Object.entries(inv).filter(([k, v]) => v > 0);

            if (itemsValidos.length === 0) {
                return sock.sendMessage(chatId, { text: '🎒 Tu inventario está vacío.' });
            }

            // Paginación
            const itemsPerPage = 8;
            const maxPages = Math.ceil(itemsValidos.length / itemsPerPage);
            let page = parseInt(args[0]) || 1;

            if (page < 1) page = 1;
            if (page > maxPages) page = maxPages;

            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentItems = itemsValidos.slice(startIndex, endIndex);

            let m = `🎒 **INVENTARIO (Pág ${page}/${maxPages})**\n━━━━━━━━━━━━━━\n`;
            currentItems.forEach(([k, v]) => {
                m += `• ${k.toUpperCase()}: x${v}\n`;
            });
            m += `━━━━━━━━━━━━━━\n`;

            if (maxPages > 1) {
                m += `💡 _Usa !inventario ${page < maxPages ? page + 1 : 1} para ver más._`;
            }

            return sock.sendMessage(chatId, { text: m });
        }

        if (start === '!dar') {
            const monto = Math.abs(parseInt(args[0]));
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (isNaN(monto) || !ment[0]) return sock.sendMessage(chatId, { text: '💸 Uso: !dar <monto> @user' });
            if (monto < 100) return sock.sendMessage(chatId, { text: '💸 El monto mínimo para enviar es 100 diky.' });

            const b = await db.obtenerBalance(sender);
            if (b < monto) return sock.sendMessage(chatId, { text: '❌ No tienes suficiente.' });

            await db.deducirMonedas(sender, monto);
            await db.sumarMonedas(ment[0], monto);
            return sock.sendMessage(chatId, {
                text: `💸 *¡TRANSFERENCIA EXITOSA!*\n━━━━━━━━━━━━━━\n💰 @${sender.split('@')[0]} le envió *${monto.toLocaleString()}* diky a @${ment[0].split('@')[0]}\n✨ Sin impuestos (100% al destinatario)`,
                mentions: ment
            });
        }

        // !mejor
        if (start === '!mejor') {
            const filter = args[0] || 'all';
            const topM = await db.obtenerTopMonedas(20);
            const topN = await db.obtenerTopNivel(20);

            const formatStat = (num) => {
                if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'b';
                if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
                if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
                return (num || 0).toLocaleString('es-ES');
            };

            // Función para limpiar número y comparar
            const cleanNumber = (n) => (n || '').split('@')[0].replace(/\D/g, '');
            const adminClean = cleanNumber(ADMIN_NUM);

            // Filtrar al admin del ranking (para que no aparezca)
            const filtrarAdmin = (lista) => {
                return lista.filter(u => {
                    const userClean = cleanNumber(u.user_id);
                    return !userClean.includes(adminClean) && !adminClean.includes(userClean);
                });
            };

            const topNFiltered = filtrarAdmin(topN);
            const topMFiltered = filtrarAdmin(topM);

            let m = '🏆 *LEADERBOARD GLOBAL* 🏆\n━━━━━━━━━━━━━━━\n\n';

            if (filter === 'lvl' || filter === 'all') {
                m += '👑 *LEVEL TOP*\n';
                topNFiltered.slice(0, 10).forEach((u, i) => {
                    const name = u.nombre_wa || u.user_id.split('@')[0];
                    const lvl = formatStat(u.nivel);
                    m += `[ ✨ *${lvl}* ] ➔ ${name}\n`;
                });
                if (filter === 'all') m += '\n';
            }

            if (filter === 'diky' || filter === 'all') {
                m += '💰 *DIKY TYCOONS*\n';
                topMFiltered.slice(0, 10).forEach((u, i) => {
                    const name = u.nombre_wa || u.user_id.split('@')[0];
                    const bal = formatStat(u.monedas);
                    m += `[ 💎 *${bal}* ] ➔ ${name}\n`;
                });
            }

            m += '\n━━━━━━━━━━━━━━━\n💡 _¡Usa !perfil para tus stats!_';
            return sock.sendMessage(chatId, { text: m });
        }

        // !bounty @user <monto>
        if (start === '!bounty') {
            const u = await db.obtenerUsuario(sender);
            const ahora = Date.now();
            const cd = 24 * 60 * 60 * 1000;
            if (ahora - (u.last_bounty || 0) < cd) {
                const resto = cd - (ahora - (u.last_bounty || 0));
                const horas = Math.floor(resto / 3600000);
                const minutos = Math.floor((resto % 3600000) / 60000);
                return sock.sendMessage(chatId, { text: `⏳ Ya has puesto una recompensa hoy. Espera *${horas}h ${minutos}m* para volver a usarlo.` }, { quoted: msg });
            }

            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const monto = Math.abs(parseInt(args[1])) || 0;
            if (!ment[0] || monto <= 0) return sock.sendMessage(chatId, { text: '🎯 **SISTEMA DE RECOMPENSAS**\nUso: *!bounty @user <monto>*\nEl siguiente que le gane en un duelo se lleva la recompensa.' });

            const bal = await db.obtenerBalance(sender);
            if (bal < monto) return sock.sendMessage(chatId, { text: '💸 No tienes suficiente capital.' });

            const target = await db.obtenerUsuario(ment[0]);
            if (!target) return sock.sendMessage(chatId, { text: '❌ Usuario no encontrado.' });

            const ok = await db.deducirMonedas(sender, monto);
            if (!ok) return sock.sendMessage(chatId, { text: '❌ Error al procesar pago.' });

            const nuevaRecompensa = (target.recompensa || 0) + monto;
            await db.actualizarUsuario(ment[0], { recompensa: nuevaRecompensa });
            await db.actualizarUsuario(sender, { last_bounty: ahora });

            return sock.sendMessage(chatId, {
                text: `🎯 ¡Se ha puesto una recompensa sobre @${ment[0].split('@')[0]}!\n💰 Total acumulado: *${nuevaRecompensa}* diky\n⚖️ Pagado por: @${sender.split('@')[0]}`,
                mentions: [ment[0], sender]
            });
        }

        // !config esta manejado por commands/social.js (incluye validacion de edad
        // 1-120 y soporte para !config flash on/off de admins). Se elimino la version
        // duplicada de aqui, que nunca se ejecutaba (social.js se carga despues
        // alfabeticamente y sobrescribe el registro de este comando).

        if (start === '!canjear') {
            const val = args[0];
            const u = await db.obtenerUsuario(sender);
            const balance = u.monedas || 0;
            let monto = (val === 'all') ? balance : parseInt(val);

            if (!monto || isNaN(monto) || monto <= 0) {
                return sock.sendMessage(chatId, {
                    text: `🎫 *CANJE DE DIKYS*\n━━━━━━━━━━━━━━\n📊 Ratio: *100 diky = 75 XP*\n💰 Tu saldo: *${balance.toLocaleString()}* diky\n\nUso: *!canjear <monto>* o *!canjear all*`
                }, { quoted: msg });
            }
            if (balance < monto) return sock.sendMessage(chatId, { text: `❌ No tienes suficiente. Tienes *${balance.toLocaleString()}* diky.` }, { quoted: msg });

            const xpGanada = Math.floor(monto * 0.75);

            // Primero deducir, luego sumar XP
            const okDeducir = await db.deducirMonedas(sender, monto);
            if (!okDeducir) return sock.sendMessage(chatId, { text: '❌ Error al procesar el canje. Inténtalo de nuevo.' }, { quoted: msg });

            const subioNivel = await db.sumarXP(sender, xpGanada);

            let resMsg = `🎫 *¡CANJE EXITOSO!*\n━━━━━━━━━━━━━━\n💰 -*${monto.toLocaleString()}* diky\n✨ +*${xpGanada.toLocaleString()}* XP`;
            if (subioNivel) resMsg += `\n\n🆙 *¡SUBISTE DE NIVEL!* ¡Felicidades!`;

            return sock.sendMessage(chatId, { text: resMsg }, { quoted: msg });
        }

        // !loteria (Ver estado)
        if (start === '!loteria') {
            if (!botState.loteria) botState.loteria = { participantes: [], pozo: 0 };
            const p = botState.loteria.participantes.length;
            const m = `🎫 **LOTERÍA DIKY** 🎫\n━━━━━━━━━━━━━━\n💰 Pozo Acumulado: *${botState.loteria.pozo}* diky\n👥 Participantes: *${p}*\n━━━━━━━━━━━━━━\n💡 Compra un ticket en la *!tienda* (!comprar 3) para participar.\n👉 El sorteo ocurre periódicamente.`;
            return sock.sendMessage(chatId, { text: m });
        }

        // !marry @user
        if (start === '!marry') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ment[0]) return sock.sendMessage(chatId, { text: '💍 Menciona a la persona con la que te quieres casar.' });
            if (ment[0] === sender) return sock.sendMessage(chatId, { text: '❓ No puedes casarte contigo mismo.' });

            const u = await db.obtenerUsuario(sender);
            const target = await db.obtenerUsuario(ment[0]);

            if (u.pareja) return sock.sendMessage(chatId, { text: '⚠️ Ya estás casado. Usa !divorce si quieres terminar tu relación actual.' });
            if (target.pareja) return sock.sendMessage(chatId, { text: '⚠️ Esa persona ya está casada.' });

            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }
            if (!inv.anillo || inv.anillo <= 0) {
                return sock.sendMessage(chatId, { text: '💍 Necesitas un *Anillo de Bodas* de la !tienda para proponer matrimonio.' });
            }

            // Consumir el anillo
            inv.anillo -= 1;
            await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });

            botState.juegos[chatId] = {
                tipo: 'boda',
                solicitante: sender,
                pareja: ment[0],
                msgId: msg.key.id
            };

            return sock.sendMessage(chatId, {
                text: `💍 @${sender.split('@')[0]} le ha propuesto matrimonio a @${ment[0].split('@')[0]}!\n\n¿Aceptas, @${ment[0].split('@')[0]}? Escribe *ACEPTO* o *RECHAZO*.`,
                mentions: [sender, ment[0]]
            }, { quoted: msg });
        }

        // !divorce
        if (start === '!divorce') {
            const u = await db.obtenerUsuario(sender);
            if (!u.pareja) return sock.sendMessage(chatId, { text: '💔 No estás casado.' });

            const ex = u.pareja;
            await db.actualizarUsuario(sender, { pareja: null });
            await db.actualizarUsuario(ex, { pareja: null });

            return sock.sendMessage(chatId, {
                text: `💔 @${sender.split('@')[0]} se ha divorciado de @${ex.split('@')[0]}. La relación ha terminado.`,
                mentions: [sender, ex]
            }, { quoted: msg });
        }

        // !regalar @user <monto> — Alias de !dar (sin impuesto)
        if (start === '!regalar') {
            const monto = Math.abs(parseInt(args[0]));
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (isNaN(monto) || !ment[0]) return sock.sendMessage(chatId, { text: '🎁 Uso: *!regalar <monto> @user*' });
            if (monto < 100) return sock.sendMessage(chatId, { text: '💸 Mínimo 100 diky.' });

            const b = await db.obtenerBalance(sender);
            if (b < monto) return sock.sendMessage(chatId, { text: '❌ No tienes suficientes diky.' });

            await db.deducirMonedas(sender, monto);
            await db.sumarMonedas(ment[0], monto);
            return sock.sendMessage(chatId, {
                text: `🎁 *¡REGALO ENVIADO!*\n━━━━━━━━━━━━━━\n💰 @${sender.split('@')[0]} le regaló *${monto}* diky a @${ment[0].split('@')[0]}\n✨ Sin impuestos (es un regalo de corazón 💖)`,
                mentions: [sender, ment[0]]
            }, { quoted: msg });
        }

        // !regalaritem @user <item> — Regalar un item del inventario
        if (start === '!regalaritem') {
            const u = await db.obtenerUsuario(sender);
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ment[0]) return sock.sendMessage(chatId, { text: '🎁 Uso: *!regalaritem @user <nombre_item>*' });
            if (ment[0] === sender) return sock.sendMessage(chatId, { text: '❓ No puedes regalarte a ti mismo.' });

            const itemName = args.slice(1).join(' ').toLowerCase();
            if (!itemName) return sock.sendMessage(chatId, { text: '❓ Especifica el nombre del item: *!regalaritem @user pico_usos*' });

            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }

            // Buscar el item por nombre parcial
            const itemKey = Object.keys(inv).find(k => k.toLowerCase().includes(itemName) && inv[k] > 0);
            if (!itemKey) return sock.sendMessage(chatId, { text: `❌ No tienes *${itemName}* en tu inventario o ya no te queda ninguno.` });

            inv[itemKey] -= 1;
            await db.actualizarUsuario(sender, { inventario: JSON.stringify(inv) });

            // Dar al destinatario
            const targetU = await db.obtenerUsuario(ment[0]);
            let invT = {};
            try { invT = JSON.parse(targetU.inventario || '{}'); } catch (e) { }
            invT[itemKey] = (invT[itemKey] || 0) + 1;
            await db.actualizarUsuario(ment[0], { inventario: JSON.stringify(invT) });

            return sock.sendMessage(chatId, {
                text: `🎁 *¡ITEM REGALADO!*\n━━━━━━━━━━━━━━\n📦 @${sender.split('@')[0]} le regaló *1x ${itemKey.toUpperCase()}* a @${ment[0].split('@')[0]}`,
                mentions: [sender, ment[0]]
            }, { quoted: msg });
        }

        // !mascotas y !alimentar ahora los maneja commands/mascotas.js
        if (start === '!mascotas' || start === '!alimentar') { return; }
        if (false) {
            const u = await db.obtenerUsuario(sender);
            const lista = [
                { e: '🐶', n: 'Perro',             tipo: 'comun',    p: 5000,   desc: 'Leal y común' },
                { e: '🐱', n: 'Gato',              tipo: 'gato',     p: 5000,   desc: 'Independiente y curioso' },
                { e: '🐺', n: 'Lobo Hunter',       tipo: 'lobo',     p: 15000,  desc: 'Feroz y leal' },
                { e: '🦊', n: 'Zorro Astuto',      tipo: 'zorro',    p: 12000,  desc: 'Inteligente y pícaro' },
                { e: '🐲', n: 'Dragón Imperial',   tipo: 'dragon',   p: 100000, desc: 'Majestuoso y poderoso' },
                { e: '🔥', n: 'Fénix Renacido',    tipo: 'fenix',    p: 80000,  desc: 'Inmortal y ardiente' },
                { e: '⚡', n: 'Pikachu',            tipo: 'pikachu',  p: 50000,  desc: 'Eléctrico y entrañable' },
                { e: '👾', n: 'Mewtwo',             tipo: 'mewtwo',   p: 250000, desc: 'Legendario y terrorífico' },
            ];

            let m = `🐾 *TIENDA DE MASCOTAS* 🐾\n━━━━━━━━━━━━━━\n`;
            lista.forEach(pet => {
                m += `${pet.e} *${pet.n}* — ${pet.p.toLocaleString()} diky\n   _${pet.desc}_\n   👉 !comprar ${pet.tipo}\n\n`;
            });
            m += `━━━━━━━━━━━━━━\n`;

            if (u.mascota_tipo) {
                m += `🐾 Tu mascota actual: *${u.mascota_nombre}* ${u.mascota_tipo} (❤️ ${u.mascota_hambre}% hambre)\n`;
                m += `🍖 Aliméntala con *!alimentar*`;
            } else {
                m += `💡 No tienes mascota. ¡Adopta una!`;
            }

            return sock.sendMessage(chatId, { text: m }, { quoted: msg });
        }

        // !alimentar — Alimentar a tu mascota
        if (start === '!alimentar') {
            const u = await db.obtenerUsuario(sender);

            if (!u.mascota_tipo) {
                return sock.sendMessage(chatId, {
                    text: `🐾 No tienes ninguna mascota.\n💡 Compra una en *!mascotas*`
                }, { quoted: msg });
            }

            // Revisar si tiene comida en inventario
            let inv = {};
            try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }

            if (!inv.comida || inv.comida <= 0) {
                return sock.sendMessage(chatId, {
                    text: `🍖 No tienes comida para *${u.mascota_nombre}* ${u.mascota_tipo}.\n\n💡 Compra comida en la *!tienda* (item #15) — 500 diky.`
                }, { quoted: msg });
            }

            // Consumir 1 comida
            inv.comida -= 1;
            const hambreActual = u.mascota_hambre || 0;
            const nuevoHambre = Math.min(100, hambreActual + 40);
            const bonusXP = 30;

            await db.actualizarUsuario(sender, {
                inventario: JSON.stringify(inv),
                mascota_hambre: nuevoHambre
            });
            await db.sumarXP(sender, bonusXP);

            const mensajes = [
                `😋 *${u.mascota_nombre}* ${u.mascota_tipo} devoró la comida con entusiasmo.`,
                `🍗 *${u.mascota_nombre}* ${u.mascota_tipo} meneó la cola de felicidad al comer.`,
                `✨ *${u.mascota_nombre}* ${u.mascota_tipo} ronroneó/ladró con satisfacción.`,
                `💖 *${u.mascota_nombre}* ${u.mascota_tipo} te miró con amor después de comer.`
            ];
            const msg_pet = mensajes[Math.floor(Math.random() * mensajes.length)];

            const comidaRestante = inv.comida || 0;
            return sock.sendMessage(chatId, {
                text: `🍖 *¡MASCOTA ALIMENTADA!* 🐾\n━━━━━━━━━━━━━━\n${msg_pet}\n\n❤️ Hambre: *${hambreActual}%* → *${nuevoHambre}%*\n✨ +${bonusXP} XP por cuidar a tu mascota\n🍗 Comidas restantes: *${comidaRestante}*\n━━━━━━━━━━━━━━`
            }, { quoted: msg });
        }
    }
};
