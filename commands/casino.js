/**
 * 🎰 MÓDULO DE CASINO Y JUEGOS DE AZAR
 */
module.exports = {
    name: 'casino',
    isMultiple: true,
    names: ['!slot', '!ruleta', '!ruleta_rusa', '!apostar', '!bj', '!blackjack', '!poker', '!minas', '!puente', '!mazmorra', '!cofre', '!bomba', '!carta', '!donde', '!cazar', '!minar', '!pescar', '!duelo', '!duelo_real', '!casar', '!aceptar', '!vender', '!tareas', '!logros'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, sender, db, botState }) {
        if (!isGroup && ['!duelo', '!casar'].includes(start)) return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' });

        const u = await db.obtenerUsuario(sender);

        // Inicializar estados necesarios
        if (!botState.duelos) botState.duelos = {};
        if (!botState.propuestasBodas) botState.propuestasBodas = {};


        // !slot (Casino)
        if (start === '!slot') {
            const cost = Math.random() < 0.5 ? 50 : 100;
            const balance = await db.obtenerBalance(sender);
            if (balance < cost) return sock.sendMessage(chatId, { text: `💸 No tienes suficientes diky (${cost}) para jugar al Slot.` }, { quoted: msg });
            const ok = await db.deducirMonedas(sender, cost);
            if (!ok) return sock.sendMessage(chatId, { text: '❌ Error al procesar apuesta.' });

            const gana = Math.random() < 0.35; // Probabilidad de ganar: 35% (Dificultad Capitalista)
            const slots = ['🍒', '💎', '🍋', '🍎', '🔔', '⭐'];

            let a, b, c;
            if (gana) {
                a = b = c = slots[Math.floor(Math.random() * slots.length)];
            } else {
                a = slots[Math.floor(Math.random() * slots.length)];
                do { b = slots[Math.floor(Math.random() * slots.length)]; } while (b === a);
                c = slots[Math.floor(Math.random() * slots.length)];
            }

            let m = `🎰 *[ CASINO DIKY ]* 🎰\n━━━━━━━━━━━━━━\n💰 Costo: ${cost} diky\n\n      | ${a} | ${b} | ${c} |\n━━━━━━━━━━━━━━\n`;
            if (gana) {
                let premio = 500;
                if (u.clase === 'Apostador') premio = Math.floor(premio * 1.15);
                await db.sumarMonedas(sender, premio);
                m += `✨ ¡GANASTE! 🎉\n💰 Recompensa: *${premio}* diky.${u.clase === 'Apostador' ? '\n🎰 *(Bonus Apostador +15%)*' : ''}`;
            } else {
                m += `❌ Perdiste... Sigue intentando.`;
            }
            return sock.sendMessage(chatId, { text: m }, { quoted: msg });
        }

        // !ruleta / !ruleta_rusa
        if (start === '!ruleta' || start === '!ruleta_rusa') {
            const mueres = Math.random() < 0.35; // Más arriesgado: 35% de morir
            if (mueres) {
                const ok = await db.deducirMonedas(sender, 100);
                if (!ok) return sock.sendMessage(chatId, { text: '❌ No pudiste pagar la muerte (el esposo te salvó?).' });
                await db.sumarXP(sender, -50);
                return sock.sendMessage(chatId, { text: `🔫 *[ RULETA RUSA ]*\n\n💀 ¡BOOM! Te volaste los sesos... (-100 diky, -50 XP)` }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: `🔫 *[ RULETA RUSA ]*\n\n💨 *[ CLICK ]*... Respiras hondo, sigues vivo.` }, { quoted: msg });
            }
        }

        // !apostar <rojo/blanco>
        if (start === '!apostar') {
            const apuesta = args[0]?.toLowerCase();
            if (!apuesta || (apuesta !== 'rojo' && apuesta !== 'blanco')) {
                return sock.sendMessage(chatId, { text: '🎰 *CASINO DIKY* 🎰\n\nDebes elegir un color: *rojo* o *blanco*.' }, { quoted: msg });
            }
            const resultado = Math.random() < 0.35 ? apuesta : (apuesta === 'rojo' ? 'blanco' : 'rojo'); // 35% de que salga tu elección
            const gano = apuesta === resultado;
            const colorEmoji = resultado === 'rojo' ? '🔴' : '⚪';

            if (gano) {
                await db.sumarMonedas(sender, 150);
                await db.sumarXP(sender, 50);
                return sock.sendMessage(chatId, { text: `🎰 *CASINO DIKY* 🎰\n\nResultado: ${colorEmoji} *${resultado.toUpperCase()}*\n\n✨ ¡GANASTE!\n💰 +150 diky | ✨ +50 XP` }, { quoted: msg });
            } else {
                const ok = await db.deducirMonedas(sender, 100);
                if (!ok) return sock.sendMessage(chatId, { text: '❌ Error al procesar pérdida.' });
                await db.sumarXP(sender, -30);
                return sock.sendMessage(chatId, { text: `🎰 *CASINO DIKY* 🎰\n\nResultado: ${colorEmoji} *${resultado.toUpperCase()}*\n\n❌ ¡PERDISTE!\n💸 -100 diky | 📉 -30 XP` }, { quoted: msg });
            }
        }

        // !bj / !blackjack
        if (start === '!bj' || start === '!blackjack') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Juego activo.' });
            const balance = await db.obtenerBalance(sender);
            if (balance < 50) return sock.sendMessage(chatId, { text: '💸 Necesitas 50 diky.' }, { quoted: msg });
            const deck = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const getVal = (c) => (['J', 'Q', 'K'].includes(c) ? 10 : c === 'A' ? 11 : parseInt(c));
            const pCards = [deck[Math.floor(Math.random() * 13)], deck[Math.floor(Math.random() * 13)]];
            const bCards = [deck[Math.floor(Math.random() * 13)]];
            botState.juegos[chatId] = { tipo: 'bj', player: pCards, bot: bCards, status: 'playing', msgId: msg.key.id, responder: sender };
            let m_bj = `🃏 *BLACKJACK DIKY* 🃏\n\n👤 Tus cartas: ${pCards.join(' ')} (Total: ${pCards.reduce((a, b) => a + getVal(b), 0)})\n🤖 Bot: ${bCards[0]} y [?] \n\n👉 Responde con *PEDIR* o *PLANTARSE*.`;
            const sentBj = await sock.sendMessage(chatId, { text: m_bj }, { quoted: msg });
            botState.juegos[chatId].msgId = sentBj.key.id;
            return;
        }

        // !poker
        if (start === '!poker') {
            const dados = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
            const caras = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const counts = {}; dados.forEach(d => counts[d] = (counts[d] || 0) + 1);
            const vals = Object.values(counts).sort((a, b) => b - a);
            let p = 0, x = 0, mano = 'Sin mano';
            if (vals[0] === 5) { mano = 'PÓKER REAL'; p = 1000; x = 500; }
            else if (vals[0] === 4) { mano = 'Póker'; p = 500; x = 200; }
            else if (vals[0] === 3 && vals[1] === 2) { mano = 'Full House'; p = 300; x = 150; }
            else if (vals[0] === 3) { mano = 'Trío'; p = 150; x = 70; }
            const resPoker = dados.map(d => caras[d - 1]).join(' ');
            if (p > 0) { await db.sumarMonedas(sender, p); await db.sumarXP(sender, x); }
            return sock.sendMessage(chatId, { text: `🎲 *PÓKER DE DADOS*\n\nDados: ${resPoker}\nMano: *${mano}*\n💰 +${p} diky | ✨ +${x} XP` }, { quoted: msg });
        }

        // !minas
        if (start === '!minas') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Juego activo.' });
            const bombs = []; while (bombs.length < 3) { let r = Math.floor(Math.random() * 9); if (!bombs.includes(r)) bombs.push(r); } // 3 bombas de 9 (Más equilibrado)
            botState.juegos[chatId] = { tipo: 'minas', board: Array(9).fill('⬜'), bombs, discovered: 0, msgId: msg.key.id, responder: sender };
            let m_minas = `💣 *BUSCAMINAS* 💣\n\n1  2  3\n4  5  6\n7  8  9\n\n👉 Responde con el número (1-9).`;
            const sentMinas = await sock.sendMessage(chatId, { text: m_minas }, { quoted: msg });
            botState.juegos[chatId].msgId = sentMinas.key.id;
            return;
        }

        // !puente (Capitalista - Probabilidad de caída 65%)
        if (start === '!puente') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Juego activo.' });
            botState.juegos[chatId] = { tipo: 'puente', nivel: 1, max: 5, msgId: msg.key.id, responder: sender, winRate: 0.35 };
            let m_p = `🌉 *PUENTE DE CRISTAL* (1/5)\n\n👉 Elige: *IZQ* o *DER*`;
            const sentP = await sock.sendMessage(chatId, { text: m_p }, { quoted: msg });
            botState.juegos[chatId].msgId = sentP.key.id;
            return;
        }

        // !mazmorra
        if (start === '!mazmorra') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Juego activo.' });
            botState.juegos[chatId] = { tipo: 'mazmorra', sala: 1, botin: 0, msgId: msg.key.id, responder: sender };
            let m_m = `🏰 *MAZMORRA DIKY* (Sala 1)\n\n👉 Elige: *PUERTA A* o *PUERTA B*`;
            const sentM = await sock.sendMessage(chatId, { text: m_m }, { quoted: msg });
            botState.juegos[chatId].msgId = sentM.key.id;
            return;
        }

        // !cazar (MASSIVE 50 ITEM EXPANSION)
        if (start === '!cazar') {
            const animales = [
                { n: '🐇 Conejo', v: 25, x: 10, r: 'Común' }, { n: '🦆 Pato', v: 30, x: 12, r: 'Común' }, { n: '🐿️ Ardilla', v: 20, x: 8, r: 'Común' }, { n: '🐀 Rata de Campo', v: 15, x: 5, r: 'Común' }, { n: '🕊️ Paloma', v: 22, x: 9, r: 'Común' },
                { n: '🐐 Cabra', v: 60, x: 30, r: 'Común' }, { n: '🦦 Nutria', v: 45, x: 22, r: 'Común' }, { n: '🦨 Mofeta', v: 35, x: 18, r: 'Común' }, { n: '🦔 Erizo', v: 40, x: 20, r: 'Común' }, { n: '🦫 Castor', v: 55, x: 28, r: 'Común' },
                { n: '🐗 Jabalí', v: 90, x: 45, r: 'Poco Común' }, { n: '🦊 Zorro', v: 110, x: 55, r: 'Poco Común' }, { n: '🦌 Ciervo', v: 160, x: 80, r: 'Poco Común' }, { n: '🦝 Mapache', v: 85, x: 42, r: 'Poco Común' }, { n: '🐺 Lobo', v: 320, x: 160, r: 'Raro' },
                { n: '🐻 Oso Pardo', v: 480, x: 240, r: 'Raro' }, { n: '🐯 Tigre', v: 750, x: 380, r: 'Épico' }, { n: '🦁 León', v: 950, x: 480, r: 'Épico' }, { n: '🐆 Leopardo', v: 800, x: 400, r: 'Épico' }, { n: '🐼 Panda (¡Ups!)', v: 500, x: 250, r: 'Raro' },
                { n: '🦏 Rinoceronte', v: 1200, x: 600, r: 'Legendario' }, { n: '🐘 Elefante', v: 1500, x: 750, r: 'Legendario' }, { n: '🐊 Cocodrilo', v: 600, x: 300, r: 'Raro' }, { n: '🦓 Cebra', v: 200, x: 100, r: 'Poco Común' }, { n: '🦒 Jirafa', v: 250, x: 125, r: 'Poco Común' },
                { n: '🦄 Unicornio', v: 3500, x: 1800, r: 'Legendario' }, { n: '🦅 Fénix', v: 5500, x: 2800, r: 'Mítico' }, { n: '🐉 Dragón Ancient', v: 10000, x: 5000, r: 'Mítico' }, { n: '🐍 Basilisco', v: 4000, x: 2000, r: 'Legendario' }, { n: '🦍 Gorila de Espalda Plateada', v: 1100, x: 550, r: 'Épico' },
                { n: '🐆 Pantera Negra', v: 850, x: 425, r: 'Épico' }, { n: '🦂 Escorpión Gigante', v: 400, x: 200, r: 'Raro' }, { n: '🦅 Águila Real', v: 180, x: 90, r: 'Poco Común' }, { n: '🦉 Búho Sabio', v: 220, x: 110, r: 'Poco Común' }, { n: '🦚 Pavo Real', v: 140, x: 70, r: 'Poco Común' },
                { n: '🦎 Quimera (Cría)', v: 2500, x: 1250, r: 'Legendario' }, { n: '🐕 Lobo Huargo', v: 1300, x: 650, r: 'Épico' }, { n: '🦣 Mamut Resucitado', v: 6000, x: 3000, r: 'Mítico' }, { n: '🦅 Hipogrifo', v: 4500, x: 2250, r: 'Legendario' }, { n: '🦂 Mantícora', v: 5000, x: 2500, r: 'Legendario' },
                { n: '🦌 Alce Gigante', v: 350, x: 175, r: 'Raro' }, { n: '🦬 Bisonte', v: 280, x: 140, r: 'Poco Común' }, { n: '🦘 Canguro Boxeador', v: 320, x: 160, r: 'Raro' }, { n: '🦅 Grifo', v: 3800, x: 1900, r: 'Legendario' }, { n: '🐲 Wyvern de Fuego', v: 7000, x: 3500, r: 'Mítico' },
                { n: '🐫 Camello Albino', v: 180, x: 90, r: 'Raro' }, { n: '🦎 Dragón de Komodo', v: 550, x: 275, r: 'Épico' }, { n: '🐒 Mandril de Colores', v: 120, x: 60, r: 'Poco Común' }, { n: '🐍 Cobra Real', v: 380, x: 190, r: 'Raro' }, { n: '🕷️ Tarántula Gigante', v: 240, x: 120, r: 'Raro' },
                { n: '🦆 Ganso Salvaje', v: 45, x: 22, r: 'Común' }, { n: '🐖 Cerdo Montes', v: 75, x: 35, r: 'Poco Común' }, { n: '🐑 Oveja', v: 35, x: 15, r: 'Común' }, { n: '🦃 Pavo Salvaje', v: 50, x: 25, r: 'Común' }, { n: '🐦 Colibrí', v: 60, x: 30, r: 'Común' },
                { n: '🐁 Ratón de Biblioteca', v: 10, x: 5, r: 'Común' }, { n: '🦡 Tejón', v: 80, x: 40, r: 'Poco Común' }, { n: '🦇 Murciélago', v: 30, x: 15, r: 'Común' }, { n: '🐸 Sapo Gigante', v: 90, x: 45, r: 'Poco Común' }, { n: '🐛 Gusano Mutante', v: 120, x: 60, r: 'Raro' },
                { n: '🦋 Mariposa de Luz', v: 150, x: 75, r: 'Raro' }, { n: '🐧 Pingüino', v: 200, x: 100, r: 'Poco Común' }, { n: '🦭 Foca', v: 250, x: 125, r: 'Poco Común' }, { n: '🐻‍❄️ Oso Polar', v: 600, x: 300, r: 'Épico' }, { n: '🐪 Dromedario', v: 170, x: 85, r: 'Poco Común' },
                { n: '🦙 Llama Escupidora', v: 140, x: 70, r: 'Común' }, { n: '🐆 Guepardo Rápidísimo', v: 850, x: 425, r: 'Épico' }, { n: '🐕‍🦺 Perro Guardián', v: 95, x: 45, r: 'Común' }, { n: '🐈 Gato Callejero', v: 40, x: 20, r: 'Común' }, { n: '🐎 Caballo Salvaje', v: 180, x: 90, r: 'Poco Común' },
                { n: '🐅 Tigre Blanco', v: 950, x: 475, r: 'Legendario' }, { n: '🐉 Dragón de Hielo', v: 9000, x: 4500, r: 'Mítico' }, { n: '🦅 Águila Harpía', v: 450, x: 225, r: 'Épico' }, { n: '🦅 Halcón Milenario', v: 7000, x: 3500, r: 'Mítico' }, { n: '🦄 Pegaso', v: 4500, x: 2250, r: 'Legendario' },
                { n: '🦁 León de Nemea', v: 8500, x: 4250, r: 'Mítico' }, { n: '🐍 Culebra Venenosa', v: 110, x: 55, r: 'Poco Común' }, { n: '🦎 Iguana', v: 65, x: 30, r: 'Común' }, { n: '🐊 Caimán Ciego', v: 350, x: 175, r: 'Raro' }, { n: '🦧 Orangután', v: 400, x: 200, r: 'Raro' },
                { n: '🐒 Mono Tití', v: 85, x: 40, r: 'Común' }, { n: '🐨 Koala Dormilón', v: 150, x: 75, r: 'Poco Común' }, { n: '🦥 Perezoso', v: 90, x: 45, r: 'Común' }, { n: '🦦 Zarigüeya', v: 45, x: 20, r: 'Común' }, { n: '🦔 Puercoespín', v: 85, x: 40, r: 'Común' },
                { n: '🦅 Cóndor', v: 500, x: 250, r: 'Épico' }, { n: '🦢 Cisne Negro', v: 220, x: 110, r: 'Raro' }, { n: '🦩 Flamenco', v: 130, x: 65, r: 'Poco Común' }, { n: '🦤 Dodo Extinto', v: 4000, x: 2000, r: 'Legendario' }, { n: '🦇 Vampiro Menor', v: 650, x: 325, r: 'Épico' },
                { n: '🐺 Hombre Lobo', v: 2500, x: 1250, r: 'Legendario' }, { n: '🐉 Wargo Oscuro', v: 1800, x: 900, r: 'Legendario' }, { n: '🕷️ Viuda Negra', v: 280, x: 140, r: 'Raro' }, { n: '🐝 Abeja Reina', v: 120, x: 60, r: 'Poco Común' }, { n: '🐜 Hormiga Quimera', v: 15000, x: 7500, r: 'Mítico' },
                { n: '🐞 Mariquita Tóxica', v: 70, x: 35, r: 'Común' }, { n: '🐌 Caracol Veloz', v: 20, x: 10, r: 'Común' }, { n: '🦗 Saltamontes', v: 15, x: 5, r: 'Común' }, { n: '🦋 Polilla Gigante', v: 300, x: 150, r: 'Raro' }, { n: '🐲 Dragón de Tierra', v: 8000, x: 4000, r: 'Mítico' }
            ];

            const r = Math.random();
            const exito = r < 0.48;
            if (exito) {
                const r2 = Math.random() * 100;
                let rarityFilter;
                let probText;

                if (r2 < 1) { rarityFilter = ['Mítico', 'Ancestral']; probText = '1%'; }
                else if (r2 < 5) { rarityFilter = ['Legendario']; probText = '4%'; }
                else if (r2 < 15) { rarityFilter = ['Épico']; probText = '10%'; }
                else if (r2 < 35) { rarityFilter = ['Raro']; probText = '20%'; }
                else if (r2 < 65) { rarityFilter = ['Poco Común']; probText = '30%'; }
                else { rarityFilter = ['Común', 'Comun']; probText = '35%'; }

                const possible = animales.filter(a => rarityFilter.includes(a.r));
                const a = possible[Math.floor(Math.random() * possible.length)] || animales[0];

                let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }
                const currCount = inv[a.n.toLowerCase()] || 0;
                let limitMsg = '';

                if (currCount >= 10) {
                    const extraMoney = (a.v || 50) * 2; // Doble del valor base como bonificación
                    await db.sumarMonedas(sender, extraMoney);
                    limitMsg = `\n⚠️ *Límite de este animal (10)*.\nVendido a un cazador local por *${extraMoney}* diky.`;
                    await db.registrarHistorial(sender, `Vendió un ${a.n} (Límite 10)`);
                } else {
                    await db.agregarItem(sender, a.n, 1);
                    const recompensaDiky = a.v || 10;
                    await db.sumarMonedas(sender, recompensaDiky);
                    limitMsg = `\n📦 _Guardado en tu inventario (${currCount + 1}/10)_ | 💰 +${recompensaDiky} diky.`;
                    await db.registrarHistorial(sender, `Cazó un ${a.n} (${a.r})`);
                }

                await db.sumarXP(sender, a.x);

                const barLength = 10;
                const filled = Math.max(1, Math.floor((parseInt(probText) / 100) * barLength));
                const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

                let resC = `🎯 *¡CACERÍA EXITOSA!* 🏹\n━━━━━━━━━━━━━━\n✨ Has cazado: *${a.n}*\n💎 Rareza: [${a.r}]\n🍀 Probabilidad: [${bar}] ${probText}${limitMsg}\n✨ +${a.x} XP\n━━━━━━━━━━━━━━`;
                if (u.clase === 'Cazador') resC += `\n🏹 *(Bonus Cazador: Mejor probabilidad)*`;
                return sock.sendMessage(chatId, { text: resC }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: `🍃 El animal escapó silenciosamente.` }, { quoted: msg });
        }

        // !minar (MASSIVE 50 ITEM EXPANSION)
        if (start === '!minar') {
            const minerales = [
                { n: '💩 Piedra', v: 5, x: 2, r: 'Común' }, { n: '🪨 Carbón', v: 25, x: 12, r: 'Común' }, { n: '🥉 Cobre', v: 45, x: 22, r: 'Común' }, { n: '🥈 Hierro', v: 70, x: 35, r: 'Poco Común' }, { n: '⚪ Plata', v: 120, x: 60, r: 'Poco Común' },
                { n: '🥇 Oro', v: 200, x: 100, r: 'Raro' }, { n: '💎 Diamante', v: 500, x: 250, r: 'Épico' }, { n: '🔮 Esmeralda', v: 700, x: 350, r: 'Épico' }, { n: '🔴 Rubí', v: 650, x: 325, r: 'Épico' }, { n: '🔵 Zafiro', v: 600, x: 300, r: 'Épico' },
                { n: '✨ Cristal Estelar', v: 1500, x: 750, r: 'Legendario' }, { n: '🌑 Obsidiana', v: 300, x: 150, r: 'Raro' }, { n: '🔱 Mithril', v: 4000, x: 2000, r: 'Legendario' }, { n: '🦴 Fósil Prehistórico', v: 250, x: 125, r: 'Raro' }, { n: '🔶 Ámbar', v: 180, x: 90, r: 'Poco Común' },
                { n: '☄️ Fragmento de Meteoro', v: 8000, x: 4000, r: 'Mítico' }, { n: '💠 Adamantio', v: 5000, x: 2500, r: 'Legendario' }, { n: '🌀 Materia Oscura', v: 12000, x: 6000, r: 'Ancestral' }, { n: '🧪 Uranio (¡Peligro!)', v: 1000, x: 500, r: 'Épico' }, { n: '🪵 Madera Fosilizada', v: 40, x: 20, r: 'Común' },
                { n: '🛸 Tecnología Antigua', v: 3500, x: 1750, r: 'Legendario' }, { n: '🧱 Cuarzo', v: 60, x: 30, r: 'Común' }, { n: '🪨 Azufre', v: 55, x: 27, r: 'Común' }, { n: '💎 Amatista', v: 450, x: 225, r: 'Épico' }, { n: '🌊 Aguamarina', v: 420, x: 210, r: 'Épico' },
                { n: '🩸 Piedra de Sangre', v: 380, x: 190, r: 'Raro' }, { n: '🍀 Jade Sagrado', v: 2200, x: 1100, r: 'Legendario' }, { n: '🪐 Polvo Espacial', v: 6000, x: 3000, r: 'Mítico' }, { n: '🪨 Granito', v: 15, x: 7, r: 'Común' }, { n: '🧱 Mármol', v: 100, x: 50, r: 'Poco Común' },
                { n: '💎 Topacio', v: 390, x: 195, r: 'Raro' }, { n: '🔮 Ópalo de Fuego', v: 1800, x: 900, r: 'Legendario' }, { n: '🌑 Piedra Lunar', v: 1600, x: 800, r: 'Legendario' }, { n: '🧱 Calcita', v: 30, x: 15, r: 'Común' }, { n: '🏮 Pirita (Oro de Tontos)', v: 10, x: 5, r: 'Basura' },
                { n: '🧿 Ojo de Tigre', v: 340, x: 170, r: 'Raro' }, { n: '💠 Turquesa', v: 310, x: 155, r: 'Raro' }, { n: '🪨 Magnetita', v: 85, x: 42, r: 'Poco Común' }, { n: '🧱 Talco', v: 20, x: 10, r: 'Común' }, { n: '🧱 Yeso', v: 25, x: 12, r: 'Común' },
                { n: '💎 Diamante Rosa', v: 2500, x: 1250, r: 'Legendario' }, { n: '🐉 Escama de Dragón (Fósil)', v: 4200, x: 2100, r: 'Legendario' }, { n: '☄️ Antimateria', v: 9000, x: 4500, r: 'Mítico' }, { n: '🦴 Hueso de Gigante', v: 1100, x: 550, r: 'Épico' }, { n: '🧿 Oricalco', v: 4800, x: 2400, r: 'Legendario' },
                { n: '🧱 Sal Gema', v: 45, x: 22, r: 'Común' }, { n: '🪨 Grafito', v: 35, x: 17, r: 'Común' }, { n: '🔥 Magma Petrificado', v: 2800, x: 1400, r: 'Legendario' }, { n: '⚡ Fragmento de Relámpago', v: 3200, x: 1600, r: 'Legendario' }, { n: '🌈 Prisma Iris', v: 5500, x: 2750, r: 'Mítico' },
                { n: '🪨 Grava', v: 8, x: 3, r: 'Basura' }, { n: '🧱 Arcilla', v: 15, x: 5, r: 'Común' }, { n: '🪨 Pizarra', v: 22, x: 10, r: 'Común' }, { n: '🧱 Arenisca', v: 28, x: 14, r: 'Común' }, { n: '🧱 Piedra Pómez', v: 35, x: 17, r: 'Común' },
                { n: '🔮 Fluorita', v: 150, x: 75, r: 'Poco Común' }, { n: '🟢 Malaquita', v: 220, x: 110, r: 'Raro' }, { n: '🔵 Lapislázuli', v: 280, x: 140, r: 'Raro' }, { n: '⚫ Ónice', v: 350, x: 175, r: 'Raro' }, { n: '🔴 Jaspe', v: 190, x: 95, r: 'Poco Común' },
                { n: '🔮 Cuarzo Rosa', v: 160, x: 80, r: 'Poco Común' }, { n: '🔮 Amatista Oscura', v: 750, x: 375, r: 'Épico' }, { n: '⚪ Perla de Tierra', v: 900, x: 450, r: 'Épico' }, { n: '🟢 Peridoto', v: 550, x: 275, r: 'Épico' }, { n: '🔵 Aguamarina Pura', v: 850, x: 425, r: 'Épico' },
                { n: '💎 Diamante Negro', v: 3500, x: 1750, r: 'Legendario' }, { n: '💠 Zafiro Estelar', v: 4200, x: 2100, r: 'Legendario' }, { n: '🔴 Rubí Sangre de Pichón', v: 4800, x: 2400, r: 'Legendario' }, { n: '🔮 Esmeralda Imperial', v: 5500, x: 2750, r: 'Legendario' }, { n: '🌈 Ópalo Negro', v: 6500, x: 3250, r: 'Mítico' },
                { n: '🌟 Corazón de Estrella', v: 15000, x: 7500, r: 'Ancestral' }, { n: '🌋 Núcleo de Magma', v: 8500, x: 4250, r: 'Mítico' }, { n: '🧊 Hielo Perpetuo (Congelado)', v: 7000, x: 3500, r: 'Mítico' }, { n: '🌪️ Tormenta Embotellada', v: 9500, x: 4750, r: 'Mítico' }, { n: '💀 Calavera de Cristal', v: 11000, x: 5500, r: 'Ancestral' },
                { n: '⚙️ Engranaje Antiguo', v: 1200, x: 600, r: 'Épico' }, { n: '🔋 Batería Extraterrestre', v: 3800, x: 1900, r: 'Legendario' }, { n: '🪙 Moneda Romana', v: 500, x: 250, r: 'Épico' }, { n: '🏺 Reliquia Quebrada', v: 250, x: 125, r: 'Raro' }, { n: '👑 Corona de Rey Enano', v: 12000, x: 6000, r: 'Ancestral' },
                { n: '🗡️ Espada Oxidada', v: 180, x: 90, r: 'Poco Común' }, { n: '🛡️ Escudo de Bronce', v: 220, x: 110, r: 'Poco Común' }, { n: '💍 Anillo de Poder', v: 25000, x: 12500, r: 'Ancestral' }, { n: '📖 Libro Prohibido', v: 14000, x: 7000, r: 'Ancestral' }, { n: '👁️ Ojo de Sauron', v: 20000, x: 10000, r: 'Ancestral' },
                { n: '🪨 Basalto', v: 40, x: 20, r: 'Común' }, { n: '🧱 Caliza', v: 30, x: 15, r: 'Común' }, { n: '⚪ Dolomita', v: 50, x: 25, r: 'Poco Común' }, { n: '🪨 Bauxita', v: 60, x: 30, r: 'Poco Común' }, { n: '🔩 Titanio Bruto', v: 950, x: 475, r: 'Épico' },
                { n: '🧪 Plutonio Recreativo', v: 4500, x: 2250, r: 'Legendario' }, { n: '🌠 Fragmento de Cometa', v: 13000, x: 6500, r: 'Ancestral' }, { n: '🌌 Éter Puro', v: 30000, x: 15000, r: 'Mítico' }, { n: '🎭 Máscara Maldita', v: 7500, x: 3750, r: 'Mítico' }, { n: '🧬 Gen Mutante', v: 6000, x: 3000, r: 'Mítico' },
                { n: '🛸 Chatarra Alienígena', v: 800, x: 400, r: 'Épico' }, { n: '💾 Disquete Antiguo', v: 150, x: 75, r: 'Poco Común' }, { n: '🤖 Cabeza de Androide', v: 4000, x: 2000, r: 'Legendario' }, { n: '🔮 Esfera del Dragón (Fake)', v: 50, x: 25, r: 'Basura' }, { n: '💎 Diamante Maldito', v: 6666, x: 3333, r: 'Mítico' }
            ];

            const r2 = Math.random() * 100;
            let rarityFilter;
            let probText;

            if (r2 < 1) { rarityFilter = ['Ancestral', 'Mítico']; probText = '1%'; }
            else if (r2 < 5) { rarityFilter = ['Legendario']; probText = '4%'; }
            else if (r2 < 15) { rarityFilter = ['Épico']; probText = '10%'; }
            else if (r2 < 35) { rarityFilter = ['Raro']; probText = '20%'; }
            else if (r2 < 65) { rarityFilter = ['Poco Común']; probText = '30%'; }
            else { rarityFilter = ['Común', 'Comun']; probText = '35%'; }

            const possible = minerales.filter(m => rarityFilter.includes(m.r));
            const m_min = possible[Math.floor(Math.random() * possible.length)] || minerales[0];

            let val = m_min.v;
            // DURABILIDAD: PICO
            if (u.pico_usos > 0) {
                await db.actualizarUsuario(sender, { pico_usos: u.pico_usos - 1 });
            }

            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }
            const currCount = inv[m_min.n.toLowerCase()] || 0;
            let limitMsg = '';

            if (currCount >= 10) {
                const extraMoney = val * 2; // Doble del valor base como bonificación
                await db.sumarMonedas(sender, extraMoney);
                limitMsg = `\n⚠️ *Límite de este mineral (10)*.\nVendido a un coleccionista por *${extraMoney}* diky.`;
                await db.registrarHistorial(sender, `Vendió un ${m_min.n} (Límite 10)`);
            } else {
                await db.agregarItem(sender, m_min.n, 1);
                limitMsg = `\n📦 _Guardado en tu inventario (${currCount + 1}/10)._`;
            }

            await db.sumarXP(sender, m_min.x);

            const barLength = 10;
            const filled = Math.max(1, Math.floor((parseInt(probText) / 100) * barLength));
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

            let resM = `⛏️ *MINERÍA EXITOSA* 🏛️\n━━━━━━━━━━━━━━\n✨ ¡Has picado: *${m_min.n}*!\n💎 Rareza: [${m_min.r}]\n🍀 Probabilidad: [${bar}] ${probText}${limitMsg}\n✨ XP: *${m_min.x}*\n━━━━━━━━━━━━━━`;
            if (u.clase === 'Minero') resM += `\n⛏️ *(Bonus Minero: Mejor suerte)*`;
            return sock.sendMessage(chatId, { text: resM }, { quoted: msg });
        }

        // !pescar (MASSIVE 50 ITEM EXPANSION)
        if (start === '!pescar') {
            const peces = [
                { n: '🐟 Pez Payaso', v: 15, x: 8, w: 0.5, r: 'Común' }, { n: '🐠 Pez Ángel', v: 22, x: 11, w: 1.1, r: 'Común' }, { n: '🐡 Pez Globo', v: 40, x: 20, w: 2.2, r: 'Poco Común' }, { n: '🐟 Atún', v: 60, x: 30, w: 18, r: 'Poco Común' }, { n: '🦐 Camarón', v: 12, x: 6, w: 0.1, r: 'Común' },
                { n: '🦑 Calamar', v: 130, x: 65, w: 4.5, r: 'Raro' }, { n: '🐙 Pulpo', v: 160, x: 80, w: 3.2, r: 'Raro' }, { n: '🐬 Delfín', v: 350, x: 175, w: 55, r: 'Épico' }, { n: '🦈 Tiburón', v: 900, x: 450, w: 1200, r: 'Legendario' }, { n: '🐋 Ballena', v: 2500, x: 1250, w: 7000, r: 'Mítico' },
                { n: '🔱 Tridente', v: 8000, x: 4000, w: 20, r: 'Ancestral' }, { n: '👑 Corona', v: 4500, x: 2250, w: 5, r: 'Ancestral' }, { n: '🏺 Ánfora', v: 550, x: 275, w: 15, r: 'Épico' }, { n: '👞 Zapato', v: 5, x: 2, w: 0.4, r: 'Basura' }, { n: '🥫 Lata', v: 2, x: 1, w: 0.1, r: 'Basura' },
                { n: '🐚 Concha', v: 35, x: 17, w: 0.3, r: 'Poco Común' }, { n: '🐍 Anguila', v: 220, x: 110, w: 4, r: 'Raro' }, { n: '🦀 Cangrejo', v: 45, x: 22, w: 0.8, r: 'Poco Común' }, { n: '🎏 Carpa Dorada', v: 1100, x: 550, w: 3, r: 'Legendario' }, { n: '🧜‍♀️ Escama', v: 3800, x: 1900, w: 0.1, r: 'Ancestral' },
                { n: '🐟 Salmón', v: 55, x: 25, w: 8, r: 'Poco Común' }, { n: '🐟 Bacalao', v: 45, x: 20, w: 10, r: 'Común' }, { n: '🐟 Trucha', v: 35, x: 15, w: 2, r: 'Común' }, { n: '🐟 Sardina', v: 10, x: 5, w: 0.1, r: 'Común' }, { n: '🐠 Pez Cirujano', v: 30, x: 15, w: 0.6, r: 'Común' },
                { n: '🦈 Tiburón Martillo', v: 750, x: 375, w: 500, r: 'Épico' }, { n: '🦈 Tiburón Ballena', v: 1800, x: 900, w: 15000, r: 'Legendario' }, { n: '🦑 Kraken (Cría)', v: 5000, x: 2500, w: 200, r: 'Legendario' }, { n: '🐙 Pulpo Gigante', v: 1200, x: 600, w: 40, r: 'Épico' }, { n: '🦀 Langosta Azul', v: 2500, x: 1250, w: 2, r: 'Legendario' },
                { n: '🐟 Pez Espada', v: 650, x: 325, w: 80, r: 'Épico' }, { n: '🐟 Manta Raya', v: 400, x: 200, w: 150, r: 'Raro' }, { n: '🐚 Perla Negra', v: 3200, x: 1600, w: 0.1, r: 'Legendario' }, { n: '🏺 Cofre Hundido', v: 6000, x: 3000, w: 50, r: 'Mítico' }, { n: '🦴 Esqueleto de Pez Pirata', v: 800, x: 400, w: 10, r: 'Épico' },
                { n: '🐟 Pez Luna', v: 300, x: 150, w: 1000, r: 'Raro' }, { n: '🐠 Pez Disco', v: 50, x: 25, w: 0.4, r: 'Poco Común' }, { n: '🐟 Barracuda', v: 180, x: 90, r: 'Raro' }, { n: '🐟 Piraña', v: 40, x: 20, w: 0.5, r: 'Poco Común' }, { n: '🐚 Coral Sagrado', v: 2800, x: 1400, r: 'Legendario' },
                { n: '🛶 Bote Viejo (¡Wtf!)', v: 1500, x: 750, w: 200, r: 'Legendario' }, { n: '🧊 Hielo Eterno', v: 3500, x: 1750, r: 'Legendario' }, { n: '⚓ Ancla de Oro', v: 5000, x: 2500, r: 'Mítico' }, { n: '🌊 Perla de los Deseos', v: 10000, x: 5000, r: 'Mítico' }, { n: '🐚 Nautilus Dorado', v: 4500, x: 2250, r: 'Legendario' },
                { n: '🐟 Pez Abisal', v: 700, x: 350, w: 5, r: 'Épico' }, { n: '🐍 Anguila de Fuego', v: 1300, x: 650, w: 12, r: 'Épico' }, { n: '🦑 Calamar Neon', v: 950, x: 475, w: 3, r: 'Épico' }, { n: '🦈 Megalodón (Cachorro)', v: 9500, x: 4750, r: 'Mítico' }, { n: '🧜‍♂️ Espejo de Sirena', v: 6500, x: 3250, r: 'Mítico' },
                { n: '🐟 Mojarra', v: 12, x: 5, w: 0.2, r: 'Común' }, { n: '🐟 Róbalo', v: 85, x: 40, w: 12, r: 'Poco Común' }, { n: '🐟 Pejerrey', v: 18, x: 8, w: 0.4, r: 'Común' }, { n: '🐟 Mero', v: 350, x: 175, w: 45, r: 'Raro' }, { n: '🐟 Esturión', v: 650, x: 325, w: 90, r: 'Épico' },
                { n: '🫧 Medusa', v: 40, x: 20, w: 1, r: 'Poco Común' }, { n: '🫧 Medusa Inmortal', v: 7500, x: 3750, w: 1.5, r: 'Mítico' }, { n: '🦞 Langosta', v: 220, x: 110, w: 3, r: 'Raro' }, { n: '🦪 Ostra', v: 60, x: 30, w: 0.5, r: 'Común' }, { n: '🦪 Ostra Brillante', v: 300, x: 150, w: 0.6, r: 'Poco Común' },
                { n: '🐢 Tortuga Marina', v: 500, x: 250, w: 80, r: 'Épico' }, { n: '🐉 Monstruo del Lago Ness', v: 12000, x: 6000, w: 5000, r: 'Ancestral' }, { n: '🐟 Pez Volador', v: 90, x: 45, w: 1.2, r: 'Poco Común' }, { n: '🐟 Pez León', v: 260, x: 130, w: 2.5, r: 'Raro' }, { n: '🐍 Serpiente Marina', v: 850, x: 425, w: 180, r: 'Épico' },
                { n: '🦈 Tiburón Blanco', v: 2000, x: 1000, w: 800, r: 'Legendario' }, { n: '🦈 Cazón', v: 150, x: 75, w: 25, r: 'Poco Común' }, { n: '🐟 Pargo Rojo', v: 75, x: 37, w: 5, r: 'Poco Común' }, { n: '🐟 Caballa', v: 25, x: 12, w: 1, r: 'Común' }, { n: '🐟 Corydora', v: 8, x: 4, w: 0.05, r: 'Común' },
                { n: '🐟 Pez Hacha', v: 140, x: 70, w: 0.1, r: 'Raro' }, { n: '🐋 Cachalote', v: 3000, x: 1500, w: 40000, r: 'Legendario' }, { n: '🐬 Orca', v: 2200, x: 1100, w: 3500, r: 'Legendario' }, { n: '🦭 Morsa', v: 600, x: 300, w: 1000, r: 'Épico' }, { n: '🧜‍♀️ Sirena Encantada', v: 15000, x: 7500, w: 55, r: 'Ancestral' },
                { n: '🏴‍☠️ Bandera Pirata', v: 450, x: 225, w: 2, r: 'Raro' }, { n: '🍾 Botella con Mensaje', v: 100, x: 50, w: 0.5, r: 'Poco Común' }, { n: '💰 Bolsa de Oro Hundida', v: 2800, x: 1400, w: 15, r: 'Legendario' }, { n: '🦠 Plankton Mutante', v: 8500, x: 4250, w: 0.1, r: 'Mítico' }, { n: '🐲 Dios del Océano (Mini)', v: 25000, x: 12500, w: 60, r: 'Ancestral' },
                { n: '🐟 Pez Sierra', v: 550, x: 275, w: 300, r: 'Épico' }, { n: '🐊 Cocodrilo Marino', v: 950, x: 475, w: 600, r: 'Épico' }, { n: '🐡 Pez Sapo', v: 80, x: 40, w: 2.5, r: 'Poco Común' }, { n: '🐟 Pez Gato', v: 70, x: 35, w: 4, r: 'Poco Común' }, { n: '🐟 Bagre Gigante', v: 400, x: 200, w: 100, r: 'Raro' },
                { n: '🦑 Cría de Cthulhu', v: 30000, x: 15000, w: 100, r: 'Ancestral' }, { n: '🐟 Lenguado', v: 50, x: 25, w: 1.5, r: 'Común' }, { n: '🐟 Rodaballo', v: 120, x: 60, w: 4, r: 'Poco Común' }, { n: '🐚 Estrella de Mar', v: 35, x: 17, w: 0.5, r: 'Común' }, { n: '🐚 Erizo de Mar', v: 45, x: 22, w: 0.3, r: 'Común' },
                { n: '🐟 Pez Cebra', v: 15, x: 7, w: 0.05, r: 'Común' }, { n: '🐠 Guppy', v: 10, x: 5, w: 0.02, r: 'Común' }, { n: '🐟 Piraña Dorada', v: 1500, x: 750, w: 0.8, r: 'Legendario' }, { n: '🌊 Roca Musgosa', v: 5, x: 2, w: 12, r: 'Basura' }, { n: '🚗 Llanta de Auto', v: 15, x: 7, w: 8, r: 'Basura' }
            ];

            const r2 = Math.random() * 100;
            let rarityFilter;
            let probText;

            if (r2 < 1) { rarityFilter = ['Mítico', 'Ancestral']; probText = '1%'; }
            else if (r2 < 5) { rarityFilter = ['Legendario']; probText = '4%'; }
            else if (r2 < 15) { rarityFilter = ['Épico']; probText = '10%'; }
            else if (r2 < 35) { rarityFilter = ['Raro']; probText = '20%'; }
            else if (r2 < 65) { rarityFilter = ['Poco Común']; probText = '30%'; }
            else { rarityFilter = ['Común', 'Comun']; probText = '35%'; }

            const possible = peces.filter(p => rarityFilter.includes(p.r));
            const p = possible[Math.floor(Math.random() * possible.length)] || peces[0];

            // DURABILIDAD: CEBO
            if (u.cebo_usos > 0) {
                await db.actualizarUsuario(sender, { cebo_usos: u.cebo_usos - 1 });
            }

            let weightBonus = (u.clase === 'Pescador') ? 1.30 : 1.0;
            const peso = (p.w ? (p.w * (0.6 + Math.random() * 0.8) * weightBonus).toFixed(2) : (Math.random() * 5 + 1).toFixed(2));

            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }
            const currCount = inv[p.n.toLowerCase()] || 0;
            let limitMsg = '';

            if (currCount >= 10) {
                const extraMoney = (p.v || 50) * 2; // Doble del valor base como bonificación
                await db.sumarMonedas(sender, extraMoney);
                limitMsg = `\n⚠️ *Límite de este pez (10)*.\nVendido en el mercado libre por *${extraMoney}* diky.`;
                await db.registrarHistorial(sender, `Vendió un ${p.n} (Límite 10)`);
            } else {
                await db.agregarItem(sender, p.n, 1);
                const recompensaDiky = p.v || 10;
                await db.sumarMonedas(sender, recompensaDiky);
                limitMsg = `\n📦 _Guardado en tu inventario (${currCount + 1}/10)_ | 💰 +${recompensaDiky} diky.`;
                await db.registrarHistorial(sender, `Pescó un ${p.n} (${p.r}) de ${peso}kg`);
            }

            await db.sumarXP(sender, p.x);

            // ACTUALIZAR RÉCORD DE PESCA
            let nuevoRecord = false;
            let currentRecordWeight = 0;
            if (u.record_pesca) {
                const match = u.record_pesca.match(/de ([\d.]+)kg/);
                if (match && match[1]) currentRecordWeight = parseFloat(match[1]);
            }
            if (parseFloat(peso) > currentRecordWeight) {
                await db.actualizarUsuario(sender, { record_pesca: `${p.n} (${p.r}) de ${peso}kg` });
                nuevoRecord = true;
            }

            const barLength = 10;
            const filled = Math.max(1, Math.floor((parseInt(probText) / 100) * barLength));
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

            let resP = `🎣 *¡PESCA EXITOSA!* 🌊\n━━━━━━━━━━━━━━\n✨ Has pescado: *${p.n}*\n💎 Rareza: [${p.r}]\n⚖️ Peso: *${peso}kg*\n🍀 Probabilidad: [${bar}] ${probText}${limitMsg}\n✨ +${p.x} XP`;
            if (nuevoRecord) resP += `\n🎯 *¡NUEVO RÉCORD PERSONAL DE PESO!*`;
            resP += `\n━━━━━━━━━━━━━━`;
            if (u.clase === 'Pescador') resP += `\n🎖️ *(Bonus Pescador: Peces más pesados)*`;
            return sock.sendMessage(chatId, { text: resP }, { quoted: msg });
        }

        // !duelo @user [monto] — Reta a alguien, acepta con !aceptar
        if (start === '!duelo') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ment[0]) return sock.sendMessage(chatId, { text: '⚔️ Menciona a alguien: *!duelo @user [apuesta]*' });
            if (ment[0] === sender) return sock.sendMessage(chatId, { text: '❓ No puedes pelear contigo mismo.' });

            const apuesta = Math.abs(parseInt(args[1])) || 500;
            const b1 = await db.obtenerBalance(sender);
            const b2 = await db.obtenerBalance(ment[0]);

            if (b1 < apuesta) return sock.sendMessage(chatId, { text: '💸 Fondos insuficientes para apostar.' });
            if (b2 < apuesta) return sock.sendMessage(chatId, { text: '💸 Tu oponente no tiene suficientes dikys.' });

            botState.duelos[ment[0]] = { retador: sender, apuesta, expira: Date.now() + 60000 };
            return sock.sendMessage(chatId, {
                text: `⚔️ *¡RETO DE DUELO!* ⚔️\n━━━━━━━━━━━━━━\n🥊 @${sender.split('@')[0]} reta a @${ment[0].split('@')[0]}\n💰 Apuesta: *${apuesta}* diky\n━━━━━━━━━━━━━━\n👉 @${ment[0].split('@')[0]}, escribe *!aceptar* para pelear.\n⏳ Expira en 60 segundos.`,
                mentions: [sender, ment[0]]
            }, { quoted: msg });
        }

        // !duelo_real @user [monto] — Duelo instantáneo sin esperar aceptación
        if (start === '!duelo_real') {
            if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Solo en grupos.' });
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ment[0]) return sock.sendMessage(chatId, { text: '⚔️ Menciona a alguien: *!duelo_real @user [apuesta]*' });
            if (ment[0] === sender) return sock.sendMessage(chatId, { text: '❓ No puedes pelear contigo mismo.' });

            const apuesta = Math.min(Math.abs(parseInt(args[1])) || 300, 1000000);
            const b1 = await db.obtenerBalance(sender);
            const b2 = await db.obtenerBalance(ment[0]);
            const target = await db.obtenerUsuario(ment[0]);

            if ((Math.abs(parseInt(args[1])) || 300) > 1000000) return sock.sendMessage(chatId, { text: '🚫 *Límite de apuesta:* Máximo *1,000,000 diky* por duelo.' }, { quoted: msg });
            if (b1 < apuesta) return sock.sendMessage(chatId, { text: '💸 No tienes suficientes dikys para apostar.' });
            if (b2 < apuesta) return sock.sendMessage(chatId, { text: '💸 Tu oponente no tiene la apuesta.' });

            const n1 = u.nombre_wa || u.nombre || sender.split('@')[0];
            const n2 = target.nombre_wa || target.nombre || ment[0].split('@')[0];

            // Animación de inicio
            const intros = [
                '🔥 ¡La arena está en llamas!',
                '⚡ ¡El choque de titanes comienza!',
                '🌩️ ¡Una tormenta de poder se desata!',
                '🐲 ¡Los dragónes de guerra han despertado!'
            ];

            const tecs = [
                '🌀 ¡Rasengan Mond!', '⚡ ¡Chidori Máximo!', '🗡️ ¡Getsuga Tensho!', '💥 ¡Kamehameha Final!',
                '👊 ¡Golpe Serio!', '🥊 ¡Gomu Gatling!', '🔥 ¡Amaterasu!', '⚔️ ¡Corte Espacial!',
                '🏹 ¡Flecha Divina!', '🐲 ¡Rugido del Dragón!', '🎇 ¡Bala de Chakra!', '🌠 ¡Meteoro!',
                '🛑 ¡Barrera de Hierro!', '✨ ¡Destello Final!', '👤 ¡Sombra Divina!', '🌀 ¡Torbellino de Plata!'
            ];

            // Stat bonificaciones por clase
            const getAtk = (usr) => {
                let base = 15 + Math.floor(Math.random() * 20);
                if (usr.clase === 'Guerrero') base = Math.floor(base * 1.2);
                if (usr.clase === 'Cazador') base = Math.floor(base * 1.1);
                return base;
            };

            // Simular 15 rondas de pelea
            let hp1 = 120, hp2 = 120;
            let fightLog = `⚔️ *¡DUELO REAL!* ⚔️\n${intros[Math.floor(Math.random() * intros.length)]}\n━━━━━━━━━━━━━━\n`;
            fightLog += `🤺 *${n1}* [120 HP]  🆚  🤺 *${n2}* [120 HP]\n💰 Apuesta: *${apuesta}* diky\n━━━━━━━━━━━━━━\n`;

            let turno = 1, atk = Math.random() < 0.5 ? 1 : 2;
            while (hp1 > 0 && hp2 > 0 && turno <= 15) {
                const atacante = atk === 1 ? n1 : n2;
                const defensor = atk === 1 ? n2 : n1;
                const usrAtk = atk === 1 ? u : target;
                let dmg = getAtk(usrAtk);
                // Crit 10%
                const crit = Math.random() < 0.1;
                if (crit) { dmg = Math.floor(dmg * 1.8); }
                if (atk === 1) hp2 -= dmg; else hp1 -= dmg;
                if (hp1 < 0) hp1 = 0; if (hp2 < 0) hp2 = 0;
                const tech = tecs[Math.floor(Math.random() * tecs.length)];
                fightLog += `🔹 *R${turno}:* ${atacante} ${tech}${crit ? ' [🔥 CRIT!]' : ''} → -${dmg} HP 👉 ${defensor} (${atk===1?hp2:hp1}HP)\n`;
                if (hp1 <= 0 || hp2 <= 0) break;
                atk = atk === 1 ? 2 : 1;
                turno++;
            }

            const gana1 = hp1 > hp2;
            const ganador = gana1 ? sender : ment[0];
            const perdedor = gana1 ? ment[0] : sender;
            const gName = gana1 ? n1 : n2;
            const pName = gana1 ? n2 : n1;

            await db.sumarMonedas(ganador, Math.min(apuesta, 1000000));
            await db.deducirMonedas(perdedor, apuesta);
            await db.registrarVictoriaDuelo(ganador);
            await db.registrarDerrotaDuelo(perdedor);
            await db.sumarXP(ganador, 300);
            await db.sumarXP(perdedor, 50);

            fightLog += `\n━━━━━━━━━━━━━━\n📊 HP Final: *${n1}*: ${hp1} | *${n2}*: ${hp2}\n\n🏆 *GANADOR: ${gName}*\n   💰 +${apuesta} diky | ✨ +300 XP\n🗡️ *${pName}* → -${apuesta} diky | +50 XP de consolación`;

            return sock.sendMessage(chatId, { text: fightLog, mentions: [ganador, perdedor] }, { quoted: msg });
        }

        // !casar @user — Propuesta de matrimonio
        if (start === '!casar') {
            const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ment[0]) return sock.sendMessage(chatId, { text: '💍 Menciona a la persona: *!casar @user*' });
            if (ment[0] === sender) return sock.sendMessage(chatId, { text: '❓ No puedes casarte contigo mismo.' });

            botState.propuestasBodas[ment[0]] = { de: sender, expira: Date.now() + 60000 };
            return sock.sendMessage(chatId, {
                text: `💍 *¡PROPUESTA DE MATRIMONIO!* 💒\n━━━━━━━━━━━━━━\n@${sender.split('@')[0]} le ha pedido matrimonio a @${ment[0].split('@')[0]} 💖\n━━━━━━━━━━━━━━\n👉 @${ment[0].split('@')[0]}, escribe *!aceptar* para decir "Sí, acepto" 💍\n⏳ Expira en 60 segundos.`,
                mentions: [sender, ment[0]]
            }, { quoted: msg });
        }

        // !aceptar — Acepta un duelo o propuesta de boda pendiente
        if (start === '!aceptar') {
            // Verificar si hay duelo pendiente
            if (botState.duelos[sender]) {
                const d = botState.duelos[sender];
                if (Date.now() > d.expira) {
                    delete botState.duelos[sender];
                    return sock.sendMessage(chatId, { text: '⏰ El reto de duelo ha expirado.' });
                }

                const target = await db.obtenerUsuario(d.retador);
                const n1 = u.nombre_wa || u.nombre || sender.split('@')[0];
                const n2 = target.nombre_wa || target.nombre || d.retador.split('@')[0];

                let hp1 = 100, hp2 = 100;
                const tecs = [
                    '¡Rasengan! 🌀', '¡Chidori! ⚡', '¡Getsuga Tensho! 🗡️', '¡Kamehameha! 💥',
                    '¡Golpe Serio! 👊', '¡Gomu Gomu Gatling! 🥊', '¡Amaterasu! 🔥',
                    '¡Corte Espacial! ⚔️', '¡Flecha de Luz! 🏹', '¡Rugido del Dragón! 🐲'
                ];

                let fightLog = `⚔️ *¡EL DUELO COMIENZA!* ⚔️\n━━━━━━━━━━━━━━\n🤺 *${n1}* VS 🤺 *${n2}*\n💰 Apuesta: *${d.apuesta}* diky\n━━━━━━━━━━━━━━\n`;

                let turno = 1, atacante = Math.random() < 0.5 ? 1 : 2;
                while (hp1 > 0 && hp2 > 0 && turno <= 10) {
                    const nombre = atacante === 1 ? n1 : n2;
                    let dmg = Math.floor(Math.random() * 25) + 10;
                    if (atacante === 1 && u.clase === 'Guerrero') dmg = Math.floor(dmg * 1.1);
                    if (atacante === 2 && target.clase === 'Guerrero') dmg = Math.floor(dmg * 1.1);
                    if (atacante === 1) hp2 -= dmg; else hp1 -= dmg;
                    if (hp1 < 0) hp1 = 0; if (hp2 < 0) hp2 = 0;
                    fightLog += `🔹 *T${turno}:* ${nombre} → ${tecs[Math.floor(Math.random() * tecs.length)]} [-${dmg} HP]\n`;
                    if (hp1 <= 0 || hp2 <= 0) break;
                    atacante = atacante === 1 ? 2 : 1;
                    turno++;
                }

                const gana1 = hp1 > hp2;
                const ganador = gana1 ? sender : d.retador;
                const perdedor = gana1 ? d.retador : sender;
                const gName = gana1 ? n1 : n2;

                await db.sumarMonedas(ganador, Math.min(d.apuesta, 1000000));
                await db.deducirMonedas(perdedor, d.apuesta);
                await db.registrarVictoriaDuelo(ganador);
                await db.registrarDerrotaDuelo(perdedor);
                await db.sumarXP(ganador, 200);

                fightLog += `\n━━━━━━━━━━━━━━\n📊 *HP FINAL:* ${n1}: ${hp1} | ${n2}: ${hp2}\n🏆 *GANADOR:* *${gName}*\n💰 +${d.apuesta} diky | ✨ +200 XP`;
                delete botState.duelos[sender];
                return sock.sendMessage(chatId, { text: fightLog, mentions: [ganador, perdedor] }, { quoted: msg });
            }

            // Verificar si hay propuesta de boda pendiente
            if (botState.propuestasBodas[sender]) {
                const b = botState.propuestasBodas[sender];
                if (Date.now() > b.expira) {
                    delete botState.propuestasBodas[sender];
                    return sock.sendMessage(chatId, { text: '⏰ La propuesta de matrimonio ha expirado.' });
                }
                await db.actualizarUsuario(sender, { pareja: b.de });
                await db.actualizarUsuario(b.de, { pareja: sender });
                await db.sumarXP(sender, 200);
                await db.sumarXP(b.de, 200);
                delete botState.propuestasBodas[sender];
                return sock.sendMessage(chatId, {
                    text: `🎊 *¡BODA CELEBRADA!* 💒\n━━━━━━━━━━━━━━\n💖 @${b.de.split('@')[0]} y @${sender.split('@')[0]} ¡ahora están casados!\n✨ Ambos ganan +200 XP`,
                    mentions: [sender, b.de]
                });
            }

            return sock.sendMessage(chatId, { text: '❌ No tienes ningún duelo ni propuesta pendiente.' });
        }

        // --- NUEVOS COMANDOS IMPLEMENTADOS ---

        // !bomba
        if (start === '!bomba') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo.' });
            const colores = ['rojo', 'azul', 'verde', 'amarillo'];
            const secreto = colores[Math.floor(Math.random() * colores.length)];
            botState.juegos[chatId] = { tipo: 'bomba', secreto, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `💣 *TIENES UNA BOMBA FRENTE A TI* 💣\n\nHay 4 cables: *ROJO*, *AZUL*, *VERDE*, *AMARILLO*.\n\n👉 Elige uno para cortar. ¡Si fallas, explota!` }, { quoted: msg });
        }

        // !donde
        if (start === '!donde') {
            const sitios = ['En el baño 🚽', 'En la Luna 🌙', 'En el refrigerador 🧊', 'En la cama 🛏️', 'En el sótano 🕸️', 'En un isekai 💫', 'Detrás de ti... 👹'];
            const r = sitios[Math.floor(Math.random() * sitios.length)];
            return sock.sendMessage(chatId, { text: `🔍 *EL RASTREADOR DICE:* \n\n📍 ${r}` }, { quoted: msg });
        }

        // !carta
        if (start === '!carta') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo.' });
            const deck = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
            const actual = deck[Math.floor(Math.random() * 13)];
            botState.juegos[chatId] = { tipo: 'carta', actual, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `🃏 *JUEGO DE CARTAS* 🃏\n\nLa carta actual es: *${actual}*\n\n¿La siguiente será *MAYOR* o *MENOR*?` }, { quoted: msg });
        }

        // !cofre
        if (start === '!cofre') {
            if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo.' });
            const ganador = Math.floor(Math.random() * 3) + 1;
            botState.juegos[chatId] = { tipo: 'cofre', ganador, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `🎁 *TRES COFRES APARECEN* 🎁\n\nElige uno: *1*, *2* o *3*.\n\n💰 Premio: 150 diky.` }, { quoted: msg });
        }

        // !vender <item> [cantidad]
        if (start === '!vender') {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });

            if (args.length === 0) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: '💰 Uso: *!vender <item> [cantidad]*\nEjemplo: *!vender diamante 2*\nTambién puedes usar *!vender todo* o *!vender <item> todo*' });
            }

            let item = args.join(' ').toLowerCase().trim();
            const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            // Base de datos improvisada de valores base
            const vData = [
                // Animales de Caza
                { n: 'conejo', v: 25 }, { n: 'pato', v: 30 }, { n: 'ardilla', v: 20 }, { n: 'rata de campo', v: 15 }, { n: 'paloma', v: 22 },
                { n: 'cabra', v: 60 }, { n: 'nutria', v: 45 }, { n: 'mofeta', v: 35 }, { n: 'erizo', v: 40 }, { n: 'castor', v: 55 },
                { n: 'jabalí', v: 90 }, { n: 'zorro', v: 110 }, { n: 'ciervo', v: 160 }, { n: 'mapache', v: 85 }, { n: 'lobo', v: 320 },
                { n: 'oso pardo', v: 480 }, { n: 'tigre', v: 750 }, { n: 'león', v: 950 }, { n: 'leopardo', v: 800 }, { n: 'panda', v: 500 },
                { n: 'rinoceronte', v: 1200 }, { n: 'elefante', v: 1500 }, { n: 'cocodrilo', v: 600 }, { n: 'cebra', v: 200 }, { n: 'jirafa', v: 250 },
                { n: 'unicornio', v: 3500 }, { n: 'fénix', v: 5500 }, { n: 'dragón ancient', v: 10000 }, { n: 'basilisco', v: 4000 }, { n: 'gorila de espalda plateada', v: 1100 },
                { n: 'pantera negra', v: 850 }, { n: 'escorpión gigante', v: 400 }, { n: 'águila real', v: 180 }, { n: 'búho sabio', v: 220 }, { n: 'pavo real', v: 140 },
                { n: 'quimera (cría)', v: 2500 }, { n: 'lobo huargo', v: 1300 }, { n: 'mamut resucitado', v: 6000 }, { n: 'hipogrifo', v: 4500 }, { n: 'mantícora', v: 5000 },
                { n: 'alce gigante', v: 350 }, { n: 'bisonte', v: 280 }, { n: 'canguro boxeador', v: 320 }, { n: 'grifo', v: 3800 }, { n: 'wyvern de fuego', v: 7000 },
                { n: 'camello albino', v: 180 }, { n: 'dragón de komodo', v: 550 }, { n: 'mandril de colores', v: 120 }, { n: 'cobra real', v: 380 }, { n: 'tarántula gigante', v: 240 },
                { n: 'ganso salvaje', v: 45 }, { n: 'cerdo montes', v: 75 }, { n: 'oveja', v: 35 }, { n: 'pavo salvaje', v: 50 }, { n: 'colibrí', v: 60 },
                { n: 'ratón de biblioteca', v: 10 }, { n: 'tejón', v: 80 }, { n: 'murciélago', v: 30 }, { n: 'sapo gigante', v: 90 }, { n: 'gusano mutante', v: 120 },
                { n: 'mariposa de luz', v: 150 }, { n: 'pingüino', v: 200 }, { n: 'foca', v: 250 }, { n: 'oso polar', v: 600 }, { n: 'dromedario', v: 170 },
                { n: 'llama escupidora', v: 140 }, { n: 'guepardo rápidísimo', v: 850 }, { n: 'perro guardián', v: 95 }, { n: 'gato callejero', v: 40 }, { n: 'caballo salvaje', v: 180 },
                { n: 'tigre blanco', v: 950 }, { n: 'dragón de hielo', v: 9000 }, { n: 'águila harpía', v: 450 }, { n: 'halcón milenario', v: 7000 }, { n: 'pegaso', v: 4500 },
                { n: 'león de nemea', v: 8500 }, { n: 'culebra venenosa', v: 110 }, { n: 'iguana', v: 65 }, { n: 'caimán ciego', v: 350 }, { n: 'orangután', v: 400 },
                { n: 'mono tití', v: 85 }, { n: 'koala dormilón', v: 150 }, { n: 'perezoso', v: 90 }, { n: 'zarigüeya', v: 45 }, { n: 'puercoespín', v: 85 },
                { n: 'cóndor', v: 500 }, { n: 'cisne negro', v: 220 }, { n: 'flamenco', v: 130 }, { n: 'dodo extinto', v: 4000 }, { n: 'vampiro menor', v: 650 },
                { n: 'hombre lobo', v: 2500 }, { n: 'wargo oscuro', v: 1800 }, { n: 'viuda negra', v: 280 }, { n: 'abeja reina', v: 120 }, { n: 'hormiga quimera', v: 15000 },
                { n: 'mariquita tóxica', v: 70 }, { n: 'caracol veloz', v: 20 }, { n: 'saltamontes', v: 15 }, { n: 'polilla gigante', v: 300 }, { n: 'dragón de tierra', v: 8000 },

                // Minerales de Minería
                { n: 'piedra', v: 5 }, { n: 'carbón', v: 25 }, { n: 'cobre', v: 45 }, { n: 'hierro', v: 70 }, { n: 'plata', v: 120 },
                { n: 'oro', v: 200 }, { n: 'diamante', v: 500 }, { n: 'esmeralda', v: 700 }, { n: 'rubí', v: 650 }, { n: 'zafiro', v: 600 },
                { n: 'cristal estelar', v: 1500 }, { n: 'obsidiana', v: 300 }, { n: 'mithril', v: 4000 }, { n: 'fósil prehistórico', v: 250 }, { n: 'ámbar', v: 180 },
                { n: 'fragmento de meteoro', v: 8000 }, { n: 'adamantio', v: 5000 }, { n: 'materia oscura', v: 12000 }, { n: 'uranio (¡peligro!)', v: 1000 }, { n: 'madera fosilizada', v: 40 },
                { n: 'tecnología antigua', v: 3500 }, { n: 'cuarzo', v: 60 }, { n: 'azufre', v: 55 }, { n: 'amatista', v: 450 }, { n: 'aguamarina', v: 420 },
                { n: 'piedra de sangre', v: 380 }, { n: 'jade sagrado', v: 2200 }, { n: 'polvo espacial', v: 6000 }, { n: 'granito', v: 15 }, { n: 'mármol', v: 100 },
                { n: 'topacio', v: 390 }, { n: 'ópalo de fuego', v: 1800 }, { n: 'piedra lunar', v: 1600 }, { n: 'calcita', v: 30 }, { n: 'pirita (oro de tontos)', v: 10 },
                { n: 'ojo de tigre', v: 340 }, { n: 'turquesa', v: 310 }, { n: 'magnetita', v: 85 }, { n: 'talco', v: 20 }, { n: 'yeso', v: 25 },
                { n: 'diamante rosa', v: 2500 }, { n: 'escama de dragón (fósil)', v: 4200 }, { n: 'antimateria', v: 9000 }, { n: 'hueso de gigante', v: 1100 }, { n: 'oricalco', v: 4800 },
                { n: 'sal gema', v: 45 }, { n: 'grafito', v: 35 }, { n: 'magma petrificado', v: 2800 }, { n: 'fragmento de relámpago', v: 3200 }, { n: 'prisma iris', v: 5500 },
                { n: 'grava', v: 8 }, { n: 'arcilla', v: 15 }, { n: 'pizarra', v: 22 }, { n: 'arenisca', v: 28 }, { n: 'piedra pómez', v: 35 },
                { n: 'fluorita', v: 150 }, { n: 'malaquita', v: 220 }, { n: 'lapislázuli', v: 280 }, { n: 'ónice', v: 350 }, { n: 'jaspe', v: 190 },
                { n: 'cuarzo rosa', v: 160 }, { n: 'amatista oscura', v: 750 }, { n: 'perla de tierra', v: 900 }, { n: 'peridoto', v: 550 }, { n: 'aguamarina pura', v: 850 },
                { n: 'diamante negro', v: 3500 }, { n: 'zafiro estelar', v: 4200 }, { n: 'rubí sangre de pichón', v: 4800 }, { n: 'esmeralda imperial', v: 5500 }, { n: 'ópalo negro', v: 6500 },
                { n: 'corazón de estrella', v: 15000 }, { n: 'núcleo de magma', v: 8500 }, { n: 'hielo perpetuo (congelado)', v: 7000 }, { n: 'tormenta embotellada', v: 9500 }, { n: 'calavera de cristal', v: 11000 },
                { n: 'engranaje antiguo', v: 1200 }, { n: 'batería extraterrestre', v: 3800 }, { n: 'moneda romana', v: 500 }, { n: 'reliquia quebrada', v: 250 }, { n: 'corona de rey enano', v: 12000 },
                { n: 'espada oxidada', v: 180 }, { n: 'escudo de bronce', v: 220 }, { n: 'anillo de poder', v: 25000 }, { n: 'libro prohibido', v: 14000 }, { n: 'ojo de sauron', v: 20000 },
                { n: 'basalto', v: 40 }, { n: 'caliza', v: 30 }, { n: 'dolomita', v: 50 }, { n: 'bauxita', v: 60 }, { n: 'titanio bruto', v: 950 },
                { n: 'plutonio recreativo', v: 4500 }, { n: 'fragmento de cometa', v: 13000 }, { n: 'éter puro', v: 30000 }, { n: 'máscara maldita', v: 7500 }, { n: 'gen mutante', v: 6000 },
                { n: 'chatarra alienígena', v: 800 }, { n: 'disquete antiguo', v: 150 }, { n: 'cabeza de androide', v: 4000 }, { n: 'esfera del dragón (fake)', v: 50 }, { n: 'diamante maldito', v: 6666 },

                // Peces de Pesca
                { n: 'pez payaso', v: 15 }, { n: 'pez ángel', v: 22 }, { n: 'pez globo', v: 40 }, { n: 'atún', v: 60 }, { n: 'camarón', v: 12 },
                { n: 'calamar', v: 130 }, { n: 'pulpo', v: 160 }, { n: 'delfín', v: 350 }, { n: 'tiburón', v: 900 }, { n: 'ballena', v: 2500 },
                { n: 'tridente', v: 8000 }, { n: 'corona', v: 4500 }, { n: 'ánfora', v: 550 }, { n: 'zapato', v: 5 }, { n: 'lata', v: 2 },
                { n: 'concha', v: 35 }, { n: 'anguila', v: 220 }, { n: 'cangrejo', v: 45 }, { n: 'carpa dorada', v: 1100 }, { n: 'escama', v: 3800 },
                { n: 'salmón', v: 55 }, { n: 'bacalao', v: 45 }, { n: 'trucha', v: 35 }, { n: 'sardina', v: 10 }, { n: 'pez cirujano', v: 30 },
                { n: 'tiburón martillo', v: 750 }, { n: 'tiburón ballena', v: 1800 }, { n: 'kraken (cría)', v: 5000 }, { n: 'pulpo gigante', v: 1200 }, { n: 'langosta azul', v: 2500 },
                { n: 'pez espada', v: 650 }, { n: 'manta raya', v: 400 }, { n: 'perla negra', v: 3200 }, { n: 'cofre hundido', v: 6000 }, { n: 'esqueleto de pez pirata', v: 800 },
                { n: 'pez luna', v: 300 }, { n: 'pez disco', v: 50 }, { n: 'barracuda', v: 180 }, { n: 'piraña', v: 40 }, { n: 'coral sagrado', v: 2800 },
                { n: 'bote viejo (¡wtf!)', v: 1500 }, { n: 'hielo eterno', v: 3500 }, { n: 'ancla de oro', v: 5000 }, { n: 'perla de los deseos', v: 10000 }, { n: 'nautilus dorado', v: 4500 },
                { n: 'pez abisal', v: 700 }, { n: 'anguila de fuego', v: 1300 }, { n: 'calamar neon', v: 950 }, { n: 'megalodón (cachorro)', v: 9500 }, { n: 'espejo de sirena', v: 6500 },
                { n: 'mojarra', v: 12 }, { n: 'róbalo', v: 85 }, { n: 'pejerrey', v: 18 }, { n: 'mero', v: 350 }, { n: 'esturión', v: 650 },
                { n: 'medusa', v: 40 }, { n: 'medusa inmortal', v: 7500 }, { n: 'langosta', v: 220 }, { n: 'ostra', v: 60 }, { n: 'ostra brillante', v: 300 },
                { n: 'tortuga marina', v: 500 }, { n: 'monstruo del lago ness', v: 12000 }, { n: 'pez volador', v: 90 }, { n: 'pez león', v: 260 }, { n: 'serpiente marina', v: 850 },
                { n: 'tiburón blanco', v: 2000 }, { n: 'cazón', v: 150 }, { n: 'pargo rojo', v: 75 }, { n: 'caballa', v: 25 }, { n: 'corydora', v: 8 },
                { n: 'pez hacha', v: 140 }, { n: 'cachalote', v: 3000 }, { n: 'orca', v: 2200 }, { n: 'morsa', v: 600 }, { n: 'sirena encantada', v: 15000 },
                { n: 'bandera pirata', v: 450 }, { n: 'botella con mensaje', v: 100 }, { n: 'bolsa de oro hundida', v: 2800 }, { n: 'plankton mutante', v: 8500 }, { n: 'dios del océano (mini)', v: 25000 },
                { n: 'pez sierra', v: 550 }, { n: 'cocodrilo marino', v: 950 }, { n: 'pez sapo', v: 80 }, { n: 'pez gato', v: 70 }, { n: 'bagre gigante', v: 400 },
                { n: 'cría de cthulhu', v: 30000 }, { n: 'lenguado', v: 50 }, { n: 'rodaballo', v: 120 }, { n: 'estrella de mar', v: 35 }, { n: 'erizo de mar', v: 45 },
                { n: 'pez cebra', v: 15 }, { n: 'guppy', v: 10 }, { n: 'piraña dorada', v: 1500 }, { n: 'roca musgosa', v: 5 }, { n: 'llanta de auto', v: 15 },

                // Otros
                { n: 'pokemon', v: 300 }
            ];

            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }

            // Lógica para !vender todo (sin especificar item)
            if (item === 'todo') {
                // Proteger datos especiales que NO son items vendibles
                const protectedKeys = ['mis_waifus'];
                const items = Object.keys(inv).filter(k => inv[k] > 0 && !protectedKeys.includes(k));
                if (items.length === 0) {
                    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(chatId, { text: '❌ Tu inventario está vacío.' });
                }

                let totalEarned = 0;
                let itemsVendidos = 0;
                for (const k of items) {
                    const qty = inv[k];
                    let precioBase = 30;
                    const keyL = normalize(k);
                    for (const d of vData) {
                        if (keyL.includes(normalize(d.n))) {
                            precioBase = d.v;
                            break;
                        }
                    }
                    totalEarned += precioBase * qty;
                    itemsVendidos += qty;
                }

                // Preservar datos protegidos (como waifus) al vender todo
                const preserved = {};
                for (const pk of protectedKeys) {
                    if (inv[pk] !== undefined) preserved[pk] = inv[pk];
                }
                await db.actualizarUsuario(sender, { inventario: JSON.stringify(preserved) });
                await db.sumarMonedas(sender, totalEarned);
                await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
                return sock.sendMessage(chatId, { text: `💰 Has vendido **TODO tu inventario** (${itemsVendidos} objetos) por un total de *${totalEarned}* diky.` }, { quoted: msg });
            }

            // Lógica normal de venta de 1 item
            let cant = 1;
            let venderTodoItem = false;

            if (item.endsWith(' todo')) {
                venderTodoItem = true;
                item = item.replace(' todo', '').trim();
            } else {
                const match = item.match(/(.+?)\s+(\d+)$/);
                if (match) {
                    item = match[1].trim();
                    cant = parseInt(match[2]);
                }
            }

            if (!item) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: '❌ Escribe el nombre del objeto que quieres vender, o usa *!vender todo*.' });
            }

            const searchItem = normalize(item);
            const protectedKeys = ['mis_waifus'];
            const itemKey = Object.keys(inv).find(k => !protectedKeys.includes(k) && normalize(k).includes(searchItem));

            if (!itemKey || inv[itemKey] < 1) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ No tienes "*${item}*" en tu inventario.` }, { quoted: msg });
            }

            if (venderTodoItem) cant = inv[itemKey];

            if (inv[itemKey] < cant) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(chatId, { text: `❌ Solo tienes ${inv[itemKey]}x de ese objeto.` }, { quoted: msg });
            }

            let precioBase = 30; // Valor por defecto si es muy común o basura
            const keyL = normalize(itemKey);
            for (const d of vData) {
                if (keyL.includes(normalize(d.n))) {
                    precioBase = d.v;
                    break;
                }
            }

            const total = precioBase * cant;

            await db.removerItem(sender, itemKey, cant);
            await db.sumarMonedas(sender, total);

            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
            return sock.sendMessage(chatId, { text: `💰 Has vendido **${cant}x ${itemKey.replace('Pokemon: ', '').trim().toUpperCase()}** por *${total}* diky.` }, { quoted: msg });
        }

        // !logros
        if (start === '!logros') {
            const victorias = u.victorias_duelo || 0;
            const pareja = u.pareja ? `Casado/a con ${u.pareja.split('@')[0]}` : 'Soltero/a 💔';
            return sock.sendMessage(chatId, {
                text: `🏅 *LOGROS DE @${sender.split('@')[0]}*\n━━━━━━━━━━━━━━\n${victorias >= 1 ? '✅' : '🔒'} Primer duelo ganado\n${victorias >= 5 ? '✅' : '🔒'} Gladiador (5 victorias)\n${victorias >= 20 ? '✅' : '🔒'} Campeón (20 victorias)\n${u.pareja ? '✅' : '🔒'} Casado/a ❤️\n${(u.monedas || 0) >= 10000 ? '✅' : '🔒'} 10,000 diky acumulados\n${(u.monedas || 0) >= 50000 ? '✅' : '🔒'} Magnate (+50k)\n━━━━━━━━━━━━━━\n👥 Estado: ${pareja}\n🏆 Victorias en duelo: *${victorias}*`,
                mentions: [sender]
            }, { quoted: msg });
        }

        // !tareas
        if (start === '!tareas') {
            return sock.sendMessage(chatId, {
                text: `📜 *MISIONES DIARIAS* 📜\n━━━━━━━━━━━━━━\n1. 🤺 Ganar un *!duelo*: 🎁 2,000 diky\n2. 🎣 Pescar algo *Raro* o superior: 🎁 1,000 diky\n3. ⛏️ Minar un *Diamante*: 🎁 5,000 diky\n4. 🏹 Cazar un animal *Épico*: 🎁 3,000 diky\n5. 🎰 Ganar al *!slot*: 🎁 500 diky\n━━━━━━━━━━━━━━\n💡 ¡Completa misiones para ganar diky extra!`
            }, { quoted: msg });
        }
    }
};
