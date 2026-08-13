// ============================================================
//   !RECONOVELA - Descarga de novelas ligeras/web novels
// ============================================================
// Usa el CLI de lncrawl (lightnovel-crawler) para buscar y descargar
// capitulos de una novela, generando un EPUB (NO PDF).
//
// DECISION DE DISEÑO IMPORTANTE: se genera EPUB en vez de PDF.
// lncrawl solo genera EPUB, TXT y JSON de forma nativa; cualquier otro
// formato (incluido PDF) requiere Calibre instalado, que es una suite
// pesada (motor Qt) con un footprint de RAM de varios cientos de MB.
// En un servidor de 512MB compartido con WhatsApp/Baileys, instalar y
// ejecutar Calibre es un riesgo real y confirmado (reportes de OOM al
// hacer exactamente esto) de tumbar el proceso COMPLETO del bot, no solo
// este comando. EPUB se abre en Apple Books (iOS, preinstalado) y Google
// Play Books / la mayoria de lectores en Android, y WhatsApp lo manda
// igual que cualquier documento.
//
// Arquitectura (siguiendo el mismo espiritu de guardrails que el resto
// del bot en Render free tier):
//   - Cola FIFO propia, concurrencia 1 (independiente de esperarSlotHeavy
//     que usan otros comandos, para no competir con manga/stickers).
//   - Rango por defecto 1-15, maximo 30 capitulos por pedido.
//   - Timeout duro de 120s, SIGKILL si se excede.
//   - Limite de tamaño de archivo: 30MB, se descarta si lo supera.
//   - Limpieza garantizada de temporales en finally.
//   - Envio del EPUB via stream de lectura, no Buffer completo en RAM.
//   - Sanitizacion del query del usuario antes de pasarlo al subproceso.

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ============================================================
//                    CONFIGURACION / GUARDRAILS
// ============================================================
const RANGO_DEFECTO_INICIO = 1;
const RANGO_DEFECTO_FIN = 5; // 1 solo bloque por defecto: respuesta mas rapida
const MAX_CAPITULOS_POR_PEDIDO = 30;
const TIMEOUT_MS = 240 * 1000; // 4 minutos, SIGKILL si se excede. lncrawl visita
// cada capitulo como pagina web individual, asi que 15+ capitulos en un sitio
// lento puede tardar mas de los 2 minutos originales sin estar realmente colgado.
const MAX_TAMANO_BYTES = 30 * 1024 * 1024; // 30MB
const LNCRAWL_BIN = process.platform === 'win32' ? 'lncrawl.exe' : 'lncrawl';

// Directorio temporal aislado por trabajo (UUID), fuera de la carpeta del
// proyecto para no interferir con git ni con otros temporales del bot.
const TEMP_ROOT = path.join(os.tmpdir(), 'diky-reconovela');

// ============================================================
//                  COLA FIFO - CONCURRENCIA 1
// ============================================================
// Arreglo simple en memoria en vez de una dependencia externa (p-queue):
// el bot ya usa este patron de cola manual en otras partes, y agregar una
// libreria nueva solo para esto no se justifica para una cola tan simple.
const colaNovela = [];
let procesandoNovela = false;

/**
 * Encola un trabajo y devuelve la posicion en la fila (0 = se ejecuta ya).
 * El propio trabajo se encarga de notificar su posicion antes de correr.
 */
function encolarTrabajoNovela(trabajoFn) {
    return new Promise((resolve, reject) => {
        const posicion = colaNovela.length;
        colaNovela.push({ trabajoFn, resolve, reject, posicionOriginal: posicion });
        procesarColaNovela();
    });
}

async function procesarColaNovela() {
    if (procesandoNovela) return;
    if (colaNovela.length === 0) return;

    procesandoNovela = true;
    const { trabajoFn, resolve, reject } = colaNovela.shift();

    try {
        const resultado = await trabajoFn();
        resolve(resultado);
    } catch (e) {
        reject(e);
    } finally {
        procesandoNovela = false;
        // Siguiente en la fila, si hay
        if (colaNovela.length > 0) procesarColaNovela();
    }
}

function posicionEnCola() {
    // +1 porque si hay algo procesando, ese ocupa el "puesto 0" implicito
    return colaNovela.length + (procesandoNovela ? 1 : 0);
}

