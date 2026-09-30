/**
 * 🎮 MANEJADOR DE RESPUESTAS A JUEGOS ACTIVOS
 */
async function handleGameResponse(sock, msg, context) {
    const { chatId, sender, cmd, txt, quotedMsgId, botState, db, isCommand } = context;

    if (!botState.juegos[chatId]) return false;

    const juego = botState.juegos[chatId];
    // TTL anti-bloqueo: si el usuario abandona a mitad de partida el juego
    // quedaba para siempre y bloqueaba nuevos (fun.js/trivia.js rechazan si
    // existe). 10 min sin respuesta → liberar el chat en silencio.
    if (!juego._ts) juego._ts = Date.now();
    else if (Date.now() - juego._ts > 10 * 60 * 1000) {
        delete botState.juegos[chatId];
        return false;
    }
    // Juegos por comando (!ttt, !pptpvp, !c4, !bingo): todo se juega con el
    // comando. Aquí solo se refresca el TTL si habla un jugador y se deja
    // pasar al resto del pipeline.
    if (['ttt', 'pptpvp', 'c4', 'bingo', 'dados', 'numero', 'carrera2', 'naval', 'hongbao', 'mentiroso', 'cadena', 'traidor', 'botella', 'pares', 'ahorcado2', 'palabron', 'esgrima', 'puja', 'miento', 'globo', 'rima', 'wordle', 'intruso', 'supervivencia', 'cazatesoros', 'ruleta2', 'escalera', 'caja'].includes(juego.tipo)) {
        const norm = (j) => (j || '').split('@')[0].replace(/\D/g, '');
        const js = [juego.jugadorX, juego.jugadorO, juego.retador, juego.oponente, juego.jugadorR, juego.jugadorA, juego.creador, ...Object.keys(juego.jugadores || {})].map(norm);
        if (js.includes(norm(sender))) juego._ts = Date.now();
        return false;
    }
    const normDuelo = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
    // Carrera de mates: el primero de los dos en escribir la respuesta
    // exacta suma punto (sin cita, es carrera de velocidad; los fallos no
    // avisan para no spamear). Al llegar a 5 puntos se libera el chat.
    if (juego.tipo === 'mates') {
        if (isCommand) return false;
        const normSender = (sender || '').split('@')[0].replace(/\D/g, '');
        const esDuelista = [juego.responder, juego.pareja].some(j => j && (j.split('@')[0].replace(/\D/g, '') === normSender));
        if (!esDuelista) return false;
        if (normDuelo(txt) !== String(juego.op.resp)) return true; // fallo en silencio
        juego._ts = Date.now();
        juego.puntos[sender] = (juego.puntos[sender] || 0) + 1;
        const pR = juego.puntos[juego.responder] || 0, pO = juego.puntos[juego.pareja] || 0;
        const nomM = (j) => `@${(j || '').split('@')[0]}`;
        if (juego.puntos[sender] >= 5) {
            const win = sender;
            delete botState.juegos[chatId];
            const pagado = await db.premiarConLimite(win, 50, 20, chatId).catch(() => true);
            await sock.sendMessage(chatId, { text: `➗ *¡${nomM(win)} GANA LA CARRERA!* 🏁 ${Math.max(pR, pO)} puntos.\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}`, mentions: [juego.responder, juego.pareja] }, { quoted: msg });
            return true;
        }
        juego.nivel++;
        juego.op = (() => {
            const n = juego.nivel;
            let a, b, op, r;
            const rr = Math.floor(Math.random() * 3);
            if (n <= 3) { a = 2 + Math.floor(Math.random() * 18); b = 2 + Math.floor(Math.random() * 18); op = rr === 0 ? '-' : '+'; }
            else if (n <= 6) { a = 3 + Math.floor(Math.random() * 12); b = 3 + Math.floor(Math.random() * 12); op = ['+', '-', '×'][rr]; }
            else { a = 6 + Math.floor(Math.random() * 25); b = 4 + Math.floor(Math.random() * 15); op = ['+', '-', '×'][rr]; }
            if (op === '+') r = a + b;
            else if (op === '-') { if (b > a) { const t = a; a = b; b = t; } r = a - b; }
            else r = a * b;
            return { texto: `${a} ${op} ${b}`, resp: r };
        })();
        await sock.sendMessage(chatId, { text: `⚡ ¡${nomM(sender)} suma! 📊 ${Math.max(pR, pO)}-${Math.min(pR, pO)}\n❓ *${juego.op.texto} = ?*`, mentions: [juego.responder, juego.pareja] }, { quoted: msg });
        return true;
    }
    // Anagrama veloz: el primero de los dos en escribir la palabra bien
    // (texto libre, sin comando) gana la ronda. 5 rondas, más puntos gana.
    if (juego.tipo === 'anagrama') {
        if (isCommand) return false;
        const normSender = (sender || '').split('@')[0].replace(/\D/g, '');
        const esDuelista = [juego.responder, juego.pareja].some(j => j && (j.split('@')[0].replace(/\D/g, '') === normSender));
        if (!esDuelista) return false;
        if (normDuelo(txt) !== normDuelo(juego.palabra)) return true; // fallo en silencio (es carrera)
        juego._ts = Date.now();
        juego.puntos[sender] = (juego.puntos[sender] || 0) + 1;
        const pR = juego.puntos[juego.responder] || 0, pO = juego.puntos[juego.pareja] || 0;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        if (juego.ronda >= 5) {
            const win = pR === pO ? null : (pR > pO ? juego.responder : juego.pareja);
            delete botState.juegos[chatId];
            if (!win) {
                await sock.sendMessage(chatId, { text: `🔀 *¡EMPATE ${Math.max(pR, pO)}-${Math.min(pR, pO)}!* Los dos deletrean igual de rápido.` }, { quoted: msg });
                return true;
            }
            const pagado = await db.premiarConLimite(win, 50, 20, chatId).catch(() => true);
            const lose = win === juego.responder ? juego.pareja : juego.responder;
            await sock.sendMessage(chatId, { text: `🔀⚡ *¡${nom(win)} DESORDENÓ PRIMERO!* Era *${juego.palabra.toUpperCase()}*.\n📊 ${Math.max(pR, pO)}-${Math.min(pR, pO)}\n💰 +50 diky | +20 XP${pagado ? '' : db.NOTA_ANTIFARMA}\n${nom(lose)}, hasta el diccionario te ganó. 😂`, mentions: [win, lose] }, { quoted: msg });
            return true;
        }
        juego.ronda++;
        const era = juego.palabra;
        const bancoA = ['guitarra', 'elefante', 'mariposa', 'chocolate', 'montaña', 'tiburón', 'castillo', 'linterna', 'pingüino', 'sombrero', 'ballena', 'dinosaurio', 'estrella', 'serpiente', 'dragón', 'fantasma', 'jirafa', 'murciélago', 'robot', 'tigre', 'volcán', 'cactus', 'trompeta', 'ventana', 'bicicleta', 'delfín', 'gorila', 'lagarto', 'pulpo', 'caracol'];
        let pal = bancoA[Math.floor(Math.random() * bancoA.length)];
        if (juego.usadasA.has(pal)) pal = bancoA.find(w => !juego.usadasA.has(w)) || pal;
        juego.usadasA.add(pal);
        juego.palabra = pal;
        let rev = [...pal].sort(() => Math.random() - 0.5).join('');
        if (rev === pal) rev = [...pal].reverse().join('');
        await sock.sendMessage(chatId, { text: `🔀 *¡${nom(sender)} suma!* Era *${era.toUpperCase()}* 📊 ${Math.max(pR, pO)}-${Math.min(pR, pO)}\n*RONDA ${juego.ronda}/5:* → *${rev.toUpperCase().split('').join(' ')}*`, mentions: [juego.responder, juego.pareja] }, { quoted: msg });
        return true;
    }
    // Palabras genéricas que se ignoran al comparar ("océano pacífico" vale
    // igual que "pacífico"). Solo se quitan si queda algo en AMBOS lados.
    const STOP_DUELO = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'y', 'oceano', 'mar', 'rio', 'lago', 'laguna', 'monte', 'montana', 'volcan', 'ciudad', 'pais', 'isla', 'desierto']);
    const sinGenericas = (s) => {
        const partes = normDuelo(s).split(/\s+/).filter(w => w && !STOP_DUELO.has(w));
        return partes.join(' ');
    };
    const respuestasEquivalentes = (dicho, correcta) => {
        const a = normDuelo(dicho), b = normDuelo(correcta);
        if (!a || !b) return false;
        if (a === b) return true;
        const sa = sinGenericas(dicho), sb = sinGenericas(correcta);
        if (sa && sb && sa === sb) return true;
        // Contención: "pacifico" dentro de "oceano pacifico" y viceversa.
        // Se exige mínimo 4 letras en el lado corto para no aceptar "mar" por "marte".
        const corto = sa.length <= sb.length ? sa : sb;
        const largo = sa.length <= sb.length ? sb : sa;
        if (corto.length >= 4 && (largo === corto || largo.split(/\s+/).includes(corto) || largo.includes(` ${corto}`) || largo.startsWith(`${corto} `))) return true;
        return false;
    };
    // Duelo de preguntas: solo cuenta si la respuesta CITA el mensaje de la
    // pregunta (así la charla normal del grupo no dispara el juego ni avisos
    // de fallo). El primero de los dos en acertar gana; si fallan se les
    // avisa para que sigan intentando. Se compara por número normalizado
    // porque el JID de la mención y el del remitente pueden venir en distinto
    // formato. Si msgId no se pudo guardar al crear, se acepta sin cita.
    if (juego.tipo === 'quizduelo') {
        if (isCommand) return false;
        if (juego.msgId && quotedMsgId !== juego.msgId) return false;
        const normSender = (sender || '').split('@')[0].replace(/\D/g, '');
        const esDuelista = [juego.responder, juego.pareja].some(j => j && (j.split('@')[0].replace(/\D/g, '') === normSender));
        if (!esDuelista) return false;
        juego._ts = Date.now();
        if (respuestasEquivalentes(txt, juego.respuesta)) {
            const win = sender, lose = sender === juego.responder ? juego.pareja : juego.responder;
            delete botState.juegos[chatId];
            const subio = await db.sumarXP(win, 30).catch(() => false);
            const pagado = await db.premiarConLimite(win, 60, 0, chatId).catch(() => true);
            const nom = (jid) => `@${(jid || '').split('@')[0]}`;
            await sock.sendMessage(chatId, {
                text: `🧠⚡ *¡${nom(win)} RESPONDIÓ PRIMERO!*\n━━━━━━━━━━━━━━\n❓ ${juego.pregunta}\n✅ Respuesta: *${juego.respuesta}*\n\n🏆 ${nom(win)} gana: 💰 +60 diky | +30 XP${subio ? '\n🆙 ¡SUBIÓ DE NIVEL!' : ''}${pagado ? '' : db.NOTA_ANTIFARMA}\n😅 ${nom(lose)}, más suerte la próxima.`,
                mentions: [win, lose]
            }, { quoted: msg });
            return true;
        }
        const quien = `@${(sender || '').split('@')[0]}`;
        await sock.sendMessage(chatId, { text: `❌ ${quien}, esa no es. ¡Sigue intentando!` }, { quoted: msg });
        return true;
    }
    const esUsuarioDelJuego = (juego.responder === sender || juego.pareja === sender || juego.solicitante === sender || juego.tipo === 'ahorcado');
    const citaMensajeCorrecto = (quotedMsgId === juego.msgId);
    const esDueño = (juego.responder === sender || juego.pareja === sender || juego.solicitante === sender);

    // La respuesta es válida si:
    // 1. Es el juego del ahorcado (global)
    // 2. Es el DUEÑO del juego Y (ha citado el mensaje correcto O no es un comando)
    const esRespuestaValida = (juego.tipo === 'ahorcado') || (esDueño && (citaMensajeCorrecto || !isCommand)) || (esDueño && ['pedir', 'plantarse', 'pl', 'p', 'seguir', 'retirarse'].includes(cmd.replace('!', '')));

    if (!esRespuestaValida) return false;

    // --- LÓGICA POR TIPO DE JUEGO ---

    // Caso Trivia / Quiz / QuizAnime
    if (['quiz', 'quizanime', 'trivia'].includes(juego.tipo)) {
        if (sender !== juego.responder) return false;
        if (isCommand) return false;
        const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const uAns = norm(cmd);
        const tAns = norm(juego.respuesta);
        if (uAns === tAns || uAns.includes(`la${tAns}`) || (uAns.length === 1 && uAns === tAns)) {
            delete botState.juegos[chatId];
            const esApuesta = juego.apuesta > 0;
            const premio = esApuesta ? Math.min(juego.apuesta * 2, 1000000) : 50;
            const subio = await db.sumarXP(sender, 25);
            // La devolución de apuesta (x2) NO pasa por el gate anti-farma
            // (es su propio dinero); el premio fijo sí.
            const pagado = esApuesta ? true : await db.premiarConLimite(sender, premio, 0, chatId).catch(() => true);
            if (esApuesta) await db.sumarMonedas(sender, premio).catch(() => {});
            let rxt = `🎉 ¡CORRECTO! Ganaste *${premio}* diky y *25* XP.${esApuesta ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagado ? '' : db.NOTA_ANTIFARMA)}`;
            if (subio) rxt += `\n🆙 ¡SUBISTE DE NIVEL!`;
            await sock.sendMessage(chatId, { text: rxt }, { quoted: msg });
            return true;
        } else {
            juego.vidas--;
            if (juego.vidas <= 0) {
                const r = juego.respuesta;
                delete botState.juegos[chatId];
                await db.sumarXP(sender, -15);
                await sock.sendMessage(chatId, { text: `💀 *PERDISTE* 💀\nLa respuesta era: *${r.toUpperCase()}*${juego.apuesta > 0 ? `\n💸 Perdiste tu apuesta de *${juego.apuesta}* diky.` : ''}` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `❌ ¡Incorrecto! Te quedan ❤️ ${juego.vidas} vidas.` }, { quoted: msg });
            }
            return true;
        }
    }

    // Caso Adivina
    if (juego.tipo === 'adivina') {
        const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const uAns = norm(cmd);
        const tAns = norm(juego.palabra);
        if (uAns.includes(tAns) || tAns.includes(uAns)) {
            delete botState.juegos[chatId];
            const esApuesta = juego.apuesta > 0;
            const premio = esApuesta ? Math.min(juego.apuesta * 2, 1000000) : 100;
            const subio = await db.sumarXP(sender, 50);
            const pagado = esApuesta ? true : await db.premiarConLimite(sender, premio, 0, chatId).catch(() => true);
            if (esApuesta) await db.sumarMonedas(sender, premio).catch(() => {});
            await sock.sendMessage(chatId, { text: `🎉 ¡SI! Era *${juego.palabra}*.\n💰 +${premio} diky | *50* XP${esApuesta ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagado ? '' : db.NOTA_ANTIFARMA)}` }, { quoted: msg });
            return true;
        } else {
            juego.vidas--;
            if (juego.vidas <= 0) {
                delete botState.juegos[chatId];
                await sock.sendMessage(chatId, { text: `💀 *INTENTOS AGOTADOS*\nEra *${juego.palabra}*.${juego.apuesta > 0 ? `\n💸 Perdiste tu apuesta de *${juego.apuesta}* diky.` : ''}` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `❌ No es. ❤️ ${juego.vidas} vidas.` }, { quoted: msg });
            }
            return true;
        }
    }

    // Caso Matemáticas
    if (juego.tipo === 'matematicas') {
        const input = isCommand ? cmd.substring(1) : cmd;
        const userNum = parseInt(input.trim());
        if (!isNaN(userNum) && userNum === juego.resultado) {
            delete botState.juegos[chatId];
            const esApuesta = juego.apuesta > 0;
            const premio = esApuesta ? Math.min(juego.apuesta * 2, 1000000) : (juego.premio || 30);
            const xp = juego.xp || 15;
            await db.sumarXP(sender, xp);
            const pagado = esApuesta ? true : await db.premiarConLimite(sender, premio, 0, chatId).catch(() => true);
            if (esApuesta) await db.sumarMonedas(sender, premio).catch(() => {});
            await sock.sendMessage(chatId, { text: `✅ ¡CORRECTO!\n💰 +${premio} diky | ✨ +${xp} XP${esApuesta ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagado ? '' : db.NOTA_ANTIFARMA)}` }, { quoted: msg });
            return true;
        } else {
            // Solo contar fallo si lo que envió parece un número
            if (!isNaN(parseInt(input.trim()))) {
                juego.vidas--;
                if (juego.vidas <= 0) {
                    const r = juego.resultado;
                    delete botState.juegos[chatId];
                    await sock.sendMessage(chatId, { text: `💀 *FALLASTE*\nEl resultado era *${r}*.${juego.apuesta > 0 ? `\n💸 Perdiste tu apuesta de *${juego.apuesta}* diky.` : ''}` }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: `❌ Incorrecto. ❤️ ${juego.vidas} vidas.` }, { quoted: msg });
                }
                return true;
            }
            return false;
        }
    }

    // Caso Banderas
    if (juego.tipo === 'bandera') {
        // Solo el jugador que inició el desafío puede responder para evitar robos de apuesta
        if (sender !== juego.responder) {
            // Si es un comando, lo dejamos pasar para que el intruso pueda usar otras funciones del bot
            // Pero si es una respuesta al mensaje del juego, la capturamos
            if (quotedMsgId === juego.msgId) return true; 
            return false;
        }
        if (isCommand) return false;

        const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const userAns = norm(cmd);
        const targetAns = norm(juego.pais || juego.palabra || juego.respuesta || "");

        // Limpiar el temporizador al recibir respuesta (sea correcta o no)
        if (juego.timer) clearTimeout(juego.timer);

        // Ajuste de precisión: Acepta si es exacto o si tiene más de 3 letras y está contenido (ej. "Dominicana" para "República Dominicana")
        const esCorrecto = (userAns === targetAns) || (userAns.length >= 4 && targetAns.includes(userAns));

        if (userAns.length > 0 && esCorrecto) {
            delete botState.juegos[chatId];
            const subtipo = juego.subtipo || 'lugar';
            const premioBase = 60;
            const xpBase = 30;
            let premioTotal = premioBase;

            if (juego.apuesta > 0) {
                premioTotal = Math.min(juego.apuesta * 2, 1000000);
            }

            await db.sumarXP(sender, xpBase);
            const esApuestaB = juego.apuesta > 0;
            const pagadoB = esApuestaB ? true : await db.premiarConLimite(sender, premioTotal, 0, chatId).catch(() => true);
            if (esApuestaB) await db.sumarMonedas(sender, premioTotal).catch(() => {});
            await sock.sendMessage(chatId, { text: `🎉 ¡CORRECTO! Es la ${subtipo}: *${juego.pais?.toUpperCase() || juego.respuesta?.toUpperCase()}*.\n💰 +${premioTotal} diky | ✨ +${xpBase} XP${esApuestaB ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagadoB ? '' : db.NOTA_ANTIFARMA)}` }, { quoted: msg });
            return true;
        } else {
            // Sin vidas: Respuesta incorrecta = Pérdida inmediata
            const r = juego.pais || juego.respuesta;
            delete botState.juegos[chatId];
            await sock.sendMessage(chatId, { text: `💀 *INCORRECTO* 💀\nHas perdido el desafío y tu apuesta. Era *${r.toUpperCase()}*.` }, { quoted: msg });
            return true;
        }
    }

    // Caso Ahorcado
    if (juego.tipo === 'ahorcado') {
        // Los comandos (ej: !8ball) NO son letras: si hay un ahorcado activo
        // en el grupo se los tragaba como letra '!' y les quitaba vidas.
        if (isCommand) return false;
        const letra = cmd.substring(0, 1).toLowerCase();
        if (cmd.toLowerCase() === juego.palabra.toLowerCase()) {
            delete botState.juegos[chatId];
            const esApuestaH = juego.apuesta > 0;
            const premioH = esApuestaH ? Math.min(juego.apuesta * 2, 1000000) : 100;
            await db.sumarXP(sender, 50);
            const pagadoH = esApuestaH ? true : await db.premiarConLimite(sender, premioH, 0, chatId).catch(() => true);
            if (esApuestaH) await db.sumarMonedas(sender, premioH).catch(() => {});
            await sock.sendMessage(chatId, { text: `🎉 ¡GANASTE! Era *${juego.palabra.toUpperCase()}*\n💰 +${premioH} diky | ✨ +50 XP${esApuestaH ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagadoH ? '' : db.NOTA_ANTIFARMA)}` }, { quoted: msg });
            return true;
        }
        if (juego.palabra.includes(letra)) {
            let nuevo = '';
            for (let i = 0; i < juego.palabra.length; i++) {
                nuevo += (juego.palabra[i] === letra || juego.oculto[i] !== '_') ? juego.palabra[i] : '_';
            }
            juego.oculto = nuevo;
            if (juego.oculto === juego.palabra) {
                delete botState.juegos[chatId];
                const esApuestaH2 = juego.apuesta > 0;
                const premioH2 = esApuestaH2 ? Math.min(juego.apuesta * 2, 1000000) : 100;
                await db.sumarXP(sender, 50);
                const pagadoH2 = esApuestaH2 ? true : await db.premiarConLimite(sender, premioH2, 0, chatId).catch(() => true);
                if (esApuestaH2) await db.sumarMonedas(sender, premioH2).catch(() => {});
                await sock.sendMessage(chatId, { text: `🎉 ¡GANASTE! Era *${juego.palabra.toUpperCase()}*\n💰 +${premioH2} diky | ✨ +50 XP${esApuestaH2 ? '\n💰 ¡Apuesta duplicada (x2)!' : (pagadoH2 ? '' : db.NOTA_ANTIFARMA)}` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `✅ ¡Letra correcta!\n\nPalabra: \`${juego.oculto.toUpperCase()}\`` });
            }
            return true;
        } else {
            juego.vidas--;
            if (juego.vidas <= 0) {
                delete botState.juegos[chatId];
                await sock.sendMessage(chatId, { text: `💀 *GAME OVER*\nLa palabra era: *${juego.palabra.toUpperCase()}*${juego.apuesta > 0 ? `\n💸 Perdiste tu apuesta de *${juego.apuesta}* diky.` : ''}` });
            } else {
                await sock.sendMessage(chatId, { text: `❌ Letra incorrecta. ❤️ ${juego.vidas} vidas.` });
            }
            return true;
        }
    }

    // Caso Blackjack
    if (juego.tipo === 'bj') {
        if (sender !== juego.responder) return false;
        const action = cmd.startsWith('!') ? cmd.substring(1) : cmd;
        const deck = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const getVal = (c) => (['J', 'Q', 'K'].includes(c) ? 10 : c === 'A' ? 11 : parseInt(c));
        const sum = (cards) => {
            let total = cards.reduce((s, c) => s + getVal(c), 0);
            let aces = cards.filter(c => c === 'A').length;
            while (total > 21 && aces > 0) { total -= 10; aces--; }
            return total;
        };
        if (['pedir', 'p', 'otra', 'card'].includes(action)) {
            juego.player.push(deck[Math.floor(Math.random() * 13)]);
            const pSum = sum(juego.player);
            if (pSum > 21) {
                delete botState.juegos[chatId];
                const ok = await db.deducirMonedas(sender, 50);
                if (!ok) return sock.sendMessage(chatId, { text: `💥 *BUST* (Total: ${pSum})\nPerdiste. (El esposo te salvó el bolsillo)` }, { quoted: msg });
                await db.sumarXP(sender, -20);
                await sock.sendMessage(chatId, { text: `💥 *BUST* (Total: ${pSum})\nPerdiste.\n💸 -50 diky | 📉 -20 XP` }, { quoted: msg });
                return true;
            }
            await sock.sendMessage(chatId, { text: `🃏 Cartas: ${juego.player.join(' ')} (${pSum})\n¿Pedir (p) o Plantarse (pl)?` }, { quoted: msg });
            return true;
        }
        if (['plantarse', 'pl', 'quedarme', 'stop'].includes(action)) {
            while (sum(juego.bot) < 17) juego.bot.push(deck[Math.floor(Math.random() * 13)]);
            const pSum = sum(juego.player), bSum = sum(juego.bot);
            delete botState.juegos[chatId];
            let res = '', p = 0, x = 0;
            if (bSum > 21 || pSum > bSum) { res = '🎉 ¡GANASTE!'; p = 250; x = 125; await db.sumarMonedas(sender, p); await db.sumarXP(sender, x); }
            else if (pSum === bSum) res = '🤝 Empate.';
            else {
                res = '💀 Perdiste.';
                const ok = await db.deducirMonedas(sender, 50);
                if (ok) await db.sumarXP(sender, -20);
            }
            let finalM = `🃏 *RESULTADO*\nTú: ${pSum} | Bot: ${bSum}\n*${res}*`;
            if (p > 0) finalM += `\n💰 +${p} diky | ✨ +${x} XP`;
            await sock.sendMessage(chatId, { text: finalM }, { quoted: msg });
            return true;
        }
    }

    // Minas Response
    if (juego.tipo === 'minas') {
        if (sender !== juego.responder) return false; // Solo el que inició puede jugar
        const num = parseInt(cmd.replace(/[^\d]/g, ''));
        if (isNaN(num) || num < 1 || num > 9) return false;
        const pos = num - 1;
        if (juego.board[pos] !== '⬜') return true;
        if (juego.bombs.includes(pos)) {
            delete botState.juegos[chatId];
            await sock.sendMessage(chatId, { text: `💥 *BOOOOM!* Perdiste.` }, { quoted: msg });
        } else {
            juego.board[pos] = '💎';
            juego.discovered++;
            if (juego.discovered === 5) {
                delete botState.juegos[chatId];
                await db.sumarMonedas(sender, 600); await db.sumarXP(sender, 200);
                await sock.sendMessage(chatId, { text: `✨ ¡VICTORIA! Encontraste 5 gemas.\n💰 +600 diky | ✨ +200 XP` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `💎 Gema ${juego.discovered}/5. Sigue.` }, { quoted: msg });
            }
        }
        return true;
    }

    // Puente Logic
    if (juego.tipo === 'puente') {
        if (sender !== juego.responder) return false;
        const choice = cmd.toLowerCase();
        if (!['izq', 'der'].includes(choice)) return false;
        const winProb = juego.winRate || 0.5;
        const ganoP = Math.random() < winProb;
        if (ganoP) {
            juego.nivel++;
            if (juego.nivel > 5) {
                delete botState.juegos[chatId];
                await db.sumarMonedas(sender, 500);
                await sock.sendMessage(chatId, { text: '🏆 ¡CRUZASTE! 💰 +500 diky.' }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `✨ Nivel ${juego.nivel}/5. ¿IZQ o DER?` }, { quoted: msg });
            }
        } else {
            delete botState.juegos[chatId];
            await sock.sendMessage(chatId, { text: '💔 *¡CRACK!* Caíste al vacío.' }, { quoted: msg });
        }
        return true;
    }

    // Bomba Logic
    if (juego.tipo === 'bomba') {
        if (sender !== juego.responder) return false;
        const choice = cmd.toLowerCase();
        const colores = ['rojo', 'azul', 'verde', 'amarillo'];
        if (!colores.includes(choice)) return false;
        delete botState.juegos[chatId];
        if (choice === juego.secreto) {
            await db.sumarMonedas(sender, 400); await db.sumarXP(sender, 150);
            await sock.sendMessage(chatId, { text: `✂️ ¡Bomba desactivada! 💰 +400 diky | ✨ +150 XP` }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `💥 ¡BOOOOM! Cortaste el cable equivocado.` }, { quoted: msg });
        }
        return true;
    }

    // Mazmorra Logic
    if (juego.tipo === 'mazmorra') {
        if (sender !== juego.responder) return false;
        const choice = cmd.toLowerCase().trim();

        if (choice === 'retirarse') {
            const premio = juego.botin;
            delete botState.juegos[chatId];
            await db.sumarMonedas(sender, premio);
            return sock.sendMessage(chatId, { text: `🏃 Te retiraste a tiempo con *${premio}* diky.` }, { quoted: msg });
        }

        // Si el usuario elige SEGUIR, enviamos de nuevo el mensaje de puertas
        if (choice === 'seguir') {
            let m = `🏰 *MAZMORRA - SALA ${juego.sala}*\n\nHay dos puertas frente a ti.\n\n👉 Elige: *PUERTA A* o *PUERTA B*`;
            const sentM = await sock.sendMessage(chatId, { text: m }, { quoted: msg });
            juego.msgId = sentM.key.id;
            return true;
        }

        // Validar elección de puerta
        if (choice !== 'puerta a' && choice !== 'puerta b' && choice !== 'a' && choice !== 'b') return false;

        const r = Math.random();
        if (r < 0.45) { // 45% de Monstruo (Pérdida total)
            delete botState.juegos[chatId];
            await sock.sendMessage(chatId, { text: '👹 ¡UN MONSTRUO TE EMBOSCÓ! Perdiste todo el botín acumulado.' }, { quoted: msg });
        } else if (r < 0.65) { // 20% de Trampa (Pérdida de XP)
            await db.sumarXP(sender, -15);
            juego.sala++;
            const sentM = await sock.sendMessage(chatId, { text: `🌵 ¡Trampa! Perdiste un poco de energía (-15 XP).\n\n📍 Siguiente: Sala ${juego.sala}\n\n👉 Escribe *SEGUIR* para continuar o *RETIRARSE* para cobrar.` }, { quoted: msg });
            juego.msgId = sentM.key.id;
        } else { // 35% de Tesoro
            const loot = Math.floor(Math.random() * 80) + 20;
            juego.botin += loot;
            juego.sala++;
            const sentM = await sock.sendMessage(chatId, { text: `💰 ¡Cofre encontrado! Ganaste *${loot}* diky.\n\n📊 Acumulado: *${juego.botin}* diky\n📍 Siguiente: Sala ${juego.sala}\n\n👉 Escribe *SEGUIR* para continuar o *RETIRARSE* para cobrar.` }, { quoted: msg });
            juego.msgId = sentM.key.id;
        }
        return true;
    }

    // Cofre Logic
    if (juego.tipo === 'cofre') {
        const num = parseInt(cmd);
        if (isNaN(num) || num < 1 || num > 3) return false;
        delete botState.juegos[chatId];
        if (num === juego.ganador) {
            await db.sumarMonedas(sender, 150);
            await sock.sendMessage(chatId, { text: '🎉 ¡ABRISTE EL COFRE! 💰 +150 diky.' }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: '💀 El cofre estaba vacío o tenía una trampa.' }, { quoted: msg });
        }
        return true;
    }

    // Carta Logic
    if (juego.tipo === 'carta') {
        const choice = cmd.toLowerCase();
        if (choice !== 'mayor' && choice !== 'menor') return false;
        const deck = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const getVal = (c) => deck.indexOf(c);
        const next = deck[Math.floor(Math.random() * 13)];
        const v1 = getVal(juego.actual), v2 = getVal(next);
        delete botState.juegos[chatId];
        if (v1 === v2) {
            await sock.sendMessage(chatId, { text: `🤝 Empate! Salió *${next}*` }, { quoted: msg });
        } else {
            let gano = (choice === 'mayor' && v2 > v1) || (choice === 'menor' && v2 < v1);
            await sock.sendMessage(chatId, { text: `🃏 La carta era: *${next}*\n*${gano ? '🎉 ¡GANASTE!' : '💀 Perdiste.'}*` }, { quoted: msg });
        }
        return true;
    }


    // Boda Logic
    if (juego.tipo === 'boda') {
        if (sender !== juego.pareja) return false;
        const resp = cmd.toLowerCase();

        if (resp === 'rechazo' || resp === 'rechazar') {
            delete botState.juegos[chatId];
            return sock.sendMessage(chatId, { text: `💔 @${sender.split('@')[0]} ha rechazado la propuesta...`, mentions: [sender, juego.solicitante] });
        }

        if (resp === 'acepto' || resp === 'aceptar') {
            delete botState.juegos[chatId];
            await db.actualizarUsuario(juego.solicitante, { pareja: juego.pareja });
            await db.actualizarUsuario(juego.pareja, { pareja: juego.solicitante });
            await db.sumarXP(juego.solicitante, 200);
            await db.sumarXP(juego.pareja, 200);

            return sock.sendMessage(chatId, {
                text: `💖 ¡VIVAN LOS NOVIOS! 💍\n\n@${juego.solicitante.split('@')[0]} y @${juego.pareja.split('@')[0]} ahora están casados.\n✨ Ambos ganan +200 XP.`,
                mentions: [juego.solicitante, juego.pareja]
            });
        }
        return false;
    }

    // Caso Retos (Waifus / Anime)
    if (['reto_waifus', 'reto_anime'].includes(juego.tipo)) {
        if (sender !== juego.responder) return true; // Ignorar a otros, pero marcar como manejado

        const respText = (txt || cmd || '').trim();
        const number = parseInt(respText);

        if (isNaN(number) || number < 1 || number > 10) {
            // Ignorar respuestas que no parezcan números o estén fuera de rango
            return false;
        }

        if (!juego.availableNumbers.includes(number)) {
            await sock.sendMessage(chatId, { text: `⚠️ El número *${number}* ya está ocupado.\n\n👉 Elige uno de los disponibles:\n🔢 ${juego.availableNumbers.join(', ')}` }, { quoted: msg });
            return true;
        }

        // Asignar el ranking
        juego.userRankings[number] = juego.lista[juego.currentIndex];

        // Quitar de disponibles
        juego.availableNumbers = juego.availableNumbers.filter(n => n !== number);

        // Avanzar
        juego.currentIndex++;

        if (juego.timer) clearTimeout(juego.timer);

        if (juego.currentIndex < 10) {
            // Enviar el siguiente
            const isWaifu = juego.tipo === 'reto_waifus';
            const icon = isWaifu ? '🎀' : '🎬';
            const nextItem = juego.lista[juego.currentIndex];

            let m = `${icon} *${juego.currentIndex + 1}/10:* ${nextItem}\n\n`;
            m += `👉 ¿Qué posición le das?\n`;
            m += `🔢 Disponibles: ${juego.availableNumbers.join(', ')}`;

            const sentMsg = await sock.sendMessage(chatId, { text: m }, { quoted: msg });
            juego.msgId = sentMsg.key.id;

            // Renovar timer (3 mins)
            juego.timer = setTimeout(async () => {
                if (botState.juegos[chatId] && botState.juegos[chatId].msgId === sentMsg.key.id) {
                    delete botState.juegos[chatId];
                    await sock.sendMessage(chatId, { text: `⏰ *TIEMPO AGOTADO* ⏰\n@${sender.split('@')[0]} tardó demasiado en responder y el reto se canceló.`, mentions: [sender] });
                }
            }, 180000);

        } else {
            // Terminó! Mostrar el Top 10 que armó
            delete botState.juegos[chatId];

            const isWaifu = juego.tipo === 'reto_waifus';
            const title = isWaifu ? 'WAIFUS' : 'ANIMES';

            let finalMsg = `🏆 *TU TOP 10 DE ${title}* 🏆\n`;
            finalMsg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            for (let i = 1; i <= 10; i++) {
                finalMsg += `*${i}.* ${juego.userRankings[i]}\n`;
            }

            finalMsg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;

            const premio = 500;
            const xp = 250;
            await db.sumarMonedas(sender, premio);
            await db.sumarXP(sender, xp);

            finalMsg += `🎉 ¡Reto completado!\n💰 +${premio} diky | ✨ +${xp} XP`;

            await sock.sendMessage(chatId, { text: finalMsg, mentions: [sender] }, { quoted: msg });
        }
        return true;
    }

    // Caso "¿Qué preferirías?" (!seria)
    if (juego.tipo === 'seria') {
        if (sender !== juego.responder) return false;
        const resp = cmd.toLowerCase().trim();
        if (resp !== 'a' && resp !== 'b') return false;

        if (juego.timer) clearTimeout(juego.timer);
        delete botState.juegos[chatId];

        const elegido = resp === 'a' ? juego.opciones[0] : juego.opciones[1];
        const noElegido = resp === 'a' ? juego.opciones[1] : juego.opciones[0];

        const reacciones = [
            `Interesante elección... 🤔`,
            `¡Buena decisión! 👏`,
            `Mmm, yo hubiera elegido la otra... 😏`,
            `¡Valiente! No muchos eligen eso. 💪`,
            `Esa es la respuesta correcta... o no. 😂`
        ];
        const reaccion = reacciones[Math.floor(Math.random() * reacciones.length)];

        await sock.sendMessage(chatId, {
            text: `✅ *ELEGISTE:* ${resp.toUpperCase()}\n━━━━━━━━━━━━━━\n\n👉 *Tu elección:* ${elegido}\n❌ *Descartaste:* ${noElegido}\n\n💬 ${reaccion}`
        }, { quoted: msg });
        return true;
    }

    return false;
}

module.exports = { handleGameResponse };
