/**
 * 🧧 JUEGOS CHINOS — grupales, de duración media y con burlas.
 * Inspirados en juegos populares chinos, adaptados a WhatsApp y a 512MB:
 * todo es texto + dados del bot, sin descargas ni audio.
 *
 *   !hongbao @a @b ...  → sobre rojo para los mencionados (máx 5), cada uno !abrir
 *   !abrir              → reclamar tu parte del sobre
 *   !mentiroso @rival   → dados mentirosos con apuesta (!apuesta) y duda (!duda)
 *   !cadena             → encadenar palabras por sus 2 últimas letras
 *   !traidor            → roles secretos, excusas (!soy) y votación (!votar)
 *   !botella @a @b ...  → la botella elimina uno por uno (!girar), el último gana
 */
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];

function normPal(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

// ---- Bancos de burlas y contenido ----
const BURLA_POBRE = [
    'mira nada más, agarró limosna 🧎',
    'hasta el sobre le tuvo lástima 😭',
    'con eso no te alcanza ni pa´ un chicle 🍬',
    'el sobre dijo "pa´ ti poquito" 🤏',
    'agarró las migajas, qué vergüenza 🫣',
    'ni pa´ los pasajes le alcanzó 🚌💨'
];
const BURLA_MENT = [
    '¡UY! Alguien está sudando 🥵',
    'esa apuesta huele a mentira 🤥',
    '¡Ándale, súbele si eres valiente! 🐔',
    'el que duda pierde... o gana 😏',
    '¡DUDAR es de sabios! ...o de miedosos 🙈'
];
const BURLA_CADENA = [
    '¿y esa palabra te la inventaste? 🤡',
    'hasta mi abuela encadena mejor 👵',
    'esa no cuadra ni a martillazos 🔨',
    '¡qué barbaridad! Lee un diccionario 📖',
    'el grupo te está juzgando en silencio 🤫'
];
const BURLA_ELIM = [
    '¡ELIMINADO! A llorar a otro lado 😭',
    'la botella habló, ni modo 🍾',
    '¡fuera! Que pase el siguiente 🚪',
    'ni las manos metiste 🙌❌',
    'el destino te odia hoy 🎯'
];
const CADENA_BANCO = [
    ['comida', 'taco'], ['animal', 'gato'], ['ciudad', 'lima'], ['fruta', 'mango'],
    ['cosa', 'mesa'], ['animal', 'perro'], ['comida', 'sopa'], ['planeta', 'marte'],
    ['cosa', 'libro'], ['animal', 'tigre'], ['fruta', 'pera'], ['ciudad', 'quito'],
    ['comida', 'arroz'], ['cosa', 'silla'], ['animal', 'loro'], ['deporte', 'futbol'],
    ['cosa', 'reloj'], ['animal', 'oso'], ['comida', 'pizza'], ['instrumento', 'guitarra'],
    ['animal', 'ballena'], ['ciudad', 'bogota'], ['cosa', 'ventana'], ['fruta', 'uva']
];
const PISTAS_TRAIDOR = [
    'Anoche alguien se robó las galletas de la cocina 🍪... había migajas hasta la puerta.',
    'El florero roto no se rompió solo. Alguien miente 👀',
    'Se escucharon pasos a las 3am cerca del cuarto del tesoro 🌙',
    'Alguien dejó huellas de lodo en la alfombra nueva 👣',
    'Falta un pedazo del pastel y todos dicen "yo no fui" 🍰',
    'La ventana estaba abierta por dentro... alguien salió por ahí 🪟',
    'El perro ladra cada vez que pasa UNA persona en especial 🐶',
    'Hay un mensaje borrado en el grupo. ¿Quién lo borró? 📱',
    'Alguien trajo doble postre y nadie sabe de dónde salió 🍩🍩',
    'La linterna del patio apareció prendida. Alguien anduvo ahí 🔦',
    'Desapareció el control remoto y apareció en un cuarto ajeno 📺',
    'Alguien sabe demasiado sobre el robo... demasiado 🤔',
    'El chisme dice que el traidor ronca. Investiguen 😴',
    'Se encontró una nota que dice "fui yo"... ¿trampa o confesión? 📝',
    'El gato no se le acerca a una persona. Los gatos saben 🐱',
    'Alguien se puso nervioso cuando mencionaron el robo 😅'
];
const RETOS_BOTELLA = [
    'Manda un audio cantando tu canción favorita 🎤',
    'Escríbele "te extraño" a tu ex y manda captura (luego lo borras) 📱',
    'Ponte de foto la imagen más fea de tu galería por 1 hora 🤳',
    'Declárale tu amor al grupo con un poema improvisado 💘',
    'Haz 10 sentadillas y manda video 🎥',
    'Publica en tu estado "soy fan del bot" por 2 horas 📢',
    'Imita a un animal a tu elección en audio 🐵',
    'Dile un piropo al admin del grupo 😳',
    'Cuenta tu secreto más vergonzoso (light) 🤫',
    'Baila 15 segundos lo que sea y manda video 💃',
    'Habla como robot en tus próximos 3 mensajes 🤖',
    'Regálale 20 diky al ganador con !dar 👛',
    'Manda tu última foto de la galería (la que sea) 🖼️',
    'Pide perdón al grupo por existir hoy 🙏'
];

async function susurrar(sock, chatId, jid, texto) {
    try { await sock.sendMessage(jid, { text: texto }); return true; }
    catch (_) { return false; }
}

module.exports = {
    name: 'chinos',
    isMultiple: true,
    names: ['!hongbao', '!abrir', '!mentiroso', '!apuesta', '!duda', '!cadena', '!traidor', '!soy', '!votar', '!botella', '!girar'],
    category: 'Juegos',

    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, isGroup, db, botState } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Estos juegos solo funcionan en grupos.' }, { quoted: msg });
        let juego = botState.juegos[chatId];

        // ==========================================
        //  !hongbao — sobre rojo para los invitados
        // ==========================================
        if (start === '!hongbao') {
            if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
            const invitados = [...new Set(mencionados.filter(j => j !== sender))].slice(0, 5);
            if (invitados.length === 0) return sock.sendMessage(chatId, { text: '🧧 Uso: *!hongbao @ana @luis @juan* (menciona de 1 a 5 personas).\nYo pongo el sobre, ellos reclaman con *!abrir*.' }, { quoted: msg });
            const total = 100 + rnd(201); // 100-300 diky
            // Reparto al azar con mínimo de 5 por invitado
            let resto = total - invitados.length * 5;
            const partes = {};
            invitados.forEach((jid, i) => {
                let extra = 0;
                if (i < invitados.length - 1) { extra = rnd(resto + 1); resto -= extra; }
                else extra = resto;
                partes[jid] = 5 + extra;
            });
            const jugadores = {};
            invitados.forEach(j => { jugadores[j] = true; });
            botState.juegos[chatId] = { tipo: 'hongbao', creador: sender, invitados, sobrantes: { ...partes }, reclamados: {}, jugadores, _ts: Date.now() };
            return sock.sendMessage(chatId, {
                text: `🧧 *¡SOBRE ROJO!* 🧧\n━━━━━━━━━━━━━━\n${nom(sender)} reparte *${total} diky* entre ${invitados.length}:\n${invitados.map(nom).join(' ')}\n\n👉 Reclamen con *!abrir* (solo invitados).\n🍀 Unos agarran harto y otros... limosna 😏`,
                mentions: [sender, ...invitados]
            }, { quoted: msg });
        }

        // !abrir — reclamar parte del sobre
        if (start === '!abrir') {
            if (!juego || juego.tipo !== 'hongbao') return sock.sendMessage(chatId, { text: '❌ No hay sobre activo. Pide uno con *!hongbao @alguien*.' }, { quoted: msg });
            if (!(sender in juego.sobrantes)) {
                if (sender in (juego.reclamados || {})) return sock.sendMessage(chatId, { text: '🧧 Ya reclamaste tu parte, no seas acaparador.' }, { quoted: msg });
                return sock.sendMessage(chatId, { text: '👀 Ese sobre no era para ti.' }, { quoted: msg });
            }
            const monto = juego.sobrantes[sender];
            // Anti-farma: si pasó el tope, su parte QUEDA guardada y puede
            // reclamarla después (no se borra, para no romper la contabilidad).
            const pagado = await db.premiarConLimite(sender, monto, 0).catch(() => true);
            if (!pagado) {
                return sock.sendMessage(chatId, { text: `🧧 ${nom(sender)}, tu parte (*${monto} diky*) sigue guardada.${db.NOTA_ANTIFARMA}\n👉 Reclama con *!abrir* en un rato.`, mentions: [sender] }, { quoted: msg });
            }
            delete juego.sobrantes[sender];
            juego.reclamados[sender] = monto;
            juego._ts = Date.now();
            const quedan = Object.keys(juego.sobrantes).length;
            if (quedan > 0) {
                return sock.sendMessage(chatId, { text: `🧧 ${nom(sender)} abrió su parte: *${monto} diky*.\n⏳ Faltan ${quedan}: *!abrir*`, mentions: [sender] }, { quoted: msg });
            }
            // Sobre vacío: rey y muerto de hambre
            const ent = Object.entries(juego.reclamados).sort((a, b) => b[1] - a[1]);
            const [rey, top] = ent[0], [pobre, low] = ent[ent.length - 1];
            delete botState.juegos[chatId];
            let txt = `🧧 *¡SOBRE VACÍO!*\n━━━━━━━━━━━━━━\n👑 Rey del sobre: ${nom(rey)} con *${top} diky*.\n💀 El más salado: ${nom(pobre)} con *${low} diky*. ${pick(BURLA_POBRE)}`;
            if (rey === pobre) txt = `🧧 *¡SOBRE VACÍO!*\n━━━━━━━━━━━━━━\n${nom(rey)} se llevó todo: *${top} diky*. Ni pa´ repartir 😤`;
            return sock.sendMessage(chatId, { text: txt, mentions: [rey, pobre] }, { quoted: msg });
        }

        // ==========================================
        //  !mentiroso — dados con apuesta y duda
        //  (1 = comodín, vale como cualquier número)
        // ==========================================
        if (start === '!mentiroso') {
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'mentiroso')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                for (const j of [sender, rival]) {
                    const bal = await db.obtenerBalance(j).catch(() => 0);
                    if (bal < 30) return sock.sendMessage(chatId, { text: `💸 ${nom(j)} no tiene los 30 diky de apuesta inicial.`, mentions: [j] }, { quoted: msg });
                }
                await db.deducirMonedas(sender, 30).catch(() => {});
                await db.deducirMonedas(rival, 30).catch(() => {});
                const dados = { [sender]: [1 + rnd(6), 1 + rnd(6), 1 + rnd(6)], [rival]: [1 + rnd(6), 1 + rnd(6), 1 + rnd(6)] };
                botState.juegos[chatId] = {
                    tipo: 'mentiroso', fase: 'apuesta', retador: sender, oponente: rival,
                    responder: sender, pareja: rival, dados, pote: 60, apuesta: null, ultimo: null, turno: sender, _ts: Date.now()
                };
                const pinta = (d) => d.map(v => `${v}️⃣`).join(' ');
                for (const jid of [sender, rival]) {
                    const ok = await susurrar(sock, chatId, jid, `🎲 *TUS DADOS SECRETOS*\n━━━━━━━━━━━━━━\n${pinta(dados[jid])}\n━━━━━━━━━━━━━━\nEl 1️⃣ es comodín 🃏. Apuesta en el grupo con *!apuesta <cantidad> <valor>* (ej: *!apuesta 3 4* = "hay tres 4s"). Si no crees al otro: *!duda*. ¡No lo compartas!`);
                    if (!ok) await sock.sendMessage(chatId, { text: `${nom(jid)}, tus dados (no te llegó el privado): 🎲 ${pinta(dados[jid])}`, mentions: [jid] });
                }
                return sock.sendMessage(chatId, {
                    text: `🎲 *¡DADOS MENTIROSOS!*\n━━━━━━━━━━━━━━\n${nom(sender)} vs ${nom(rival)}\n💰 Bote: *60 diky* (30 c/u)\n🃏 El 1 es comodín.\n\n👉 ${nom(sender)} apuesta primero: *!apuesta <cantidad> <valor>*\n😏 ¿No le crees? *!duda* (pero si fallas, pagas tú)`,
                    mentions: [sender, rival]
                }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🎲 Uso: *!mentiroso @usuario* para retar (apuesta inicial: 30 diky c/u).' }, { quoted: msg });
        }

        // !apuesta <cantidad> <valor> — subir la apuesta
        if (start === '!apuesta') {
            if (!juego || juego.tipo !== 'mentiroso' || juego.fase !== 'apuesta') return sock.sendMessage(chatId, { text: '❌ No hay partida de mentirosos. Reta con *!mentiroso @usuario*.' }, { quoted: msg });
            if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ No es tu turno, le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
            const cant = parseInt(args[0], 10), valor = parseInt(args[1], 10);
            if (!cant || !valor || cant < 1 || cant > 6 || valor < 1 || valor > 6) return sock.sendMessage(chatId, { text: '🎲 Uso: *!apuesta <cantidad 1-6> <valor 1-6>* (ej: *!apuesta 3 4*).' }, { quoted: msg });
            const prev = juego.apuesta;
            if (prev && !(cant > prev.cant || (cant === prev.cant && valor > prev.valor))) {
                return sock.sendMessage(chatId, { text: `📈 Tienes que SUPERAR la apuesta actual: *${prev.cant} seises... digo, ${prev.cant} ${prev.valor}s*. 🐔 ¿miedo?` }, { quoted: msg });
            }
            juego.apuesta = { cant, valor }; juego.ultimo = sender;
            juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
            juego._ts = Date.now();
            return sock.sendMessage(chatId, {
                text: `🎲 ${nom(sender)} apuesta: *hay ${cant} ${valor}s*.\n${pick(BURLA_MENT)}\n👉 ${nom(juego.turno)}: súbela con *!apuesta* o canta *!duda*`,
                mentions: [sender, juego.turno]
            }, { quoted: msg });
        }

        // !duda — no creerle y revelar
        if (start === '!duda') {
            if (!juego || juego.tipo !== 'mentiroso' || juego.fase !== 'apuesta' || !juego.apuesta) return sock.sendMessage(chatId, { text: '❌ No hay apuesta que dudar. Primero se apuesta, luego se duda.' }, { quoted: msg });
            if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `👀 Solo ${nom(juego.turno)} puede dudar ahora.`, mentions: [juego.turno] }, { quoted: msg });
            const { cant, valor } = juego.apuesta;
            const todos = [...juego.dados[juego.retador], ...juego.dados[juego.oponente]];
            const reales = todos.filter(v => v === valor || (valor !== 1 && v === 1)).length;
            const apostador = juego.ultimo;
            const ganaApostador = reales >= cant;
            const win = ganaApostador ? apostador : sender;
            delete botState.juegos[chatId];
            await db.sumarMonedas(win, juego.pote).catch(() => {});
            const pinta = (d) => d.join(' ');
            return sock.sendMessage(chatId, {
                text: `🎲 *¡REVELACIÓN!*\n━━━━━━━━━━━━━━\n${nom(juego.retador)}: 🎲 ${pinta(juego.dados[juego.retador])}\n${nom(juego.oponente)}: 🎲 ${pinta(juego.dados[juego.oponente])}\n(1 = comodín 🃏)\nApuesta: *${cant} ${valor}s* → hay *${reales}*.\n━━━━━━━━━━━━━━\n${ganaApostador ? `🤥 ¡El apostador DECÍA LA VERDAD! ${nom(sender)} dudó y perdió.` : `🤡 ¡ERA MENTIRA! ${nom(apostador)} fanfarroneó y perdió.`}\n🏆 ${nom(win)} se lleva el bote: *${juego.pote} diky*`,
                mentions: [juego.retador, juego.oponente]
            }, { quoted: msg });
        }

        // ==========================================
        //  !cadena — encadenar palabras (2 letras)
        // ==========================================
        if (start === '!cadena') {
            const palabra = normPal(args.join(''));
            if (!juego || juego.tipo !== 'cadena') {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const ini = pick(CADENA_BANCO);
                botState.juegos[chatId] = {
                    tipo: 'cadena', creador: sender, categoria: ini[0], ultima: normPal(ini[1]),
                    usadas: new Set([normPal(ini[1])]), jugadores: {}, fallos: {}, _ts: Date.now()
                };
                return sock.sendMessage(chatId, { text: `🔗 *¡CADENA DE PALABRAS!*\n━━━━━━━━━━━━━━\n📂 Categoría libre. Empiezo yo: *${ini[1].toUpperCase()}*\n👉 Sigue con *!cadena <palabra>* que empiece con *"${normPal(ini[1]).slice(-2).toUpperCase()}"*.\n❤️ 3 vidas por jugador. El que repite, inventa o se equivoca pierde una. ¡Último en pie gana (+60 diky)!` }, { quoted: msg });
            }
            if (!palabra || palabra.length < 3) return sock.sendMessage(chatId, { text: '🔗 Manda una palabra de verdad: *!cadena <palabra>*.' }, { quoted: msg });
            juego.jugadores[sender] = true;
            const vivos = Object.keys(juego.jugadores).filter(j => (juego.fallos[j] || 0) < 3);
            if (!vivos.includes(sender)) return sock.sendMessage(chatId, { text: `💀 ${nom(sender)}, ya estás eliminado. Mira y aprende.` }, { quoted: msg });
            juego._ts = Date.now();
            const debe = juego.ultima.slice(-2);
            const fail = async (motivo) => {
                juego.fallos[sender] = (juego.fallos[sender] || 0) + 1;
                const quedan = 3 - juego.fallos[sender];
                if (quedan <= 0) {
                    const aun = Object.keys(juego.jugadores).filter(j => (juego.fallos[j] || 0) < 3);
                    let txt = `💥 ${nom(sender)}: *${motivo}*. ${pick(BURLA_CADENA)}\n💀 ¡ELIMINADO!`;
                    if (aun.length === 1 && Object.keys(juego.jugadores).length >= 2) {
                        const win = aun[0];
                        delete botState.juegos[chatId];
                        db.sumarXP(win, 20).catch(() => {});
                        const pagado = await db.premiarConLimite(win, 60, 0).catch(() => true);
                        txt += `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} GANA LA CADENA!*\n💰 +60 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}`;
                        return sock.sendMessage(chatId, { text: txt, mentions: [sender, win] }, { quoted: msg });
                    }
                    return sock.sendMessage(chatId, { text: txt, mentions: [sender] }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: `💥 ${nom(sender)}: *${motivo}*. ${pick(BURLA_CADENA)}\n❤️ Te quedan *${quedan}* vidas. La palabra sigue siendo *${juego.ultima.toUpperCase()}* (busca *"${debe.toUpperCase()}"*)`, mentions: [sender] }, { quoted: msg });
            };
            if (!palabra.startsWith(debe)) return await fail(`"${palabra.toUpperCase()}" no empieza con "${debe.toUpperCase()}"`);
            if (juego.usadas.has(palabra)) return await fail(`"${palabra.toUpperCase()}" ya se usó`);
            juego.usadas.add(palabra); juego.ultima = palabra;
            return sock.sendMessage(chatId, { text: `🔗 ${nom(sender)}: *${palabra.toUpperCase()}* ✅\n👉 Siguiente con *"${palabra.slice(-2).toUpperCase()}"*: *!cadena <palabra>*`, mentions: [sender] }, { quoted: msg });
        }

        // ==========================================
        //  !traidor — roles secretos + excusas + voto
        // ==========================================
        if (start === '!traidor') {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'yo') {
                if (!juego || juego.tipo !== 'traidor' || juego.fase !== 'lobby') return sock.sendMessage(chatId, { text: '❌ No hay lobby abierto. Ábrelo con *!traidor*.' }, { quoted: msg });
                if (juego.apuntados.includes(sender)) return sock.sendMessage(chatId, { text: 'Ya estás dentro, tranquilo.' }, { quoted: msg });
                if (juego.apuntados.length >= 8) return sock.sendMessage(chatId, { text: '🚫 Lobby lleno (máx 8).' }, { quoted: msg });
                juego.apuntados.push(sender); juego.jugadores[sender] = true; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🕵️ ${nom(sender)} se apunta (${juego.apuntados.length}/8).\n👉 El creador empieza con *!traidor empezar* (mín 4).`, mentions: [sender] }, { quoted: msg });
            }
            if (sub === 'empezar') {
                if (!juego || juego.tipo !== 'traidor' || juego.fase !== 'lobby') return sock.sendMessage(chatId, { text: '❌ No hay lobby pendiente.' }, { quoted: msg });
                if (sender !== juego.creador) return sock.sendMessage(chatId, { text: '👑 Solo el creador empieza la partida.' }, { quoted: msg });
                if (juego.apuntados.length < 4) return sock.sendMessage(chatId, { text: `👥 Mínimo 4 jugadores (van ${juego.apuntados.length}). Que se apunten con *!traidor yo*.` }, { quoted: msg });
                const traidor = pick(juego.apuntados);
                juego.traidor = traidor; juego.fase = 'excusas'; juego.excusas = {}; juego.votos = {};
                juego.pista = pick(PISTAS_TRAIDOR); juego._ts = Date.now();
                for (const jid of juego.apuntados) {
                    const esT = jid === traidor;
                    const ok = await susurrar(sock, chatId, jid, esT
                        ? `🗡️ *ERES EL TRAIDOR*\n━━━━━━━━━━━━━━\nDisimula. Cuando pregunten, inventa la excusa más creíble.\nSi te descubren, pierdes. Si sobrevives a la votación, el premio es tuyo 😈`
                        : `😇 *ERES INOCENTE*\n━━━━━━━━━━━━━━\nHay UN traidor entre ustedes. Defiéndete con una buena excusa y vota bien en la ronda de votación.`);
                    if (!ok) {
                        delete botState.juegos[chatId];
                        return sock.sendMessage(chatId, { text: `❌ ${nom(jid)} no recibe privados del bot (escríbeme primero por privado) y sin secreto no hay juego. Partida cancelada.` }, { quoted: msg });
                    }
                }
                return sock.sendMessage(chatId, {
                    text: `🕵️ *¡ROLES REPARTIDOS!*\n━━━━━━━━━━━━━━\n🔎 Pista del caso:\n_${juego.pista}_\n\n❓ *¿Por qué NO eres el traidor?*\nTodos respondan con *!soy <su excusa>* (ej: *!soy yo estaba durmiendo*).\nCuando todos hablen, abro la votación 🗳️`,
                    mentions: juego.apuntados
                }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'traidor') {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'traidor', fase: 'lobby', creador: sender, apuntados: [sender], jugadores: { [sender]: true }, excusas: {}, votos: {}, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🕵️ *¡SE BUSCA AL TRAIDOR!* (de 4 a 8 jugadores)\n━━━━━━━━━━━━━━\n${nom(sender)} abre el lobby.\n👉 Apúntate con *!traidor yo*\n👑 El creador empieza con *!traidor empezar*\n\nHay UN traidor infiltrado... ¿lo descubrirán? 😏`, mentions: [sender] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🕵️ Uso: *!traidor yo* para apuntarte, *!traidor empezar* (creador, mín 4).' }, { quoted: msg });
        }

        // !soy <excusa> — defenderte ante la acusación
        if (start === '!soy') {
            if (!juego || juego.tipo !== 'traidor' || juego.fase !== 'excusas') return sock.sendMessage(chatId, { text: '❌ No hay ronda de excusas activa.' }, { quoted: msg });
            if (!juego.apuntados.includes(sender)) return sock.sendMessage(chatId, { text: '👀 Tú ni juegas, sapo.' }, { quoted: msg });
            if (juego.excusas[sender]) return sock.sendMessage(chatId, { text: 'Ya diste tu excusa, no la cambies 😏' }, { quoted: msg });
            const excusa = args.join(' ').slice(0, 200);
            if (!excusa) return sock.sendMessage(chatId, { text: '🗣️ Di tu excusa: *!soy <por qué no eres el traidor>*.' }, { quoted: msg });
            juego.excusas[sender] = excusa; juego._ts = Date.now();
            const faltan = juego.apuntados.filter(j => !juego.excusas[j]);
            let txt = `🗣️ ${nom(sender)}: _"${excusa}"_\n${faltan.length > 0 ? `⏳ Faltan: ${faltan.map(nom).join(' ')}` : ''}`;
            if (faltan.length === 0) {
                juego.fase = 'votacion';
                txt += `\n━━━━━━━━━━━━━━\n🗳️ *¡A VOTAR!* ¿Quién es el traidor?\nVoten con *!votar @usuario* (una vez cada uno).`;
            }
            return sock.sendMessage(chatId, { text: txt, mentions: juego.apuntados }, { quoted: msg });
        }

        // !votar @user — votar al sospechoso
        if (start === '!votar') {
            if (!juego || juego.tipo !== 'traidor' || juego.fase !== 'votacion') return sock.sendMessage(chatId, { text: '❌ Aún no es hora de votar.' }, { quoted: msg });
            if (!juego.apuntados.includes(sender)) return sock.sendMessage(chatId, { text: '👀 Tú ni juegas.' }, { quoted: msg });
            if (juego.votos[sender]) return sock.sendMessage(chatId, { text: 'Ya votaste, sin trampa 🗳️' }, { quoted: msg });
            if (mencionados.length === 0 || !juego.apuntados.includes(mencionados[0])) return sock.sendMessage(chatId, { text: '🗳️ Vota a un jugador con *!votar @usuario*.' }, { quoted: msg });
            juego.votos[sender] = mencionados[0]; juego._ts = Date.now();
            const faltan = juego.apuntados.filter(j => !juego.votos[j]);
            if (faltan.length > 0) {
                return sock.sendMessage(chatId, { text: `🗳️ ${nom(sender)} votó (secreto 🤫).\n⏳ Faltan: ${faltan.map(nom).join(' ')}`, mentions: faltan }, { quoted: msg });
            }
            // Resolver
            const conteo = {};
            Object.values(juego.votos).forEach(v => { conteo[v] = (conteo[v] || 0) + 1; });
            const orden = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
            const top = orden.filter(([, n]) => n === orden[0][1]).map(([j]) => j);
            const traidor = juego.traidor;
            delete botState.juegos[chatId];
            if (top.length > 1) {
                const pagado = await db.premiarConLimite(traidor, 120, 0).catch(() => true);
                return sock.sendMessage(chatId, { text: `🗳️ *¡EMPATE!* ${top.map(nom).join(' vs ')}.\nEntre la duda, el traidor se escapa por la ventana 🪟💨\n🗡️ El traidor era ${nom(traidor)} y se lleva *120 diky*.${pagado ? '' : db.NOTA_ANTIFARMA}\n😅 Inocentes: se los bailaron sabroso.`, mentions: [...top, traidor] }, { quoted: msg });
            }
            const acusado = top[0];
            if (acusado === traidor) {
                const inocentes = juego.apuntados.filter(j => j !== traidor);
                let algunoBloqueado = false;
                for (const j of inocentes) {
                    const pagado = await db.premiarConLimite(j, 40, 0).catch(() => true);
                    if (!pagado) algunoBloqueado = true;
                }
                return sock.sendMessage(chatId, { text: `🗳️ Con *${orden[0][1]} votos* acusan a ${nom(acusado)}...\n━━━━━━━━━━━━━━\n🎯 *¡ERA EL TRAIDOR!* 🗡️😱\nCada inocente gana *40 diky*. ¡Buen olfato! 👃${algunoBloqueado ? db.NOTA_ANTIFARMA : ''}\n${nom(traidor)}, más suerte disimulando la próxima 🤡`, mentions: [...inocentes, traidor] }, { quoted: msg });
            }
            const pagado = await db.premiarConLimite(traidor, 120, 0).catch(() => true);
            return sock.sendMessage(chatId, { text: `🗳️ Con *${orden[0][1]} votos* acusan a ${nom(acusado)}...\n━━━━━━━━━━━━━━\n😇 *¡ERA INOCENTE!* Lo lincharon de gratis.\n🗡️ El verdadero traidor era ${nom(traidor)} y se lleva *120 diky*.${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(acusado)}, pide indemnización 😭`, mentions: [acusado, traidor] }, { quoted: msg });
        }

        // ==========================================
        //  !botella — eliminación uno por uno
        // ==========================================
        if (start === '!botella') {
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'botella')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const players = [...new Set([sender, ...mencionados])].slice(0, 8);
                if (players.length < 2) return sock.sendMessage(chatId, { text: '🍾 Menciona a quiénes juegan: *!botella @ana @luis*.' }, { quoted: msg });
                const jugadores = {};
                players.forEach(j => { jugadores[j] = true; });
                botState.juegos[chatId] = { tipo: 'botella', creador: sender, vivos: [...players], jugadores, _ts: Date.now() };
                return sock.sendMessage(chatId, {
                    text: `🍾 *¡LA BOTELLA!* 🍾\n━━━━━━━━━━━━━━\nEn la ronda: ${players.map(nom).join(' ')}\n\n👉 Giren con *!girar*. La botella elige víctima, la víctima cumple reto y SALE. El último en pie gana (+60 diky). ¡Que tiemble el que salga! 😈`,
                    mentions: players
                }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🍾 Uso: *!botella @ana @luis @juan* (menciona a los que juegan).' }, { quoted: msg });
        }

        // !girar — girar la botella y eliminar
        if (start === '!girar') {
            if (!juego || juego.tipo !== 'botella') return sock.sendMessage(chatId, { text: '❌ No hay botella girando. Ármala con *!botella @...*.' }, { quoted: msg });
            if (!juego.vivos.includes(sender)) return sock.sendMessage(chatId, { text: '👀 Tú ya saliste (o ni juegas). Solo giran los vivos.' }, { quoted: msg });
            juego._ts = Date.now();
            let bolsa = juego.vivos.filter(j => j !== sender);
            if (bolsa.length === 0) bolsa = [...juego.vivos];
            const victima = pick(bolsa);
            juego.vivos = juego.vivos.filter(j => j !== victima);
            if (juego.vivos.length === 1) {
                const win = juego.vivos[0];
                delete botState.juegos[chatId];
                const subio = await db.sumarXP(win, 20).catch(() => false);
                const pagado = await db.premiarConLimite(win, 60, 0).catch(() => true);
                return sock.sendMessage(chatId, {
                    text: `🍾 *¡GIRA LA BOTELLA!* 🌀\nLa botella apunta a... ${nom(victima)} 😱\n🎲 Reto final: _${pick(RETOS_BOTELLA)}_\n${pick(BURLA_ELIM)}\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} ES EL ÚLTIMO EN PIE!*\n💰 +60 diky | +20 XP${subio ? '\n🆙 ¡SUBIÓ DE NIVEL!' : ''}${pagado ? '' : db.NOTA_ANTIFARMA}`,
                    mentions: [victima, win]
                }, { quoted: msg });
            }
            return sock.sendMessage(chatId, {
                text: `🍾 *¡GIRA LA BOTELLA!* 🌀\nLa botella apunta a... ${nom(victima)} 😱\n🎲 Tu reto: _${pick(RETOS_BOTELLA)}_\n${pick(BURLA_ELIM)}\n━━━━━━━━━━━━━━\nQuedan ${juego.vivos.length}: ${juego.vivos.map(nom).join(' ')}\n👉 Siguiente: *!girar*`,
                mentions: [victima, ...juego.vivos]
            }, { quoted: msg });
        }

        return false;
    }
};
