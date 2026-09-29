/**
 * ⚔️ JUEGOS PvP — partidas contra otra persona (texto + emojis, 0 descargas).
 * Sin peso en RAM: todo el estado vive en botState.juegos[chatId] con TTL.
 *
 *   !pptpvp @user   → piedra-papel-tijera con números revueltos y revelación
 *   !c4 @user       → conecta 4 por turnos (!c4 si / !c4 <1-7>)
 *   !quizduelo @user→ pregunta para dos, el primero en responder gana
 *   !bingo          → bingo grupal (!bingo yo / !bingo empezar / !bingo cantar)
 */
const PPT_FIGS = ['piedra', 'papel', 'tijera'];
const PPT_EMOJI = { piedra: '✊', papel: '✋', tijera: '✌️' };

// Revuelve [piedra, papel, tijera] en orden aleatorio: el 1 no siempre es piedra
function mapaPPT() {
    const figs = [...PPT_FIGS];
    for (let i = figs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [figs[i], figs[j]] = [figs[j], figs[i]];
    }
    return figs; // índice 0 = número 1, etc.
}

function ganaPPT(a, b) {
    if (a === b) return 0;
    if ((a === 'piedra' && b === 'tijera') || (a === 'papel' && b === 'piedra') || (a === 'tijera' && b === 'papel')) return 1;
    return 2;
}

// --- Conecta 4 ---
function pintarC4(t) {
    let r = '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n';
    for (let f = 0; f < 6; f++) {
        for (let c = 0; c < 7; c++) {
            r += t[f][c] === 'R' ? '🔴' : t[f][c] === 'A' ? '🟡' : '⚪';
        }
        r += '\n';
    }
    return r;
}

function ganadorC4(t) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let f = 0; f < 6; f++) {
        for (let c = 0; c < 7; c++) {
            const v = t[f][c];
            if (!v) continue;
            for (const [df, dc] of dirs) {
                let n = 1, ff = f + df, cc = c + dc;
                while (ff >= 0 && ff < 6 && cc >= 0 && cc < 7 && t[ff][cc] === v) { n++; ff += df; cc += dc; }
                if (n >= 4) return v;
            }
        }
    }
    return t[0].every(x => x) ? 'E' : null;
}

