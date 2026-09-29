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
    '!topactivos': {
        desc: 'Ranking de los que más hablan en este grupo.',
        usage: '!topactivos',
        ejemplo: '!topactivos',
        args: 'Ninguno',
        cooldown: 'Ninguno'
    },
    '!warn': {
        desc: 'Advertir a un miembro (admin). A las 3 es expulsado.',
        usage: '!warn @usuario [motivo]',
        ejemplo: '!warn @juan spam',
        args: 'Mención (requerida), motivo (opcional)',
        cooldown: 'Ninguno'
    },
    '!unwarn': {
        desc: 'Quitar las advertencias de un miembro (admin).',
        usage: '!unwarn @usuario',
        ejemplo: '!unwarn @juan',
        args: 'Mención (requerida)',
        cooldown: 'Ninguno'
    },
    '!warns': {
        desc: 'Ver cuántas advertencias tiene alguien.',
        usage: '!warns [@usuario]',
        ejemplo: '!warns @juan',
        args: 'Mención (opcional, sin ella ves las tuyas)',
        cooldown: 'Ninguno'
    },
    '!afk': {
        desc: 'Marcarte como ausente. Se quita solo al volver a escribir.',
        usage: '!afk [motivo]',
        ejemplo: '!afk almorzando',
        args: 'Motivo (opcional)',
        cooldown: 'Ninguno'
    },
    '!encuesta': {
        desc: 'Crear una encuesta nativa de WhatsApp en el grupo.',
        usage: '!encuesta <pregunta>, <opción1>, <opción2> [, ...]',
        ejemplo: '!encuesta ¿Soy hombre?, Sí, No',
        args: 'Pregunta y 2-12 opciones separadas por |',
        cooldown: 'Ninguno'
    },
    '!recordar': {
        desc: 'El bot te avisa con un texto en el futuro.',
        usage: '!recordar <tiempo> <texto>',
        ejemplo: '!recordar 2h Tomar la medicina\n!recordar 10m Llamar a mamá',
        args: 'Tiempo: número + s/m/h/d (máx 720). Máx 10 por usuario.',
        cooldown: 'Ninguno'
    },
    '!recordatorios': {
        desc: 'Ver o borrar tus recordatorios de este chat.',
        usage: '!recordatorios\n!recordatorios borrar <número>',
        ejemplo: '!recordatorios\n!recordatorios borrar 3',
        args: 'Ninguno / número del recordatorio',
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
    '!ttt': {
        desc: 'Tres en raya contra otro miembro del grupo.',
        usage: '!ttt @usuario\n!ttt si / !ttt no\n!ttt <1-9>',
        ejemplo: '!ttt @juan\n!ttt 5',
        args: 'Mención para retar, número de casilla para jugar',
        cooldown: 'Ninguno'
    },
    '!pptpvp': {
        desc: 'Piedra-papel-tijera contra otra persona con mapas secretos revueltos.',
        usage: '!pptpvp @usuario\n!pptpvp <1-3>',
        ejemplo: '!pptpvp @juan\n!pptpvp 2',
        args: 'Mención para retar, número de tu mapa secreto para elegir',
        cooldown: 'Ninguno'
    },
    '!c4': {
        desc: 'Conecta 4 contra otro miembro del grupo.',
        usage: '!c4 @usuario\n!c4 si / !c4 no\n!c4 <1-7>',
        ejemplo: '!c4 @juan\n!c4 4',
        args: 'Mención para retar, número de columna para jugar',
        cooldown: 'Ninguno'
    },
    '!quizduelo': {
        desc: 'Duelo de preguntas para dos, el primero en responder gana.',
        usage: '!quizduelo @usuario',
        ejemplo: '!quizduelo @juan',
        args: 'Mención del oponente (requerido)',
        cooldown: 'Ninguno'
    },
    '!bingo': {
        desc: 'Bingo grupal con cartones de 12 números.',
        usage: '!bingo\n!bingo yo\n!bingo empezar\n!bingo cantar\n!bingo carton',
        ejemplo: '!bingo\n!bingo yo',
        args: 'Subcomando según la fase del juego',
        cooldown: 'Ninguno'
    },
    '!dados': {
        desc: 'Duelo de dados contra alguien, al mejor de 5 rondas.',
        usage: '!dados @usuario\n!dados si / !dados no\n!tirar',
        ejemplo: '!dados @juan\n!tirar',
        args: 'Mención para retar, !tirar para tirar el dado',
        cooldown: 'Ninguno'
    },
    '!numero': {
        desc: 'Adivina el número secreto del 1 al 100 por turnos.',
        usage: '!numero @usuario\n!numero si / !numero no\n!numero <n>',
        ejemplo: '!numero @juan\n!numero 50',
        args: 'Mención para retar, número para adivinar',
        cooldown: 'Ninguno'
    },
    '!mates': {
        desc: 'Carrera de operaciones contra alguien, el más rápido suma punto.',
        usage: '!mates @usuario',
        ejemplo: '!mates @juan',
        args: 'Mención del oponente (requerido)',
        cooldown: 'Ninguno'
    },
    '!carrera2': {
        desc: 'Carrera a 30 pasos por turnos contra alguien.',
        usage: '!carrera2 @usuario\n!carrera2 si / !carrera2 no\n!avanza',
        ejemplo: '!carrera2 @juan\n!avanza',
        args: 'Mención para retar, !avanza para avanzar',
        cooldown: 'Ninguno'
    },
    '!naval': {
        desc: 'Batalla naval 5x5 contra alguien, barcos escondidos al azar.',
        usage: '!naval @usuario\n!naval si / !naval no\n!fuego B3',
        ejemplo: '!naval @juan\n!fuego B3',
        args: 'Mención para retar, casilla A-E + 1-5 para disparar',
        cooldown: 'Ninguno'
    },
    '!reflejos': {
        desc: 'Prueba tu velocidad de reacción contra el ¡AHORA! (guarda tu récord).',
        usage: '!reflejos\n!reflejos ya',
        ejemplo: '!reflejos',
        args: 'Ninguno para empezar, !reflejos ya al ver el ¡AHORA!',
        cooldown: 'Ninguno'
    },
    '!maraton': {
        desc: '10 operaciones contra reloj (guarda tu mejor tiempo).',
        usage: '!maraton\n!maraton <número>',
        ejemplo: '!maraton\n!maraton 42',
        args: 'Ninguno para empezar, número para responder',
        cooldown: 'Ninguno'
    },
    '!simon': {
        desc: 'Memoria de secuencias de emojis (guarda tu récord).',
        usage: '!simon\n!simon <emojis en orden>',
        ejemplo: '!simon\n!simon 🔥 🐱',
        args: 'Ninguno para empezar, emojis en orden para repetir',
        cooldown: 'Ninguno'
    },
    '!hongbao': {
        desc: 'Sobre rojo: reparte diky al azar entre los mencionados (máx 5).',
        usage: '!hongbao @ana @luis\n!abrir',
        ejemplo: '!hongbao @ana @luis',
        args: 'De 1 a 5 menciones; !abrir para reclamar tu parte',
        cooldown: 'Ninguno'
    },
    '!mentiroso': {
        desc: 'Dados mentirosos contra alguien: apuesta, duda y el 1 es comodín.',
        usage: '!mentiroso @usuario\n!apuesta <cant> <valor>\n!duda',
        ejemplo: '!mentiroso @juan\n!apuesta 3 4',
        args: 'Mención para retar (30 diky de apuesta c/u)',
        cooldown: 'Ninguno'
    },
    '!cadena': {
        desc: 'Encadena palabras por sus 2 últimas letras. 3 vidas, último en pie gana.',
        usage: '!cadena\n!cadena <palabra>',
        ejemplo: '!cadena\n!cadena mesa',
        args: 'Ninguno para empezar, palabra para encadenar',
        cooldown: 'Ninguno'
    },
    '!traidor': {
        desc: 'Descubre al traidor: roles secretos, excusas con !soy y votación con !votar.',
        usage: '!traidor\n!traidor yo\n!traidor empezar\n!soy <excusa>\n!votar @usuario',
        ejemplo: '!traidor\n!traidor yo',
        args: 'De 4 a 8 jugadores en el lobby',
        cooldown: 'Ninguno'
    },
    '!botella': {
        desc: 'La botella elimina uno por uno con retos. El último en pie gana.',
        usage: '!botella @ana @luis\n!girar',
        ejemplo: '!botella @ana @luis',
        args: 'Menciones de los que juegan; !girar para girar',
        cooldown: 'Ninguno'
    },
    '!pares': {
        desc: 'Memorama 4x4 contra alguien: por turnos, si haces par sigues tirando.',
        usage: '!pares @usuario\n!voltea <A1> <B2>',
        ejemplo: '!pares @juan\n!voltea A1 B2',
        args: 'Mención para retar; 2 casillas distintas por turno',
        cooldown: 'Ninguno'
    },
    '!ahorcado2': {
        desc: 'Ahorcado 1v1: uno pone la palabra por privado y el otro adivina (6 fallos).',
        usage: '!ahorcado2 @usuario\n!palabra <palabra> (por privado)\n!ahorcado2 <letra>',
        ejemplo: '!ahorcado2 @juan',
        args: 'Mención para retar; letra o palabra completa para adivinar',
        cooldown: 'Ninguno'
    },
    '!palabron': {
        desc: 'Palabra más larga con las mismas 6 letras. 3 rondas, mínimo 4 letras.',
        usage: '!palabron @usuario\n!palabron <palabra>',
        ejemplo: '!palabron @juan\n!palabron respeto',
        args: 'Mención para retar; palabra con solo las letras dadas',
        cooldown: 'Ninguno'
    },
    '!esgrima': {
        desc: 'Duelo de esgrima: atacar > finta > bloquear > atacar. Primero en 3 toques.',
        usage: '!esgrima @usuario\n!tira <atacar|bloquear|finta>',
        ejemplo: '!esgrima @juan\n!tira atacar',
        args: 'Mención para retar; movimiento secreto por ronda',
        cooldown: 'Ninguno'
    },
    '!puja': {
        desc: 'Adivina el precio secreto sin pasarte. El más cercano gana.',
        usage: '!puja @usuario\n!puja <número>',
        ejemplo: '!puja @juan\n!puja 350',
        args: 'Mención para retar; una oferta por jugador',
        cooldown: 'Ninguno'
    },
    '!miento': {
        desc: '2 verdades + 1 mentira: escribe tu trío (o auto) y el rival descubre la mentira.',
        usage: '!miento @usuario\n!miento 1..|2..|3.. (o auto)\n!cual <1-3>',
        ejemplo: '!miento @juan\n!miento auto\n!cual 2',
        args: 'Mención para retar; trío con | o auto',
        cooldown: 'Ninguno'
    },
    '!globo': {
        desc: 'Inflen el globo por turnos (1-3 de aire). Al que le explota, pierde.',
        usage: '!globo @usuario\n!inflar [1-3]',
        ejemplo: '!globo @juan\n!inflar 2',
        args: 'Mención para retar; 1 a 3 de aire por turno',
        cooldown: 'Ninguno'
    },
    '!anagrama': {
        desc: 'Palabra revuelta: el primero en escribirla bien gana la ronda (5 rondas).',
        usage: '!anagrama @usuario',
        ejemplo: '!anagrama @juan',
        args: 'Mención para retar; se responde en texto libre',
        cooldown: 'Ninguno'
    },
    '!rima': {
        desc: 'Batalla de rimas por turnos con la terminación dada. 5 turnos cada uno.',
        usage: '!rima @usuario\n!rima <palabra>',
        ejemplo: '!rima @juan\n!rima corazon',
        args: 'Mención para retar; palabra que rime y no repetida',
        cooldown: 'Ninguno'
    },
    '!wordle': {
        desc: 'Adivina la palabra de 5 letras en 6 intentos (guarda tu récord).',
        usage: '!wordle\n!wordle <palabra>',
        ejemplo: '!wordle\n!wordle playa',
        args: 'Ninguno para empezar, palabra de 5 letras para probar',
        cooldown: 'Ninguno'
    },
    '!intruso': {
        desc: 'Encuentra la palabra infiltrada entre 4. 5 rondas (guarda tu récord).',
        usage: '!intruso\n!intruso <1-4>',
        ejemplo: '!intruso\n!intruso 3',
        args: 'Ninguno para empezar, número del infiltrado',
        cooldown: 'Ninguno'
    },
    '!supervivencia': {
        desc: '7 retos mezclados con 3 vidas (guarda tu mejor puntaje).',
        usage: '!supervivencia\n!supervivencia <respuesta>',
        ejemplo: '!supervivencia\n!supervivencia lima',
        args: 'Ninguno para empezar, respuesta al reto',
        cooldown: 'Ninguno'
    },
    '!cazatesoros': {
        desc: 'Encuentra el número del 1 al 50 con pistas de frío/caliente (récord).',
        usage: '!cazatesoros\n!cazatesoros <número>',
        ejemplo: '!cazatesoros\n!cazatesoros 25',
        args: 'Ninguno para empezar, número del 1 al 50',
        cooldown: 'Ninguno'
    },
    '!ruleta2': {
        desc: 'Di una palabra de la categoría con esa letra. 5 rondas (récord de racha).',
        usage: '!ruleta2\n!ruleta2 <palabra>',
        ejemplo: '!ruleta2\n!ruleta2 perro',
        args: 'Ninguno para empezar, palabra válida y no repetida',
        cooldown: 'Ninguno'
    },
    '!escalera': {
        desc: 'Serpientes y escaleras: llega al 50 en 15 turnos (récord).',
        usage: '!escalera\n!escalera lanza',
        ejemplo: '!escalera\n!escalera lanza',
        args: 'Ninguno para empezar, lanza para tirar el dado',
        cooldown: 'Ninguno'
    },
    '!caja': {
        desc: 'Abre la caja fuerte de 3 dígitos en 8 intentos (récord).',
        usage: '!caja\n!caja <3 dígitos>',
        ejemplo: '!caja\n!caja 123',
        args: 'Ninguno para empezar, 3 dígitos por intento',
        cooldown: 'Ninguno'
    },
    '!emojimix': {
        desc: 'Mezcla 2 emojis en un sticker (cocina de emojis).',
        usage: '!emojimix <emoji1><emoji2>',
        ejemplo: '!emojimix 😂❤️',
        args: '2 emojis (requerido)',
        cooldown: 'Ninguno'
    },
    '!duelo': {
        desc: 'Reta a otro usuario a un duelo.',
        usage: '!duelo @usuario [apuesta]',
        ejemplo: '!duelo @usuario\n!duelo @usuario 500',
        args: 'Usuario (requerido), apuesta (opcional)',
        cooldown: 'Ninguno'
    },
    '!trivia': {
        desc: 'Inicia un juego de trivia/preguntas. Puedes apostar diky: si ganas te devuelve el doble, si pierdes se descuenta.',
        usage: '!trivia [apuesta]',
        ejemplo: '!trivia\n!trivia 200',
        args: 'Apuesta (opcional)',
        cooldown: '30 segundos'
    },
    '!quiz': {
        desc: 'Alias de !trivia - Inicia un quiz. Puedes apostar diky: si ganas te devuelve el doble, si pierdes se descuenta.',
        usage: '!quiz [apuesta]',
        ejemplo: '!quiz\n!quiz 200',
        args: 'Apuesta (opcional)',
        cooldown: '30 segundos'
    },
    '!quizanime': {
        desc: 'Trivia específica de anime. Puedes apostar diky: si ganas te devuelve el doble, si pierdes se descuenta.',
        usage: '!quizanime [apuesta]',
        ejemplo: '!quizanime\n!quizanime 200',
        args: 'Apuesta (opcional)',
        cooldown: '30 segundos'
    },
    '!ahorcado': {
        desc: 'Juega al ahorcado. Puedes apostar diky: si ganas te devuelve el doble, si pierdes se descuenta.',
        usage: '!ahorcado [apuesta]',
        ejemplo: '!ahorcado\n!ahorcado 200',
        args: 'Apuesta (opcional)',
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
    '!remoto': {
        desc: 'Control remoto del dueño por privado: apaga el bot o pone modo admin en un grupo sin entrar a él. Solo el dueño.',
        usage: '!remoto id\n!remoto <id-grupo> bot [on|off]\n!remoto <id-grupo> adm [on|off]',
        ejemplo: '!remoto id\n!remoto 123456-789@g.us bot off\n!remoto 123456-789@g.us adm on',
        args: 'ID de grupo + acción',
        cooldown: 'Ninguno (solo dueño)'
    },
    '!autoadmin': {
        desc: 'El bot intenta hacerse admin a sí mismo. Solo funciona si WhatsApp lo permite; si no, un admin debe promoverlo a mano una vez.',
        usage: '!autoadmin',
        ejemplo: '!autoadmin',
        args: 'Ninguno',
        cooldown: 'Ninguno (solo admins)'
    },
    '!antifarma': {
        desc: 'Tope de 5 premios/hora del grupo. Con off el grupo es 100% juego y todos reciben recompensas sin tope.',
        usage: '!antifarma [on|off]',
        ejemplo: '!antifarma off\n!antifarma on',
        args: 'Estado (opcional)',
        cooldown: 'Ninguno (solo admins)'
    },
    '!bienvenida': {
        desc: 'Gestiona mensajes de bienvenida (el bot no necesita ser admin para saludar).',
        usage: '!bienvenida [on|off|ver|test]\n!setbienvenida <mensaje>',
        ejemplo: '!bienvenida on\n!setbienvenida ¡Bienvenido {usuario}!\n!bienvenida test',
        args: 'Estado o mensaje (opcional)',
        cooldown: 'Ninguno (solo admins)'
    },
    '!despedida': {
        desc: 'Mensaje cuando alguien sale del grupo (el bot no necesita ser admin).',
        usage: '!despedida [on|off|ver|test]\n!setdespedida <mensaje>',
        ejemplo: '!despedida on\n!setdespedida Adiós {usuario}!\n!despedida test',
        args: 'Estado o mensaje (opcional)',
        cooldown: 'Ninguno (solo admins)'
    },
    '!setportada': {
        desc: 'Pone la portada de ESTE grupo (imagen del !menu, bienvenida y despedida). Cada grupo tiene la suya; no afecta a otros grupos. Solo admins. Manda el comando con foto o respondiendo a una foto.',
        usage: '!setportada',
        ejemplo: '!setportada (+ foto)',
        args: 'Foto adjunta o respondida',
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
