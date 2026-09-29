/**
 * ⚔️ DUELOS 2 — más juegos 1v1 (texto + emojis, 0 descargas).
 * Estado en botState.juegos[chatId] con TTL. Premios fijos con anti-farma.
 *
 *   !pares @user      → memorama 4x4 por turnos (!voltea A1 B2)
 *   !ahorcado2 @user  → uno pone la palabra por privado, el otro adivina
 *   !palabron @user   → misma 6 letras, palabra más larga gana (3 rondas)
 *   !esgrima @user    → atacar/bloquear/finta secreto por rondas (!tira)
 *   !puja @user       → precio secreto, más cercano sin pasarse (!puja <n>)
 *   !miento @user     → 2 verdades + 1 mentira, el rival adivina (!cual)
 *   !globo @user      → inflar por turnos, al que le explota pierde (!inflar)
 *   !anagrama @user   → misma palabra revuelta, el más rápido la desordena
 *   !rima @user       → por turnos con la terminación dada (!rima <palabra>)
 */
function rnd(n) { return Math.floor(Math.random() * n); }
function normPal(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function normJ(j) { return (j || '').split('@')[0].replace(/\D/g, ''); }
const BURLAS = [
    '😂 ¡Te bailaron sabroso!',
    '🤣 La próxima trae lentes, que no ves ni la mitad.',
    '💀 RIP. Ni el bot te puede salvar de esa.',
    '😜 Te humillaron en frente de todo el grupo.',
    '🤡 El payaso del grupo eres tú hoy.',
    '🥴 Con esa jugada hasta el bot se rió.',
    '😹 ¡Papelón histórico! Lo voy a contar en todos los grupos.',
    '🙈 Tápate los ojos, que da vergüenza ajena.'
];
const burl = () => BURLAS[rnd(BURLAS.length)];

// --- Diccionario español (Datamuse API, gratis sin key) para !palabron ---
// Si la API falla o tarda, se acepta la palabra (fail-open: mejor dejar pasar
// un invento que tumbar el juego por internet lento).
const dicCache = new Map(); // palabra -> true/false
async function esPalabraReal(pal) {
    if (dicCache.has(pal)) return dicCache.get(pal);
    let ok = true;
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(pal)}&v=es&max=3`, { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error('http ' + r.status);
        const arr = await r.json();
        ok = Array.isArray(arr) && arr.some(w => normPal(w.word) === pal);
    } catch (_) { ok = true; }
    if (dicCache.size > 500) dicCache.clear();
    dicCache.set(pal, ok);
    return ok;
}

// --- Memorama: 12 emojis, se eligen 8 pares al azar ---
const PARES_POOL = ['🍕', '🐱', '⚽', '🚀', '🍩', '🐸', '🎧', '🌮', '🐼', '⚡', '🍇', '🎲'];
const PARES_COLS = ['A', 'B', 'C', 'D'];
function nuevoTableroPares() {
    const elegidos = [...PARES_POOL].sort(() => Math.random() - 0.5).slice(0, 8);
    const fichas = [...elegidos, ...elegidos].sort(() => Math.random() - 0.5);
    const tab = {};
    let i = 0;
    for (let f = 1; f <= 4; f++) for (const c of PARES_COLS) tab[`${c}${f}`] = fichas[i++];
    return tab;
}
function pintarPares(tab, vistos, turnoKey) {
    let r = '　🇦 🇧 🇨 🇩\n';
    for (let f = 1; f <= 4; f++) {
        r += `${f}️⃣`;
        for (const c of PARES_COLS) {
            const k = `${c}${f}`;
            r += tab[k] === null ? '✅' : (vistos.has(k + turnoKey) ? tab[k] : '🟦');
        }
        r += '\n';
    }
    return r;
}

// --- Palabrón: sets de 6 letras con vocales garantizadas ---
const PALABRON_SETS = ['aeslrt', 'aeimnr', 'aelorv', 'aeprst', 'acenot', 'adilno', 'aegirs', 'aeilmt', 'acelrs', 'aeoprs', 'eimnrs', 'ailmno', 'aelnrt', 'aeglnr', 'aeilnr', 'aemnrs', 'aeilrv', 'acdein', 'adeiln', 'aeilns', 'ailnrt', 'aeilpt', 'aeirst', 'ailrst', 'aimnrs', 'aginrs', 'aeilms', 'aelmrs', 'aelnrs', 'adeirs', 'aeilrs', 'aeinrs', 'aeilnt', 'aelprs', 'aenrst', 'aeinrt', 'ailmrs', 'aelmnr', 'adelnr', 'aelrst', 'aeimrt', 'aeimst', 'aeilmt', 'aegirt', 'aeilqr', 'aeimns', 'aelnst', 'aeinst', 'aelnsv', 'aeilnv'];
function sirvePalabron(pal, letras, usadas) {
    if (pal.length < 4 || usadas.has(pal)) return false;
    const disp = {};
    for (const ch of letras) disp[ch] = (disp[ch] || 0) + 1;
    for (const ch of pal) { if (!disp[ch]) return false; disp[ch]--; }
    return true;
}

// --- Puja: objetos con precio secreto ---
const PUJA_OBJETOS = [
    ['📱 un celular gama media', 350], ['🎧 unos audífonos buenos', 80], ['👟 unos tenis de marca', 120],
    ['🍕 una pizza familiar', 15], ['🚲 una bicicleta', 250], ['💻 una laptop', 700],
    ['⌚ un smartwatch', 150], ['🎮 un control de consola', 60], ['📺 un televisor 50”', 450],
    ['☕ una cafetera', 70], ['🎸 una guitarra', 300], ['📷 una cámara', 550],
    ['🛵 una moto usada', 1200], ['🛋️ un sofá', 400], ['🍔 una hamburguesa doble', 8],
    ['🎟️ una entrada al cine VIP', 12], ['📚 una enciclopedia', 90], ['🧥 una chamarra de cuero', 180],
    ['🏀 un balón profesional', 45], ['🪁 una cometa gigante', 20], ['🐶 un cachorro con vacunas', 200],
    ['🌮 una orden de 5 tacos', 7], ['🥤 un refresco de 2 litros', 3], ['🍫 una caja de chocolates', 10],
    ['🧸 un peluche gigante', 35], ['🪴 una planta exótica', 25], ['🔦 una lámpara táctica', 30],
    ['🎤 un micrófono', 110], ['🥁 una batería', 600], ['🎹 un teclado musical', 280],
    ['🚁 un dron con cámara', 500], ['🖨️ una impresora', 160], ['🪑 una silla gamer', 220],
    ['🧢 una gorra firmada', 50], ['👓 unos lentes de sol', 95], ['🎒 una mochila antirrobo', 65],
    ['🍯 un frasco de miel pura', 9], ['🧀 un queso entero', 22], ['🥩 un corte premium 1kg', 28],
    ['🍰 un pastel de bodas', 75], ['🍨 un helado de 5 litros', 18], ['🥑 un costal de aguacates', 40]
];

// --- Miento: tríos ejemplo (1 mentira mezclada) ---
const MIENTO_TRIOS = [
    ['Sé nadar', 'Tengo un tatuaje', 'Hablo 3 idiomas'],
    ['Nunca he llorado con una película', 'Sé cocinar arroz', 'Tengo miedo a la oscuridad'],
    ['He viajado en avión', 'Sé tocar un instrumento', 'Nunca me he caído de la bici'],
    ['Tengo un hermano gemelo', 'Sé hacer malabares', 'Odio el chocolate'],
    ['He conocido a un famoso', 'Sé programar', 'Nunca he roto un hueso'],
    ['Duermo con la luz prendida', 'Sé silbar', 'He ganado un concurso'],
    ['Tengo una fobia rara', 'Sé bailar salsa', 'Nunca he probado el café'],
    ['He llorado de la risa en clase', 'Sé arreglar un carro', 'Tengo buena memoria'],
    ['He dormido en el cine', 'Sé hacer trucos de magia', 'Nunca me he perdido'],
    ['Colecciono algo raro', 'Sé hablar con acentos', 'He plantado un árbol'],
    ['He cantado en karaoke', 'Sé andar en patineta', 'Nunca he comido sushi'],
    ['Tengo un talento secreto', 'Sé leer rápido', 'He visto un OVNI'],
    ['He corrido una maratón', 'Sé tejer', 'Nunca he mentido en un juego'],
    ['He acampado en el monte', 'Sé bucear', 'Tengo alergia a algo común'],
    ['He ganado una apuesta grande', 'Sé imitar voces', 'Nunca he llegado tarde'],
    ['He cocinado para 20 personas', 'Sé escalar', 'Tengo un diario'],
    ['He viajado solo', 'Sé hacer pan', 'Nunca he visto nieve'],
    ['He adoptado una mascota', 'Sé jugar ajedrez', 'Tengo un apodo vergonzoso'],
    ['He trabajado de noche', 'Sé reparar celulares', 'Nunca he ido a un concierto'],
    ['He perdido una apuesta tonta', 'Sé hacer cocteles', 'Tengo un amuleto'],
    ['He montado a caballo', 'Sé dibujar retratos', 'Nunca he probado picante'],
    ['He dormido en un aeropuerto', 'Sé tocar la batería', 'Tengo dos nombres'],
    ['He ganado un torneo', 'Sé hacer origami', 'Nunca he usado lentes'],
    ['He probado comida exótica', 'Sé nadar de espaldas', 'Tengo un récord personal'],
    ['He cantado bajo la lluvia', 'Sé hacer videos', 'Nunca he faltado a clases'],
    ['He visto salir el sol en la playa', 'Sé patinar en hielo', 'Tengo un primo famoso'],
    ['He rescatado un animal', 'Sé hacer rimas', 'Nunca he jugado videojuegos'],
    ['He viajado en barco', 'Sé bailar breakdance', 'Tengo miedo a las alturas'],
    ['He comido insectos', 'Sé hacer velas', 'Nunca he tenido pesadillas'],
    ['He ganado en una rifa', 'Sé tocar el piano', 'Tengo una colección vieja']
];

// --- Globo: burlas de explosión ---
const GLOBO_BURLAS = [
    '💥 ¡PUM! Te explotó en la cara, payaso.',
    '💥 ¡Reventado! Hasta el globo se cansó de ti.',
    '💥 ¡KABOOM! Eso por avaricioso, querías más aire.',
    '💥 ¡Explotó! Te quedó la cara llena de hule.',
    '💥 ¡PUM! El globo dijo “con este no más”.',
    '💥 ¡Reventó! Ni inflar un globo sabes hacer.',
    '💥 ¡BOOM! Saliste volando con todo y globo.',
    '💥 ¡PUM! Esa fue tu última inflada, campeón.'
];

// --- Anagrama: palabras para revolver ---
const ANAGRAMA_BANCO = ['guitarra', 'elefante', 'computadora', 'mariposa', 'telescopio', 'chocolate', 'montaña', 'tiburón', 'biblioteca', 'avión', 'serpiente', 'castillo', 'dragón', 'espejo', 'fantasma', 'jirafa', 'koala', 'linterna', 'murciélago', 'naranja', 'pingüino', 'queso', 'robot', 'sombrero', 'tigre', 'unicornio', 'volcán', 'ballena', 'cactus', 'dinosaurio', 'estrella', 'fresa', 'globo', 'helado', 'isla', 'juguete', 'kiwi', 'león', 'mango', 'nieve', 'oso', 'pelota', 'ratón', 'sandía', 'trompeta', 'uva', 'ventana', 'zapato', 'araña', 'bicicleta', 'camello', 'delfín', 'escorpión', 'foca', 'gorila', 'hormiga', 'iguana', 'jabalí', 'lagarto', 'mono', 'nutria', 'oveja', 'pato', 'rana', 'sapo', 'toro', 'urraca', 'vaca', 'zorro', 'abeja', 'caballo', 'ciervo', 'erizo', 'flamenco', 'gallo', 'hiena', 'lobo', 'mapache', 'panda', 'topo', 'ardilla', 'burro', 'camaleón', 'pavo', 'cisne', 'ganso', 'pulpo', 'calamar', 'medusa', 'caracol', 'lombriz', 'grillo', 'luciérnaga', 'avispa', 'mosquito', 'libélula', 'escarabajo', 'chinche', 'polilla', 'saltamontes', 'cigarra'];
function revolver(pal) {
    let arr;
    do { arr = [...pal].sort(() => Math.random() - 0.5); } while (arr.join('') === pal);
    return arr.join('');
}

// --- Rima: terminaciones ---
const RIMA_TERMINACIONES = ['amor', 'ando', 'ente', 'illa', 'osa', 'ero', 'ada', 'ito', 'una', 'ar', 'ión', 'ura', 'eza', 'al', 'ín', 'ola', 'eta', 'ado', 'ima', 'or', 'ela', 'oso', 'ana', 'ino', 'era', 'azo', 'ija', 'uelo', 'oma', 'izo', 'anda', 'ejo', 'ina', 'oso', 'ata', 'elo', 'ira', 'onte', 'esa', 'ullo'];

async function premiar2(db, win, xp, monedas, chatId) {
    try { return await db.premiarConLimite(win, monedas, xp, chatId); }
    catch (_) { return true; }
}

module.exports = {
    name: 'duelos2',
    isMultiple: true,
    names: ['!pares', '!voltea', '!ahorcado2', '!palabra', '!palabron', '!esgrima', '!tira', '!puja', '!miento', '!cual', '!globo', '!inflar', '!anagrama', '!rima'],
    category: 'Juegos',
    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, isGroup, db, botState } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!isGroup && !(start === '!palabra')) return sock.sendMessage(chatId, { text: '👥 Estos duelos solo funcionan en grupos.' }, { quoted: msg });
        let juego = botState.juegos[chatId];
        const esDuelista = (j) => j && juego && [juego.retador, juego.oponente, juego.responder, juego.pareja].some(x => x && normJ(x) === normJ(j));

        // ============ !pares — memorama 4x4 ============
        if (start === '!pares' || start === '!voltea') {
            if (start === '!pares' && mencionados.length > 0 && (!juego || juego.tipo !== 'pares')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'pares', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🃏 *¡MEMORAMA!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\nTablero 4x4 (8 pares). Por turnos: *!voltea A1 B2*.\nSi haces par, ¡sigues tirando!\n👉 ${nom(rival)}: *!pares si* o *!pares no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (start === '!pares' && ['si', 'no'].includes((args[0] || '').toLowerCase())) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'pares' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.tab = nuevoTableroPares(); juego.puntos = {}; juego.turno = juego.retador; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🃏 *¡A JUGAR!*\n${pintarPares(juego.tab, new Set(), '')}\n👉 ${nom(juego.turno)} voltea: *!voltea A1 B2*`, mentions: [juego.turno] }, { quoted: msg });
            }
            if (start === '!voltea') {
                if (!juego || juego.tipo !== 'pares' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay memorama activo. Reta con *!pares @usuario*.' }, { quoted: msg });
                if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Ese duelo es de otros dos.' }, { quoted: msg });
                if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ Le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
                const a = (args[0] || '').toUpperCase(), b = (args[1] || '').toUpperCase();
                const ok = /^[A-D][1-4]$/;
                if (!ok.test(a) || !ok.test(b) || a === b) return sock.sendMessage(chatId, { text: '⚠️ Uso: *!voltea A1 B2* (letras A-D, números 1-4, dos casillas distintas).' }, { quoted: msg });
                if (juego.tab[a] === null || juego.tab[b] === null) return sock.sendMessage(chatId, { text: '⚠️ Una de esas ya salió, elige otras.' }, { quoted: msg });
                juego._ts = Date.now();
                let txt = `🃏 ${nom(sender)} volteó *${a}* ${juego.tab[a]} y *${b}* ${juego.tab[b]}\n`;
                if (juego.tab[a] === juego.tab[b]) {
                    juego.puntos[sender] = (juego.puntos[sender] || 0) + 1;
                    juego.tab[a] = null; juego.tab[b] = null;
                    txt += `✨ *¡PAR!* Punto para ${nom(sender)} (sigues tirando 🎲)\n`;
                } else {
                    juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
                    txt += `${burl()}\n🔄 Turno de ${nom(juego.turno)}: *!voltea C3 D4*`;
                }
                const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
                txt += `\n📊 ${nom(juego.retador)} ${pR} — ${pO} ${nom(juego.oponente)}`;
                if (pR + pO >= 8) {
                    const win = pR === pO ? null : (pR > pO ? juego.retador : juego.oponente);
                    delete botState.juegos[chatId];
                    if (!win) return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🤝 *¡EMPATE 4-4!* Nadie se lleva nada... aburridos.` }, { quoted: msg });
                    const pagado = await premiar2(db, win, 20, 50, chatId);
                    const lose = win === juego.retador ? juego.oponente : juego.retador;
                    return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} GANA EL MEMORAMA!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: txt, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🃏 Uso: *!pares @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !palabra — poner palabra secreta POR PRIVADO ============
        if (start === '!palabra') {
            if (isGroup) return sock.sendMessage(chatId, { text: '🤫 La palabra secreta se manda POR PRIVADO al bot: *!palabra <palabra>*.' }, { quoted: msg });
            let hallado = null;
            for (const [cid, j] of Object.entries(botState.juegos)) {
                if (j && j.tipo === 'ahorcado2' && j.fase === 'esperando' && normJ(j.retador) === normJ(sender)) { hallado = { cid, j }; break; }
            }
            if (!hallado) return sock.sendMessage(chatId, { text: '❌ No tienes ningún !ahorcado2 esperando palabra.' }, { quoted: msg });
            const pal = normPal(args.join(''));
            if (pal.length < 4 || pal.length > 12 || !/^[a-z]+$/.test(pal)) return sock.sendMessage(chatId, { text: '⚠️ Palabra de 4 a 12 letras (sin números).' }, { quoted: msg });
            hallado.j.palabra = pal; hallado.j.fase = 'juego'; hallado.j.fallos = 0; hallado.j.letras = new Set(); hallado.j._ts = Date.now();
            await sock.sendMessage(chatId, { text: `🤫 Palabra guardada (*${pal.length} letras*). ¡Vuelve al grupo!` });
            const o = hallado.j.oponente;
            return sock.sendMessage(hallado.cid, { text: `🔤 *¡AHORCADO!*\n━━━━━━━━━━━━━━\n${nom(o)}, adivina la palabra de ${nom(sender)}: *${'_ '.repeat(pal.length)}* (${pal.length} letras)\nPrueba con *!ahorcado2 <letra>* — 6 fallos y pierdes.\n💡 También vale *!ahorcado2 <palabra completa>* para arriesgarte.`, mentions: [o, sender] });
        }

        // ============ !ahorcado2 ============
        if (start === '!ahorcado2') {
            const sub = (args[0] || '').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'ahorcado2')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'ahorcado2', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🔤 *¡AHORCADO 1v1!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: ¡uno pone la palabra y el otro adivina!\n👉 ${nom(rival)}: *!ahorcado2 si* o *!ahorcado2 no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'ahorcado2' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'esperando'; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🤫 ${nom(juego.retador)}, mándame la palabra secreta POR PRIVADO: *!palabra <palabra>* (4-12 letras).\n${nom(juego.oponente)}, espera... y reza. 🙏`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'ahorcado2' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '🔤 Uso: *!ahorcado2 @usuario* para retar.' }, { quoted: msg });
            if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Solo el adivinador juega aquí.' }, { quoted: msg });
            if (!sub) return sock.sendMessage(chatId, { text: '🔤 Prueba con *!ahorcado2 <letra>*.' }, { quoted: msg });
            const intento = normPal(sub);
            juego._ts = Date.now();
            const pal = juego.palabra;
            const mostrar = () => [...pal].map(ch => (juego.letras.has(ch) ? ch : '_')).join(' ');
            if (intento.length > 1) {
                if (intento === pal) {
                    delete botState.juegos[chatId];
                    const pagado = await premiar2(db, sender, 20, 50, chatId);
                    return sock.sendMessage(chatId, { text: `🎯 *¡${nom(sender)} LA ADIVINÓ DE UNA!* Era *${pal}*.\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(juego.retador)} ${burl()}`, mentions: [sender, juego.retador] }, { quoted: msg });
                }
                juego.fallos++;
            } else if (/^[a-z]$/.test(intento)) {
                if (juego.letras.has(intento)) return sock.sendMessage(chatId, { text: `⚠️ La *${intento}* ya salió. Actual: ${mostrar()}` }, { quoted: msg });
                juego.letras.add(intento);
                if (!pal.includes(intento)) juego.fallos++;
            } else return sock.sendMessage(chatId, { text: '⚠️ Solo letras o la palabra completa.' }, { quoted: msg });
            if ([...pal].every(ch => juego.letras.has(ch))) {
                delete botState.juegos[chatId];
                const pagado = await premiar2(db, sender, 20, 50, chatId);
                return sock.sendMessage(chatId, { text: `🏆 *¡${nom(sender)} GANA!* La palabra era *${pal}*.\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(juego.retador)} ${burl()}`, mentions: [sender, juego.retador] }, { quoted: msg });
            }
            if (juego.fallos >= 6) {
                const win = juego.retador;
                delete botState.juegos[chatId];
                const pagado = await premiar2(db, win, 20, 50, chatId);
                return sock.sendMessage(chatId, { text: `💀 *¡AHORCADO!* La palabra era *${pal}*.\n🏆 ${nom(win)} gana por ponerla imposible.\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(sender)} ${burl()}`, mentions: [win, sender] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: `🔤 ${mostrar()}\n❌ Fallos: ${juego.fallos}/6 — *!ahorcado2 <letra>*`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !palabron — palabra más larga, 3 rondas ============
        if (start === '!palabron') {
            const sub = args.join('').toLowerCase();
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'palabron')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'palabron', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🔠 *¡PALABRÓN!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: les doy 6 letras y gana quien arme la palabra más larga (3 rondas).\n👉 ${nom(rival)}: *!palabron si* o *!palabron no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (sub === 'si' || sub === 'no') {
                if (!juego || juego.tipo !== 'palabron' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.ronda = 1; juego.puntos = {}; juego.resp = {}; juego.letras = PALABRON_SETS[rnd(PALABRON_SETS.length)]; juego.usadas = new Set(); juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🔠 *RONDA 1/3:* letras *${juego.letras.toUpperCase().split('').join(' ')}*\nArmen su palabra con *!palabron <palabra>* (mínimo 4 letras).`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'palabron' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '🔠 Uso: *!palabron @usuario* para retar.' }, { quoted: msg });
            if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Ese duelo es de otros dos.' }, { quoted: msg });
            const pal = normPal(sub);
            if (pal.length < 4) return sock.sendMessage(chatId, { text: '⚠️ Mínimo 4 letras, piensa en grande. 🧠' }, { quoted: msg });
            if (!sirvePalabron(pal, juego.letras, juego.usadas)) return sock.sendMessage(chatId, { text: `❌ *${pal}* no vale (usa solo las letras dadas y no repetidas). ${burl()}`, mentions: [sender] }, { quoted: msg });
            if (!(await esPalabraReal(pal))) return sock.sendMessage(chatId, { text: `📖 *${pal.toUpperCase()}* no está en el diccionario, inventor. 😏 Busca una palabra de verdad.`, mentions: [sender] }, { quoted: msg });
            juego.resp[sender] = pal; juego.usadas.add(pal); juego._ts = Date.now();
            const otro = sender === juego.retador ? juego.oponente : juego.retador;
            if (!juego.resp[otro]) return sock.sendMessage(chatId, { text: `✅ ${nom(sender)} ya puso la suya. Falta ${nom(otro)}: *!palabron <palabra>*`, mentions: [otro] }, { quoted: msg });
            const wR = juego.resp[juego.retador], wO = juego.resp[juego.oponente];
            let txt = `🔠 *RONDA ${juego.ronda}/3*\n${nom(juego.retador)}: *${wR}* (${wR.length})\n${nom(juego.oponente)}: *${wO}* (${wO.length})\n`;
            if (wR.length !== wO.length) {
                const g = wR.length > wO.length ? juego.retador : juego.oponente;
                juego.puntos[g] = (juego.puntos[g] || 0) + 1;
                txt += `🏅 Ronda para ${nom(g)}\n`;
            } else txt += '🤝 Empate, la RAE llora.\n';
            const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
            txt += `📊 ${pR} — ${pO}`;
            if (juego.ronda >= 3) {
                const win = pR === pO ? null : (pR > pO ? juego.retador : juego.oponente);
                delete botState.juegos[chatId];
                if (!win) return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🤝 *¡EMPATE!* Los dos con el mismo vocabulario de primaria.` }, { quoted: msg });
                const pagado = await premiar2(db, win, 20, 50, chatId);
                const lose = win === juego.retador ? juego.oponente : juego.retador;
                return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} TIENE MÁS DICCIONARIO!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
            }
            juego.ronda++; juego.resp = {}; juego.usadas = new Set(); juego.letras = PALABRON_SETS[rnd(PALABRON_SETS.length)];
            return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🔠 *RONDA ${juego.ronda}/3:* letras *${juego.letras.toUpperCase().split('').join(' ')}*`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
        }

        // ============ !esgrima — atacar/bloquear/finta, 3 toques ============
        if (start === '!esgrima' || start === '!tira') {
            const MOVS = ['atacar', 'bloquear', 'finta'];
            const GANA = { atacar: 'finta', finta: 'bloquear', bloquear: 'atacar' };
            if (start === '!esgrima' && mencionados.length > 0 && (!juego || juego.tipo !== 'esgrima')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'esgrima', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🤺 *¡DUELO DE ESGRIMA!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n⚔️ atacar le gana a finta · finta a bloquear · bloquear a atacar. Primero en dar 3 toques.\n👉 ${nom(rival)}: *!esgrima si* o *!esgrima no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (start === '!esgrima' && ['si', 'no'].includes((args[0] || '').toLowerCase())) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'esgrima' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.toques = {}; juego.mov = {}; juego.ronda = 1; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🤺 *¡EN GUARDIA! RONDA 1*\nElijan en secreto: *!tira atacar* · *!tira bloquear* · *!tira finta*`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            if (start === '!tira') {
                const mov = (args[0] || '').toLowerCase();
                if (!juego || juego.tipo !== 'esgrima' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay duelo activo. Reta con *!esgrima @usuario*.' }, { quoted: msg });
                if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Ese duelo es de otros dos.' }, { quoted: msg });
                if (!MOVS.includes(mov)) return sock.sendMessage(chatId, { text: '⚠️ Opciones: *atacar*, *bloquear* o *finta*.' }, { quoted: msg });
                if (juego.mov[sender]) return sock.sendMessage(chatId, { text: '⏳ Ya elegiste, espera al otro.' }, { quoted: msg });
                juego.mov[sender] = mov; juego._ts = Date.now();
                const otro = sender === juego.retador ? juego.oponente : juego.retador;
                if (!juego.mov[otro]) return sock.sendMessage(chatId, { text: `🤺 ${nom(sender)} ya eligió en secreto. Falta ${nom(otro)}: *!tira <movimiento>*`, mentions: [otro] }, { quoted: msg });
                const mR = juego.mov[juego.retador], mO = juego.mov[juego.oponente];
                let txt = `🤺 *RONDA ${juego.ronda}*\n${nom(juego.retador)}: ${mR} ⚔️ ${nom(juego.oponente)}: ${mO}\n`;
                if (mR !== mO) {
                    const gRonda = GANA[mR] === mO ? juego.retador : juego.oponente;
                    juego.toques[gRonda] = (juego.toques[gRonda] || 0) + 1;
                    txt += `🩸 ¡Toque para ${nom(gRonda)}!\n`;
                } else txt += '🛡️ Chocaron espadas, nadie toca.\n';
                const tR = juego.toques[juego.retador] || 0, tO = juego.toques[juego.oponente] || 0;
                txt += `📊 ${nom(juego.retador)} ${tR} — ${tO} ${nom(juego.oponente)}`;
                if (tR >= 3 || tO >= 3) {
                    const win = tR >= 3 ? juego.retador : juego.oponente;
                    delete botState.juegos[chatId];
                    const pagado = await premiar2(db, win, 20, 50, chatId);
                    const lose = win === juego.retador ? juego.oponente : juego.retador;
                    return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} GANA EL DUELO!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
                }
                juego.ronda++; juego.mov = {};
                return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🤺 *RONDA ${juego.ronda}:* elijan con *!tira <movimiento>*`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🤺 Uso: *!esgrima @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !puja — precio secreto ============
        if (start === '!puja') {
            const arg = args.join(' ');
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'puja')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'puja', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `💰 *¡LA PUJA JUSTA!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: les muestro un objeto y gana quien adivine el precio sin pasarse.\n👉 ${nom(rival)}: *!puja si* o *!puja no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (['si', 'no'].includes(arg.toLowerCase())) {
                if (!juego || juego.tipo !== 'puja' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (arg.toLowerCase() === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                const [obj, precio] = PUJA_OBJETOS[rnd(PUJA_OBJETOS.length)];
                juego.fase = 'juego'; juego.obj = obj; juego.precio = precio; juego.ofertas = {}; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `💰 *¿CUÁNTO CUESTA ${obj.toUpperCase()}?*\nOferten con *!puja <número>* (en diky). El más cercano SIN PASARSE gana.`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            if (/^\d+$/.test(arg.trim())) {
                if (!juego || juego.tipo !== 'puja' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay puja activa. Reta con *!puja @usuario*.' }, { quoted: msg });
                if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Esa puja es de otros dos.' }, { quoted: msg });
                if (juego.ofertas[sender] !== undefined) return sock.sendMessage(chatId, { text: '⏳ Ya ofertaste, espera al otro.' }, { quoted: msg });
                juego.ofertas[sender] = parseInt(arg.trim(), 10); juego._ts = Date.now();
                const otro = sender === juego.retador ? juego.oponente : juego.retador;
                if (juego.ofertas[otro] === undefined) return sock.sendMessage(chatId, { text: `✅ ${nom(sender)} ofertó en secreto. Falta ${nom(otro)}: *!puja <número>*`, mentions: [otro] }, { quoted: msg });
                const p = juego.precio, oR = juego.ofertas[juego.retador], oO = juego.ofertas[juego.oponente];
                const dR = oR > p ? Infinity : p - oR, dO = oO > p ? Infinity : p - oO;
                let txt = `💰 *RESULTADO*\n${juego.obj} cuesta *${p}* diky.\n${nom(juego.retador)}: ${oR} ${oR > p ? '📈 (se pasó)' : ''}\n${nom(juego.oponente)}: ${oO} ${oO > p ? '📈 (se pasó)' : ''}\n`;
                let win = null;
                if (dR !== Infinity || dO !== Infinity) win = dR <= dO ? juego.retador : juego.oponente;
                delete botState.juegos[chatId];
                if (!win) return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🤝 *¡LOS DOS SE PASARON!* Qué par de derrochadores.`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
                const pagado = await premiar2(db, win, 20, 50, chatId);
                const lose = win === juego.retador ? juego.oponente : juego.retador;
                return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} TIENE MEJOR OJO!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '💰 Uso: *!puja @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !miento / !cual — 2 verdades + 1 mentira ============
        if (start === '!miento' || start === '!cual') {
            const resto = args.join(' ');
            if (start === '!miento' && mencionados.length > 0 && (!juego || juego.tipo !== 'miento')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'miento', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🕵️ *¡MIENTE, MIENTE!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: uno dice 2 verdades + 1 mentira y el otro descubre cuál es la mentira.\n👉 ${nom(rival)}: *!miento si* o *!miento no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (start === '!miento' && ['si', 'no'].includes((args[0] || '').toLowerCase())) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'miento' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'escribeA'; juego.puntos = {}; juego._ts = Date.now();
                // La mentira se asigna AQUÍ (al aceptar), no al revelar: el escritor
                // la conoce desde el inicio para defenderla. Si no le llega el privado,
                // se aborta YA y no después de que escribió todo.
                juego.mentiraA = 1 + rnd(3);
                try { await sock.sendMessage(juego.retador, { text: `🤫 Aceptaron tu reto. Cuando escribas tu trío, la MENTIRA será la número *${juego.mentiraA}*. Defiéndela como una verdad.` }); }
                catch (_) { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '❌ No pude escribirle al privado al retador. Que abra chat conmigo primero y repitan el reto.' }, { quoted: msg }); }
                return sock.sendMessage(chatId, { text: `🕵️ ${nom(juego.retador)}, escribe tus 3 frases así:\n*!miento 1.Sé nadar|2.Odio el helado|3.Tengo un gato*\n(o *!miento auto* y las invento yo por ti 😏)\n📩 Ya te mandé al privado cuál será la mentira.\n${nom(juego.oponente)} NO mires... bueno, mira, igual te van a engañar.`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            if (start === '!miento' && juego && juego.tipo === 'miento' && (juego.fase === 'escribeA' || juego.fase === 'escribeB')) {
                const escritor = juego.fase === 'escribeA' ? juego.retador : juego.oponente;
                if (sender !== escritor) return sock.sendMessage(chatId, { text: '👀 Ahora le toca escribir al otro.' }, { quoted: msg });
                let frases, mentira;
                if (resto.toLowerCase() === 'auto') {
                    frases = MIENTO_TRIOS[rnd(MIENTO_TRIOS.length)];
                    // La mentira ya se asignó al aceptar el reto (el escritor ya la conoce)
                    mentira = juego.fase === 'escribeA' ? (juego.mentiraA || (1 + rnd(3))) : (juego.mentiraB || (1 + rnd(3)));
                } else {
                    const partes = resto.split('|').map(s => s.trim().replace(/^[123][.)]\s*/, ''));
                    if (partes.length !== 3 || partes.some(s => s.length < 2)) return sock.sendMessage(chatId, { text: '⚠️ Formato: *!miento 1.frase|2.frase|3.frase* (o *!miento auto*).' }, { quoted: msg });
                    frases = partes;
                    // La mentira ya se asignó al aceptar el reto (el escritor ya la conoce)
                    mentira = juego.fase === 'escribeA' ? (juego.mentiraA || (1 + rnd(3))) : (juego.mentiraB || (1 + rnd(3)));
                }
                juego.frases = frases; juego.mentira = mentira;
                juego.fase = juego.fase === 'escribeA' ? 'adivinaB' : 'adivinaA';
                juego._ts = Date.now();
                const adv = juego.fase === 'adivinaB' ? juego.oponente : juego.retador;
                return sock.sendMessage(chatId, { text: `🕵️ *${nom(escritor)} dice:*\n1️⃣ ${frases[0]}\n2️⃣ ${frases[1]}\n3️⃣ ${frases[2]}\n\n👉 ${nom(adv)}, ¿cuál es la MENTIRA? *!cual <1-3>*`, mentions: [escritor, adv] }, { quoted: msg });
            }
            if (start === '!cual') {
                if (!juego || juego.tipo !== 'miento' || (juego.fase !== 'adivinaB' && juego.fase !== 'adivinaA')) return sock.sendMessage(chatId, { text: '❌ No hay nada que adivinar. Reta con *!miento @usuario*.' }, { quoted: msg });
                const adv = juego.fase === 'adivinaB' ? juego.oponente : juego.retador;
                if (sender !== adv) return sock.sendMessage(chatId, { text: '👀 Le toca adivinar al otro.' }, { quoted: msg });
                const n = parseInt((args[0] || '').trim(), 10);
                if (![1, 2, 3].includes(n)) return sock.sendMessage(chatId, { text: '⚠️ Responde *!cual 1*, *!cual 2* o *!cual 3*.' }, { quoted: msg });
                juego._ts = Date.now();
                const acierto = n === juego.mentira;
                if (acierto) juego.puntos[sender] = (juego.puntos[sender] || 0) + 1;
                let txt = acierto ? `🕵️ *¡${nom(sender)} TE DESCUBRIÓ!* La mentira era la ${juego.mentira}. ¡Qué mentiroso tan malo! 😂` : `😅 ${nom(sender)} cayó redondo: la mentira era la *${juego.mentira}*. ¡Te mintieron en la cara!`;
                if (juego.fase === 'adivinaB') {
                    juego.fase = 'escribeB';
                    // La mentira del 2.º turno también se asigna ANTES de escribir
                    juego.mentiraB = 1 + rnd(3);
                    try { await sock.sendMessage(juego.oponente, { text: `🤫 Te toca escribir. La MENTIRA de tu trío será la número *${juego.mentiraB}*. Defiéndela como una verdad.` }); }
                    catch (_) {
                        const pR2 = juego.puntos[juego.retador] || 0, pO2 = juego.puntos[juego.oponente] || 0;
                        const win2 = pR2 === pO2 ? null : (pR2 > pO2 ? juego.retador : juego.oponente);
                        delete botState.juegos[chatId];
                        let fin = txt + `\n━━━━━━━━━━━━━━\n❌ No pude escribirle al privado a ${nom(juego.oponente)} para la 2.ª ronda. El juego termina aquí.\n📊 ${nom(juego.retador)} ${pR2} — ${pO2} ${nom(juego.oponente)}`;
                        if (!win2) return sock.sendMessage(chatId, { text: fin + `\n🤝 *¡EMPATE!*` }, { quoted: msg });
                        const pagado2 = await premiar2(db, win2, 20, 50, chatId);
                        return sock.sendMessage(chatId, { text: fin + `\n🏆 *¡${nom(win2)} GANA!*\n💰 +50 diky | +20 XP${pagado2 ? '' : db.NOTA_ANTIFARMA}`, mentions: [sender, win2] }, { quoted: msg });
                    }
                    return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🔄 Turno de ${nom(juego.oponente)}: escribe tu trío con *!miento 1..|2..|3..* o *!miento auto*\n📩 Ya te mandé al privado cuál será la mentira.`, mentions: [sender, juego.oponente] }, { quoted: msg });
                }
                const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
                txt += `\n📊 ${nom(juego.retador)} ${pR} — ${pO} ${nom(juego.oponente)}`;
                const win = pR === pO ? null : (pR > pO ? juego.retador : juego.oponente);
                delete botState.juegos[chatId];
                if (!win) return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🤝 *¡EMPATE!* Los dos mienten igual de mal.` }, { quoted: msg });
                const pagado = await premiar2(db, win, 20, 50, chatId);
                const lose = win === juego.retador ? juego.oponente : juego.retador;
                return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} TIENE MEJOR OLFATO!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🕵️ Uso: *!miento @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !globo / !inflar ============
        if (start === '!globo' || start === '!inflar') {
            if (start === '!globo' && mencionados.length > 0 && (!juego || juego.tipo !== 'globo')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'globo', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🎈 *¡EL GLOBO LOCO!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: inflan por turnos (1 a 3 de aire) y al que le EXPLOTE pierde. Nadie sabe el límite... 😈\n👉 ${nom(rival)}: *!globo si* o *!globo no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (start === '!globo' && ['si', 'no'].includes((args[0] || '').toLowerCase())) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'globo' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.aire = 0; juego.limite = 8 + rnd(8); juego.turno = juego.retador; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🎈 *¡A INFLAR!* El globo aguanta entre 8 y 15 de aire... ¿quién será el salado?\n👉 ${nom(juego.turno)}: *!inflar [1-3]*`, mentions: [juego.turno] }, { quoted: msg });
            }
            if (start === '!inflar') {
                if (!juego || juego.tipo !== 'globo' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '❌ No hay globo activo. Reta con *!globo @usuario*.' }, { quoted: msg });
                if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Ese globo es de otros dos.' }, { quoted: msg });
                if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ Le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
                let n = parseInt((args[0] || '1').trim(), 10);
                if (![1, 2, 3].includes(n)) return sock.sendMessage(chatId, { text: '⚠️ Solo 1, 2 o 3 de aire por turno, no seas avaricioso. 😏' }, { quoted: msg });
                juego.aire += n; juego._ts = Date.now();
                if (juego.aire >= juego.limite) {
                    const win = sender === juego.retador ? juego.oponente : juego.retador;
                    delete botState.juegos[chatId];
                    const pagado = await premiar2(db, win, 20, 50, chatId);
                    return sock.sendMessage(chatId, { text: `${GLOBO_BURLAS[rnd(GLOBO_BURLAS.length)]}\n🎈 El globo aguantaba *${juego.limite}* y ${nom(sender)} lo llevó a *${juego.aire}*.\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} GANA!*\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}`, mentions: [sender, win] }, { quoted: msg });
                }
                juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
                const tam = juego.aire <= 4 ? '🎈' : juego.aire <= 8 ? '🎈🎈' : '🎈🎈🎈';
                return sock.sendMessage(chatId, { text: `${tam} ${nom(sender)} le metió *${n}* de aire. Lleva *${juego.aire}*... cruje peligroso. 😬\n👉 Turno de ${nom(juego.turno)}: *!inflar [1-3]*`, mentions: [juego.turno] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🎈 Uso: *!globo @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !anagrama — el más rápido en texto libre ============
        if (start === '!anagrama') {
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'anagrama')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'anagrama', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🔀 *¡ANAGRAMA VELOZ!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: les revuelvo una palabra y el PRIMERO en escribirla bien gana la ronda (5 rondas, ¡sin comando, a pelo!).\n👉 ${nom(rival)}: *!anagrama si* o *!anagrama no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (['si', 'no'].includes((args[0] || '').toLowerCase())) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'anagrama' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.ronda = 1; juego.puntos = {};
                juego.palabra = ANAGRAMA_BANCO[rnd(ANAGRAMA_BANCO.length)]; juego.usadasA = new Set([juego.palabra]); juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🔀 *RONDA 1/5:* desordena esto → *${revolver(juego.palabra).toUpperCase().split('').join(' ')}*\n¡Escríbela bien, sin comando, el más rápido gana! ⚡`, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🔀 Uso: *!anagrama @usuario* para retar.' }, { quoted: msg });
        }

        // ============ !rima — turnos con la terminación ============
        if (start === '!rima') {
            const resto = args.join(' ');
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'rima')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'rima', fase: 'reto', retador: sender, oponente: rival, responder: sender, pareja: rival, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🎤 *¡BATALLA DE RIMAS!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}: les doy una terminación y por turnos riman (5 turnos cada uno, sin repetir).\n👉 ${nom(rival)}: *!rima si* o *!rima no*`, mentions: [sender, rival] }, { quoted: msg });
            }
            if (['si', 'no'].includes((args[0] || '').toLowerCase()) && (!juego || juego.fase === 'reto' || juego.tipo !== 'rima')) {
                const sub = args[0].toLowerCase();
                if (!juego || juego.tipo !== 'rima' || juego.fase !== 'reto') return sock.sendMessage(chatId, { text: '❌ No hay reto pendiente.' }, { quoted: msg });
                if (sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese reto no es para ti.' }, { quoted: msg });
                if (sub === 'no') { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                juego.fase = 'juego'; juego.term = RIMA_TERMINACIONES[rnd(RIMA_TERMINACIONES.length)]; juego.turno = juego.retador; juego.puntos = {}; juego.dichas = new Set(); juego.turnos = 0; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🎤 *¡A RIMAR con “-${juego.term}”!*\n👉 ${nom(juego.turno)} empieza: *!rima <palabra>* (que termine en “${juego.term}”, mínimo ${juego.term.length + 2} letras).`, mentions: [juego.turno] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'rima' || juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '🎤 Uso: *!rima @usuario* para retar.' }, { quoted: msg });
            if (!esDuelista(sender)) return sock.sendMessage(chatId, { text: '👀 Esa batalla es de otros dos.' }, { quoted: msg });
            if (sender !== juego.turno) return sock.sendMessage(chatId, { text: `⏳ Le toca a ${nom(juego.turno)}.`, mentions: [juego.turno] }, { quoted: msg });
            const pal = normPal(resto);
            juego.turnos++; juego._ts = Date.now();
            const vale = pal.length >= juego.term.length + 2 && pal.endsWith(juego.term) && pal !== juego.term && !juego.dichas.has(pal);
            let txt;
            if (vale) {
                juego.puntos[sender] = (juego.puntos[sender] || 0) + 1;
                juego.dichas.add(pal);
                txt = `🎤 ${nom(sender)}: *${pal}* ¡RIMA! 🔥\n`;
            } else {
                const por = juego.dichas.has(pal) ? 'repetida, ¡qué memoria de pollo! 🐔' : 'no rima ni a palos. 🤡';
                txt = `🎤 ${nom(sender)}: *${resto.trim() || '...'}* ... ${por} ${burl()}\n`;
            }
            juego.turno = sender === juego.retador ? juego.oponente : juego.retador;
            const pR = juego.puntos[juego.retador] || 0, pO = juego.puntos[juego.oponente] || 0;
            txt += `📊 ${nom(juego.retador)} ${pR} — ${pO} ${nom(juego.oponente)}`;
            if (juego.turnos >= 10) {
                const win = pR === pO ? null : (pR > pO ? juego.retador : juego.oponente);
                delete botState.juegos[chatId];
                if (!win) return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🤝 *¡EMPATE!* Los dos riman como reguetoneros sin autotune.` }, { quoted: msg });
                const pagado = await premiar2(db, win, 20, 50, chatId);
                const lose = win === juego.retador ? juego.oponente : juego.retador;
                return sock.sendMessage(chatId, { text: txt + `\n━━━━━━━━━━━━━━\n🏆 *¡${nom(win)} ES EL GALLO!* 🎤\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)} ${burl()}`, mentions: [win, lose] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: txt + `\n👉 Turno de ${nom(juego.turno)}: *!rima <palabra>*`, mentions: [juego.turno] }, { quoted: msg });
        }
    }
};
