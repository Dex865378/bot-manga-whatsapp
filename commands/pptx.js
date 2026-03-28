/**
 * 🎮 PPT EXTREMO - Piedra Papel Tijera Edición Extendida
 * 9 elementos con relaciones de victoria/derrota
 * 
 * Basado en RPSLS (Big Bang Theory) + elementos clásicos
 * Cada elemento gana a 4 y pierde contra 4
 */

// Definición de las 9 opciones con sus emojis
const opciones = {
    piedra: { emoji: '🪨', nombre: 'Piedra' },
    papel: { emoji: '📄', nombre: 'Papel' },
    tijera: { emoji: '✂️', nombre: 'Tijera' },
    lagarto: { emoji: '🦎', nombre: 'Lagarto' },
    spock: { emoji: '🖖', nombre: 'Spock' },
    fuego: { emoji: '🔥', nombre: 'Fuego' },
    agua: { emoji: '💧', nombre: 'Agua' },
    aire: { emoji: '💨', nombre: 'Aire' },
    rayo: { emoji: '⚡', nombre: 'Rayo' }
};

// Tabla de victorias: clave le gana a los valores
// Cada elemento gana a exactamente 4 de los otros 8
const victorias = {
    piedra: { tijera: 'aplasta', lagarto: 'aplasta', fuego: 'apaga por falta de oxígeno', rayo: 'absorbe' },
    papel: { piedra: 'envuelve', spock: 'desaprueba', agua: 'flota sobre', aire: 'planea con' },
    tijera: { papel: 'corta', lagarto: 'decapita', aire: 'corta el viento', rayo: 'conduce a tierra' },
    lagarto: { papel: 'devora', spock: 'envenena', agua: 'bebe', aire: 'respira' },
    spock: { piedra: 'vaporiza', tijera: 'rompe', fuego: 'extingue con lógica', rayo: 'redirige' },
    fuego: { tijera: 'derrite', lagarto: 'quema', papel: 'incinera', aire: 'se expande con' },
    agua: { piedra: 'erosiona', fuego: 'apaga', rayo: 'conduce', tijera: 'oxida' },
    aire: { fuego: 'extingue', agua: 'evapora', piedra: 'desgasta', spock: 'ahoga en el vacío' },
    rayo: { agua: 'electrifica', lagarto: 'electrocuta', papel: 'quema', aire: 'ioniza' }
};

// Aliases para facilitar escritura
const aliases = {
    'piedra': 'piedra', 'roca': 'piedra', 'stone': 'piedra', 'rock': 'piedra',
    'papel': 'papel', 'paper': 'papel', 'hoja': 'papel',
    'tijera': 'tijera', 'tijeras': 'tijera', 'scissors': 'tijera',
    'lagarto': 'lagarto', 'lizard': 'lagarto', 'reptil': 'lagarto',
    'spock': 'spock', 'vulcano': 'spock', 'leonard': 'spock',
    'fuego': 'fuego', 'fire': 'fuego', 'llama': 'fuego',
    'agua': 'agua', 'water': 'agua',
    'aire': 'aire', 'air': 'aire', 'viento': 'aire',
    'rayo': 'rayo', 'lightning': 'rayo', 'trueno': 'rayo', 'thunder': 'rayo'
};

function determinarResultado(jugador, bot) {
    if (jugador === bot) return 'empate';
    if (victorias[jugador] && victorias[jugador][bot]) return 'gana';
    return 'pierde';
}

function getAccion(ganador, perdedor) {
    return victorias[ganador]?.[perdedor] || 'derrota a';
}

