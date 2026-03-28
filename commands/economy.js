/**
 * 💰 MÓDULO DE ECONOMÍA Y SOCIAL
 */
module.exports = {
    name: 'economy',
    isMultiple: true,
    names: ['!daily', '!w', '!slut', '!perfil', '!p', '!profile', '!config', '!tienda', '!comprar', '!inventario', '!mejor', '!bounty', '!dar', '!canjear', '!marry', '!divorce', '!regalaritem', '!regalar', '!clase', '!prestigio', '!loteria'],
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
            const u = await db.obtenerUsuario(targetId);
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

            pText += `📝 **Bio:** _${bio}_\n`;
            pText += `━━━━━━━━━━━━━━`;

            return sock.sendMessage(chatId, { text: pText, mentions: u.pareja ? [targetId, u.pareja] : [targetId] }, { quoted: msg });
        }

        // !daily
        if (start === '!daily') {
            const u = await db.obtenerUsuario(sender);
            const ahora = Date.now();
            const cd = 24 * 60 * 60 * 1000;
            if (ahora - (u.last_daily || 0) < cd) return sock.sendMessage(chatId, { text: `⏳ Vuelve mañana para tu recompensa.` }, { quoted: msg });

            let premio = 5000;
            if (u.clase === 'Empresario') premio += 1000;
            await db.sumarMonedas(sender, premio);
            await db.actualizarUsuario(sender, { last_daily: ahora });
            return sock.sendMessage(chatId, { text: `💰 ¡RECOMPENSA DIARIA! 💰\n\nHas recibido *${premio}* diky.\n¡Vuelve mañana para más!` }, { quoted: msg });
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
                '\n💎 **MÍTICOS**',
                '10. Grimorio de Diky - 📖 250k (Poder ancestral)',
                '13. Fragmento Estelar - ✨ 500k (¿?)'
            ];
            return sock.sendMessage(chatId, { text: `🛒 **TIENDA DIKY - STOCK ACTUAL**\n━━━━━━━━━━━━━━\n${itms.join('\n')}\n━━━━━━━━━━━━━━\n💡 !comprar <número>` });
        }

        // !comprar
        if (start === '!comprar') {
            const num = parseInt(args[0]);
            const u = await db.obtenerUsuario(sender);
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
                14: { n: 'Pokebola', p: 2000, key: 'pokebola', type: 'item' }
            };
            const it = items[num];
            if (!it) return sock.sendMessage(chatId, { text: '❌ Item no válido o no existe en stock.' });

            let finalPrice = it.p;
            if (u.clase === 'Hacker') finalPrice = Math.floor(it.p * 0.9);

            const balance = await db.obtenerBalance(sender);
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
            const u = await db.obtenerUsuario(sender);
            const ahora = Date.now();
            const esW = start === '!w';
            const cd = esW ? 3600000 : 1200000;
            const last = esW ? u.last_work : u.last_slut;
            if (ahora - (last || 0) < cd) return sock.sendMessage(chatId, { text: '⏳ Estás cansado.' }, { quoted: msg });
            const gan = esW ? 1000 : 500;
            await db.sumarMonedas(sender, gan);
            await db.actualizarUsuario(sender, esW ? { last_work: ahora } : { last_slut: ahora });
            return sock.sendMessage(chatId, { text: `💰 ${esW ? 'Trabajaste' : 'Kabukicho'} : +${gan} diky.` }, { quoted: msg });
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

            const tax = Math.floor(monto * 0.08);
            const montoReal = monto - tax;

            await db.deducirMonedas(sender, monto);
            await db.sumarMonedas(ment[0], montoReal);
            return sock.sendMessage(chatId, {
                text: `💸 Enviado: ${monto} diky\n📊 Impuesto (8%): -${tax} diky\n✅ @${ment[0].split('@')[0]} recibió: *${montoReal}* diky.`,
                mentions: ment
            });
        }

        // !mejor
        if (start === '!mejor') {
            const filter = args[0] || 'all';
            const topM = await db.obtenerTopMonedas(20);
            const topN = await db.obtenerTopNivel(20);
            let m = '';
            if (filter === 'lvl' || filter === 'all') {
                m += '🔥 **TOP NIVEL** 🔥\n';
                topN.forEach((u, i) => {
                    const isG = u.nivel >= 9999;
                    m += `${i + 1}. ${u.nombre_wa || u.user_id.split('@')[0]} - Lvl ${isG ? '∞' : u.nivel}\n`;
                });
            }
            if (filter === 'diky' || filter === 'all') {
                m += '\n💰 **TOP RIQUEZA** 💰\n';
                topM.forEach((u, i) => {
                    const isG = u.nivel >= 9999;
                    m += `${i + 1}. ${u.nombre_wa || u.user_id.split('@')[0]} - ${isG ? '∞' : u.monedas} diky\n`;
                });
            }
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

        // !config <tipo> <valor>
        if (start === '!config') {
            const type = args[0]?.toLowerCase();
            const val = args.slice(1).join(' ');
            if (!type || !val) {
                return sock.sendMessage(chatId, { text: '⚙️ **CONFIGURACIÓN DE PERFIL**\n━━━━━━━━━━━━━━\n• *!config bio <texto>*\n• *!config edad <número>*\n• *!config nombre <texto>*\n• *!config nacimiento <fecha>*\n• *!config altura <texto>*\n• *!config fav manga/anime <texto>*\n• *!config power <texto>*\n━━━━━━━━━━━━━━' });
            }

            const mapper = {
                'bio': 'descripcion', 'descripcion': 'descripcion',
                'edad': 'edad', 'nombre': 'nombre_wa',
                'nacimiento': 'nacimiento', 'altura': 'altura',
                'anime': 'anime_fav', 'manga': 'manga_fav',
                'power': 'superpoder', 'poder': 'superpoder'
            };

            let field = mapper[type];
            if (!field && type === 'fav') {
                if (args[1]?.toLowerCase() === 'manga') { field = 'manga_fav'; args.splice(1, 1); }
                else if (args[1]?.toLowerCase() === 'anime') { field = 'anime_fav'; args.splice(1, 1); }
                val = args.slice(1).join(' ');
            }

            if (!field) return sock.sendMessage(chatId, { text: '❌ Tipo de configuración no válido.' });

            let finalVal = val;
            if (field === 'edad') {
                finalVal = parseInt(val);
                if (isNaN(finalVal)) return sock.sendMessage(chatId, { text: '❌ La edad debe ser un número.' });
            }

            const ok = await db.actualizarUsuario(sender, { [field]: finalVal });
            if (ok) return sock.sendMessage(chatId, { text: `✅ Tu **${type.toUpperCase()}** ha sido actualizado correctamente.` }, { quoted: msg });
            else return sock.sendMessage(chatId, { text: '❌ Error al guardar en la base de datos.' });
        }

        // !canjear
        if (start === '!canjear') {
            const val = args[0];
            const u = await db.obtenerUsuario(sender);
            const balance = u.monedas || 0;
            let monto = (val === 'all') ? balance : parseInt(val);

            if (!monto || isNaN(monto) || monto <= 0) {
                return sock.sendMessage(chatId, { text: '🎫 **CANJE DE DIKYS**\nIntercambia dikys por XP (Ratio 2:1)\nUso: *!canjear <monto>*' });
            }
            if (balance < monto) return sock.sendMessage(chatId, { text: '❌ No tienes suficiente.' });

            const xpGanada = Math.floor(monto / 2);
            await db.deducirMonedas(sender, monto);
            await db.sumarXP(sender, xpGanada);
            return sock.sendMessage(chatId, { text: `🎫 **CANJE EXITOSO**\n💰 -${monto} diky\n✨ +${xpGanada} XP` });
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
    }
};
