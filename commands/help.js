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
        desc: 'Envía las páginas de un manga disponible. Usa "all" para descargar todos los capítulos.',
        usage: '!leer <código> [capítulo|all]',
        ejemplo: '!leer 008 1\n!leer 008 all',
        args: 'Código del manga (requerido), capítulo o "all" (opcional)',
        cooldown: '30 segundos (por usuario)'
    },
    '!recomanga': {
        desc: 'Recomienda un manga popular con capítulos en español. Puedes filtrar por género.',
        usage: '!recomanga [género]',
        ejemplo: '!recomanga\n!recomanga accion\n!recomanga generos',
        args: 'Género (opcional). Usa "generos" para ver la lista.',
        cooldown: '5 segundos'
    },
    '!parar': {
        desc: 'Detiene una descarga masiva de manga en curso (!leer all).',
        usage: '!parar',
        ejemplo: '!parar',
        args: 'Ninguno',
        cooldown: 'Ninguno'
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
    
    // ECONOMIA
    '!perfil': {
        desc: 'Muestra tu balance y perfil de usuario.',
        usage: '!perfil [@usuario]',
        ejemplo: '!perfil\n!p @usuario',
        args: 'Usuario (opcional)',
        cooldown: 'Ninguno',
        alias: '!p, !profile'
    },
    '!daily': {
        desc: 'Recoge tu recompensa diaria.',
        usage: '!daily',
        ejemplo: '!daily',
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
    '!tienda': {
        desc: 'Muestra la tienda de items.',
        usage: '!tienda',
        ejemplo: '!tienda',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!comprar': {
        desc: 'Compra un item de la tienda.',
        usage: '!comprar <numero>',
        ejemplo: '!comprar 1',
        args: 'Numero del item (requerido)',
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
    
    '!casar': {
        desc: 'Propone matrimonio a otro usuario.',
        usage: '!casar @usuario',
        ejemplo: '!casar @usuario',
        args: 'Usuario (requerido)',
        cooldown: 'Ninguno',
        alias: '!marry, !proponer'
    },
    '!divorce': {
        desc: 'Termina tu matrimonio actual.',
        usage: '!divorce',
        ejemplo: '!divorce',
        args: 'Ninguno',
        cooldown: '1 dia'
    },
    '!pareja': {
        desc: 'Muestra tu pareja actual.',
        usage: '!pareja',
        ejemplo: '!pareja',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!mascotas': {
        desc: 'Gestiona tu mascota.',
        usage: '!mascotas [accion]',
        ejemplo: '!mascotas\n!alimentar',
        args: 'Accion (opcional)',
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

// Este modulo YA NO registra su propio comando '!help' (antes colisionaba
// con el '!help' de main.js y por orden de carga alfabetico, main.js siempre
// ganaba y esta ayuda detallada nunca se ejecutaba). Se exporta helpData para
// que main.js la use cuando '!help <comando>' trae un argumento. isMultiple:
// false + names vacio evita que commandHandler intente registrar un comando
// invocable directamente desde aqui (name: '__help_data__' es solo un id
// interno no usado por los usuarios).
module.exports = {
    name: '__help_data__',
    helpData,
    isMultiple: false,
    async execute() { /* no-op: este modulo no se registra como comando de usuario */ }
};
