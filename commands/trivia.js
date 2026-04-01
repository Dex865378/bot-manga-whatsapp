/**
 * 💡 MÓDULO DE TRIVIA Y CONOCIMIENTO
 */
const axios = require('axios');

module.exports = {
    name: 'trivia',
    isMultiple: true,
    names: ['!quiz', '!quizanime', '!adivina', '!matematicas', '!bandera', '!ahorcado', '!trivia'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, isGroup, sender, db, botState }) {

        if (botState.juegos[chatId]) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo en este grupo.' }, { quoted: msg });

        // !quiz (Cultura General)
        if (start === '!quiz' || start === '!trivia') {
            const quizes = [
                { q: '¿Cuál es el país más grande del mundo?', a: 'rusia' },
                { q: '¿En qué año terminó la Segunda Guerra Mundial?', a: '1945' },
                { q: '¿Cuál es la capital de Japón?', a: 'tokio' },
                { q: '¿Quién pintó la Mona Lisa?', a: 'da vinci' },
                { q: '¿Cuál es el elemento químico con el símbolo O?', a: 'oxigeno' },
                { q: '¿Cuál es el río más largo del mundo?', a: 'amazonas' },
                { q: '¿Quién escribió "Don Quijote de la Mancha"?', a: 'cervantes' },
                { q: '¿Cuál es el océano más grande?', a: 'pacifico' }
            ];
            const quiz = quizes[Math.floor(Math.random() * quizes.length)];
            botState.juegos[chatId] = { tipo: 'quiz', respuesta: quiz.a, vidas: 2, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `❓ *QUIZ DE CULTURA GENERAL* ❓\n\n*Pregunta:* ${quiz.q}\n\n❤️ Vidas: 2\n👉 _Responde a este mensaje con tu respuesta._` }, { quoted: msg });
        }

        // !quizanime
        if (start === '!quizanime') {
            const quizes = [
                { q: '¿Cómo se llama el protagonista de One Piece?', a: 'luffy' },
                { q: '¿Quién es el creador de Dragon Ball?', a: 'akira toriyama' },
                { q: '¿Cómo se llama el rival de Naruto?', a: 'sasuke' },
                { q: '¿Qué anime trata sobre un cuaderno de la muerte?', a: 'death note' },
                { q: '¿Cuál es el nombre del protagonista de Shingeki no Kyojin?', a: 'eren' },
                { q: '¿Cómo se llama la gata cósmica de Sailor Moon?', a: 'luna' }
            ];
            const quiz = quizes[Math.floor(Math.random() * quizes.length)];
            botState.juegos[chatId] = { tipo: 'quizanime', respuesta: quiz.a, vidas: 2, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `⛩️ *QUIZ ANIME* ⛩️\n\n*Pregunta:* ${quiz.q}\n\n❤️ Vidas: 2\n👉 _Responde a este mensaje con tu respuesta._` }, { quoted: msg });
        }

        // !adivina
        if (start === '!adivina') {
            const palabras = ['computadora', 'whatsapp', 'teclado', 'anime', 'manga', 'naruto', 'one piece', 'videojuego', 'internet', 'celular'];
            const p = palabras[Math.floor(Math.random() * palabras.length)];
            const des = p.split('').sort(() => 0.5 - Math.random()).join('');
            botState.juegos[chatId] = { tipo: 'adivina', palabra: p, vidas: 2, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `🧩 *ADIVINA LA PALABRA* 🧩\n\nPalabra desordenada: *${des.toUpperCase()}*\n\n❤️ Vidas: 2\n👉 _Escribe la palabra correcta._` }, { quoted: msg });
        }

        // !matematicas (1:facil, 2:medio, 3:dificil, 4:extremo, 5:ingenieria)
        if (start === '!matematicas') {
            let nivelInput = args[0]?.toLowerCase() || '1';
            const mapaNiveles = { '1': 'facil', '2': 'medio', '3': 'dificil', '4': 'extremo', '5': 'ingenieria' };
            const nivel = mapaNiveles[nivelInput] || nivelInput;

            let n1, n2, op, res, premio, xp, qText;
            const ops = ['+', '-', '*'];

            switch (nivel) {
                case 'medio': case '2':
                    n1 = Math.floor(Math.random() * 80) + 20; n2 = Math.floor(Math.random() * 80) + 10;
                    op = ops[Math.floor(Math.random() * 3)]; res = op === '+' ? n1 + n2 : op === '-' ? n1 - n2 : n1 * n2;
                    qText = `${n1} ${op} ${n2}`; premio = 100; xp = 50;
                    break;
                case 'dificil': case '3':
                    n1 = Math.floor(Math.random() * 200) + 50; n2 = Math.floor(Math.random() * 20) + 5;
                    op = '*'; res = n1 * n2; qText = `${n1} x ${n2}`; premio = 350; xp = 150;
                    break;
                case 'extremo': case '4':
                    const e1 = Math.floor(Math.random() * 100) + 10; const e2 = Math.floor(Math.random() * 50) + 5;
                    const e3 = Math.floor(Math.random() * 300) + 20; const eOp = Math.random() < 0.5 ? '+' : '-';
                    res = (e1 * e2) + (eOp === '+' ? e3 : -e3); qText = `(${e1} x ${e2}) ${eOp} ${e3}`; premio = 800; xp = 400;
                    break;
                case 'ingenieria': case '5':
                    const i1 = Math.floor(Math.random() * 50) + 10; const i2 = Math.floor(Math.random() * 40) + 5;
                    const i3 = Math.floor(Math.random() * 1000) + 100; const i4 = Math.floor(Math.random() * 500) + 10;
                    res = (i1 * i2 + i3) - i4; qText = `(${i1} x ${i2} + ${i3}) - ${i4}`; premio = 2500; xp = 1000;
                    break;
                default:
                    n1 = Math.floor(Math.random() * 40) + 1; n2 = Math.floor(Math.random() * 40) + 1;
                    op = Math.random() < 0.5 ? '+' : '-'; res = op === '+' ? n1 + n2 : n1 - n2;
                    qText = `${n1} ${op} ${n2}`; premio = 50; xp = 20;
                    break;
            }

            botState.juegos[chatId] = { tipo: 'matematicas', resultado: res, vidas: 2, msgId: msg.key.id, responder: sender, premio, xp };
            return sock.sendMessage(chatId, { text: `🧮 **DESAFÍO DIKY: ${nivel.toUpperCase()}** 🧮\n━━━━━━━━━━━━━━\n¿Cuánto es: **${qText}**?\n\n💰 Premio: *${premio}* diky\n✨ XP: *${xp}*\n❤️ Vidas: 2\n━━━━━━━━━━━━━━\n👉 _Responde con el número exacto._` }, { quoted: msg });
        }

        // !bandera [pais/provincia/capitales] [apuesta]
        if (start === '!bandera') {
            const { paises, provincias, capitales } = require('../data/triviaData');
            const sub = args[0]?.toLowerCase();
            const apuesta = parseInt(args[1]) || 0;

            const MAX_APUESTA = 1000000;
            if (apuesta > 0) {
                if (apuesta > MAX_APUESTA) {
                    return sock.sendMessage(chatId, { text: `🚫 *Apuesta demasiado alta.*\nEl límite máximo es *1,000,000 diky* por partida.` }, { quoted: msg });
                }
                const bal = await db.obtenerBalance(sender);
                if (bal < apuesta) return sock.sendMessage(chatId, { text: '💸 No tienes suficientes diky para esta apuesta.' }, { quoted: msg });
                const ok = await db.deducirMonedas(sender, apuesta);
                if (!ok) return sock.sendMessage(chatId, { text: '❌ Error al procesar la apuesta.' });
            }

            const modoProvincia = (sub === 'provincia' || sub === 'estado');
            const modoCapital = (sub === 'capital' || sub === 'capitales');

            let lista = paises;
            let subtipo = 'país';
            if (modoProvincia) { lista = provincias; subtipo = 'provincia'; }
            else if (modoCapital) { lista = capitales; subtipo = 'capital'; }

            const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
            if (botState.triviaIndex === undefined) botState.triviaIndex = 0;

            let filtered = [];
            let item;
            let attempts = 0;

            while (filtered.length === 0 && attempts < 26) {
                const currentLetter = alphabet[botState.triviaIndex % alphabet.length];
                filtered = lista.filter(x => x.p.toLowerCase().startsWith(currentLetter));

                if (filtered.length > 0) {
                    item = filtered[Math.floor(Math.random() * filtered.length)];
                    botState.triviaIndex++; // Avanzar para la próxima vez
                } else {
                    botState.triviaIndex++;
                    attempts++;
                }
            }

            // Fallback si no hay nada con ninguna letra (raro)
            if (!item) item = lista[Math.floor(Math.random() * lista.length)];

            // Temporizador de 1 minuto (60 segundos)
            const timeoutJuego = setTimeout(async () => {
                if (botState.juegos[chatId] && botState.juegos[chatId].tipo === 'bandera' && botState.juegos[chatId].pais === item.p) {
                    delete botState.juegos[chatId];
                    await sock.sendMessage(chatId, { text: `⏰ *TIEMPO AGOTADO* ⏰\nNo respondiste en el minuto exacto. Perdiste el desafío y tu apuesta.\n\n🌍 La respuesta era: *${item.p.toUpperCase()}*` });
                }
            }, 60000);

            botState.juegos[chatId] = {
                tipo: 'bandera',
                pais: item.p,
                msgId: msg.key.id,
                responder: sender,
                subtipo,
                pista: item.f,
                apuesta,
                timer: timeoutJuego
            };

            const labels = { 'país': 'Bandera', 'provincia': 'Ubicación', 'capital': 'País de origen' };

            let m = `🗺️ **ADIVINA LA ${subtipo.toUpperCase()}** 🗺️\n━━━━━━━━━━━━━━\n`;
            m += `${labels[subtipo]}: ${item.f}\n💡 Pista: *${item.h}*\n`;
            if (apuesta > 0) m += `💰 Apuesta: *${apuesta}* diky (Ganas x1.5)\n`;
            m += `━━━━━━━━━━━━━━\n⏳ Tiempo: *1 minuto*\n👉 _¿Cómo se llama esta ${subtipo}?_`;

            return sock.sendMessage(chatId, { text: m }, { quoted: msg });
        }

        // !ahorcado
        if (start === '!ahorcado') {
            const palabras = ['programacion', 'javascript', 'whatsapp', 'bot', 'manga', 'anime', 'teclado', 'monitor', 'hardware', 'software'];
            const p = palabras[Math.floor(Math.random() * palabras.length)];
            const oculto = '_'.repeat(p.length);
            botState.juegos[chatId] = { tipo: 'ahorcado', palabra: p, oculto, vidas: 4, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `🪑 *AHORCADO DIKY* 🪑\n\nPalabra: \`${oculto}\` (${p.length} letras)\n\n❤️ Vidas: 4\n👉 _Escribe una letra o la palabra completa._` }, { quoted: msg });
        }
    }
};
