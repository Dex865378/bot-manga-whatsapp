/**
 * 🎮 MINIJUEGOS — competitivos livianos (texto + emojis, 0 descargas).
 * Sin peso en RAM: el estado vive en botState.juegos[chatId] con TTL.
 *
 * 1v1 (con reto y aceptación):
 *   !dados @user    → duelo de dados al mejor de 5 rondas (!tirar)
 *   !numero @user   → adivina el número secreto 1-100 por turnos (!numero <n>)
 *   !mates @user    → carrera de operaciones, el primero en responder suma (!mates = ver)
 *   !carrera2 @user → carrera a 30 pasos por turnos (!avanza)
 *   !naval @user    → batalla naval 5x5, barcos al azar (!fuego B3)
 * Solo (con récord guardado):
 *   !reflejos       → responde !reflejos ya al ¡AHORA! (marca personal en ms)
 *   !maraton        → 10 operaciones contra reloj (!maraton <respuesta>)
 *   !simon          → repite la secuencia de emojis (!simon 🔥 🐱 ...)
 */
const DADO_EMOJI = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const SIMON_EMOJIS = ['🔥', '🐱', '⚽', '🍕', '🚀', '🐸', '🌙', '⭐'];
const NAVAL_COLS = ['A', 'B', 'C', 'D', 'E'];
const NAVAL_SIZE = 5;
const NAVAL_BARCOS = [3, 2]; // celdas por barco
const METAS = { dados: 3, mates: 5, carrera2: 30 };

function rnd(n) { return Math.floor(Math.random() * n); }

// --- Operaciones de mates/maraton (dificultad rampante) ---
function genOp(nivel) {
    let a, b, op, resp;
    const r = rnd(3);
    if (nivel <= 3) { a = 2 + rnd(18); b = 2 + rnd(18); op = r === 0 ? '-' : '+'; }
    else if (nivel <= 6) { a = 3 + rnd(12); b = 3 + rnd(12); op = ['+', '-', '×'][r]; }
    else { a = 6 + rnd(25); b = 4 + rnd(15); op = ['+', '-', '×'][r]; }
    if (op === '+') resp = a + b;
    else if (op === '-') { if (b > a) [a, b] = [b, a]; resp = a - b; }
    else resp = a * b;
    return { texto: `${a} ${op} ${b}`, resp };
}

// --- Batalla naval: coloca barcos al azar sin traslape ---
function colocarBarcos() {
    const ocupadas = new Set();
    const barcos = [];
    for (const tam of NAVAL_BARCOS) {
        for (let intento = 0; intento < 100; intento++) {
            const horiz = Math.random() < 0.5;
            const f = rnd(NAVAL_SIZE), c = rnd(NAVAL_SIZE);
            const celdas = [];
            for (let i = 0; i < tam; i++) {
                const ff = horiz ? f : f + i, cc = horiz ? c + i : c;
                if (ff >= NAVAL_SIZE || cc >= NAVAL_SIZE) break;
                celdas.push(`${ff},${cc}`);
            }
            if (celdas.length === tam && celdas.every(x => !ocupadas.has(x))) {
                celdas.forEach(x => ocupadas.add(x));
                barcos.push(...celdas);
                break;
            }
        }
    }
    return new Set(barcos);
}

function pintarNavalPropio(barcos, tirosRival) {
    // Tu tablero: 🚢 intacto, 🔥 tocado, ⚪ agua fallada por el rival
    let r = '　🇦​🇧​🇨​🇩​🇪\n';
    for (let f = 0; f < NAVAL_SIZE; f++) {
        r += `${f + 1}️⃣`;
        for (let c = 0; c < NAVAL_SIZE; c++) {
            const k = `${f},${c}`;
            if (tirosRival.has(k)) r += barcos.has(k) ? '🔥' : '⚪';
            else r += barcos.has(k) ? '🚢' : '🌊';
        }
        r += '\n';
    }
    return r;
}

function pintarNavalTiros(misTiros, barcosRival) {
    // Lo que le disparaste: 💥 dado, ⚪ fallado, 🌊 sin probar
    let r = '　🇦​🇧​🇨​🇩​🇪\n';
    for (let f = 0; f < NAVAL_SIZE; f++) {
        r += `${f + 1}️⃣`;
        for (let c = 0; c < NAVAL_SIZE; c++) {
            const k = `${f},${c}`;
            if (!misTiros.has(k)) r += '🌊';
            else r += barcosRival.has(k) ? '💥' : '⚪';
        }
        r += '\n';
    }
    return r;
}