// --- Banco de preguntas del duelo (respuestas cortas, sin repetir pronto) ---
// Formato: [pregunta, respuesta]. La comparación ignora mayúsculas/acentos.
const DUELO_Q = [
    ['¿Capital de Francia?', 'paris'], ['¿Capital de Japón?', 'tokio'], ['¿Capital de Italia?', 'roma'],
    ['¿Capital de México?', 'mexico'], ['¿Capital de Argentina?', 'buenos aires'], ['¿Capital de España?', 'madrid'],
    ['¿Capital de Brasil?', 'brasilia'], ['¿Capital de Canadá?', 'ottawa'], ['¿Capital de China?', 'pekin'],
    ['¿Capital de Rusia?', 'moscu'], ['¿Capital de Egipto?', 'el cairo'], ['¿Capital de Perú?', 'lima'],
    ['¿Capital de Colombia?', 'bogota'], ['¿Capital de Chile?', 'santiago'], ['¿En qué país está la torre Eiffel?', 'francia'],
    ['¿En qué país están las pirámides de Giza?', 'egipto'], ['¿Río más largo del mundo?', 'amazonas'],
    ['¿Océano más grande?', 'pacifico'], ['¿Continente más grande?', 'asia'], ['¿País más grande del mundo?', 'rusia'],
    ['¿Quién pintó la Mona Lisa?', 'da vinci'], ['¿Quién escribió Don Quijote?', 'cervantes'],
    ['¿En qué año llegó el hombre a la luna?', '1969'], ['¿Quién fue el primer presidente de México?', 'guadalupe victoria'],
    ['¿Civilización que construyó Chichén Itzá?', 'maya'], ['¿En qué año empezó la 2da guerra mundial?', '1939'],
    ['¿Quién descubrió América?', 'colon'], ['¿Imperio que construyó el Coliseo?', 'romano'],
    ['¿Símbolo químico del oro?', 'au'], ['¿Símbolo químico del agua?', 'h2o'],
    ['¿Planeta más cercano al sol?', 'mercurio'], ['¿Planeta rojo?', 'marte'], ['¿Planeta con anillos?', 'saturno'],
    ['¿Gas que respiramos para vivir?', 'oxigeno'], ['¿Cuántos huesos tiene el cuerpo humano?', '206'],
    ['¿Órgano más grande del cuerpo?', 'piel'], ['¿Qué planeta es el más grande?', 'jupiter'],
    ['¿Cuántos lados tiene un hexágono?', '6'], ['¿7 x 8?', '56'], ['¿12 x 12?', '144'],
    ['¿100 - 37?', '63'], ['¿15 + 28?', '43'], ['¿9 x 6?', '54'], ['¿81 / 9?', '9'],
    ['¿5 al cuadrado?', '25'], ['¿La mitad de 130?', '65'], ['¿3 x 7 + 5?', '26'],
    ['¿Cuántos minutos hay en una hora?', '60'], ['¿Cuántos días tiene un año bisiesto?', '366'],
    ['¿Protagonista de Naruto?', 'naruto'], ['¿Aldea de Naruto?', 'konoha'], ['¿Maestro de Naruto?', 'kakashi'],
    ['¿Mejor amigo/rival de Naruto?', 'sasuke'], ['¿Protagonista de One Piece?', 'luffy'],
    ['¿Barco de los mugiwara?', 'thousand sunny'], ['¿Espadachín de One Piece?', 'zoro'],
    ['¿Navegante de One Piece?', 'nami'], ['¿Fruta que comió Luffy?', 'gomu gomu'],
    ['¿Protagonista de Dragon Ball?', 'goku'], ['¿Príncipe saiyajin?', 'vegeta'],
    ['¿Esferas que reúnen al dragón?', '7'], ['¿Nombre del dragón de las esferas?', 'shenlong'],
    ['¿Protagonista de Death Note?', 'light'], ['¿Detective rival de Light?', 'l'],
    ['¿Cuaderno que mata al escribir nombres?', 'death note'], ['¿Protagonista de Attack on Titan?', 'eren'],
    ['¿Ciudad amurallada de Attack on Titan?', 'shiganshina'], ['¿Titán acorazado?', 'reiner'],
    ['¿Cazador de demonios protagonista?', 'tanjiro'], ['¿Hermana demonio de Tanjiro?', 'nezuko'],
    ['¿Pilar del agua?', 'tomioka'], ['¿Exorcista de Jujutsu Kaisen?', 'itadori'],
    ['¿Hechicero más fuerte de Jujutsu Kaisen?', 'gojo'], ['¿Deporte de Blue Lock?', 'futbol'],
    ['¿Protagonista de Blue Lock?', 'isagi'], ['¿Cuántos jugadores hay en un equipo de fútbol?', '11'],
    ['¿Cada cuántos años es el mundial?', '4'], ['¿País con más mundiales?', 'brasil'],
    ['¿En qué deporte se usa un bate?', 'beisbol'], ['¿Cuántos sets se juegan en voleibol?', '5'],
    ['¿Moneda de México?', 'peso'], ['¿Idioma oficial de Brasil?', 'portugues'],
    ['¿Festividad mexicana del 2 de noviembre?', 'muertos'], ['¿Platillo mexicano con tortilla y carne?', 'taco'],
    ['¿Bebida mexicana del agave?', 'tequila'], ['¿Volcán mexicano famoso?', 'popocatepetl'],
    ['¿Río que divide México y EE.UU.?', 'bravo'], ['¿Mar entre México y Cuba?', 'caribe'],
    ['¿Color del cielo despejado?', 'azul'], ['¿Cuántas patas tiene una araña?', '8'],
    ['¿Animal que dice miau?', 'gato'], ['¿Animal más rápido del mundo?', 'guepardo'],
    ['¿Ave que no vuela y nada?', 'pinguino'], ['¿Mamífero que vuela?', 'murcielago'],
    ['¿Instrumento con 6 cuerdas?', 'guitarra'], ['¿Cuántas teclas tiene un piano?', '88'],
    ['¿Saga de mago con cicatriz en la frente?', 'harry potter'], ['¿Escuela de Harry Potter?', 'hogwarts'],
    ['¿Droide azul de Star Wars?', 'r2d2'], ['¿Espada de luz de Star Wars?', 'sable'],
    ['¿Superhéroe murciélago?', 'batman'], ['¿Metal del escudo del Capitán América?', 'vibranium'],
    ['¿Guantelete de Thanos?', 'infinito'], ['¿Planeta de Superman?', 'kripton'],
    ['¿Héroe arácnido de Marvel?', 'spiderman'], ['¿Alter ego de Iron Man?', 'tony stark']
];