module.exports = {
    name: '!pptx',
    category: 'Juegos',
    async execute(sock, chatId, msg, args, { sender, db }) {
        const input = (args[0] || '').toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Sin argumento: mostrar ayuda con todas las opciones
        if (!input) {
            const listaOpciones = Object.entries(opciones)
                .map(([key, val]) => `${val.emoji} *${val.nombre}*`)
                .join('\n');

            return sock.sendMessage(chatId, {
                text:
                    `╔══════════════════════╗
║  🎮 *PPT EXTREMO* 🎮   ║
╚══════════════════════╝

¡Piedra Papel Tijera con *9 elementos*!
Cada uno gana a 4 y pierde contra 4.

*Opciones:*
${listaOpciones}

💡 *Uso:* !pptx <opción>
📖 *Ejemplo:* !pptx lagarto
📊 *Reglas:* !pptx reglas`
            }, { quoted: msg });
        }

        // Mostrar tabla de reglas
        if (input === 'reglas' || input === 'rules' || input === 'tabla') {
            let reglas = `📊 *TABLA DE VICTORIAS - PPT EXTREMO*\n\n`;
            for (const [elem, victs] of Object.entries(victorias)) {
                const info = opciones[elem];
                const victList = Object.entries(victs)
                    .map(([v, accion]) => `${opciones[v].emoji} ${accion} a ${opciones[v].nombre}`)
                    .join(', ');
                reglas += `${info.emoji} *${info.nombre}* → ${victList}\n\n`;
            }
            reglas += `_Cada elemento gana a 4 y pierde contra 4. ¡Perfecto equilibrio!_`;
            return sock.sendMessage(chatId, { text: reglas }, { quoted: msg });
        }

        // Resolver alias
        const eleccion = aliases[input];
        if (!eleccion) {
            const sugerencias = Object.keys(opciones).join(', ');
            return sock.sendMessage(chatId, {
                text:
                    `❌ *"${input}"* no es una opción válida.\n\n` +
                    `💡 Opciones: ${sugerencias}\n` +
                    `📖 Escribe *!pptx* para ver la guía completa.`
            }, { quoted: msg });
        }

        // El bot elige al azar
        const keys = Object.keys(opciones);
        const botChoice = keys[Math.floor(Math.random() * keys.length)];

        const jugadorInfo = opciones[eleccion];
        const botInfo = opciones[botChoice];
        const resultado = determinarResultado(eleccion, botChoice);

        let resultadoTexto = '';
        let resultadoEmoji = '';

        if (resultado === 'empate') {
            resultadoEmoji = '🤝';
            resultadoTexto = '¡EMPATE! Misma elección.';
        } else if (resultado === 'gana') {
            resultadoEmoji = '🏆';
            const accion = getAccion(eleccion, botChoice);
            resultadoTexto = `¡GANASTE! 🎉\n${jugadorInfo.emoji} ${jugadorInfo.nombre} *${accion}* ${botInfo.emoji} ${botInfo.nombre}`;
        } else {
            resultadoEmoji = '💀';
            const accion = getAccion(botChoice, eleccion);
            resultadoTexto = `¡PERDISTE! 😵\n${botInfo.emoji} ${botInfo.nombre} *${accion}* ${jugadorInfo.emoji} ${jugadorInfo.nombre}`;
        }

        // Animación de suspense
        const frames = ['🎮 *PPT EXTREMO*\n\n3️⃣...', '2️⃣...', '1️⃣...', '¡YA!'];

        const mensaje =
            `╔══════════════════════╗
║  🎮 *PPT EXTREMO* 🎮   ║
╚══════════════════════╝

👤 *Tú:* ${jugadorInfo.emoji} ${jugadorInfo.nombre}
🤖 *Bot:* ${botInfo.emoji} ${botInfo.nombre}

━━━━━━━━━━━━━━━━━━━━
${resultadoEmoji} *${resultadoTexto}*
━━━━━━━━━━━━━━━━━━━━

💡 _Escribe !pptx reglas para ver la tabla completa_`;

        await sock.sendMessage(chatId, { react: { text: resultadoEmoji, key: msg.key } }).catch(() => { });
        return sock.sendMessage(chatId, { text: mensaje }, { quoted: msg });
    }
};
