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
                { q: '¿Cuál es el océano más grande?', a: 'pacifico' },
                { q: '¿Cuál es el planeta más cercano al sol?', a: 'mercurio' },
                { q: '¿Cuántos huesos tiene el cuerpo humano adulto?', a: '206' },
                { q: '¿Cuál es el animal terrestre más rápido?', a: 'guepardo' },
                { q: '¿En qué continente está Egipto?', a: 'africa' },
                { q: '¿Cuál es la moneda oficial de Japón?', a: 'yen' },
                { q: '¿Quién fue el primer hombre en pisar la luna?', a: 'neil armstrong' },
                { q: '¿Cuál es el metal más abundante en la corteza terrestre?', a: 'aluminio' },
                { q: '¿Cuántos lados tiene un hexágono?', a: '6' },
                { q: '¿Cuál es la montaña más alta del mundo?', a: 'everest' },
                { q: '¿Qué gas respiramos principalmente del aire?', a: 'nitrogeno' },
                { q: '¿En qué país se originó el sushi?', a: 'japon' },
                { q: '¿Cuál es el idioma más hablado del mundo?', a: 'chino mandarin' },
                { q: '¿Cuántos jugadores tiene un equipo de fútbol en cancha?', a: '11' },
                { q: '¿Cuál es el desierto más grande del mundo?', a: 'sahara' },
                { q: '¿Quién compuso la Novena Sinfonía?', a: 'beethoven' },
                { q: '¿Cuál es el país con más habitantes del mundo?', a: 'india' },
                { q: '¿En qué año llegó el hombre a la luna?', a: '1969' },
                { q: '¿Cuál es la capital de Francia?', a: 'paris' },
                { q: '¿Cuál es la capital de Italia?', a: 'roma' },
                { q: '¿Cuál es la capital de España?', a: 'madrid' },
                { q: '¿Cuál es la capital de Alemania?', a: 'berlin' },
                { q: '¿Cuál es la capital de Brasil?', a: 'brasilia' },
                { q: '¿Cuál es la capital de Canadá?', a: 'ottawa' },
                { q: '¿Cuál es la capital de Australia?', a: 'canberra' },
                { q: '¿Cuántos continentes hay en el mundo?', a: '6' },
                { q: '¿Cuál es el hueso más largo del cuerpo humano?', a: 'femur' },
                { q: '¿Cuál es el órgano más grande del cuerpo humano?', a: 'piel' },
                { q: '¿Cuál es el metal líquido a temperatura ambiente?', a: 'mercurio' },
                { q: '¿Cuántos colores tiene el arcoíris?', a: '7' },
                { q: '¿Cuál es el país más pequeño del mundo?', a: 'ciudad del vaticano' },
                { q: '¿Quién descubrió América?', a: 'cristobal colon' },
                { q: '¿En qué año cayó el Muro de Berlín?', a: '1989' },
                { q: '¿Cuál es el símbolo químico del oro?', a: 'au' },
                { q: '¿Cuál es el símbolo químico del hierro?', a: 'fe' },
                { q: '¿Cuál es la velocidad de la luz aproximada en km/s?', a: '300000' },
                { q: '¿Quién escribió "Cien años de soledad"?', a: 'gabriel garcia marquez' },
                { q: '¿Quién pintó "La noche estrellada"?', a: 'van gogh' },
                { q: '¿Cuál es el instrumento musical con 88 teclas?', a: 'piano' },
                { q: '¿Cuál es el país conocido como "tierra del sol naciente"?', a: 'japon' },
                { q: '¿Cuál es el ave que no puede volar más grande del mundo?', a: 'avestruz' },
                { q: '¿Cuántas patas tiene una araña?', a: '8' },
                { q: '¿Cuál es el planeta más grande del sistema solar?', a: 'jupiter' },
                { q: '¿Cuál es el planeta conocido como el planeta rojo?', a: 'marte' },
                { q: '¿Cuántos minutos tiene una hora?', a: '60' },
                { q: '¿Cuántos días tiene un año bisiesto?', a: '366' },
                { q: '¿Cuál es la capital de Rusia?', a: 'moscu' },
                { q: '¿Cuál es la capital de China?', a: 'pekin' },
                { q: '¿Cuál es la capital de Egipto?', a: 'el cairo' },
                { q: '¿Quién fue el primer presidente de Estados Unidos?', a: 'george washington' },
                { q: '¿Cuál es el mamífero más grande del mundo?', a: 'ballena azul' },
                { q: '¿Qué instrumento se usa para medir la temperatura?', a: 'termometro' },
                { q: '¿Cuántos huesos tiene la mano humana?', a: '27' }
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
                { q: '¿Cómo se llama la gata cósmica de Sailor Moon?', a: 'luna' },
                { q: '¿Cómo se llama el protagonista de Death Note?', a: 'light' },
                { q: '¿Qué anime tiene como protagonista a Izuku Midoriya?', a: 'my hero academia' },
                { q: '¿Cómo se llama el espadachín de One Piece?', a: 'zoro' },
                { q: '¿Cuál es el apellido del protagonista de Fullmetal Alchemist?', a: 'elric' },
                { q: '¿Cómo se llama el demonio de la espada en Chainsaw Man?', a: 'pochita' },
                { q: '¿Qué anime trata sobre cazadores que matan titanes?', a: 'attack on titan' },
                { q: '¿Cómo se llama la organización criminal en Naruto?', a: 'akatsuki' },
                { q: '¿Quién es el maestro de Goku al inicio de Dragon Ball?', a: 'muten roshi' },
                { q: '¿Cómo se llama el protagonista de Tokyo Ghoul?', a: 'kaneki' },
                { q: '¿En qué anime aparece un shinigami llamado Ryuk?', a: 'death note' },
                { q: '¿Cómo se llama la hermana menor de Ichigo en Bleach?', a: 'yuzu' },
                { q: '¿Qué anime trata sobre un chico que se convierte en alquimista?', a: 'fullmetal alchemist' },
                { q: '¿Cómo se llama el pirata rival principal de Luffy?', a: 'shanks' },
                { q: '¿Cómo se llama el protagonista de Chainsaw Man?', a: 'denji' },
                { q: '¿Cómo se llama el protagonista de Jujutsu Kaisen?', a: 'yuji itadori' },
                { q: '¿Cómo se llama la maldición más poderosa que posee Yuji?', a: 'sukuna' },
                { q: '¿Cómo se llama el protagonista de Demon Slayer?', a: 'tanjiro' },
                { q: '¿Cómo se llama la hermana de Tanjiro en Demon Slayer?', a: 'nezuko' },
                { q: '¿Cómo se llama el protagonista de Bleach?', a: 'ichigo' },
                { q: '¿Cómo se llama el capitán del Sunny en One Piece?', a: 'luffy' },
                { q: '¿Cómo se llama el reno médico de la tripulación de Luffy?', a: 'chopper' },
                { q: '¿Cómo se llama el cocinero de la tripulación de Luffy?', a: 'sanji' },
                { q: '¿Cuál es el sueño de Luffy en One Piece?', a: 'ser el rey de los piratas' },
                { q: '¿Cómo se llama la aldea de Naruto?', a: 'konoha' },
                { q: '¿Cómo se llama el sensei de Naruto en el equipo 7?', a: 'kakashi' },
                { q: '¿Qué animal es sellado dentro de Naruto?', a: 'kurama' },
                { q: '¿Cómo se llama la novia/esposa de Naruto?', a: 'hinata' },
                { q: '¿Cómo se llama el androide número 18 en Dragon Ball?', a: 'lazuli' },
                { q: '¿Cómo se llama el planeta natal de Goku?', a: 'vegeta' },
                { q: '¿Cómo se llama el hijo mayor de Goku?', a: 'gohan' },
                { q: '¿Cómo se llama el villano principal de la saga Cell?', a: 'cell' },
                { q: '¿Qué anime trata sobre un joven que caza titanes tras perder su hogar?', a: 'attack on titan' },
                { q: '¿Cómo se llama el mejor amigo de Eren en Attack on Titan?', a: 'armin' },
                { q: '¿Cómo se llama la chica que se convierte en titán acorazado?', a: 'annie' },
                { q: '¿Cómo se llama el protagonista de Spy x Family?', a: 'loid forger' },
                { q: '¿Cómo se llama la hija adoptiva en Spy x Family?', a: 'anya' },
                { q: '¿Cómo se llama el protagonista de Hunter x Hunter?', a: 'gon' },
                { q: '¿Cómo se llama el mejor amigo de Gon en Hunter x Hunter?', a: 'killua' },
                { q: '¿Cómo se llama el protagonista de Fairy Tail?', a: 'natsu' },
                { q: '¿Cómo se llama el gremio principal en Fairy Tail?', a: 'fairy tail' },
                { q: '¿Cómo se llama el protagonista de Blue Lock?', a: 'isagi' },
                { q: '¿Qué anime trata sobre un equipo de vóleibol en preparatoria?', a: 'haikyuu' },
                { q: '¿Cómo se llama el protagonista de Haikyuu!!?', a: 'hinata shoyo' },
                { q: '¿Cómo se llama el protagonista de Solo Leveling?', a: 'sung jinwoo' },
                { q: '¿Qué anime trata sobre un chico que se convierte en el cazador más fuerte tras una mazmorra?', a: 'solo leveling' },
                { q: '¿Cómo se llama el pueblo natal de Ash Ketchum en Pokémon?', a: 'pueblo paleta' },
                { q: '¿Cómo se llama el compañero Pokémon inicial de Ash?', a: 'pikachu' },
                { q: '¿Cómo se llama el protagonista de Dragon Ball al inicio de la serie?', a: 'goku' },
                { q: '¿Cómo se llama la técnica insignia de Goku para atacar?', a: 'kamehameha' }
            ];
            const quiz = quizes[Math.floor(Math.random() * quizes.length)];
            botState.juegos[chatId] = { tipo: 'quizanime', respuesta: quiz.a, vidas: 2, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `⛩️ *QUIZ ANIME* ⛩️\n\n*Pregunta:* ${quiz.q}\n\n❤️ Vidas: 2\n👉 _Responde a este mensaje con tu respuesta._` }, { quoted: msg });
        }

        // !adivina
        if (start === '!adivina') {
            const palabras = [
                'computadora', 'whatsapp', 'teclado', 'anime', 'manga', 'naruto', 'one piece', 'videojuego', 'internet', 'celular',
                'aventura', 'universo', 'chocolate', 'guitarra', 'biblioteca', 'aeropuerto', 'elefante', 'mariposa', 'terremoto', 'diccionario',
                'refrigerador', 'motocicleta', 'astronauta', 'dinosaurio', 'fotografia', 'matematicas', 'geografia', 'historia', 'ciencia', 'planeta',
                'estrella', 'oceano', 'montaña', 'desierto', 'volcan', 'cascada', 'bosque', 'jardin', 'edificio', 'restaurante',
                'hospital', 'escuela', 'universidad', 'medicina', 'tecnologia', 'robot', 'satelite', 'telescopio', 'microscopio', 'laboratorio',
                'orquesta', 'sinfonia', 'pelicula', 'television', 'radio', 'periodico', 'revista', 'escritor', 'pintura', 'escultura',
                'arquitectura', 'ingenieria', 'programador', 'desarrollador', 'inteligencia', 'algoritmo', 'servidor', 'navegador', 'aplicacion', 'plataforma'
            ];
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
            const palabras = [
                'programacion', 'javascript', 'whatsapp', 'bot', 'manga', 'anime', 'teclado', 'monitor', 'hardware', 'software',
                'internet', 'servidor', 'algoritmo', 'variable', 'funcion', 'proyecto', 'usuario', 'sistema', 'archivo', 'contraseña',
                'aplicacion', 'inteligencia', 'tecnologia', 'desarrollador', 'computadora', 'navegador', 'plataforma', 'base de datos', 'framework', 'libreria',
                'compilador', 'interprete', 'protocolo', 'seguridad', 'encriptacion', 'red social', 'streaming', 'multimedia', 'procesador', 'memoria',
                'almacenamiento', 'nube', 'inteligencia artificial', 'aprendizaje', 'automatizacion', 'robotica', 'ciberseguridad', 'programador', 'debugging', 'repositorio',
                'version', 'actualizacion', 'instalacion', 'configuracion', 'notificacion', 'aplicativo', 'terminal', 'consola', 'depuracion', 'interfaz',
                'experiencia', 'usabilidad', 'accesibilidad', 'documentacion', 'implementacion'
            ];
            const p = palabras[Math.floor(Math.random() * palabras.length)];
            const oculto = '_'.repeat(p.length);
            botState.juegos[chatId] = { tipo: 'ahorcado', palabra: p, oculto, vidas: 4, msgId: msg.key.id, responder: sender };
            return sock.sendMessage(chatId, { text: `🪑 *AHORCADO DIKY* 🪑\n\nPalabra: \`${oculto}\` (${p.length} letras)\n\n❤️ Vidas: 4\n👉 _Escribe una letra o la palabra completa._` }, { quoted: msg });
        }
    }
};