function contarImpactos(tiros, barcos) {
    let n = 0;
    for (const t of tiros) if (barcos.has(t)) n++;
    return n;
}

function barraCarrera(pos, meta) {
    const llenos = Math.min(10, Math.round((pos / meta) * 10));
    return '🟩'.repeat(llenos) + '⬜'.repeat(10 - llenos);
}

async function premiar(db, win, xp, monedas) {
    // Devuelve true si los diky se pagaron (false = tope anti-farma).
    try { return await db.premiarConLimite(win, monedas, xp); }
    catch (_) { return true; }
}

module.exports = {
    name: 'minijuegos',
    isMultiple: true,
    names: ['!dados', '!tirar', '!numero', '!mates', '!carrera2', '!avanza', '!naval', '!fuego', '!reflejos', '!maraton', '!simon'],
    category: 'Juegos',
    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, isGroup, db, botState } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Estos juegos solo funcionan en grupos.' }, { quoted: msg });
        let juego = botState.juegos[chatId];
        const normJ = (j) => (j || '').split('@')[0].replace(/\D/g, '');
        const esDuelista = (j) => j && juego && [juego.retador, juego.oponente, juego.responder, juego.pareja].some(x => x && normJ(x) === normJ(j));

        // ==========================================
        //  !dados — duelo de dados, mejor de 5 rondas
        // ==========================================
        if (start === '!dados') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'dados')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'dados', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, ronda: 1, puntos: {}, tiradas: {}, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🎲 *¡DUELO DE DADOS!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n🏆 Al mejor de 5 rondas (el primero en ganar 3).\n👉 ${nom(rival)}, acepta con *!dados si* o rechaza con *!dados no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'dados' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🎲 *¡RONDA 1!*\n━━━━━━━━━━━━━━\n${nom(juego.retador)} empieza: *!tirar*\n(luego tira ${nom(juego.oponente)})`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🎲 Uso: *!dados @usuario* para retar.' }, { quoted: msg });
        }

        // !tirar — tiro del duelo de dados
        if (start === '!tirar') {
            if (!juego || juego.tipo !== 'dados' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay duelo de dados activo. Reta con *!dados @usuario*.' }, { quoted: msg });
            if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Ese duelo es de otros dos.' }, { quoted: msg });
            if (juego.tiradas[sender] !== undefined) return sock.sendMessage(chatId, { text: '⏳ Ya tiraste esta ronda, espera al otro.' }, { quoted: msg });
            const v = 1 + rnd(6);
            juego.tiradas[sender] = v; juego._ts = Date.now();
            const otro = sender === juego.retador ? juego.oponente : juego.retador;
            if (juego.tiradas[otro] === undefined) {
                return sock.sendMessage(chatId, { text: `🎲 ${nom(sender)} tiró: ${DADO_EMOJI[v - 1]} *(${v})*\n👉 Falta ${nom(otro)}: *!tirar*`, mentions: [otro] }, { quoted: msg });
            }
            // Ronda completa
            const vR = juego.tiradas[juego.retador], vO = juego.tiradas[juego.oponente];
            let txt = `🎲 *RONDA ${juego.ronda}*\n━━━━━━━━━━━━━━\n${nom(juego.retador)}: ${DADO_EMOJI[vR - 1]} (${vR})\n${nom(juego.oponente)}: ${DADO_EMOJI[vO - 1]} (${vO})\n`;
            if (vR !== vO) {
                const gRonda = vR > vO ? juego.retador : juego.oponente;
                juego.puntos[gRonda] = (juego.puntos[gRonda] || 0) + 1;
                txt += `🏅 Punto para ${nom(gRonda)}\n`;
            } else txt += '🤝 Empate en la ronda, nadie suma.\n';
            const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
            txt += `📊 ${nom(juego.retador)} ${pR} — ${pO} ${nom(juego.oponente)}`;
            if (pR >= METAS.dados || pO >= METAS.dados) {
                const win = pR >= METAS.dados ? juego.retador : juego.oponente;
                delete botState.juegos[chatId];
                const pagado = await premiar(db, win, 20, 50);
                txt += `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} GANA EL DUELO!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}`;
                return sock.sendMessage(chatId, { text: txt, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            juego.ronda++; juego.tiradas = {};
            txt += `\n━━━━━━━━━━━━━━\n👉 *RONDA ${juego.ronda}:* ${nom(juego.retador)} empieza con *!tirar*`;
            return sock.sendMessage(chatId, { text: txt, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
        }

        // ==========================================
        //  !numero — adivina el secreto 1-100 por turnos
        // ==========================================
        if (start === '!numero') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'numero')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'numero', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🔢 *¡ADIVINA EL NÚMERO!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n🤔 Pensaré un número del *1 al 100*. Adivinan por turnos y doy pistas.\n👉 ${nom(rival)}, acepta con *!numero si* o rechaza con *!numero no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'numero' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.secreto = 1 + rnd(100); juego.turno = juego.retador; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🔢 *¡EMPIEZA!* Ya pensé mi número (1-100).\n👉 ${nom(juego.retador)} adivina primero: *!numero <n>*`, mentions: [juego.retador] }, { quoted: msg });
            }
            if (/^\d+$/.test(sub)) {
                if (!juego || juego.tipo !== 'numero' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay partida activa. Reta con *!numero @usuario*.' }, { quoted: msg });
                if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Esa partida es de otros dos.' }, { quoted: msg });
                if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ No es tu turno, le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
                const n = parseInt(sub, 10);
                if (n < 1 || n > 100) return sock.sendMessage(chatId, { text: '⚠️ El número es del 1 al 100.' }, { quoted: msg });
                juego._ts = Date.now();
                if (n === juego.secreto) {
                    const win = sender;
                    delete botState.juegos[chatId];
                    const pagado = await premiar(db, win, 15, 40);
                    return sock.sendMessage(chatId, { text: `🎯 *¡${nom(win)} LO ADIVINÓ!* Era el *${juego.secreto}*.\n💰 +40 diky | +15 XP${pagado ? '' : db.NOTA_ANTIFARMA}`, mentions: [win] }, { quoted: msg });
                }
                juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
                const pista = n < juego.secreto ? '📈 Más ALTO' : '📉 Más BAJO';
                return sock.sendMessage(chatId, { text: `${nom(sender)} dice *${n}*: ${pista}.\n👉 Turno de ${nom(juego.turno)}: *!numero <n>*`, mentions: [juego.turno] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🔢 Uso: *!numero @usuario* para retar.' }, { quoted: msg });
        }

        // ==========================================
        //  !mates — carrera de operaciones (el más rápido suma)
        // ==========================================
        if (start === '!mates') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'mates')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const op = genOp(1);
                botState.juegos[chatId] = { tipo: 'mates', fase: 'juego', retador: sender, oponente: rival, responder: sender, pareja: rival, puntos: {}, nivel: 1, op, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `➗ *¡CARRERA DE MATES!*\n━━━━━━━━━━━━━━\n${nom(sender)} 🆚 ${nom(rival)}\n🏁 El primero en llegar a *${METAS.mates} puntos* gana.\n\n❓ *${op.texto} = ?*\n✍️ Respondan el número en el chat (sin comando, el más rápido suma).`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'mates') return sock.sendMessage(chatId, { text: '➗ Uso: *!mates @usuario* para retar.' }, { quoted: msg });
            const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
            return sock.sendMessage(chatId, { text: `➗ *MATES EN CURSO*\n📊 ${nom(juego.retador)} ${pR} — ${pO} ${nom(juego.oponente)}\n❓ *${juego.op.texto} = ?*`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
        }

        // ==========================================
        //  !carrera2 — carrera a 30 pasos por turnos
        // ==========================================
        if (start === '!carrera2') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'carrera2')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'carrera2', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🏁 *¡CARRERA!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n🚀 Meta: *${METAS.carrera2} pasos*. Avanzan por turnos con *!avanza* (1-6 pasos por tiro).\n👉 ${nom(rival)}, acepta con *!carrera2 si* o rechaza con *!carrera2 no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'carrera2' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.pos = {}; juego.turno = juego.retador; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🏁 *¡A CORRER!* Meta: ${METAS.carrera2} pasos.\n👉 ${nom(juego.retador)} empieza: *!avanza*`, mentions: [juego.retador] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🏁 Uso: *!carrera2 @usuario* para retar.' }, { quoted: msg });
        }

        // !avanza — paso de la carrera
        if (start === '!avanza') {
            if (!juego || juego.tipo !== 'carrera2' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay carrera activa. Reta con *!carrera2 @usuario*.' }, { quoted: msg });
            if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Esa carrera es de otros dos.' }, { quoted: msg });
            if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ No es tu turno, le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
            const pasos = 1 + rnd(6);
            juego.pos[sender] = (juego.pos[sender] || 0) + pasos;
            juego._ts = Date.now();
            const pR = juego.pos[juego.retador] || 0, pO = juego.pos[juego.oponente] || 0;
            let txt = `🏃 ${nom(sender)} avanza *+${pasos}* pasos.\n━━━━━━━━━━━━━━\n${nom(juego.retador)}: ${barraCarrera(pR, METAS.carrera2)} ${pR}/${METAS.carrera2}\n${nom(juego.oponente)}: ${barraCarrera(pO, METAS.carrera2)} ${pO}/${METAS.carrera2}`;
            if (juego.pos[sender] >= METAS.carrera2) {
                const win = sender;
                delete botState.juegos[chatId];
                const pagado = await premiar(db, win, 20, 50);
                txt += `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} CRUZA LA META!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}`;
                return sock.sendMessage(chatId, { text: txt, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
            txt += `\n━━━━━━━━━━━━━━\n👉 Turno de ${nom(juego.turno)}: *!avanza*`;
            return sock.sendMessage(chatId, { text: txt, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
        }

        // ==========================================
        //  !naval — batalla naval 5x5 (barcos al azar)
        // ==========================================
        if (start === '!naval') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'naval')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'naval', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🚢 *¡BATALLA NAVAL!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n🌊 Tablero 5x5, escondí *2 barcos* de cada lado (de 3 y 2 casillas). Disparan por turnos con *!fuego B3*.\n👉 ${nom(rival)}, acepta con *!naval si* o rechaza con *!naval no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'naval' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego';
                juego.barcos = { [juego.retador]: colocarBarcos(), [juego.oponente]: colocarBarcos() };
                juego.tiros = { [juego.retador]: new Set(), [juego.oponente]: new Set() };
                juego.turno = juego.retador; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🚢 *¡FUEGO!* Barcos escondidos.\n👉 ${nom(juego.retador)} dispara primero: *!fuego <letra><número>* (ej: *!fuego B3*)`, mentions: [juego.retador] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🚢 Uso: *!naval @usuario* para retar.' }, { quoted: msg });
        }

        // !fuego — disparo de la batalla naval
        if (start === '!fuego') {
            const sub = (args[0] || '').toUpperCase().replace(/\s/g, '');
            const m = /^([A-E])([1-5])$/.exec(sub);
            if (!juego || juego.tipo !== 'naval' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay batalla activa. Reta con *!naval @usuario*.' }, { quoted: msg });
            if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Esa batalla es de otros dos.' }, { quoted: msg });
            if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ No es tu turno, le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
            if (!m) return sock.sendMessage(chatId, { text: '🎯 Uso: *!fuego <letra><número>* (A-E, 1-5). Ej: *!fuego B3*.' }, { quoted: msg });
            const key = `${parseInt(m[2], 10) - 1},${NAVAL_COLS.indexOf(m[1])}`;
            const rival = sender === juego.retador ? juego.oponente : juego.retador;
            if (juego.tiros[sender].has(key)) return sock.sendMessage(chatId, { text: '🔁 Ya disparaste ahí. Elige otra casilla.' }, { quoted: msg });
            juego.tiros[sender].add(key); juego._ts = Date.now();
            const dio = juego.barcos[rival].has(key);
            const hits = contarImpactos(juego.tiros[sender], juego.barcos[rival]);
            const total = [...juego.barcos[rival]].length;
            let txt = dio ? `💥 *¡IMPACTO!* ${nom(sender)} le dio a un barco (${hits}/${total} tocados).` : `🌊 Agua... ${nom(sender)} falló.`;
            if (hits >= total) {
                const win = sender;
                delete botState.juegos[chatId];
                const pagado = await premiar(db, win, 30, 60);
                txt += `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} HUNDE TODA LA FLOTA!*\n💰 +60 diky | +30 XP${pagado ? '' : db.NOTA_ANTIFARMA}`;
                return sock.sendMessage(chatId, { text: txt, mentions: [win] }, { quoted: msg });
            }
            juego.turno = rival;
            txt += `\n━━━━━━━━━━━━━━\n🛡️ *Tu tablero:*\n${pintarNavalPropio(juego.barcos[sender], juego.tiros[rival])}\n🎯 *Tus tiros:*\n${pintarNavalTiros(juego.tiros[sender], juego.barcos[rival])}\n👉 Turno de ${nom(rival)}: *!fuego <casilla>*`;
            return sock.sendMessage(chatId, { text: txt, mentions: [rival] }, { quoted: msg });
        }

        // ==========================================
        //  !reflejos — responde al ¡AHORA! (récord en ms)
        // ==========================================
        if (start === '!reflejos') {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'ya') {
                if (!juego || juego.tipo !== 'reflejos' || juego.jugador !== sender) {
                    if (juego && juego.tipo === 'reflejos') return sock.sendMessage(chatId, { text: '👀 Ese reflejo es de otro.' }, { quoted: msg });
                    return sock.sendMessage(chatId, { text: '⚡ Uso: *!reflejos* para empezar.' }, { quoted: msg });
                }
                if (juego.fase !== 'listo') {
                    delete botState.juegos[chatId];
                    return sock.sendMessage(chatId, { text: '😅 *¡Te adelantaste!* Todavía no decía ¡AHORA!.\n🔄 Empieza de nuevo con *!reflejos*.' }, { quoted: msg });
                }
                const ms = Date.now() - juego.t0;
                delete botState.juegos[chatId];
                let extra = '';
                try {
                    const r = await db.saveRecord('reflejos', sender, ms, true);
                    if (r.nuevo) extra = `\n🏅 *¡NUEVO RÉCORD PERSONAL!* (antes: ${r.anterior !== null ? `${r.anterior}ms` : '—'})`;
                    else extra = `\n📊 Tu mejor: *${r.anterior}ms*`;
                } catch (_) {}
                return sock.sendMessage(chatId, { text: `⚡ ${nom(sender)}: *${ms}ms*${extra}`, mentions: [sender] }, { quoted: msg });
            }
            if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
            botState.juegos[chatId] = { tipo: 'reflejos', fase: 'espera', jugador: sender, responder: sender, _ts: Date.now() };
            await sock.sendMessage(chatId, { text: `⚡ *¡REFLEJOS!*\n━━━━━━━━━━━━━━\n${nom(sender)}, espera el *¡AHORA!* y responde rapidísimo con *!reflejos ya*.\n⚠️ Si te adelantas, pierdes.` , mentions: [sender] }, { quoted: msg });
            const espera = 3000 + rnd(5000);
            setTimeout(async () => {
                try {
                    const j = botState.juegos[chatId];
                    if (!j || j.tipo !== 'reflejos' || j.fase !== 'espera' || j.jugador !== sender) return;
                    j.fase = 'listo'; j.t0 = Date.now(); j._ts = Date.now();
                    await sock.sendMessage(chatId, { text: `⚡⚡ *¡AHORA!* ⚡⚡\n${nom(sender)}, ¡* !reflejos ya* YA!`, mentions: [sender] });
                } catch (_) {}
            }, espera);
            return;
        }

        // ==========================================
        //  !maraton — 10 operaciones contra reloj
        // ==========================================
        if (start === '!maraton') {
            const sub = (args[0] || '').toLowerCase();
            if (!sub) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const op = genOp(1);
                botState.juegos[chatId] = { tipo: 'maraton', jugador: sender, responder: sender, n: 1, op, t0: Date.now(), fallos: 0, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🏃 *¡MARATÓN!* 10 operaciones contra reloj.\n━━━━━━━━━━━━━━\n1️⃣ *${op.texto} = ?*\n✍️ Responde con *!maraton <número>*`, mentions: [sender] }, { quoted: msg });
            }
            if (!/^-?\d+$/.test(sub)) return sock.sendMessage(chatId, { text: '🏃 Uso: *!maraton* para empezar, luego *!maraton <número>*.' }, { quoted: msg });
            if (!juego || juego.tipo !== 'maraton' || juego.jugador !== sender) {
                if (juego && juego.tipo === 'maraton') return sock.sendMessage(chatId, { text: '👀 Esa maratón es de otro.' }, { quoted: msg });
                return sock.sendMessage(chatId, { text: '🏃 Empieza tu maratón con *!maraton*.' }, { quoted: msg });
            }
            if (parseInt(sub, 10) !== juego.op.resp) {
                juego.fallos++; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `❌ No es ${sub}. Sigue intentando: *${juego.op.texto} = ?*` }, { quoted: msg });
            }
            juego.n++; juego._ts = Date.now();
            if (juego.n > 10) {
                const ms = Date.now() - juego.t0;
                const segs = (ms / 1000).toFixed(1);
                delete botState.juegos[chatId];
                let extra = '';
                try {
                    const r = await db.saveRecord('maraton', sender, ms, true);
                    if (r.nuevo) extra = `\n🏅 *¡NUEVO RÉCORD PERSONAL!* (antes: ${r.anterior !== null ? `${(r.anterior / 1000).toFixed(1)}s` : '—'})`;
                    else extra = `\n📊 Tu mejor: *${(r.anterior / 1000).toFixed(1)}s*`;
                } catch (_) {}
                await premiar(db, sender, 10, 0);
                return sock.sendMessage(chatId, { text: `🏁 *¡MARATÓN COMPLETADA!*\n━━━━━━━━━━━━━━\n⏱️ Tiempo: *${segs}s* | ❌ Fallos: ${juego.fallos}${extra}\n+10 XP`, mentions: [sender] }, { quoted: msg });
            }
            juego.op = genOp(juego.n);
            return sock.sendMessage(chatId, { text: `✅ ¡Bien! ${juego.n - 1}/10\n${juego.n}️⃣ *${juego.op.texto} = ?*` }, { quoted: msg });
        }

        // ==========================================
        //  !simon — memoria de emojis (récord)
        // ==========================================
        if (start === '!simon') {
            if (args.length === 0) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const seq = [SIMON_EMOJIS[rnd(SIMON_EMOJIS.length)], SIMON_EMOJIS[rnd(SIMON_EMOJIS.length)]];
                botState.juegos[chatId] = { tipo: 'simon', jugador: sender, responder: sender, seq, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🧠 *¡SIMON DICE!* Memoriza y repite.\n━━━━━━━━━━━━━━\n${seq.join('  ')}\n\n✍️ Repite con *!simon* + los emojis en orden.`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'simon' || juego.jugador !== sender) {
                if (juego && juego.tipo === 'simon') return sock.sendMessage(chatId, { text: '👀 Ese Simón es de otro.' }, { quoted: msg });
                return sock.sendMessage(chatId, { text: '🧠 Empieza con *!simon* (sin nada).' }, { quoted: msg });
            }
            const dicho = args.join('').replace(/\s/g, '');
            const real = juego.seq.join('');
            if (dicho !== real) {
                const nivel = juego.seq.length - 1;
                delete botState.juegos[chatId];
                let extra = '';
                try {
                    const r = await db.saveRecord('simon', sender, juego.seq.length, false);
                    if (r.nuevo) extra = `\n🏅 *¡NUEVO RÉCORD PERSONAL!* (antes: ${r.anterior !== null ? `nivel ${r.anterior - 1}` : '—'})`;
                    else extra = `\n📊 Tu mejor: *nivel ${r.anterior - 1}*`;
                } catch (_) {}
                await premiar(db, sender, 10, 0);
                return sock.sendMessage(chatId, { text: `💥 *¡FALLASTE!* Era: ${juego.seq.join('  ')}\n🏁 Llegaste a *nivel ${nivel}*${extra}\n+10 XP`, mentions: [sender] }, { quoted: msg });
            }
            juego.seq.push(SIMON_EMOJIS[rnd(SIMON_EMOJIS.length)]);
            juego._ts = Date.now();
            return sock.sendMessage(chatId, { text: `✅ ¡Bien! Nivel ${juego.seq.length - 1} superado.\n━━━━━━━━━━━━━━\n${juego.seq.join('  ')}\n\n✍️ Repite con *!simon* + los emojis en orden.` }, { quoted: msg });
        }
    }
};