// ============================================================
//                    SANITIZACION DE ENTRADA
// ============================================================
// Previene inyeccion de comandos: al usar spawn() con argumentos como
// arreglo (no como string concatenado a un shell), Node.js YA evita la
// inyeccion clasica de shell (;, &&, |, etc. no se interpretan). Aun asi,
// se limpia el input de caracteres de control y se limita su longitud,
// como defensa en profundidad y para evitar queries absurdas.
function sanitizarQuery(texto) {
    if (!texto) return '';
    return texto
        .replace(/[\x00-\x1F\x7F]/g, '') // caracteres de control
        .replace(/["'`$\\]/g, '') // comillas y caracteres de escape de shell
        .trim()
        .slice(0, 150); // limite de longitud razonable para un titulo
}

// ============================================================
//                    LIMPIEZA DE TEMPORALES
// ============================================================
function limpiarDirectorioTrabajo(dirTrabajo) {
    try {
        if (dirTrabajo && fs.existsSync(dirTrabajo)) {
            fs.rmSync(dirTrabajo, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('[RECONOVELA] Error limpiando temporales:', e.message);
    }
}

// ============================================================
//              EJECUCION SEGURA DEL SUBPROCESO lncrawl
// ============================================================
// IMPORTANTE: la version instalada (lightnovel-crawler 4.x, PyPI activo)
// tiene un CLI reescrito con subcomandos, DISTINTO a versiones viejas 2.x/3.x
// que se ven en ejemplos antiguos por internet:
//   - `lncrawl crawl` NO acepta un texto de busqueda como argumento, solo
//     una URL de novela. No existe --suppress ni --range en esta version.
//   - Para buscar por nombre hay que usar `lncrawl search "<query>"` primero
//     y extraer la URL del resultado, y LUEGO pasarla a `lncrawl crawl`.
//   - El rango de capitulos se controla con --first N (desde el capitulo 1)
//     o --last N (los N mas recientes) - no hay un --first-X--last-Y nativo
//     para un rango arbitrario tipo "20 a 35", asi que se pide --first FIN
//     y se descartan los capitulos anteriores a INICIO del EPUB generado
//     solo si INICIO > 1 ... en la practica, para mantenerlo simple y
//     confiable, este comando descarga desde el capitulo 1 hasta capFin
//     (equivalente a --first capFin), ignorando capInicio si es mayor a 1
//     por ahora - ver limitacion documentada en el mensaje de uso.

/**
 * Paso 1: busca la novela por nombre y extrae la primera URL de resultado
 * via regex sobre la salida de texto (lncrawl search no tiene salida JSON,
 * a diferencia de `sources list` que si la tiene).
 */
function buscarUrlNovela(query) {
    return new Promise((resolve, reject) => {
        // --concurrency mas alto para revisar mas fuentes en paralelo (por
        // defecto lncrawl usa un valor conservador que puede volver la
        // busqueda mas lenta de lo necesario en un servidor con red normal).
        const args = ['search', query, '--limit', '5', '--concurrency', '20'];
        console.log('[NOVELA] Spawn (search):', LNCRAWL_BIN, args.join(' '));

        const proc = spawn(LNCRAWL_BIN, args, {
            windowsHide: true,
            env: { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir() }
        });

        let stdoutData = '';
        let stderrData = '';
        let timedOut = false;

        // Subido de 45s a 90s: con 361 fuentes disponibles, algunas
        // responden lento y el timeout corto cortaba la busqueda antes de
        // que terminara, aunque no estuviera realmente colgada.
        const killTimer = setTimeout(() => {
            timedOut = true;
            try { proc.kill('SIGKILL'); } catch (e) { }
        }, 90 * 1000);

        proc.stdout?.on('data', (chunk) => { stdoutData += chunk.toString(); });
        proc.stderr?.on('data', (chunk) => { stderrData += chunk.toString(); });

        proc.on('error', (err) => {
            clearTimeout(killTimer);
            reject(new Error(`No se pudo iniciar lncrawl: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(killTimer);
            if (timedOut) return reject(new Error('TIMEOUT_BUSQUEDA'));
            if (code !== 0) return reject(new Error(stderrData.slice(0, 800) || `busqueda salio con codigo ${code}`));

            // Extraer URLs http(s) de la salida. El regex excluye caracteres
            // de puntuacion de cierre comunes al final (: ; , .) que a veces
            // quedan pegados a la URL por el formato de tabla/lista de la
            // salida de lncrawl, y que rompian el crawl si se pasaban tal cual.
            const candidatos = (stdoutData.match(/https?:\/\/[^\s"'<>]+/g) || [])
                .map(u => u.replace(/[:;,.]+$/, ''));

            // DESCARTAR paginas de busqueda intermedias de un sitio (el link
            // de "buscar esto en este sitio", no la pagina real de la novela).
            // Cubre los patrones de query-string de busqueda mas comunes en
            // sitios de novelas/manga: WordPress (?s=), y variantes genericas
            // (word=, q=, query=, search=), ademas de rutas /search o /?s=.
            const esUrlDeBusqueda = (u) => {
                try {
                    const parsed = new URL(u);
                    const params = parsed.searchParams;
                    if (params.has('s') || params.has('word') || params.has('q') || params.has('query') || params.has('search')) return true;
                    if (/\/search\/?$/i.test(parsed.pathname)) return true;
                    return false;
                } catch (e) {
                    return true; // URL malformada, mejor descartarla
                }
            };

            const urlValida = candidatos.find(u => !esUrlDeBusqueda(u));
            if (!urlValida) {
                console.warn('[NOVELA][DEBUG] Sin URL valida. Candidatos encontrados:', candidatos.length, JSON.stringify(candidatos.slice(0, 10)));
                console.warn('[NOVELA][DEBUG] stdout crudo (primeros 1500 chars):', stdoutData.slice(0, 1500));

                // Distinguir "de verdad no existe" de "las fuentes estan
                // bloqueando el scraping" (Cloudflare/WAF), que son causas
                // MUY distintas y merecen mensajes distintos al usuario -
                // la segunda no se soluciona reintentando ni cambiando el
                // nombre, es un bloqueo de infraestructura de las fuentes.
                const patronesBloqueo = /CertificateVerifyError|Managed JavaScript challenge|Super Bot Fight Mode|scored as automated|challenge served|upstream error \(HTTP 5\d\d\)/i;
                if (patronesBloqueo.test(stdoutData)) {
                    return reject(new Error('FUENTES_BLOQUEADAS'));
                }
                return reject(new Error('SIN_RESULTADOS'));
            }
            resolve(urlValida);
        });
    });
}

/**
 * Ejecuta UN bloque de descarga (hasta el capitulo `hastaCapitulo`) sobre
 * una URL ya resuelta, en formato EPUB. Usa spawn (no exec/shell) para que
 * la URL nunca pase por un shell, eliminando la clase de vulnerabilidad de
 * inyeccion de comandos por construccion, no solo por sanitizacion.
 */
function ejecutarBloqueLncrawl(urlNovela, hastaCapitulo, dirTrabajo, timeoutBloqueMs) {
    return new Promise((resolve, reject) => {
        // IMPORTANTE: `crawl` NO tiene flag de directorio de salida (-o no
        // existe en esta version). lncrawl 4.x siempre guarda en
        // "$HOME/.lncrawl/novels", confirmado por el propio equipo del
        // proyecto. Por eso se fija HOME=dirTrabajo para este subproceso:
        // cada job de descarga queda aislado en su propia carpeta temporal
        // sin pisarse con otros jobs concurrentes, sin necesitar un flag
        // que simplemente no existe.
        const args = [
            'crawl',
            urlNovela,
            '--noin', // sin prompts interactivos, obligatorio en un subproceso automatizado
            '-f', 'epub',
            '--first', String(hastaCapitulo) // acumulativo: siempre desde el capitulo 1
        ];

        console.log('[NOVELA] Spawn (crawl bloque hasta cap', hastaCapitulo, '):', LNCRAWL_BIN, args.join(' '));

        const proc = spawn(LNCRAWL_BIN, args, {
            windowsHide: true,
            // HOME apunta al directorio de trabajo del job: asi lncrawl
            // escribe en "<dirTrabajo>/.lncrawl/novels" en vez de un HOME
            // global compartido entre jobs concurrentes.
            env: { PATH: process.env.PATH, HOME: dirTrabajo }
        });

        let stderrData = '';
        let timedOut = false;

        const killTimer = setTimeout(() => {
            timedOut = true;
            console.warn('[NOVELA] Timeout de bloque excedido, matando proceso...');
            try { proc.kill('SIGKILL'); } catch (e) { }
        }, timeoutBloqueMs);

        proc.stderr?.on('data', (chunk) => {
            stderrData += chunk.toString();
        });

        proc.on('error', (err) => {
            clearTimeout(killTimer);
            reject(new Error(`No se pudo iniciar lncrawl: ${err.message}`));
        });

        proc.on('close', (code) => {
            clearTimeout(killTimer);
            if (timedOut) {
                return reject(new Error('TIMEOUT'));
            }
            if (code !== 0) {
                return reject(new Error(stderrData.slice(0, 800) || `lncrawl salio con codigo ${code}`));
            }
            resolve();
        });
    });
}

/**
 * Orquesta la descarga en BLOQUES DE 5 capitulos, en vez de pedir todo de
 * una sola pasada. lncrawl guarda internamente que capitulos ya bajo para
 * esa novela, asi que cada pasada con --first creciente (5, 10, 15...)
 * SOLO descarga los capitulos nuevos del bloque, reusando lo anterior -
 * confirmado por el propio proyecto: "--resume" descarga unicamente lo
 * pendiente. Esto reduce drasticamente el riesgo de timeout: en vez de un
 * unico proceso de 10-15+ capitulos que puede tardar minutos sin dar
 * ninguna senal de vida, se hacen 2-3 pasadas cortas, cada una con su
 * propio timeout y notificando progreso real al usuario entre bloques.
 */
const TAMANO_BLOQUE = 5;
const TIMEOUT_POR_BLOQUE_MS = 90 * 1000; // 90s por bloque de 5 capitulos

async function ejecutarLncrawlPorBloques(urlNovela, capFin, dirTrabajo, onBloqueCompletado) {
    let capituloActual = 0;
    while (capituloActual < capFin) {
        capituloActual = Math.min(capituloActual + TAMANO_BLOQUE, capFin);
        await ejecutarBloqueLncrawl(urlNovela, capituloActual, dirTrabajo, TIMEOUT_POR_BLOQUE_MS);
        // Callback DESPUES de completar el bloque, no antes: asi ya existe
        // un EPUB parcial en disco que se puede inspeccionar (ej. para
        // detectar el idioma del contenido tras el primer bloque).
        if (onBloqueCompletado) await onBloqueCompletado(capituloActual, capFin);
    }
}

/**
 * Busca el archivo .epub generado dentro del directorio de trabajo.
 * lncrawl crea subcarpetas segun el nombre de la novela, asi que se
 * busca recursivamente en vez de asumir una ruta fija.
 */
function buscarEpubGenerado(dirTrabajo) {
    const encontrados = [];
    function recorrer(dir) {
        let items;
        try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        for (const item of items) {
            const rutaCompleta = path.join(dir, item.name);
            if (item.isDirectory()) {
                recorrer(rutaCompleta);
            } else if (item.isFile() && item.name.toLowerCase().endsWith('.epub')) {
                encontrados.push(rutaCompleta);
            }
        }
    }
    recorrer(dirTrabajo);
    return encontrados[0] || null;
}

/**
 * Extrae una muestra de texto plano de un EPUB para detectar su idioma.
 * Un EPUB es un .zip con capitulos en XHTML/HTML adentro (confirmado: la
 * estructura interna es HTML+CSS empaquetado). Se usa el comando `unzip`
 * del sistema (ligero, ya instalado) en vez de agregar una libreria de
 * Node para parsear EPUB, evitando una dependencia nueva para algo tan
 * puntual como leer un poco de texto de muestra.
 */
function extraerMuestraTextoEpub(epubPath) {
    return new Promise((resolve) => {
        // -l lista los archivos dentro del zip, para encontrar un .xhtml/.html
        const listProc = spawn('unzip', ['-Z1', epubPath], { windowsHide: true });
        let listado = '';
        listProc.stdout?.on('data', (c) => { listado += c.toString(); });
        listProc.on('error', () => resolve(null));
        listProc.on('close', (code) => {
            if (code !== 0) return resolve(null);
            const archivos = listado.split('\n').map(l => l.trim()).filter(Boolean);
            // Preferir capitulos reales (suelen tener "chapter" o numeros en
            // el nombre) sobre portada/indice/metadata
            const candidato = archivos.find(f => /chapter|cap[ií]tulo|\d+\.x?html?$/i.test(f))
                || archivos.find(f => /\.x?html?$/i.test(f));
            if (!candidato) return resolve(null);

            // -p extrae al stdout sin escribir a disco (mas liviano)
            const extractProc = spawn('unzip', ['-p', epubPath, candidato], { windowsHide: true });
            let contenido = '';
            extractProc.stdout?.on('data', (c) => { contenido += c.toString(); if (contenido.length > 3000) extractProc.kill('SIGKILL'); });
            extractProc.on('error', () => resolve(null));
            extractProc.on('close', () => {
                const textoPlano = contenido
                    .replace(/<[^>]+>/g, ' ') // quitar tags HTML
                    .replace(/\s+/g, ' ')
                    .trim();
                resolve(textoPlano.slice(0, 1500) || null);
            });
        });
    });
}

// ============================================================
//                    COMANDO !NOVELA (busqueda directa)
// ============================================================
const novelaCommand = {
    name: '!novela',
    isMultiple: false,

    async execute(sock, chatId, msg, args, extras) {
        if (args.length === 0) {
            return sock.sendMessage(chatId, {
                text: `📖 *!novela <nombre> [cap_fin]*\n\n` +
                    `Ejemplos:\n` +
                    `• *!novela Solo Leveling* (capitulos 1-15 por defecto)\n` +
                    `• *!novela Solo Leveling 20* (capitulos 1-20)\n\n` +
                    `⚠️ Siempre descarga desde el capitulo 1. Maximo ${MAX_CAPITULOS_POR_PEDIDO} capitulos por pedido, se envia como archivo *.epub* (no PDF).\n💡 ¿No sabes que leer? Prueba *!reconovela* para recibir una recomendacion.`
            }, { quoted: msg });
        }

        // ── Parseo de argumentos: separar nombre de novela del numero de capitulo final ──
        // Nota: la version instalada de lncrawl solo soporta --first N (desde
        // el capitulo 1), no un rango arbitrario [inicio, fin]. Por eso solo
        // se acepta un unico numero al final (capitulo final deseado).
        let capFin = RANGO_DEFECTO_FIN;
        let argsTexto = [...args];

        const ultimo = args[args.length - 1];
        if (args.length >= 2 && /^\d+$/.test(ultimo)) {
            capFin = parseInt(ultimo, 10);
            argsTexto = args.slice(0, -1);
        }

        const queryOriginal = argsTexto.join(' ').trim();
        const query = sanitizarQuery(queryOriginal);

        if (!query) {
            return sock.sendMessage(chatId, { text: '❌ Especifica el nombre de la novela. Ejemplo: *!novela Solo Leveling*' }, { quoted: msg });
        }

        // ── Guardrail: capitulo minimo 1 ──
        if (capFin < 1) capFin = 1;

        // ── Guardrail: maximo 30 capitulos por EPUB ──
        if (capFin > MAX_CAPITULOS_POR_PEDIDO) {
            const antesFin = capFin;
            capFin = MAX_CAPITULOS_POR_PEDIDO;
            await sock.sendMessage(chatId, {
                text: `⚠️ Pediste hasta el capitulo ${antesFin}, pero el maximo por pedido es *${MAX_CAPITULOS_POR_PEDIDO}* capitulos.\nAjustado a capitulos *1-${capFin}*.`
            }, { quoted: msg });
        }

        // ── Notificar posicion en la fila si hay algo procesando ──
        const posicion = posicionEnCola();
        if (posicion > 0) {
            await sock.sendMessage(chatId, {
                text: `📚 Estas en el puesto *${posicion}* de la fila. Solo se procesa una novela a la vez para no saturar el servidor. Te aviso cuando empiece tu descarga.`
            }, { quoted: msg });
        }

        // ── Encolar el trabajo real ──
        try {
            await encolarTrabajoNovela(async () => {
                await procesarDescargaNovela(sock, chatId, msg, query, capFin);
            });
        } catch (e) {
            console.error('[NOVELA] Error no capturado en la cola:', e.message);
        }
    }
};

// ============================================================
//         COMANDO !RECONOVELA (descubrimiento, estilo !recomanga)
// ============================================================
const anilist = require('../services/anilist');

let recoNovelaCounter = 0;

// Deteccion simple de texto en ingles, igual que la usada en commands/media.js
// para !recomanga - se duplica aqui (en vez de importar de media.js) para
// mantener commands/novel.js autonomo, sin acoplarlo a la estructura interna
// de otro archivo de comandos.
function esTextoIngles(text) {
    if (!text || text.length < 10) return false;
    const lower = ' ' + text.toLowerCase() + ' ';
    const enIndicators = [
        ' the ', ' and ', ' of ', ' to ', ' in ', ' is ', ' was ', ' with ', ' for ',
        ' that ', ' this ', ' from ', ' has ', ' have ', ' who ', ' which ', ' his ',
        ' her ', ' their ', ' but ', ' not ', ' will ', ' can ', ' been ', ' were ',
        ' when ', ' after ', ' before ', ' story ', ' however ', ' becomes ', ' one day '
    ];
    for (const w of enIndicators) {
        if (lower.includes(w)) return true;
    }
    return false;
}

const reconovelaCommand = {
    name: '!reconovela',
    isMultiple: false,

    async execute(sock, chatId, msg, args, extras) {
        const { sender, pushName, botState, traducirConCache } = extras;
        const genero = args.length > 0 ? args.join(' ').trim() : null;

        const genListText = anilist.GENEROS_DISPLAY.map(g => `• *${g}*`).join('\n');

        if (genero === 'generos' || genero === 'géneros' || genero === 'lista') {
            return sock.sendMessage(chatId, {
                text: `🏷️ *Géneros de Novela disponibles:*\n\n${genListText}\n\n💡 *Uso:* !reconovela <género>\n*Ejemplo:* !reconovela fantasy`
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: `🔍 Buscando novela${genero ? ` de *${genero}*` : ' popular'}...` }, { quoted: msg });

        try {
            const reco = await anilist.recomendarNovela(genero, []);

            if (reco?.error === 'genero_no_encontrado') {
                return sock.sendMessage(chatId, {
                    text: `❌ El género "*${genero}*" no fue reconocido.\n\n🏷️ *Géneros válidos:*\n${genListText}\n\n💡 Ejemplo: *!reconovela fantasy*`
                }, { quoted: msg });
            }

            if (!reco || !reco.novela) {
                return sock.sendMessage(chatId, { text: `❌ No se encontraron novelas${genero ? ` de "${genero}"` : ''} en este momento.\n\n💡 Prueba *!reconovela generos* para ver la lista.` }, { quoted: msg });
            }

            const n = reco.novela;
            recoNovelaCounter++;

            const statusMap = { 'RELEASING': '📡 En publicación', 'FINISHED': '✅ Completada', 'HIATUS': '⏸️ En pausa', 'CANCELLED': '❌ Cancelada', 'NOT_YET_RELEASED': '🔜 Próximamente' };
            const estadoTxt = statusMap[n.status] || n.status || '❓';
            const tagsText = n.tags.length > 0 ? n.tags.join(', ') : 'Sin género';

            // Traducir sinopsis al español si viene en ingles (AniList casi
            // siempre la devuelve en ingles) - mismo mecanismo que !recomanga.
            let descText = n.descripcion || 'Sin descripción disponible.';
            if (n.descripcion && esTextoIngles(n.descripcion) && typeof traducirConCache === 'function') {
                try {
                    descText = await traducirConCache(n.descripcion, `reconovela_${n.id}`);
                } catch (_) { /* si falla la traduccion, usar el original */ }
            }

            // Registrar sesión interactiva para responder con números
            if (botState.novelaSessions) {
                const senderClean = (sender || '').split('@')[0].split(':')[0];
                botState.novelaSessions.set(`${chatId}_${senderClean}`, {
                    titulo: n.titulo,
                    generoEs: genero,
                    pushName,
                    step: 'MAIN_MENU',
                    ts: Date.now()
                });
            }

            let caption = `📚 *Te recomiendo esta novela:*\n\n`;
            caption += `📖 *${n.titulo}*\n`;
            caption += `🏷️ *Géneros:* ${tagsText}\n`;
            caption += `📅 *Año:* ${n.year || '?'}\n`;
            caption += `📊 *Estado:* ${estadoTxt}\n\n`;
            caption += `📝 *Sinopsis:*\n${descText}\n\n`;
            caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            caption += `🔢 *Responde con un número:*\n`;
            caption += `1️⃣ Descargar (capítulos 1-${RANGO_DEFECTO_FIN})\n`;
            caption += `2️⃣ Recomendar otra novela\n`;
            caption += `❌ Escribe *0* o *cancelar* para salir\n\n`;
            caption += `💡 ¿Quieres más o menos capítulos? Usa *!novela ${n.titulo} <número>* directamente.`;

            if (reco.coverUrl) {
                return sock.sendMessage(chatId, { image: { url: reco.coverUrl }, caption }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: caption }, { quoted: msg });
        } catch (e) {
            console.error('❌ [reconovela] Error:', e.message);
            return sock.sendMessage(chatId, { text: '❌ Error al buscar recomendación. Intenta de nuevo.' }, { quoted: msg });
        }
    }
};

module.exports = {
    isMultiple: true,
    names: ['!novela', '!reconovela'],
    commands: {
        '!novela': novelaCommand,
        '!reconovela': reconovelaCommand
    },
    async execute(sock, chatId, msg, args, extras) {
        const { start } = extras;
        if (start === '!reconovela') return reconovelaCommand.execute(sock, chatId, msg, args, extras);
        return novelaCommand.execute(sock, chatId, msg, args, extras);
    }
};

// ============================================================
//            LOGICA DE DESCARGA (corre dentro de la cola)
// ============================================================

/**
 * Valida el tamaño del EPUB y lo manda por WhatsApp via stream. Se usa
 * tanto para el envio de adelanto (primer bloque) como para el envio
 * final (EPUB acumulativo completo), evitando duplicar la logica de
 * validacion/envio en dos lugares.
 * @param {boolean} silencioso - si true, no notifica errores de tamaño al
 *   usuario (usado en el envio de adelanto: si falla, simplemente no se
 *   manda el adelanto y se sigue esperando el envio final normal).
 * @returns {boolean} true si se envio correctamente
 */
async function intentarEnviarEpub(sock, chatId, msg, epubPath, query, capInicio, capFin, silencioso) {
    const stats = fs.statSync(epubPath);

    if (stats.size > MAX_TAMANO_BYTES) {
        if (!silencioso) {
            await sock.sendMessage(chatId, {
                text: `⚠️ El EPUB generado pesa ${(stats.size / 1024 / 1024).toFixed(1)}MB, superando el limite de ${MAX_TAMANO_BYTES / 1024 / 1024}MB del servidor.\n💡 Pide menos capitulos, por ejemplo *!novela ${query} ${Math.max(1, Math.floor(capFin / 2))}*`
            }, { quoted: msg });
        }
        return false;
    }
    if (stats.size < 1024) {
        if (!silencioso) {
            await sock.sendMessage(chatId, { text: `❌ La descarga genero un archivo vacio o corrupto para *${query}*. Puede que la fuente haya fallado, intenta de nuevo.` }, { quoted: msg });
        }
        return false;
    }

    // ── Envio via stream de lectura, no Buffer completo en memoria ──
    // La sintaxis correcta de Baileys para pasar un stream es
    // { document: { stream: miStream } }, NO { document: miStream }
    // directo - pasarlo directo causaba un TypeError interno en Baileys
    // (Cannot read properties of undefined, reading 'toString') porque
    // no reconocia el ReadStream como forma valida de WAMediaUpload.
    const nombreArchivo = `${query.replace(/[^\w\s-]/g, '').trim() || 'novela'} (${capInicio}-${capFin}).epub`;

    await sock.sendMessage(chatId, {
        document: { stream: fs.createReadStream(epubPath) },
        mimetype: 'application/epub+zip',
        fileName: nombreArchivo
    }, { quoted: msg });

    return true;
}

async function procesarDescargaNovela(sock, chatId, msg, query, capFin) {
    const jobId = crypto.randomUUID();
    const dirTrabajo = path.join(TEMP_ROOT, jobId);

    try {
        fs.mkdirSync(dirTrabajo, { recursive: true });
    } catch (e) {
        return sock.sendMessage(chatId, { text: '❌ No se pudo preparar el espacio temporal para la descarga. Intenta de nuevo en un momento.' }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: `🔍 Buscando *${query}*...` }, { quoted: msg });

        // ── Paso 1: resolver la URL real de la novela ──
        const urlNovela = await buscarUrlNovela(query);

        // ── Paso 2: descargar en bloques de 5. Si se piden MAS de un bloque,
        // el primero se manda de inmediato como adelanto en cuanto esta
        // listo (en vez de esperar en silencio hasta tener TODO), y el
        // resto llega en un segundo EPUB acumulativo al terminar. Esto le
        // da al usuario una respuesta rapida sin cambiar el ritmo real de
        // descarga de lncrawl (que es deliberadamente conservador para no
        // hacer que las fuentes bloqueen al crawler - ver nota en
        // ejecutarLncrawlPorBloques).
        let avisoIdiomaEnviado = false;
        let primerBloqueEnviado = false;
        const esperaMultiplesBloques = capFin > TAMANO_BLOQUE;

        await ejecutarLncrawlPorBloques(urlNovela, capFin, dirTrabajo, async (hasta, total) => {
            // Deteccion de idioma: solo una vez, tras el primer bloque
            if (!avisoIdiomaEnviado) {
                avisoIdiomaEnviado = true;
                try {
                    const epubParcial = buscarEpubGenerado(dirTrabajo);
                    if (epubParcial) {
                        const muestra = await extraerMuestraTextoEpub(epubParcial);
                        if (muestra && esTextoIngles(muestra)) {
                            await sock.sendMessage(chatId, { text: `ℹ️ *${query}* está disponible en inglés (no hay traducción del contenido completo, solo de la sinopsis). Continúo con la descarga...` }, { quoted: msg });
                        }
                    }
                } catch (e) {
                    console.warn('[NOVELA] No se pudo detectar idioma:', e.message);
                }
            }

            // Adelanto: mandar el primer bloque de inmediato si se pidieron mas capitulos
            if (!primerBloqueEnviado && esperaMultiplesBloques && hasta < total) {
                primerBloqueEnviado = true;
                const epubParcial = buscarEpubGenerado(dirTrabajo);
                if (epubParcial) {
                    const enviado = await intentarEnviarEpub(sock, chatId, msg, epubParcial, query, 1, hasta, true);
                    if (enviado) {
                        await sock.sendMessage(chatId, { text: `📬 Van los primeros ${hasta} capítulos. Sigo con el resto (hasta el ${total})...` }, { quoted: msg });
                    }
                }
            }
        });

        // ── Envio final: EPUB acumulativo completo (1 a capFin) ──
        const epubFinal = buscarEpubGenerado(dirTrabajo);
        if (!epubFinal) {
            return sock.sendMessage(chatId, {
                text: `❌ La descarga de *${query}* no genero ningun archivo. La fuente pudo haber fallado, intenta de nuevo.`
            }, { quoted: msg });
        }

        // Si hubo adelanto, avisar que este es el EPUB COMPLETO acumulado
        // (no capitulos nuevos aparte) para que no parezca una repeticion rara.
        if (primerBloqueEnviado) {
            await sock.sendMessage(chatId, { text: `📚 Y aquí el archivo completo con todos los capítulos (1-${capFin}):` }, { quoted: msg });
        }

        const enviadoFinal = await intentarEnviarEpub(sock, chatId, msg, epubFinal, query, 1, capFin, false);
        if (enviadoFinal) {
            await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        }

    } catch (e) {
        if (e.message === 'TIMEOUT' || e.message === 'TIMEOUT_BUSQUEDA') {
            await sock.sendMessage(chatId, {
                text: `⏱️ La búsqueda/descarga de *${query}* tardo demasiado y fue cancelada.\n💡 Prueba con menos capitulos o intenta de nuevo mas tarde.`
            }, { quoted: msg });
        } else if (e.message === 'SIN_RESULTADOS') {
            await sock.sendMessage(chatId, {
                text: `❌ No se encontro *${query}* en ninguna de las fuentes disponibles.\n💡 Revisa el nombre exacto o prueba con el titulo en ingles.`
            }, { quoted: msg });
        } else if (e.message === 'FUENTES_BLOQUEADAS') {
            await sock.sendMessage(chatId, {
                text: `🚫 Las fuentes que tienen *${query}* están bloqueando las descargas automáticas en este momento (protección anti-bot de esos sitios, no es un problema con el bot).\n💡 Prueba de nuevo más tarde, o intenta con otra novela - algunos títulos tienen más fuentes disponibles que otros.`
            }, { quoted: msg });
        } else {
            console.error('[NOVELA] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ Ocurrio un error inesperado descargando *${query}*.\n💡 Verifica el nombre o intenta con otra novela.`
            }, { quoted: msg });
        }
    } finally {
        // Limpieza SIEMPRE, exito o fallo, para no acumular archivos huerfanos
        // en el disco del servidor (relevante en un plan gratuito con espacio limitado).
        limpiarDirectorioTrabajo(dirTrabajo);
    }
}
