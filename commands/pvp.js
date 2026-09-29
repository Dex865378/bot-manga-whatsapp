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
    ['¿Héroe arácnido de Marvel?', 'spiderman'], ['¿Alter ego de Iron Man?', 'tony stark'],
    // ── Capitales del mundo ──
    ['¿Capital de Guatemala?', 'guatemala'], ['¿Capital de El Salvador?', 'san salvador'], ['¿Capital de Honduras?', 'tegucigalpa'],
    ['¿Capital de Nicaragua?', 'managua'], ['¿Capital de Costa Rica?', 'san jose'], ['¿Capital de Panamá?', 'panama'],
    ['¿Capital de Cuba?', 'la habana'], ['¿Capital de Venezuela?', 'caracas'], ['¿Capital de Ecuador?', 'quito'],
    ['¿Capital de Bolivia?', 'sucre'], ['¿Capital de Paraguay?', 'asuncion'], ['¿Capital de Uruguay?', 'montevideo'],
    ['¿Capital de Portugal?', 'lisboa'], ['¿Capital de Alemania?', 'berlin'], ['¿Capital de Reino Unido?', 'londres'],
    ['¿Capital de Irlanda?', 'dublin'], ['¿Capital de Países Bajos?', 'amsterdam'], ['¿Capital de Bélgica?', 'bruselas'],
    ['¿Capital de Suiza?', 'berna'], ['¿Capital de Austria?', 'viena'], ['¿Capital de Grecia?', 'atenas'],
    ['¿Capital de Turquía?', 'ankara'], ['¿Capital de Polonia?', 'varsovia'], ['¿Capital de Noruega?', 'oslo'],
    ['¿Capital de Suecia?', 'estocolmo'], ['¿Capital de Finlandia?', 'helsinki'], ['¿Capital de Dinamarca?', 'copenhague'],
    ['¿Capital de Ucrania?', 'kiev'], ['¿Capital de India?', 'nueva delhi'], ['¿Capital de Tailandia?', 'bangkok'],
    ['¿Capital de Vietnam?', 'hanoi'], ['¿Capital de Corea del Sur?', 'seul'], ['¿Capital de Indonesia?', 'yakarta'],
    ['¿Capital de Filipinas?', 'manila'], ['¿Capital de Arabia Saudita?', 'riad'], ['¿Capital de Israel?', 'jerusalen'],
    ['¿Capital de Marruecos?', 'rabat'], ['¿Capital de Argelia?', 'argel'], ['¿Capital de Nigeria?', 'abuya'],
    ['¿Capital de Sudáfrica?', 'pretoria'], ['¿Capital de Kenia?', 'nairobi'], ['¿Capital de Australia?', 'canberra'],
    ['¿Capital de Nueva Zelanda?', 'wellington'], ['¿Capital de República Dominicana?', 'santo domingo'], ['¿Capital de Jamaica?', 'kingston'],
    // ── Geografía física ──
    ['¿Desierto más grande del mundo?', 'sahara'], ['¿Montaña más alta del mundo?', 'everest'], ['¿Cordillera más larga del mundo?', 'andes'],
    ['¿Isla más grande del mundo?', 'groenlandia'], ['¿Río que pasa por Egipto?', 'nilo'], ['¿Montaña sagrada de Japón?', 'fuji'],
    ['¿Río que pasa por París?', 'sena'], ['¿Río que pasa por Londres?', 'tamesis'], ['¿Cataratas entre EE.UU. y Canadá?', 'niagara'],
    ['¿Estrecho entre España y Marruecos?', 'gibraltar'], ['¿Mar entre Europa y África?', 'mediterraneo'], ['¿Océano más pequeño?', 'artico'],
    ['¿Continente más pequeño?', 'oceania'], ['¿Desierto famoso de Chile?', 'atacama'], ['¿Volcán famoso de Italia?', 'vesubio'],
    ['¿Lago navegable más alto del mundo?', 'titicaca'], ['¿Península de España y Portugal?', 'iberica'], ['¿Cordillera que cruza México?', 'sierra madre'],
    ['¿País con forma de bota?', 'italia'], ['¿País del sol naciente?', 'japon'], ['¿País de los canguros?' , 'australia'],
    ['¿País de los tulipanes?', 'holanda'], ['¿Ciudad de los canales?', 'venecia'], ['¿Ciudad que nunca duerme?', 'nueva york'],
    ['¿Muro famoso de China?', 'muralla china'], ['¿Torre inclinada famosa?', 'pisa'], ['¿Estatua regalada a EE.UU. por Francia?', 'libertad'],
    ['¿Ópera famosa de Australia?', 'sidney'], ['¿Cristo gigante de Brasil?', 'corcovado'], ['¿Pirámides famosas de México?', 'teotihuacan'],
    // ── Historia ──
    ['¿Año de la caída de Tenochtitlan?', '1521'], ['¿Quién conquistó México?', 'cortes'], ['¿Padre de la patria mexicana?', 'hidalgo'],
    ['¿Año del Grito de Independencia?', '1810'], ['¿Benemérito de las Américas?', 'juarez'], ['¿Dictador 30 años en México?', 'porfirio diaz'],
    ['¿Año de la Revolución Mexicana?', '1910'], ['¿Asesinado en Chinameca?', 'zapata'], ['¿Centauro del Norte?', 'villa'],
    ['¿Castillo de los Niños Héroes?', 'chapultepec'], ['¿Capital del imperio azteca?', 'tenochtitlan'], ['¿Dios mexica de la guerra?', 'huitzilopochtli'],
    ['¿Calendario famoso mexica?', 'piedra del sol'], ['¿Batalla del 5 de mayo?', 'puebla'], ['¿Constitución mexicana de qué año?', '1917'],
    ['¿Presidente que expropió el petróleo?', 'cardenas'], ['¿Último emperador azteca?', 'cuauhtemoc'], ['¿Primera guerra mundial empezó en?', '1914'],
    ['¿Segunda guerra mundial terminó en?', '1945'], ['¿Muro de Berlín cayó en?', '1989'], ['¿Revolución Francesa en qué año?', '1789'],
    ['¿Llegada a América en qué año?', '1492'], ['¿Faraona famosa de Egipto?', 'cleopatra'], ['¿Emperador francés famoso?', 'napoleon'],
    ['¿Primer hombre en el espacio?', 'gagarin'], ['¿Titanic se hundió en?', '1912'], ['¿Ciudad de la bomba atómica?', 'hiroshima'],
    ['¿Imperio que construyó Machu Picchu?', 'inca'], ['¿Ciudad de los 300 guerreros?', 'esparta'], ['¿Caballo gigante de Troya?', 'troya'],
    ['¿Olimpiadas nacieron dónde?', 'grecia'], ['¿Independencia de EE.UU. en?', '1776'], ['¿Inventor de la imprenta?', 'gutenberg'],
    ['¿Teoría de la evolución quién?', 'darwin'], ['¿Pintó la Capilla Sixtina?', 'miguel angel'], ['¿Escribió La Odisea?', 'homero'],
    ['¿Filósofo del mito de la caverna?', 'platon'], ['¿Maestro de Alejandro Magno?', 'aristoteles'], ['¿Libertador de Sudamérica?', 'bolivar'],
    ['¿Gladiador tracio famoso?', 'espartaco'], ['¿Quién mató a Julio César?', 'bruto'], ['¿Cárcel tomada en la Revolución Francesa?', 'bastilla'],
    ['¿Guerreros del norte con barcos?', 'vikingos'], ['¿Reina de Inglaterra por 70 años?', 'isabel'], ['¿Che famoso de la revolución cubana?', 'guevara'],
    ['¿Siglo de la peste negra?', '14'],
    // ── Ciencia ──
    ['¿Fórmula de la sal de mesa?', 'nacl'], ['¿Gas de los globos que flotan?', 'helio'], ['¿Metal de las latas?', 'aluminio'],
    ['¿Parte positiva del átomo?', 'proton'], ['¿Parte negativa del átomo?', 'electron'], ['¿Centro del átomo?', 'nucleo'],
    ['¿Proceso con que las plantas comen luz?', 'fotosintesis'], ['¿Ley de la gravedad quién?', 'newton'], ['¿E=mc2 quién?', 'einstein'],
    ['¿Forma del ADN?', 'helice'], ['¿Unidad básica de la vida?', 'celula'], ['¿Células del cerebro?', 'neuronas'],
    ['¿Vacuna contra la rabia quién?', 'pasteur'], ['¿Descubrió la penicilina?', 'fleming'], ['¿Galaxia donde vivimos?', 'via lactea'],
    ['¿Agujero que traga la luz?', 'agujero negro'], ['¿Satélite natural de la Tierra?', 'luna'], ['¿Planeta enano famoso?', 'pluton'],
    ['¿Estrella más cercana a la Tierra?', 'sol'], ['¿Estrellas fugaces qué son?', 'meteoros'], ['¿Hueso más largo del cuerpo?', 'femur'],
    ['¿Músculo que bombea sangre?', 'corazon'], ['¿Órganos para respirar?', 'pulmones'], ['¿Líquido rojo del cuerpo?', 'sangre'],
    ['¿Órgano que piensa?', 'cerebro'], ['¿Cuántos sentidos tenemos?', '5'], ['¿Dientes tiene un adulto?', '32'],
    ['¿Qué miden los años luz?', 'distancia'], ['¿Capa que protege de rayos UV?', 'ozono'], ['¿Elemento de los diamantes?', 'carbono'],
    // ── Mates extra ──
    ['¿7 x 7?', '49'], ['¿8 x 9?', '72'], ['¿6 x 6?', '36'],
    ['¿11 x 11?', '121'], ['¿200 - 87?', '113'], ['¿45 + 55?', '100'],
    ['¿10 al cubo?', '1000'], ['¿Raíz cuadrada de 144?', '12'], ['¿25% de 200?', '50'],
    ['¿Doble de 75?', '150'], ['¿Triple de 30?', '90'], ['¿1000 / 4?', '250'],
    ['¿4 x 4 x 4?', '64'], ['¿Primo después del 7?', '11'], ['¿14 x 2?', '28'],
    ['¿99 + 1?', '100'], ['¿500 - 250?', '250'], ['¿3 al cubo?', '27'],
    // ── Anime extra ──
    ['¿Técnica de clones de Naruto?', 'kage bunshin'], ['¿Demonio dentro de Naruto?', 'kurama'], ['¿Organización de capas negras con nubes?', 'akatsuki'],
    ['¿Hermano mayor de Sasuke?', 'itachi'], ['¿Maestro pervertido de Naruto?', 'jiraiya'], ['¿Aldea de la arena?', 'suna'],
    ['¿Kazekage amigo de Naruto?', 'gaara'], ['¿Compañera de equipo de Naruto?', 'sakura'], ['¿Cocinero de los mugiwara?', 'sanji'],
    ['¿Esqueleto músico de One Piece?', 'brook'], ['¿Reno doctor de One Piece?', 'chopper'], ['¿Francotirador mentiroso?', 'usopp'],
    ['¿Arqueóloga de One Piece?', 'robin'], ['¿Isla del cielo?', 'skypiea'], ['¿Carpintero cyborg?', 'franky'],
    ['¿Hijo de Goku?', 'gohan'], ['¿Fusión de Goku y Vegeta?', 'gogeta'], ['¿Dios destructor gato?', 'bills'],
    ['¿Ángel asistente de Bills?', 'whis'], ['¿Namekusein verde?', 'piccolo'], ['¿Transformación de pelo rubio?', 'super saiyajin'],
    ['¿Raza guerrera de Goku?', 'saiyajin'], ['¿Shinigami amigo de Light?', 'ryuk'], ['¿Novia con death note?', 'misa'],
    ['¿Hermano menor de Eren?', 'zeke'], ['¿Soldado más fuerte de la humanidad?', 'levi'], ['¿Titán hembra?', 'annie'],
    ['¿Compañera fan de la papa?', 'sasha'], ['¿Isla de los eldianos?', 'paradis'], ['¿Cazador con máscara de jabalí?', 'inosuke'],
    ['¿Cazador dormilón del trueno?', 'zenitsu'], ['¿Pilar del fuego?', 'rengoku'], ['¿Jefe de los demonios?', 'muzan'],
    ['¿Pilar del sonido?', 'uzui'], ['¿Pilar del amor?', 'mitsuri'], ['¿Rey de las maldiciones?', 'sukuna'],
    ['¿Chica del martillo en Jujutsu?', 'nobara'], ['¿Protagonista sin quirk?', 'deku'], ['¿Símbolo de la paz?', 'all might'],
    ['¿Rival explosivo de Deku?', 'bakugo'], ['¿Chica de gravedad cero?', 'uraraka'], ['¿Villano lleno de manos?', 'shigaraki'],
    ['¿Protagonista pelinaranja de Bleach?', 'ichigo'], ['¿Monstruo con máscara blanca?', 'hollow'], ['¿Protagonista del examen de cazador?', 'gon'],
    ['¿Amigo asesino de Gon?', 'killua'], ['¿Payaso de Hunter x Hunter?', 'hisoka'], ['¿Alquimista de acero?', 'edward'],
    ['¿Hermano armadura de Edward?', 'alphonse'], ['¿Militar de fuego?', 'mustang'], ['¿Espía papá de Anya?', 'loid'],
    ['¿Niña que lee mentes?', 'anya'], ['¿Mamá asesina de Anya?', 'yor'], ['¿Protagonista motosierra?', 'denji'],
    ['¿Demonio perrito de Denji?', 'pochita'], ['¿Jefa manipuladora de Denji?', 'makima'], ['¿Prota que viaja al pasado?', 'takemichi'],
    ['¿Científico despetrificado?', 'senku'], ['¿Calvo de un solo golpe?', 'saitama'], ['¿Cyborg discípulo de Saitama?', 'genos'],
    ['¿Prota sin magia de Black Clover?', 'asta'], ['¿Rival talentoso de Asta?', 'yuno'], ['¿Mago de fuego de Fairy Tail?', 'natsu'],
    ['¿Rata eléctrica amarilla?', 'pikachu'], ['¿Entrenador de Pikachu?', 'ash'], ['¿Equipo villano de Pokémon?', 'team rocket'],
    ['¿Gato robot del futuro?', 'doraemon'], ['¿Medio demonio del pasado?', 'inuyasha'], ['¿Caballero de Pegaso?', 'seiya'],
    ['¿Diosa de los caballeros?', 'atenea'], ['¿Pelirrojo del básquet?', 'hanamichi'], ['¿Prota chiquito del vóley?', 'hinata'],
    ['¿Dragón blanco de Kaiba?', 'blue eyes'], ['¿Enmascarado de Akatsuki?', 'obito'], ['¿Brujita del delivery?', 'kiki'],
    ['¿Espíritu gris del bosque?', 'totoro'], ['¿Piloto tímido del Eva?', 'shinji'], ['¿Gata consejera lunar?' , 'luna'],
    // ── Deportes ──
    ['¿Mundial 2022 dónde fue?', 'qatar'], ['¿Balón de Oro 8 veces?', 'messi'], ['¿CR7 de qué país es?', 'portugal'],
    ['¿Club de joven Messi?', 'barcelona'], ['¿Portero famoso de México?', 'ochoa'], ['¿Nombre del Canelo?', 'saul'],
    ['¿Deporte del Super Bowl?', 'futbol americano'], ['¿Maratón cuántos km?', '42'], ['¿Nadador con más oros?', 'phelps'],
    ['¿Jamaicano más rápido?', 'bolt'], ['¿Deporte de Serena Williams?', 'tenis'], ['¿Juego de tablero con reinas?', 'ajedrez'],
    ['¿Carrera de F1 famosa?', 'monaco'], ['¿Piloto mexicano de F1?', 'checo'], ['¿Deporte de guantes?', 'box'],
    ['¿Deporte de canasta?', 'basquetbol'], ['¿Hoyo en uno en qué deporte?', 'golf'], ['¿Deporte con red alta?', 'voleibol'],
    // ── Animales ──
    ['¿Rey de la selva?', 'leon'], ['¿Trompa larga y orejas grandes?', 'elefante'], ['¿Cuello más largo?', 'jirafa'],
    ['¿Rayas blancas y negras?', 'cebra'], ['¿Bebé en la bolsa?', 'canguro'], ['¿Cambia de color?', 'camaleon'],
    ['¿Salta y croa?', 'rana'], ['¿Caparazón lento?', 'tortuga'], ['¿8 brazos que echa tinta?', 'pulpo'],
    ['¿Da lana suave?', 'oveja'], ['¿Da leche y hace muu?', 'vaca'], ['¿Relincha?', 'caballo'],
    ['¿Rebuzna?', 'burro'], ['¿Cacarea?', 'gallina'], ['¿Ladra?', 'perro'],
    ['¿Pájaro que repite palabras?', 'loro'], ['¿Animal más grande del mundo?', 'ballena'], ['¿Dinosaurio famoso cazador?', 'tiranosaurio'],
    // ── Cine y series ──
    ['¿Mago del anillo único?', 'gandalf'], ['¿Enano que lleva el anillo?', 'frodo'], ['¿Pirata de la brújula?', 'jack sparrow'],
    ['¿Payaso asesino de la alcantarilla?', 'pennywise'], ['¿Tiburón de Spielberg?', 'jaws'], ['¿Juguete vaquero?', 'woody'],
    ['¿Princesa de hielo?', 'elsa'], ['¿Muñeco de nieve amigo?', 'olaf'], ['¿Hijo rey león?', 'simba'],
    ['¿Rata chef de París?', 'remy'], ['¿Pez payaso perdido?', 'nemo'], ['¿Vecinos amarillos?', 'simpson'],
    ['¿Vecindad famosa del Chavo?', 'vecindad'], ['¿Chapulín de qué color?', 'rojo'], ['¿Nombre de un dragón de Daenerys?', 'drogon'],
    // ── Música ──
    ['¿Rey del pop?', 'michael jackson'], ['¿Reina del pop?', 'madonna'], ['¿4 de Liverpool?', 'beatles'],
    ['¿Banda de Freddie Mercury?', 'queen'], ['¿Reguetonero de la gasolina?', 'daddy yankee'], ['¿Colombiana de las caderas?', 'shakira'],
    ['¿Cantante de Imagine?', 'lennon'], ['¿Mariachi más famoso?', 'vicente fernandez'],
    // ── Videojuegos y tecnología ──
    ['¿Fontanero bigotón?', 'mario'], ['¿Erizo azul rápido?', 'sonic'], ['¿Espada maestra de quién?', 'link'],
    ['¿Princesa en otro castillo?', 'peach'], ['¿Creeper explota en qué juego?', 'minecraft'], ['¿Battle royale de la isla?', 'fortnite'],
    ['¿Terror con cámaras y animatrónicos?', 'fnaf'], ['¿Jefe maestro de qué saga?', 'halo'], ['¿Brujo de pelo blanco Geralt?', 'witcher'],
    ['¿Dios de la guerra calvo?', 'kratos'], ['¿Manzana mordida qué marca?', 'apple'], ['¿Sistema de ventanas?', 'windows'],
    ['¿Buscador más famoso?', 'google'], ['¿Pajarito azul qué red?', 'twitter'], ['¿Videos qué plataforma roja?', 'youtube'],
    ['¿Fotos y reels dónde?', 'instagram'], ['¿Fundó Microsoft?', 'gates'],
    // ── Comida y literatura ──
    ['¿Queso fundido en tortilla?', 'quesadilla'], ['¿Salsa de aguacate?', 'guacamole'], ['¿Arroz típico de España?', 'paella'],
    ['¿Postre frío de verano?', 'helado'], ['¿Pan dulce de noviembre?', 'pan de muerto'], ['¿Caballero de los molinos?', 'quijote'],
    ['¿Ballena blanca del libro?', 'moby dick'], ['¿Niño de otro planeta con bufanda?', 'principito'], ['¿Muñeco de madera mentirosillo?', 'pinocho'],
    // ── Más capitales ──
    ['¿Capital de Rumania?', 'bucarest'], ['¿Capital de Hungría?', 'budapest'], ['¿Capital de Chequia?', 'praga'],
    ['¿Capital de Croacia?', 'zagreb'], ['¿Capital de Serbia?', 'belgrado'], ['¿Capital de Islandia?', 'reikiavik'],
    ['¿Capital de Luxemburgo?', 'luxemburgo'], ['¿Capital de Mónaco?', 'monaco'], ['¿Capital de Eslovenia?', 'liubliana'],
    ['¿Capital de Bosnia?', 'sarajevo'], ['¿Capital de Albania?', 'tirana'], ['¿Capital de Chipre?', 'nicosia'],
    // ── Más ciencia ──
    ['¿Metal precioso amarillo?', 'oro'], ['¿Símbolo químico de la plata?', 'ag'], ['¿Gas que usan las plantas?', 'co2'],
    ['¿Ácido del limón?', 'citrico'], ['¿A cuántos grados hierve el agua?', '100'], ['¿A cuántos grados se congela?', '0'],
    ['¿Instrumento que mide terremotos?', 'sismografo'], ['¿Ciencia que estudia las estrellas?', 'astronomia'], ['¿Ciencia de los insectos?', 'entomologia'],
    ['¿Animal de sangre fría?', 'reptil'], ['¿Cría de la rana?', 'renacuajo'],
    // ── Más anime ──
    ['¿Ojos rojos copiadores?', 'sharingan'], ['¿Villano serpiente de Naruto?', 'orochimaru'], ['¿Rey de los piratas?', 'roger'],
    ['¿Emperador de pelo rojo?', 'shanks'], ['¿Hombre pez de la tripulación?', 'jinbe'], ['¿Esposa de Goku?', 'milk'],
    ['¿Hijo de Vegeta?', 'trunks'], ['¿Nombre real de L?', 'lawliet'], ['¿Quinto Hokage?', 'tsunade'],
    ['¿Papá de Gon?', 'ging'], ['¿Chica de papel de Akatsuki?', 'konan'], ['¿Títere rubio explosivo?', 'deidara'],
    // ── Misceláneo ──
    ['¿Animal de la bandera mexicana?', 'aguila'], ['¿Serpiente de la bandera?', 'serpiente'], ['¿Día de Muertos cuándo?', '2 de noviembre'],
    ['¿Piñata en qué fiesta?', 'posadas'], ['¿Rosca de qué mes?', 'enero'], ['¿Idioma oficial de México?', 'espanol'],
    ['¿Moneda de EE.UU.?', 'dolar'], ['¿Moneda de Europa?', 'euro'], ['¿Manecillas tiene un reloj?', '3'],
    ['¿Caras tiene una moneda?', '2'], ['¿Minutos dura un partido?', '90'], ['¿Días tiene febrero normal?', '28'],
    ['¿Días tiene abril?', '30'], ['¿Semanas tiene un año?', '52'], ['¿Meses tienen 31 días?', '7'],
    ['¿Horas tiene un día?', '24'], ['¿Minutos hay en 2 horas?', '120'], ['¿Dientes de leche tenemos?', '20'],
    ['¿Sangre roja por qué metal?', 'hierro'], ['¿Vitamina que da el sol?', 'd'], ['¿Órgano que filtra la sangre?', 'rinon'],
    ['¿Músculo del hipo?', 'diafragma'], ['¿Colores de la bandera mexicana?', 'verde blanco rojo'],
    ['¿Animal que pone huevos y da leche?', 'ornitorrinco'], ['¿Pájaro símbolo de la paz?', 'paloma'], ['¿Flor símbolo de Holanda?', 'tulipan'], ['¿Fruta de la pasión?' , 'maracuya']
];