function normDuelo(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

module.exports = {
    name: 'pvp',
    isMultiple: true,
    names: ['!pptpvp', '!c4', '!quizduelo', '!bingo'],
    category: 'Juegos',
    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, isGroup, db, botState } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Estos juegos solo funcionan en grupos.' }, { quoted: msg });

        // ==========================================
        //  !pptpvp — piedra-papel-tijera vs persona
        // ==========================================
        if (start === '!pptpvp') {
            let juego = botState.juegos[chatId];
            const sub = (args[0] || '').toLowerCase();

            // Retar: !pptpvp @usuario
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'pptpvp')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                const mapaR = mapaPPT(), mapaO = mapaPPT();
                botState.juegos[chatId] = {
                    tipo: 'pptpvp', fase: 'elige', retador: sender, oponente: rival,
                    responder: sender, pareja: rival, mapas: { [sender]: mapaR, [rival]: mapaO },
                    elecciones: {}, _ts: Date.now()
                };
                // Mapa secreto por privado: el número se elige en el grupo pero
                // nadie sabe qué figura esconde hasta la revelación final
                for (const [jid, mapa] of [[sender, mapaR], [rival, mapaO]]) {
                    const txtMapa = `✊✋✌️ *TU MAPA SECRETO*\n━━━━━━━━━━━━━━\n1️⃣ → ${PPT_EMOJI[mapa[0]]} ${mapa[0]}\n2️⃣ → ${PPT_EMOJI[mapa[1]]} ${mapa[1]}\n3️⃣ → ${PPT_EMOJI[mapa[2]]} ${mapa[2]}\n━━━━━━━━━━━━━━\nResponde en el grupo con *!pptpvp <1-3>*. ¡No lo compartas!`;
                    try { await sock.sendMessage(jid, { text: txtMapa }); }
                    catch (_) {
                        await sock.sendMessage(chatId, { text: `${nom(jid)}, tu mapa (no te llegó el privado):\n1️⃣ ${mapa[0]} | 2️⃣ ${mapa[1]} | 3️⃣ ${mapa[2]}`, mentions: [jid] });
                    }
                }
                return sock.sendMessage(chatId, {
                    text: `✊✋✌️ *¡DUELO DE PPT!*\n━━━━━━━━━━━━━━\n${nom(sender)} reta a ${nom(rival)}\n\n📩 Revisen su privado: ahí está su mapa secreto (los números están revueltos, no son iguales para los dos).\n👉 Elijan en el grupo con *!pptpvp <1-3>*`,
                    mentions: [sender, rival]
                }, { quoted: msg });
            }

            // Elegir: !pptpvp <1-3>
            if (/^[1-3]$/.test(sub)) {
                if (!juego || juego.tipo !== 'pptpvp') return sock.sendMessage(chatId, { text: '❌ No hay duelo activo. Reta con *!pptpvp @usuario*.' }, { quoted: msg });
                if (sender !== juego.retador && sender !== juego.oponente) return sock.sendMessage(chatId, { text: '👀 Ese duelo es de otros dos.' }, { quoted: msg });
                if (juego.elecciones[sender]) return sock.sendMessage(chatId, { text: '⏳ Ya elegiste, espera al otro.' }, { quoted: msg });
                juego.elecciones[sender] = juego.mapas[sender][parseInt(sub, 10) - 1];
                juego._ts = Date.now();
                if (!juego.elecciones[juego.retador] || !juego.elecciones[juego.oponente]) {
                    const falta = juego.elecciones[juego.retador] ? juego.oponente : juego.retador;
                    return sock.sendMessage(chatId, { text: `🔒 ${nom(sender)} ya eligió.\n👉 Falta ${nom(falta)}: *!pptpvp <1-3>*`, mentions: [falta] }, { quoted: msg });
                }
                // Revelación final
                const eR = juego.elecciones[juego.retador], eO = juego.elecciones[juego.oponente];
                const g = ganaPPT(eR, eO);
                delete botState.juegos[chatId];
                let final = `✊✋✌️ *¡REVELACIÓN!*\n━━━━━━━━━━━━━━\n${nom(juego.retador)}: ${PPT_EMOJI[eR]} *${eR}*\n${nom(juego.oponente)}: ${PPT_EMOJI[eO]} *${eO}*\n━━━━━━━━━━━━━━\n`;
                if (g === 0) {
                    final += '🤝 *¡EMPATE!* Nadie gana esta vez.';
                    return sock.sendMessage(chatId, { text: final, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
                }
                const win = g === 1 ? juego.retador : juego.oponente;
                const subio = await db.sumarXP(win, 10).catch(() => false);
                await db.sumarMonedas(win, 20).catch(() => {});
                final += `🏆 ¡GANA ${nom(win)}!${subio ? '\n🆙 ¡SUBIÓ DE NIVEL!' : ''}\n💰 +20 diky | +10 XP`;
                return sock.sendMessage(chatId, { text: final, mentions: [juego.retador, juego.oponente] }, { quoted: msg });
            }

            return sock.sendMessage(chatId, { text: '✊ Uso: *!pptpvp @usuario* para retar, luego *!pptpvp <1-3>* para elegir.' }, { quoted: msg });
        }

        // ==========================================
        //  !c4 — conecta 4 contra otro miembro
        // ==========================================
        if (start === '!c4') {
            let juego = botState.juegos[chatId];
            const sub = (args[0] || '').toLowerCase();

            // Retar: !c4 @usuario
            if (mencionados.length > 0 && (!juego || juego.tipo !== 'c4')) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = {
                    tipo: 'c4', fase: 'reto', jugadorR: sender, jugadorA: rival, turno: 'R',
                    responder: sender, pareja: rival,
                    tablero: Array.from({ length: 6 }, () => Array(7).fill('')), _ts: Date.now()
                };
                return sock.sendMessage(chatId, {
                    text: `🔴🟡 *¡RETO DE CONECTA 4!*\n━━━━━━━━━━━━━━\n🔴 ${nom(sender)} reta a 🟡 ${nom(rival)}\n\n${nom(rival)} escribe *!c4 si* para aceptar o *!c4 no* para rechazar.`,
                    mentions: [sender, rival]
                }, { quoted: msg });
            }

            if (!juego || juego.tipo !== 'c4') return sock.sendMessage(chatId, { text: '❌ No hay partida activa. Reta con *!c4 @usuario*.' }, { quoted: msg });
            const soyR = sender === juego.jugadorR, soyA = sender === juego.jugadorA;
            if (!soyR && !soyA) return sock.sendMessage(chatId, { text: '👀 Esa partida es de otros dos. Reta con *!c4 @usuario*.' }, { quoted: msg });

            // Aceptar / rechazar
            if (juego.fase === 'reto') {
                if (sub === 'no' && soyA) { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🚫 Reto rechazado.' }, { quoted: msg }); }
                if (sub === 'si' && soyA) {
                    juego.fase = 'juego'; juego._ts = Date.now();
                    return sock.sendMessage(chatId, {
                        text: `🔴🟡 *¡QUE EMPIECE EL JUEGO!*\n━━━━━━━━━━━━━━\n🔴 ${nom(juego.jugadorR)}  vs  🟡 ${nom(juego.jugadorA)}\n\n${pintarC4(juego.tablero)}\n👉 Turno de ${nom(juego.jugadorR)}: *!c4 <1-7>*`,
                        mentions: [juego.jugadorR, juego.jugadorA]
                    }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: `⏳ Esperando a ${nom(juego.jugadorA)}: *!c4 si* o *!c4 no*.`, mentions: [juego.jugadorA] });
            }

            // Jugar: !c4 <1-7>
            const col = parseInt(sub, 10);
            const miFicha = soyR ? 'R' : 'A';
            if (!col || col < 1 || col > 7) return sock.sendMessage(chatId, { text: `🎯 Tu turno: *!c4 <1-7>*\n\n${pintarC4(juego.tablero)}` }, { quoted: msg });
            if (juego.turno !== miFicha) return sock.sendMessage(chatId, { text: '⏳ No es tu turno.' }, { quoted: msg });
            const c = col - 1;
            let fila = -1;
            for (let f = 5; f >= 0; f--) { if (!juego.tablero[f][c]) { fila = f; break; } }
            if (fila < 0) return sock.sendMessage(chatId, { text: '🚫 Columna llena, elige otra.' }, { quoted: msg });
            juego.tablero[fila][c] = miFicha;
            juego._ts = Date.now();
            const g = ganadorC4(juego.tablero);
            if (g) {
                delete botState.juegos[chatId];
                if (g === 'E') return sock.sendMessage(chatId, { text: `🤝 *¡EMPATE!*\n━━━━━━━━━━━━━━\n${pintarC4(juego.tablero)}\nBuena partida.` });
                const win = g === 'R' ? juego.jugadorR : juego.jugadorA;
                const subio = await db.sumarXP(win, 15).catch(() => false);
                await db.sumarMonedas(win, 30).catch(() => {});
                return sock.sendMessage(chatId, {
                    text: `🏆 *¡${nom(win)} CONECTA 4!*\n━━━━━━━━━━━━━━\n${pintarC4(juego.tablero)}\n💰 +30 diky | +15 XP${subio ? '\n🆙 ¡SUBIÓ DE NIVEL!' : ''}`,
                    mentions: [juego.jugadorR, juego.jugadorA]
                }, { quoted: msg });
            }
            juego.turno = juego.turno === 'R' ? 'A' : 'R';
            const toca = juego.turno === 'R' ? juego.jugadorR : juego.jugadorA;
            return sock.sendMessage(chatId, {
                text: `${pintarC4(juego.tablero)}\n👉 Turno de ${nom(toca)}: *!c4 <1-7>*`,
                mentions: [toca]
            }, { quoted: msg });
        }

        // ==========================================
        //  !quizduelo — pregunta para dos, el más rápido gana
        // ==========================================
        if (start === '!quizduelo') {
            const juego = botState.juegos[chatId];
            if (mencionados.length > 0 && (!juego)) {
                const rival = mencionados[0];
                if (rival === sender) return sock.sendMessage(chatId, { text: '😅 No puedes retarte a ti mismo.' }, { quoted: msg });
                const [pregunta, respuesta] = DUELO_Q[Math.floor(Math.random() * DUELO_Q.length)];
                const sent = await sock.sendMessage(chatId, {
                    text: `🧠⚡ *¡DUELO DE PREGUNTAS!*\n━━━━━━━━━━━━━━\n${nom(sender)}  vs  ${nom(rival)}\n\n❓ *${pregunta}*\n\nEl primero en responder bien gana. ¡Rápido!\n💡 Responde CITANDO este mensaje con tu respuesta.`,
                    mentions: [sender, rival]
                }, { quoted: msg });
                botState.juegos[chatId] = {
                    tipo: 'quizduelo', pregunta, respuesta,
                    responder: sender, pareja: rival,
                    msgId: sent?.key?.id || null, _ts: Date.now()
                };
                return;
            }
            if (juego && juego.tipo === 'quizduelo') {
                return sock.sendMessage(chatId, { text: `⏳ Duelo en curso, responde CITANDO la pregunta:\n❓ *${juego.pregunta}*` }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: '🧠 Uso: *!quizduelo @usuario*\nEl primero de los dos en responder bien gana.' }, { quoted: msg });
        }

        // ==========================================
        //  !bingo — bingo grupal
        // ==========================================
        if (start === '!bingo') {
            let juego = botState.juegos[chatId];
            const sub = (args[0] || '').toLowerCase();

            // Crear sala: !bingo
            if (!sub) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'bingo', fase: 'registro', creador: sender, responder: sender, jugadores: {}, cantados: [], _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🎱 *¡SALA DE BINGO ABIERTA!*\n━━━━━━━━━━━━━━\nÚnete con *!bingo yo*.\nCuando estén listos, el creador escribe *!bingo empezar*.\n🎰 Serán 50 bolas, cartón de 12 números.` }, { quoted: msg });
            }

            if (!juego || juego.tipo !== 'bingo') return sock.sendMessage(chatId, { text: '❌ No hay bingo activo. Ábrelo con *!bingo*.' }, { quoted: msg });

            // Unirse: !bingo yo
            if (sub === 'yo') {
                if (juego.fase !== 'registro') return sock.sendMessage(chatId, { text: '🚫 El registro ya cerró, espera al próximo bingo.' }, { quoted: msg });
                if (juego.jugadores[sender]) return sock.sendMessage(chatId, { text: '✅ Ya tienes tu cartón, espera el inicio.' }, { quoted: msg });
                const nums = new Set();
                while (nums.size < 12) nums.add(Math.floor(Math.random() * 50) + 1);
                juego.jugadores[sender] = { carton: [...nums].sort((a, b) => a - b), aciertos: [] };
                juego._ts = Date.now();
                const lista = Object.keys(juego.jugadores).map(nom).join(' ');
                try { await sock.sendMessage(sender, { text: `🎱 *TU CARTÓN*\n━━━━━━━━━━━━━━\n${juego.jugadores[sender].carton.join(' · ')}\n━━━━━━━━━━━━━━\nGuárdalo, ¡suerte!` }); }
                catch (_) {
                    await sock.sendMessage(chatId, { text: `${nom(sender)}, tu cartón (no te llegó el privado):\n${juego.jugadores[sender].carton.join(' · ')}`, mentions: [sender] });
                }
                return sock.sendMessage(chatId, { text: `✅ ${nom(sender)} se unió (${Object.keys(juego.jugadores).length} jugando).\n👥 ${lista}`, mentions: Object.keys(juego.jugadores) }, { quoted: msg });
            }

            // Empezar: !bingo empezar (creador)
            if (sub === 'empezar') {
                if (sender !== juego.creador) return sock.sendMessage(chatId, { text: `⏳ Solo ${nom(juego.creador)} puede empezar el bingo.` }, { quoted: msg });
                if (juego.fase !== 'registro') return sock.sendMessage(chatId, { text: 'El bingo ya empezó.' }, { quoted: msg });
                if (Object.keys(juego.jugadores).length < 2) return sock.sendMessage(chatId, { text: '👥 Se necesitan al menos 2 jugadores (*!bingo yo*).' }, { quoted: msg });
                juego.fase = 'juego'; juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🎱 *¡QUE EMPIECE EL BINGO!* 🎱\n━━━━━━━━━━━━━━\n${Object.keys(juego.jugadores).length} jugadores.\nCanten bolas con *!bingo cantar*.\n🏆 Bingo completo = +100 diky y +50 XP.` }, { quoted: msg });
            }

            // Cantar: !bingo cantar
            if (sub === 'cantar') {
                if (juego.fase !== 'juego') return sock.sendMessage(chatId, { text: '⏳ Primero *!bingo empezar*.' }, { quoted: msg });
                if (juego.cantados.length >= 50) { delete botState.juegos[chatId]; return sock.sendMessage(chatId, { text: '🎱 Se acabaron las bolas sin ganador. ¡Otra ronda con *!bingo*!' }); }
                let bola;
                do { bola = Math.floor(Math.random() * 50) + 1; } while (juego.cantados.includes(bola));
                juego.cantados.push(bola);
                juego._ts = Date.now();
                const ganadores = [];
                for (const [jid, j] of Object.entries(juego.jugadores)) {
                    if (j.carton.includes(bola) && !j.aciertos.includes(bola)) j.aciertos.push(bola);
                    if (j.aciertos.length >= j.carton.length) ganadores.push(jid);
                }
                if (ganadores.length > 0) {
                    delete botState.juegos[chatId];
                    for (const g of ganadores) { await db.sumarXP(g, 50).catch(() => {}); await db.sumarMonedas(g, 100).catch(() => {}); }
                    return sock.sendMessage(chatId, {
                        text: `🎱 ¡BOLA ${bola}!\n━━━━━━━━━━━━━━\n🎉🎉 *¡BINGOOO!* 🎉🎉\n🏆 ${ganadores.map(nom).join(' ')} completaron su cartón.\n💰 +100 diky | +50 XP c/u`,
                        mentions: ganadores
                    }, { quoted: msg });
                }
                return sock.sendMessage(chatId, { text: `🎱 ¡BOLA *${bola}*! (van ${juego.cantados.length}/50)\n👉 *!bingo cantar* para la siguiente.` }, { quoted: msg });
            }

            // Ver cartón: !bingo carton
            if (sub === 'carton') {
                const j = juego.jugadores[sender];
                if (!j) return sock.sendMessage(chatId, { text: '❌ No estás en este bingo.' }, { quoted: msg });
                const faltan = j.carton.filter(n => !j.aciertos.includes(n));
                return sock.sendMessage(chatId, { text: `🎱 Tu cartón: ${j.carton.join(' · ')}\n✅ Aciertos (${j.aciertos.length}/${j.carton.length}): ${j.aciertos.join(' · ') || '—'}\n🎯 Te faltan: ${faltan.join(' · ') || '¡nada!'}` }, { quoted: msg });
            }

            return sock.sendMessage(chatId, { text: '🎱 Uso: *!bingo* (abrir) → *!bingo yo* → *!bingo empezar* → *!bingo cantar*.' }, { quoted: msg });
        }

        return false;
    }
};
