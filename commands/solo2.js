/**
 * 🏆 SOLO 2 — más juegos en solitario con récord guardado (texto + emojis).
 * Estado en botState.juegos[chatId] con TTL. Récords en tabla records.
 *
 *   !wordle         → adivina la palabra de 5 letras en 6 intentos 🟩🟨⬜
 *   !intruso        → encuentra al infiltrado entre 4 palabras (5 rondas)
 *   !supervivencia  → 7 retos mezclados con 3 vidas
 *   !cazatesoros    → encuentra el número del 1 al 50 con pistas de calor
 *   !ruleta2        → di una palabra de la categoría con esa letra (racha)
 *   !escalera       → serpientes y escaleras hasta el 50 en 15 turnos
 *   !caja           → abre la caja fuerte de 3 dígitos en 8 intentos
 */
function rnd(n) { return Math.floor(Math.random() * n); }
function normS(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }

// --- Wordle: palabras de 5 letras (verificadas, sin tildes) ---
const _WORDLE_CRUDO = ['playa', 'perro', 'libro', 'mesas', 'silla', 'campo', 'nubes', 'aguas', 'fuego', 'hojas', 'ramas', 'fruta', 'panes', 'queso', 'leche', 'arroz', 'dulce', 'fiesta', 'baile', 'canto', 'risas', 'juegos', 'ninos', 'madre', 'padre', 'amigo', 'calle', 'plaza', 'besos', 'velas', 'globo', 'nieve', 'salsa', 'tacos', 'torta', 'pollo', 'carne', 'huevo', 'papas', 'melon', 'radio', 'reloj', 'banos', 'poema', 'arbol', 'avion', 'jamon', 'tigre', 'cebra', 'raton', 'altar', 'angel', 'barco', 'bolsa', 'cerca', 'cesta', 'ciclo', 'cinta', 'clima', 'cobra', 'color', 'coral', 'corte', 'costa', 'curva', 'datos', 'deuda', 'dicho', 'dieta', 'dolor', 'donde', 'drama', 'falta', 'fecha', 'fibra', 'final', 'firma', 'fondo', 'forma', 'frase', 'ganas', 'gasto', 'gente', 'golpe', 'gorda', 'gorra', 'grito', 'grupo', 'guia', 'haber', 'heroe', 'honor', 'hueso', 'joven', 'joyas', 'labor', 'lapiz', 'largo', 'lejos', 'lento', 'lider', 'limite', 'limon', 'linea', 'lista', 'llave', 'local', 'logro', 'lucha', 'lugar', 'magia', 'marco', 'mareo', 'marca', 'martes', 'mayor', 'medio', 'mejor', 'mente', 'metal', 'metro', 'miedo', 'monte', 'moral', 'motor', 'mover', 'movil', 'mujer', 'multa', 'mundo', 'museo', 'nadar', 'nariz', 'negro', 'nieta', 'noble', 'noche', 'norma', 'norte', 'notas', 'nuevo', 'ocaso', 'oeste', 'oidos', 'onda', 'opera', 'orden', 'oreja', 'oveja', 'pacto', 'pagar', 'palco', 'palma', 'papel', 'pared', 'parte', 'paseo', 'pasos', 'pasta', 'patio', 'pausa', 'pecho', 'pelea', 'perfil', 'perdon', 'piano', 'piloto', 'pinza', 'piso', 'pista', 'placer', 'plato', 'pluma', 'pobre', 'poder', 'poeta', 'poner', 'portal', 'poste', 'potro', 'presa', 'primo', 'prisa', 'pronto', 'propio', 'prosa', 'puesto', 'pulso', 'punto', 'queja', 'quien', 'quinto', 'rabia', 'rango', 'razon', 'recta', 'regla', 'renta', 'resto', 'rezar', 'ritmo', 'robar', 'robot', 'roca', 'ronda', 'rubio', 'rueda', 'ruido', 'ruina', 'ruta', 'sabado', 'saber', 'sabio', 'sabor', 'sacar', 'salir', 'salon', 'salud', 'santo', 'sauce', 'sauna', 'sello', 'selva', 'senal', 'senor', 'seria', 'serie', 'serio', 'sexto', 'sierra', 'signo', 'sitio', 'sobre', 'solar', 'sonar', 'sueno', 'sordo', 'subir', 'sucio', 'sudar', 'suelo', 'suave', 'super', 'tabla', 'tamal', 'tango', 'tarde', 'tarea', 'tarifa', 'techo', 'tecla', 'temor', 'tener', 'tercer', 'termo', 'texto', 'tiara', 'timido', 'tinta', 'tinto', 'tocar', 'tomar', 'tonto', 'torre', 'total', 'tragar', 'traje', 'tramo', 'trece', 'tribu', 'trigo', 'triste', 'tronco', 'truco', 'tumba', 'tumor', 'tunel', 'turno', 'tutor'];
// Filtro de seguridad: si alguna se cuela con otra longitud, fuera (partida imposible).
const WORDLE_BANCO = _WORDLE_CRUDO.map(normS).filter(w => /^[a-z]{5}$/.test(w));
function pistaWordle(secreta, intento) {
    const res = Array(5).fill('⬜');
    const sobra = {};
    for (let i = 0; i < 5; i++) {
        if (intento[i] === secreta[i]) res[i] = '🟩';
        else sobra[secreta[i]] = (sobra[secreta[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
        if (res[i] === '⬜' && sobra[intento[i]] > 0) { res[i] = '🟨'; sobra[intento[i]]--; }
    }
    return res.join('');
}

// --- Intruso: 40 sets [categoría, 4 palabras, índice del intruso] ---
const INTRUSO_SETS = [
    ['FRUTAS', ['manzana', 'pera', 'uva', 'martillo'], 3], ['ANIMALES', ['perro', 'gato', 'loro', 'silla'], 3],
    ['COLORES', ['rojo', 'azul', 'verde', 'mesa'], 3], ['DEPORTES', ['fútbol', 'tenis', 'natación', 'lápiz'], 3],
    ['PAÍSES', ['México', 'Perú', 'Chile', 'pelota'], 3], ['COMIDA', ['tacos', 'pizza', 'sopa', 'zapato'], 3],
    ['INSTRUMENTOS', ['guitarra', 'piano', 'batería', 'escoba'], 3], ['TRANSPORTE', ['carro', 'avión', 'barco', 'libro'], 3],
    ['ROPA', ['camisa', 'pantalón', 'sombrero', 'tenedor'], 3], ['OFICIOS', ['doctor', 'maestro', 'carpintero', 'nube'], 3],
    ['BEBIDAS', ['agua', 'jugo', 'café', 'piedra'], 3], ['DULCES', ['chocolate', 'paleta', 'chicle', 'tornillo'], 3],
    ['MUEBLES', ['mesa', 'silla', 'cama', 'avión'], 3], ['HERRAMIENTAS', ['martillo', 'sierra', 'taladro', 'gato'], 3],
    ['FLORES', ['rosa', 'clavel', 'tulipán', 'cuchara'], 3], ['PLANETAS', ['Marte', 'Venus', 'Júpiter', 'queso'], 3],
    ['IDIOMAS', ['español', 'inglés', 'francés', 'silla'], 3], ['REDES', ['WhatsApp', 'TikTok', 'Instagram', 'tamal'], 3],
    ['JUGUETES', ['pelota', 'muñeca', 'trompo', 'cebolla'], 3], ['MASCOTAS', ['perro', 'gato', 'pez', 'refrigerador'], 3],
    ['VERDURAS', ['tomate', 'cebolla', 'papa', 'teléfono'], 3], ['POSTRES', ['pastel', 'helado', 'flan', 'llanta'], 3],
    ['PROFESIONES', ['abogado', 'ingeniero', 'enfermera', 'globo'], 3], ['CLIMA', ['lluvia', 'sol', 'nieve', 'tijeras'], 3],
    ['CUERPO', ['mano', 'pie', 'ojo', 'teclado'], 3], ['ESCUELA', ['lápiz', 'cuaderno', 'borrador', 'perro'], 3],
    ['COCINA', ['olla', 'sartén', 'cuchillo', 'pelota'], 3], ['MÚSICA', ['salsa', 'rock', 'cumbia', 'martillo'], 3],
    ['CINE', ['actor', 'cámara', 'guion', 'sandía'], 3], ['PLAYA', ['arena', 'olas', 'sombrilla', 'computadora'], 3],
    ['BOSQUE', ['árbol', 'ardilla', 'hongo', 'celular'], 3], ['CIUDAD', ['edificio', 'semáforo', 'parque', 'tiburón'], 3],
    ['GRANJA', ['vaca', 'caballo', 'gallina', 'avión'], 3], ['ESPACIO', ['estrella', 'luna', 'cohete', 'taco'], 3],
    ['FAMILIA', ['madre', 'padre', 'hermano', 'escoba'], 3], ['EMOCIONES', ['alegría', 'miedo', 'enojo', 'ladrillo'], 3],
    ['JUEGOS', ['ajedrez', 'dominó', 'cartas', 'sopa'], 3], ['BAÑO', ['jabón', 'toalla', 'espejo', 'perro'], 3],
    ['OFICINA', ['papel', 'grapadora', 'carpeta', 'sandía'], 3], ['JARDÍN', ['maceta', 'manguera', 'semilla', 'avión'], 3]
];

// --- Supervivencia: capitales + revueltas (las mates se generan) ---
const SUPER_CAPITALES = [['México', 'ciudad de mexico'], ['Colombia', 'bogota'], ['Argentina', 'buenos aires'], ['Perú', 'lima'], ['Chile', 'santiago'], ['España', 'madrid'], ['Francia', 'paris'], ['Italia', 'roma'], ['Japón', 'tokio'], ['Brasil', 'brasilia'], ['Egipto', 'el cairo'], ['China', 'pekin'], ['Corea del Sur', 'seul'], ['Alemania', 'berlin'], ['Inglaterra', 'londres'], ['Portugal', 'lisboa'], ['Grecia', 'atenas'], ['Rusia', 'moscu'], ['Canadá', 'ottawa'], ['Cuba', 'la habana'], ['Venezuela', 'caracas'], ['Ecuador', 'quito'], ['Uruguay', 'montevideo'], ['Paraguay', 'asuncion'], ['Bolivia', 'la paz'], ['EEUU', 'washington'], ['India', 'nueva delhi'], ['Turquía', 'ankara'], ['Marruecos', 'rabat'], ['Tailandia', 'bangkok']];
const SUPER_REVUELTAS = ['gato', 'perro', 'casa', 'libro', 'mesa', 'sol', 'luna', 'flor', 'pez', 'ave', 'tren', 'barco', 'nube', 'lluvia', 'nieve', 'fresa', 'mango', 'tigre', 'oso', 'lobo'];
function revolverS(pal) {
    let arr;
    do { arr = [...pal].sort(() => Math.random() - 0.5); } while (arr.join('') === pal);
    return arr.join('');
}
function genRetoSuper(nivel) {
    const tipo = rnd(4);
    if (tipo === 0) {
        const [pais, cap] = SUPER_CAPITALES[rnd(SUPER_CAPITALES.length)];
        return { texto: `🌍 Capital de *${pais}*`, resp: normS(cap) };
    }
    if (tipo === 1) {
        const a = 2 + rnd(20) + nivel, b = 2 + rnd(20);
        return { texto: `➗ *${a} + ${b}*`, resp: String(a + b) };
    }
    if (tipo === 2) {
        const pal = SUPER_REVUELTAS[rnd(SUPER_REVUELTAS.length)];
        return { texto: `🔀 Desordena: *${revolverS(pal).toUpperCase().split('').join(' ')}*`, resp: normS(pal) };
    }
    const a = 3 + rnd(9), b = 3 + rnd(9);
    return { texto: `✖️ *${a} × ${b}*`, resp: String(a * b) };
}

// --- Ruleta2: 8 categorías × 12 palabras ---
const RULETA2_CATS = {
    '🐶 ANIMAL': ['perro', 'gato', 'pato', 'loro', 'pez', 'oso', 'lobo', 'toro', 'puma', 'zorro', 'koala', 'panda'],
    '🍎 FRUTA': ['manzana', 'pera', 'uva', 'mango', 'piña', 'coco', 'limon', 'fresa', 'melon', 'sandia', 'durazno', 'cereza'],
    '🌍 PAÍS': ['mexico', 'peru', 'chile', 'cuba', 'panama', 'italia', 'francia', 'españa', 'japon', 'china', 'india', 'egipto'],
    '🍕 COMIDA': ['tacos', 'pizza', 'sopa', 'tamales', 'arepas', 'torta', 'pollo', 'carne', 'huevo', 'queso', 'arroz', 'pescado'],
    '⚽ DEPORTE': ['futbol', 'tenis', 'boxeo', 'natacion', 'ciclismo', 'beisbol', 'basquet', 'voleibol', 'atletismo', 'judo', 'karate', 'surf'],
    '🎨 COLOR': ['rojo', 'azul', 'verde', 'negro', 'blanco', 'rosado', 'morado', 'naranja', 'gris', 'dorado', 'celeste', 'marron'],
    '👕 ROPA': ['camisa', 'pantalon', 'sombrero', 'zapatos', 'abrigo', 'bufanda', 'guantes', 'medias', 'collar', 'anillo', 'gorra', 'falda'],
    '🎸 INSTRUMENTO': ['guitarra', 'piano', 'bateria', 'trompeta', 'violin', 'flauta', 'tambor', 'saxofon', 'arpa', 'tuba', 'acordeon', 'maracas']
};

// --- Escalera: serpientes 🐍 y escaleras 🪜 en tablero al 50 ---
const ESC_MAPA = { 4: 14, 9: 31, 20: 38, 28: 44, 36: 6, 47: 26, 49: 11, 40: 19, 32: 22, 16: 7 };

module.exports = {
    name: 'solo2',
    isMultiple: true,
    names: ['!wordle', '!intruso', '!supervivencia', '!cazatesoros', '!ruleta2', '!escalera', '!caja'],
    category: 'Juegos',
    async execute(sock, chatId, msg, args, extras) {
        const { start, sender, isGroup, db, botState } = extras;
        const nom = (jid) => `@${(jid || '').split('@')[0]}`;
        if (!isGroup) return sock.sendMessage(chatId, { text: '👥 Estos juegos solo funcionan en grupos.' }, { quoted: msg });
        let juego = botState.juegos[chatId];
        const resto = args.join(' ').trim();

        // ============ !wordle ============
        if (start === '!wordle') {
            if (!resto && (!juego || juego.tipo !== 'wordle')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                const pal = WORDLE_BANCO[rnd(WORDLE_BANCO.length)];
                botState.juegos[chatId] = { tipo: 'wordle', responder: sender, palabra: pal, intentos: 0, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🟩 *¡WORDLE!* ${nom(sender)} tiene 6 intentos para la palabra de 5 letras.\nPrueba con *!wordle <palabra>*`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'wordle') return sock.sendMessage(chatId, { text: '🟩 Empieza con *!wordle*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Ese wordle es de ${nom(juego.responder)}.` }, { quoted: msg });
            const intento = normS(resto);
            if (intento.length !== 5 || !/^[a-z]{5}$/.test(intento)) return sock.sendMessage(chatId, { text: '⚠️ Solo palabras de 5 letras.' }, { quoted: msg });
            juego.intentos++; juego._ts = Date.now();
            if (intento === juego.palabra) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('wordle', sender).catch(() => null);
                if (!antes || juego.intentos < antes) await db.saveRecord('wordle', sender, juego.intentos, true).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: `🎉 *¡CORRECTO en ${juego.intentos} intento(s)!* La palabra era *${juego.palabra.toUpperCase()}*.\n🏅 Récord personal: ${!antes || juego.intentos < antes ? '¡NUEVO! 🔥' : antes + ' intentos'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            if (juego.intentos >= 6) {
                delete botState.juegos[chatId];
                return sock.sendMessage(chatId, { text: `💀 *¡PERDISTE!* Era *${juego.palabra.toUpperCase()}*.\nÚltima pista: ${pistaWordle(juego.palabra, intento)}\nMás suerte la próxima, crack. 😏`, mentions: [sender] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: `${pistaWordle(juego.palabra, intento)}  *${intento.toUpperCase()}*\nIntentos: ${juego.intentos}/6 — *!wordle <palabra>*`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !intruso ============
        if (start === '!intruso') {
            if (!resto && (!juego || juego.tipo !== 'intruso')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'intruso', responder: sender, ronda: 1, puntos: 0, usadas: new Set(), _ts: Date.now() };
                juego = botState.juegos[chatId];
                const set = INTRUSO_SETS[rnd(INTRUSO_SETS.length)];
                juego.set = set; juego.usadas.add(set[1].join(','));
                juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🕵️ *¡EL INTRUSO!* ${nom(sender)} (ronda 1/5, tema ${set[0]})\n1️⃣ ${set[1][0]}\n2️⃣ ${set[1][1]}\n3️⃣ ${set[1][2]}\n4️⃣ ${set[1][3]}\n¿Cuál NO pertenece? *!intruso <1-4>*`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'intruso') return sock.sendMessage(chatId, { text: '🕵️ Empieza con *!intruso*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Ese intruso es de ${nom(juego.responder)}.` }, { quoted: msg });
            const n = parseInt(resto.trim(), 10);
            if (![1, 2, 3, 4].includes(n)) return sock.sendMessage(chatId, { text: '⚠️ Responde *!intruso 1*, *2*, *3* o *4*.' }, { quoted: msg });
            juego._ts = Date.now();
            let txt = '';
            if (n - 1 === juego.set[2]) { juego.puntos++; txt = `✅ *¡Correcto!* El intruso era *${juego.set[1][juego.set[2]]}*. 🕵️‍♂️ ¡Buen ojo!\n`; }
            else txt = `❌ ¡Fallaste! El intruso era *${juego.set[1][juego.set[2]]}*. Hasta mi abuela lo vio. 👵\n`;
            if (juego.ronda >= 5) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('intruso', sender).catch(() => null);
                if (!antes || juego.puntos > antes) await db.saveRecord('intruso', sender, juego.puntos, false).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🏁 *¡FIN!* Puntaje: *${juego.puntos}/5*.\n🏅 Récord personal: ${!antes || juego.puntos > antes ? '¡NUEVO! 🔥' : antes + '/5'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            juego.ronda++;
            let set;
            for (let i = 0; i < 50; i++) { const c = INTRUSO_SETS[rnd(INTRUSO_SETS.length)]; if (!juego.usadas.has(c[1].join(','))) { set = c; break; } }
            if (!set) set = INTRUSO_SETS[rnd(INTRUSO_SETS.length)];
            juego.set = set; juego.usadas.add(set[1].join(','));
            return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🕵️ Ronda ${juego.ronda}/5 (tema ${set[0]}) — puntos: ${juego.puntos}\n1️⃣ ${set[1][0]}\n2️⃣ ${set[1][1]}\n3️⃣ ${set[1][2]}\n4️⃣ ${set[1][3]}`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !supervivencia — 7 retos, 3 vidas ============
        if (start === '!supervivencia') {
            if (!resto && (!juego || juego.tipo !== 'supervivencia')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                const reto = genRetoSuper(1);
                botState.juegos[chatId] = { tipo: 'supervivencia', responder: sender, ronda: 1, puntos: 0, vidas: 3, reto, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🧟 *¡SUPERVIVENCIA!* ${nom(sender)}: 7 retos mezclados con 3 vidas ❤️❤️❤️.\n\n*RETO 1/7:* ${reto.texto}\nResponde: *!supervivencia <respuesta>*`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'supervivencia') return sock.sendMessage(chatId, { text: '🧟 Empieza con *!supervivencia*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Esa supervivencia es de ${nom(juego.responder)}.` }, { quoted: msg });
            if (!resto) return sock.sendMessage(chatId, { text: '⚠️ Responde con *!supervivencia <respuesta>*.' }, { quoted: msg });
            juego._ts = Date.now();
            let txt = '';
            if (normS(resto) === juego.reto.resp) { juego.puntos++; txt = `✅ *¡Correcto!* +1 punto.\n`; }
            else { juego.vidas--; txt = `❌ ¡Era *${juego.reto.resp}*! Pierdes una vida. ${'❤️'.repeat(Math.max(juego.vidas, 0))}${juego.vidas <= 0 ? '💀' : ''}\n`; }
            if (juego.vidas <= 0) {
                delete botState.juegos[chatId];
                return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n💀 *¡MUERTO en el reto ${juego.ronda}/7!* Puntaje: *${juego.puntos}*. Te comieron los zombies. 🧟`, mentions: [sender] }, { quoted: msg });
            }
            if (juego.ronda >= 7) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('supervivencia', sender).catch(() => null);
                if (!antes || juego.puntos > antes) await db.saveRecord('supervivencia', sender, juego.puntos, false).catch(() => {});
                await db.sumarXP(sender, 15).catch(() => {});
                return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🏆 *¡SOBREVIVISTE!* Puntaje: *${juego.puntos}/7* con ${juego.vidas} vida(s).\n🏅 Récord personal: ${!antes || juego.puntos > antes ? '¡NUEVO! 🔥' : antes + '/7'} | +15 XP`, mentions: [sender] }, { quoted: msg });
            }
            juego.ronda++;
            juego.reto = genRetoSuper(juego.ronda);
            return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n*RETO ${juego.ronda}/7* (puntos ${juego.puntos}, vidas ${'❤️'.repeat(juego.vidas)}): ${juego.reto.texto}`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !cazatesoros — número 1-50 ============
        if (start === '!cazatesoros') {
            if (!resto && (!juego || juego.tipo !== 'cazatesoros')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'cazatesoros', responder: sender, num: 1 + rnd(50), intentos: 0, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🗺️ *¡CAZA EL TESORO!* ${nom(sender)}: escondí un número del *1 al 50*.\nBusca con *!cazatesoros <n>* (te digo si estás frío o caliente 🔥).`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'cazatesoros') return sock.sendMessage(chatId, { text: '🗺️ Empieza con *!cazatesoros*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Ese tesoro es de ${nom(juego.responder)}.` }, { quoted: msg });
            const n = parseInt(resto.trim(), 10);
            if (!n || n < 1 || n > 50) return sock.sendMessage(chatId, { text: '⚠️ Número del 1 al 50.' }, { quoted: msg });
            juego.intentos++; juego._ts = Date.now();
            if (n === juego.num) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('cazatesoros', sender).catch(() => null);
                if (!antes || juego.intentos < antes) await db.saveRecord('cazatesoros', sender, juego.intentos, true).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: `💰 *¡TESORO ENCONTRADO en ${juego.intentos} intento(s)!* Era el *${juego.num}*. ¡Pirata legendario! 🏴‍☠️\n🏅 Récord personal: ${!antes || juego.intentos < antes ? '¡NUEVO! 🔥' : antes + ' intentos'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            const d = Math.abs(n - juego.num);
            const calor = d <= 2 ? '🔥🔥 ¡HIRVIENDO!' : d <= 5 ? '🔥 ¡Caliente!' : d <= 10 ? '🌤️ Tibio...' : d <= 20 ? '❄️ Frío...' : '🧊 ¡CONGELADO! ¿Buscas en otro mapa?';
            const dir = n < juego.num ? '📈 más alto' : '📉 más bajo';
            return sock.sendMessage(chatId, { text: `${nom(sender)} prueba *${n}*: ${calor} (${dir})\nIntentos: ${juego.intentos} — *!cazatesoros <n>*`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !ruleta2 — palabra de la categoría con esa letra ============
        if (start === '!ruleta2') {
            if (!resto && (!juego || juego.tipo !== 'ruleta2')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'ruleta2', responder: sender, ronda: 1, racha: 0, mejor: 0, dichas: new Set(), _ts: Date.now() };
                juego = botState.juegos[chatId];
                const cats = Object.keys(RULETA2_CATS);
                juego.cat = cats[rnd(cats.length)];
                const letras = [...new Set(RULETA2_CATS[juego.cat].map(w => w[0]))];
                juego.letra = letras[rnd(letras.length)];
                juego._ts = Date.now();
                return sock.sendMessage(chatId, { text: `🎡 *¡RULETA DE PALABRAS!* ${nom(sender)} (ronda 1/5)\nDi algo de *${juego.cat}* que empiece con *“${juego.letra.toUpperCase()}”*:\n*!ruleta2 <palabra>* (sin repetir, si fallas se corta la racha 😈)`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'ruleta2') return sock.sendMessage(chatId, { text: '🎡 Empieza con *!ruleta2*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Esa ruleta es de ${nom(juego.responder)}.` }, { quoted: msg });
            const pal = normS(resto);
            juego._ts = Date.now();
            const lista = RULETA2_CATS[juego.cat].map(normS);
            let txt = '';
            if (pal[0] === juego.letra && lista.includes(pal) && !juego.dichas.has(pal)) {
                juego.racha++; juego.mejor = Math.max(juego.mejor, juego.racha); juego.dichas.add(pal);
                txt = `✅ *¡${resto.trim()} vale!* Racha: ${juego.racha} 🔥\n`;
            } else {
                const por = juego.dichas.has(pal) ? 'repetida, ¡qué memoria! 🐔' : pal[0] !== juego.letra ? `ni empieza con “${juego.letra.toUpperCase()}”, ¿lees o no? 🤓` : 'esa no está en mi lista, inventando palabras... 🤥';
                txt = `❌ *${resto.trim() || '...'}* ${por} Racha cortada. ${juego.racha > 1 ? 'Ibas bien y la regaste. 😂' : ''}\n`;
                juego.racha = 0;
            }
            if (juego.ronda >= 5) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('ruleta2', sender).catch(() => null);
                if (!antes || juego.mejor > antes) await db.saveRecord('ruleta2', sender, juego.mejor, false).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🏁 *¡FIN!* Mejor racha: *${juego.mejor}/5*.\n🏅 Récord personal: ${!antes || juego.mejor > antes ? '¡NUEVO! 🔥' : antes + '/5'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            juego.ronda++;
            const cats = Object.keys(RULETA2_CATS);
            juego.cat = cats[rnd(cats.length)];
            const letras = [...new Set(RULETA2_CATS[juego.cat].map(w => w[0]))];
            juego.letra = letras[rnd(letras.length)];
            return sock.sendMessage(chatId, { text: txt + `━━━━━━━━━━━━━━\n🎡 Ronda ${juego.ronda}/5: *${juego.cat}* con *“${juego.letra.toUpperCase()}”*`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !escalera — serpientes y escaleras al 50 ============
        if (start === '!escalera') {
            const sub = resto.toLowerCase();
            if (!sub && (!juego || juego.tipo !== 'escalera')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                botState.juegos[chatId] = { tipo: 'escalera', responder: sender, pos: 0, turnos: 0, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🐍 *¡ESCALERA!* ${nom(sender)}: llega al *50* en máximo 15 turnos.\n🪜 Escaleras que suben: 4, 9, 20, 28 · 🐍 Serpientes que bajan: ¡varias escondidas!\nLanza con *!escalera lanza*`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'escalera') return sock.sendMessage(chatId, { text: '🐍 Empieza con *!escalera*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Esa escalera es de ${nom(juego.responder)}.` }, { quoted: msg });
            if (sub !== 'lanza') return sock.sendMessage(chatId, { text: '🎲 Lanza con *!escalera lanza*.' }, { quoted: msg });
            const dado = 1 + rnd(6);
            juego.turnos++; juego._ts = Date.now();
            let nueva = juego.pos + dado;
            if (nueva > 50) nueva = juego.pos;
            let extra = '';
            if (ESC_MAPA[nueva] !== undefined) {
                const dest = ESC_MAPA[nueva];
                extra = dest > nueva ? `\n🪜 *¡ESCALERA!* Subes de ${nueva} a ${dest} 🚀` : `\n🐍 *¡SERPIENTE!* Bajas de ${nueva} a ${dest} 😂 ¡Te mordió por confiado!`;
                nueva = dest;
            }
            juego.pos = nueva;
            const llenos = Math.min(10, Math.round((nueva / 50) * 10));
            const barra = '🟩'.repeat(llenos) + '⬜'.repeat(10 - llenos);
            if (nueva >= 50) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('escalera', sender).catch(() => null);
                if (!antes || juego.turnos < antes) await db.saveRecord('escalera', sender, juego.turnos, true).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: `🏆 *¡LLEGASTE AL 50 en ${juego.turnos} turnos!*\n🏅 Récord personal: ${!antes || juego.turnos < antes ? '¡NUEVO! 🔥' : antes + ' turnos'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            if (juego.turnos >= 15) {
                delete botState.juegos[chatId];
                return sock.sendMessage(chatId, { text: `⏰ *¡SE ACABARON LOS 15 TURNOS!* Te quedaste en *${nueva}*. Las serpientes festejan. 🐍🎉`, mentions: [sender] }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: `🎲 Dado: *${dado}* → casilla *${nueva}*/50${extra}\n${barra}\nTurno ${juego.turnos}/15 — *!escalera lanza*`, mentions: [sender] }, { quoted: msg });
        }

        // ============ !caja — caja fuerte de 3 dígitos ============
        if (start === '!caja') {
            if (!resto && (!juego || juego.tipo !== 'caja')) {
                if (juego) return sock.sendMessage(chatId, { text: '⚠️ Ya hay un juego activo. Termínalo primero.' }, { quoted: msg });
                const digs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].sort(() => Math.random() - 0.5).slice(0, 3);
                botState.juegos[chatId] = { tipo: 'caja', responder: sender, cod: digs.join(''), intentos: 0, _ts: Date.now() };
                return sock.sendMessage(chatId, { text: `🔐 *¡CAJA FUERTE!* ${nom(sender)}: código de 3 dígitos distintos, 8 intentos.\nPrueba con *!caja 123* (te digo cuántos van bien ubicados ✅ y cuántos están pero movidos 🔀).`, mentions: [sender] }, { quoted: msg });
            }
            if (!juego || juego.tipo !== 'caja') return sock.sendMessage(chatId, { text: '🔐 Empieza con *!caja*.' }, { quoted: msg });
            if (sender !== juego.responder) return sock.sendMessage(chatId, { text: `👀 Esa caja es de ${nom(juego.responder)}.` }, { quoted: msg });
            const intento = resto.trim();
            if (!/^\d{3}$/.test(intento)) return sock.sendMessage(chatId, { text: '⚠️ Solo 3 dígitos: *!caja 123*.' }, { quoted: msg });
            juego.intentos++; juego._ts = Date.now();
            if (intento === juego.cod) {
                delete botState.juegos[chatId];
                const antes = await db.getRecord('caja', sender).catch(() => null);
                if (!antes || juego.intentos < antes) await db.saveRecord('caja', sender, juego.intentos, true).catch(() => {});
                await db.sumarXP(sender, 10).catch(() => {});
                return sock.sendMessage(chatId, { text: `💰 *¡CAJA ABIERTA en ${juego.intentos} intento(s)!* ¡Ladrón profesional! 🕶️\n🏅 Récord personal: ${!antes || juego.intentos < antes ? '¡NUEVO! 🔥' : antes + ' intentos'} | +10 XP`, mentions: [sender] }, { quoted: msg });
            }
            if (juego.intentos >= 8) {
                delete botState.juegos[chatId];
                return sock.sendMessage(chatId, { text: `🚨 *¡ALARMA! Se acabaron los 8 intentos.* El código era *${juego.cod}*. La policía va en camino. 🚔😂`, mentions: [sender] }, { quoted: msg });
            }
            let bien = 0, mov = 0;
            const usadas = [false, false, false];
            for (let i = 0; i < 3; i++) if (intento[i] === juego.cod[i]) { bien++; usadas[i] = true; }
            for (let i = 0; i < 3; i++) {
                if (intento[i] === juego.cod[i]) continue;
                for (let k = 0; k < 3; k++) {
                    if (!usadas[k] && intento[i] === juego.cod[k]) { mov++; usadas[k] = true; break; }
                }
            }
            return sock.sendMessage(chatId, { text: `🔐 *${intento}*: ✅ ${bien} bien ubicado(s) · 🔀 ${mov} está(n) pero movido(s).\nIntento ${juego.intentos}/8 — *!caja <3 dígitos>*`, mentions: [sender] }, { quoted: msg });
        }
    }
};