const dueloUsadas = new Map(); // chatId -> Set de índices ya salidos (no repetir hasta agotar el banco)
function elegirPreguntaDuelo(chatId) {
    let usadas = dueloUsadas.get(chatId);
    if (!usadas) { usadas = new Set(); dueloUsadas.set(chatId, usadas); }
    if (usadas.size >= DUELO_Q.length) usadas.clear(); // banco agotado: se reinicia
    let idx;
    do { idx = Math.floor(Math.random() * DUELO_Q.length); } while (usadas.has(idx));
    usadas.add(idx);
    if (dueloUsadas.size > 200) dueloUsadas.delete(dueloUsadas.keys().next().value); // tope de chats
    return DUELO_Q[idx];
}

function normDuelo(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

module.exports = {
    name: 'pvp',
    isMultiple: true,
    names: ['!pptpvp', '!c4', '!quizduelo', '!bingo'],
    category: 'Juegos',
    elegirPreguntaDuelo, // expuesto para pruebas (no es comando)
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
                const [pregunta, respuesta] = elegirPreguntaDuelo(chatId);
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
                const estado = Object.entries(juego.jugadores)
                    .map(([jid, j]) => `• ${nom(jid)}: le faltan *${j.carton.length - j.aciertos.length}*`)
                    .join('\n');
                return sock.sendMessage(chatId, {
                    text: `🎱 ¡BOLA *${bola}*! (van ${juego.cantados.length}/50)\n━━━━━━━━━━━━━━\n${estado}\n━━━━━━━━━━━━━━\n👉 *!bingo cantar* para la siguiente.`,
                    mentions: Object.keys(juego.jugadores)
                }, { quoted: msg });
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
