/**
 * ❓ SISTEMA DE AYUDA CONTEXTUAL
 * Comando !help para todos los comandos
 */

const helpData = {
    // MEDIA
    '!anime': {
        desc: 'Busca información de un anime o inicia un reto de memorización.',
        usage: '!anime <nombre>\n!anime reto',
        ejemplo: '!anime Attack on Titan\n!anime reto',
        args: 'Nombre del anime (opcional)',
        cooldown: 'Ninguno'
    },
    '!personaje': {
        desc: 'Busca información de un personaje de anime/manga.',
        usage: '!personaje <nombre>',
        ejemplo: '!personaje Goku\n!personaje Naruto Uzumaki',
        args: 'Nombre del personaje (requerido)',
        cooldown: 'Ninguno'
    },
    '!manga': {
        desc: 'Busca un manga local o en la base de datos mundial.',
        usage: '!manga <código o nombre>',
        ejemplo: '!manga 001\n!manga One Piece',
        args: 'Código local o nombre del manga (requerido)',
        cooldown: 'Ninguno'
    },
    '!leer': {
        desc: 'Envía las páginas de un manga disponible localmente.',
        usage: '!leer <código>',
        ejemplo: '!leer 001',
        args: 'Código del manga (requerido)',
        cooldown: '30 segundos (por usuario)'
    },
    '!recomendar': {
        desc: 'Recomienda un anime aleatorio de calidad (score >= 7).',
        usage: '!recomendar',
        ejemplo: '!recomendar',
        args: 'Ninguno',
        cooldown: '5 segundos'
    },
    '!random': {
        desc: 'Devuelve un anime aleatorio de la base de datos.',
        usage: '!random',
        ejemplo: '!random',
        args: 'Ninguno',
        cooldown: '5 segundos'
    },
    '!estrenos': {
        desc: 'Muestra los estrenos de anime de hoy.',
        usage: '!estrenos',
        ejemplo: '!estrenos',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!temporada': {
        desc: 'Lista los animes de la temporada actual.',
        usage: '!temporada',
        ejemplo: '!temporada',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!waifu': {
        desc: 'Genera una waifu aleatoria.',
        usage: '!waifu [categoría]',
        ejemplo: '!waifu\n!waifu maid',
        args: 'Categoría (opcional)',
        cooldown: 'Ninguno'
    },
    '!estudio': {
        desc: 'Busca información de un estudio de animación.',
        usage: '!estudio <nombre>',
        ejemplo: '!estudio MAPPA',
        args: 'Nombre del estudio (requerido)',
        cooldown: 'Ninguno'
    },
    '!proximo': {
        desc: 'Muestra información de emisión de un anime.',
        usage: '!proximo <nombre>',
        ejemplo: '!proximo Demon Slayer',
        args: 'Nombre del anime (requerido)',
        cooldown: 'Ninguno'
    },
    '!wiki': {
        desc: 'Busca información en Wikipedia.',
        usage: '!wiki <término>',
        ejemplo: '!wiki Dragon Ball',
        args: 'Término a buscar (requerido)',
        cooldown: 'Ninguno'
    },
    
    // ECONOMÍA
    '!balance': {
        desc: 'Muestra tu balance de dikys.',
        usage: '!balance [@usuario]',
        ejemplo: '!balance\n!balance @usuario',
        args: 'Usuario (opcional)',
        cooldown: 'Ninguno'
    },
    '!diario': {
        desc: 'Recoge tu recompensa diaria.',
        usage: '!diario',
        ejemplo: '!diario',
        args: 'Ninguno',
        cooldown: '24 horas'
    },
    '!w': {
        desc: 'Trabaja para ganar dikys.',
        usage: '!w',
        ejemplo: '!w',
        args: 'Ninguno',
        cooldown: '1 hora'
    },
    '!slut': {
        desc: 'Trabajo alternativo (menos dikys, menos cooldown).',
        usage: '!slut',
        ejemplo: '!slut',
        args: 'Ninguno',
        cooldown: '20 minutos'
    },
    '!prestigio': {
        desc: 'Asciende de prestigio reiniciando tu nivel.',
        usage: '!prestigio',
        ejemplo: '!prestigio',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!top': {
        desc: 'Muestra el ranking de usuarios.',
        usage: '!top [monedas|nivel|duelos]',
        ejemplo: '!top\n!top nivel\n!top monedas',
        args: 'Tipo de ranking (opcional)',
        cooldown: 'Ninguno'
    },
    '!shop': {
        desc: 'Muestra la tienda de items.',
        usage: '!shop',
        ejemplo: '!shop',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!buy': {
        desc: 'Compra un item de la tienda.',
        usage: '!buy <item>',
        ejemplo: '!buy pico\n!buy cebo',
        args: 'Nombre del item (requerido)',
        cooldown: 'Ninguno'
    },
    '!inventario': {
        desc: 'Muestra tu inventario de items.',
        usage: '!inventario',
        ejemplo: '!inventario',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    
    // JUEGOS
    '!duelo': {
        desc: 'Reta a otro usuario a un duelo.',
        usage: '!duelo @usuario [apuesta]',
        ejemplo: '!duelo @usuario\n!duelo @usuario 500',
        args: 'Usuario (requerido), apuesta (opcional)',
        cooldown: 'Ninguno'
    },
    '!trivia': {
        desc: 'Inicia un juego de trivia/preguntas.',
        usage: '!trivia',
        ejemplo: '!trivia',
        args: 'Ninguno',
        cooldown: '30 segundos'
    },
    '!quiz': {
        desc: 'Alias de !trivia - Inicia un quiz.',
        usage: '!quiz',
        ejemplo: '!quiz',
        args: 'Ninguno',
        cooldown: '30 segundos'
    },
    '!quizanime': {
        desc: 'Trivia específica de anime.',
        usage: '!quizanime',
        ejemplo: '!quizanime',
        args: 'Ninguno',
        cooldown: '30 segundos'
    },
    '!ahorcado': {
        desc: 'Juega al ahorcado.',
        usage: '!ahorcado [dificultad]',
        ejemplo: '!ahorcado\n!ahorcado dificil',
        args: 'Dificultad (opcional: facil, medio, dificil)',
        cooldown: '30 segundos'
    },
    '!slot': {
        desc: 'Juega a la máquina tragamonedas.',
        usage: '!slot [apuesta]',
        ejemplo: '!slot\n!slot 100',
        args: 'Apuesta (opcional, default: 10)',
        cooldown: '5 segundos'
    },
    '!ruleta': {
        desc: 'Gira la ruleta de la fortuna.',
        usage: '!ruleta',
        ejemplo: '!ruleta',
        args: 'Ninguno',
        cooldown: '1 minuto'
    },
    
    // SOCIAL
    '!perfil': {
        desc: 'Muestra o edita tu perfil.',
        usage: '!perfil [campo] [valor]',
        ejemplo: '!perfil\n!perfil anime FMA\n!perfil edad 20',
        args: 'Campo y valor (opcionales)',
        cooldown: 'Ninguno'
    },
    '!proponer': {
        desc: 'Propone matrimonio a otro usuario.',
        usage: '!proponer @usuario',
        ejemplo: '!proponer @usuario',
        args: 'Usuario (requerido)',
        cooldown: 'Ninguno'
    },
    '!divorcio': {
        desc: 'Termina tu matrimonio actual.',
        usage: '!divorcio',
        ejemplo: '!divorcio',
        args: 'Ninguno',
        cooldown: '1 día'
    },
    '!pareja': {
        desc: 'Muestra tu pareja actual.',
        usage: '!pareja',
        ejemplo: '!pareja',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!mascota': {
        desc: 'Gestiona tu mascota.',
        usage: '!mascota [acción]',
        ejemplo: '!mascota\n!mascota alimentar\n!mascota ver',
        args: 'Acción (opcional: alimentar, ver, lista)',
        cooldown: 'Ninguno'
    },
    
    // UTILIDADES
    '!menu': {
        desc: 'Muestra el menú de comandos disponibles.',
        usage: '!menu',
        ejemplo: '!menu',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!help': {
        desc: 'Muestra ayuda detallada de un comando.',
        usage: '!help [comando]',
        ejemplo: '!help\n!help anime\n!help balance',
        args: 'Nombre del comando (opcional)',
        cooldown: 'Ninguno'
    },
    '!ping': {
        desc: 'Verifica la latencia del bot.',
        usage: '!ping',
        ejemplo: '!ping',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!bot': {
        desc: 'Activa o desactiva el bot en el grupo.',
        usage: '!bot [on|off]',
        ejemplo: '!bot\n!bot on\n!bot off',
        args: 'Estado (opcional)',
        cooldown: 'Ninguno (solo admins)'
    },
    '!bienvenida': {
        desc: 'Gestiona mensajes de bienvenida.',
        usage: '!bienvenida [on|off]\n!setbienvenida <mensaje>',
        ejemplo: '!bienvenida on\n!setbienvenida ¡Bienvenido {usuario}!',
        args: 'Estado o mensaje (opcional)',
        cooldown: 'Ninguno (solo admins)'
    },
    '!tag': {
        desc: 'Menciona a todos los miembros del grupo.',
        usage: '!tag [mensaje]',
        ejemplo: '!tag\n!tag Reunión importante',
        args: 'Mensaje (opcional)',
        cooldown: '1 minuto (solo admins)'
    },
    '!reglas': {
        desc: 'Muestra las reglas del grupo.',
        usage: '!reglas',
        ejemplo: '!reglas',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    }
};

module.exports = {
    name: '!help',
    isMultiple: true,
    names: ['!help'],
    async execute(sock, chatId, msg, args, { start, botState }) {
        const commandName = args[0] ? (args[0].startsWith('!') ? args[0] : '!' + args[0]) : null;
        
        // Si no hay argumento, mostrar lista general
        if (!commandName) {
            let menu = '📚 *SISTEMA DE AYUDA*\n\n';
            menu += 'Usa `!help <comando>` para información detallada.\n\n';
            menu += '📺 *MEDIA*\n';
            menu += '`!anime` | `!personaje` | `!manga` | `!leer`\n';
            menu += '`!recomendar` | `!random` | `!estrenos` | `!temporada`\n';
            menu += '`!waifu` | `!estudio` | `!proximo` | `!wiki`\n\n';
            menu += '💰 *ECONOMÍA*\n';
            menu += '`!balance` | `!diario` | `!w` | `!slut`\n';
            menu += '`!prestigio` | `!top` | `!shop` | `!buy` | `!inventario`\n\n';
            menu += '🎮 *JUEGOS*\n';
            menu += '`!duelo` | `!trivia` | `!quiz` | `!quizanime`\n';
            menu += '`!ahorcado` | `!slot` | `!ruleta`\n\n';
            menu += '👥 *SOCIAL*\n';
            menu += '`!perfil` | `!proponer` | `!divorcio` | `!pareja` | `!mascota`\n\n';
            menu += '⚙️ *UTILIDADES*\n';
            menu += '`!menu` | `!help` | `!ping` | `!bot` | `!bienvenida`\n';
            menu += '`!tag` | `!reglas`\n\n';
            menu += '💡 *Ejemplo:* `!help anime` o `!help balance`';
            
            return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
        }
        
        // Buscar ayuda específica
        const help = helpData[commandName];
        
        if (!help) {
            return sock.sendMessage(chatId, { 
                text: `❌ Comando *${commandName}* no encontrado.\n\nUsa *!help* para ver la lista de comandos.` 
            }, { quoted: msg });
        }
        
        // Mostrar ayuda detallada
        let response = `❓ *AYUDA: ${commandName}*\n\n`;
        response += `📖 *Descripción:*\n${help.desc}\n\n`;
        response += `📝 *Uso:*\n\`\`\`${help.usage}\`\`\`\n\n`;
        response += `💡 *Ejemplo:*\n${help.ejemplo}\n\n`;
        response += `📋 *Argumentos:* ${help.args}\n`;
        response += `⏱️ *Cooldown:* ${help.cooldown}`;
        
        return sock.sendMessage(chatId, { text: response }, { quoted: msg });
    }
};
