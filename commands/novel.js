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
const RANGO_DEFECTO_FIN = 15;
const MAX_CAPITULOS_POR_PEDIDO = 30;
const TIMEOUT_MS = 120 * 1000; // 2 minutos, SIGKILL si se excede
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
/**
 * Ejecuta lncrawl para descargar capitulos en formato EPUB.
 * Usa spawn (no exec/shell) para que el query nunca pase por un shell,
 * eliminando la clase de vulnerabilidad de inyeccion de comandos por
 * construccion, no solo por sanitizacion de la entrada.
 */
function ejecutarLncrawl(query, capInicio, capFin, dirTrabajo) {
    return new Promise((resolve, reject) => {
        const args = [
            'crawl',
            query,
            '--noin', // sin prompts interactivos, obligatorio en un subproceso automatizado
            '--suppress', // sin output ruidoso en consola
            '-f', 'epub',
            '--range', `${capInicio}-${capFin}`,
            '-o', dirTrabajo
        ];

        console.log('[RECONOVELA] Spawn:', LNCRAWL_BIN, args.join(' '));

        const proc = spawn(LNCRAWL_BIN, args, {
            windowsHide: true,
            // Aislar el subproceso de variables de entorno sensibles del bot
            // (tokens de Turso, Gemini, etc.) que no necesita para nada.
            env: { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir() }
        });

        let stderrData = '';
        let timedOut = false;

        // Timeout estricto: SIGKILL a los 120s, sin excepciones. Un proceso
        // colgado en un servidor de 512MB no puede quedarse vivo "por si acaso".
        const killTimer = setTimeout(() => {
            timedOut = true;
            console.warn('[RECONOVELA] Timeout excedido, matando proceso...');
            try { proc.kill('SIGKILL'); } catch (e) { }
        }, TIMEOUT_MS);

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
                return reject(new Error(stderrData.slice(0, 300) || `lncrawl salio con codigo ${code}`));
            }
            resolve();
        });
    });
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

// ============================================================
//                    COMANDO PRINCIPAL
// ============================================================
module.exports = {
    name: '!reconovela',
    isMultiple: true,
    names: ['!reconovela', '!novela'],
    description: 'Descarga capitulos de una novela ligera/web novel en EPUB',

    async execute(sock, chatId, msg, args, extras) {
        const { start } = extras;

        if (args.length === 0) {
            return sock.sendMessage(chatId, {
                text: `📖 *!reconovela <nombre> [cap_inicio] [cap_fin]*\n\n` +
                    `Ejemplos:\n` +
                    `• *!reconovela Solo Leveling* (capitulos 1-15 por defecto)\n` +
                    `• *!reconovela Solo Leveling 1 20*\n\n` +
                    `⚠️ Maximo ${MAX_CAPITULOS_POR_PEDIDO} capitulos por pedido, se envia como archivo *.epub* (no PDF).`
            }, { quoted: msg });
        }

        // ── Parseo de argumentos: separar nombre de novela de los numeros de capitulo ──
        let capInicio = RANGO_DEFECTO_INICIO;
        let capFin = RANGO_DEFECTO_FIN;
        let argsTexto = [...args];

        const ultimo = args[args.length - 1];
        const penultimo = args[args.length - 2];
        if (args.length >= 3 && /^\d+$/.test(ultimo) && /^\d+$/.test(penultimo)) {
            capInicio = parseInt(penultimo, 10);
            capFin = parseInt(ultimo, 10);
            argsTexto = args.slice(0, -2);
        } else if (args.length >= 2 && /^\d+$/.test(ultimo)) {
            capFin = parseInt(ultimo, 10);
            argsTexto = args.slice(0, -1);
        }

        const queryOriginal = argsTexto.join(' ').trim();
        const query = sanitizarQuery(queryOriginal);

        if (!query) {
            return sock.sendMessage(chatId, { text: '❌ Especifica el nombre de la novela. Ejemplo: *!reconovela Solo Leveling*' }, { quoted: msg });
        }

        // ── Guardrail: rango invalido o invertido ──
        if (capInicio < 1) capInicio = 1;
        if (capFin < capInicio) capFin = capInicio;

        // ── Guardrail: maximo 30 capitulos por PDF/EPUB ──
        if ((capFin - capInicio + 1) > MAX_CAPITULOS_POR_PEDIDO) {
            const antesFin = capFin;
            capFin = capInicio + MAX_CAPITULOS_POR_PEDIDO - 1;
            await sock.sendMessage(chatId, {
                text: `⚠️ Pediste ${antesFin - capInicio + 1} capitulos, pero el maximo por pedido es *${MAX_CAPITULOS_POR_PEDIDO}*.\nAjustado a capitulos *${capInicio}-${capFin}*. Pide el resto en otro mensaje.`
            }, { quoted: msg });
        }

        // ── Notificar posicion en la fila si hay algo procesando ──
        const posicion = posicionEnCola();
        if (posicion > 0) {
            await sock.sendMessage(chatId, {
                text: `📚 Estas en el puesto *${posicion}* de la fila. Solo se procesa una novela a la vez para no saturar el servidor. Te aviso cuando empiece tu descarga.`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { text: `📖 Buscando *${query}* (capitulos ${capInicio}-${capFin})...` }, { quoted: msg });
        }

        // ── Encolar el trabajo real ──
        try {
            await encolarTrabajoNovela(async () => {
                await procesarDescargaNovela(sock, chatId, msg, query, capInicio, capFin);
            });
        } catch (e) {
            // Los errores especificos ya se notificaron dentro de procesarDescargaNovela;
            // esto es solo una red de seguridad por si algo se escapa antes.
            console.error('[RECONOVELA] Error no capturado en la cola:', e.message);
        }
    }
};

// ============================================================
//            LOGICA DE DESCARGA (corre dentro de la cola)
// ============================================================
async function procesarDescargaNovela(sock, chatId, msg, query, capInicio, capFin) {
    const jobId = crypto.randomUUID();
    const dirTrabajo = path.join(TEMP_ROOT, jobId);

    try {
        fs.mkdirSync(dirTrabajo, { recursive: true });
    } catch (e) {
        return sock.sendMessage(chatId, { text: '❌ No se pudo preparar el espacio temporal para la descarga. Intenta de nuevo en un momento.' }, { quoted: msg });
    }

    try {
        await sock.sendMessage(chatId, { text: `⏳ Iniciando descarga de *${query}*...` }, { quoted: msg });

        await ejecutarLncrawl(query, capInicio, capFin, dirTrabajo);

        const epubPath = buscarEpubGenerado(dirTrabajo);
        if (!epubPath) {
            return sock.sendMessage(chatId, {
                text: `❌ No se encontro *${query}* en ninguna de las fuentes disponibles.\n💡 Revisa el nombre exacto o prueba con el titulo en ingles.`
            }, { quoted: msg });
        }

        // ── Guardrail de tamaño: descartar sin intentar procesar si es muy pesado ──
        const stats = fs.statSync(epubPath);
        if (stats.size > MAX_TAMANO_BYTES) {
            return sock.sendMessage(chatId, {
                text: `⚠️ El EPUB generado pesa ${(stats.size / 1024 / 1024).toFixed(1)}MB, superando el limite de ${MAX_TAMANO_BYTES / 1024 / 1024}MB del servidor.\n💡 Pide un rango de capitulos mas chico, por ejemplo *!reconovela ${query} ${capInicio} ${Math.max(capInicio, Math.floor((capInicio + capFin) / 2))}*`
            }, { quoted: msg });
        }
        if (stats.size < 1024) {
            return sock.sendMessage(chatId, { text: `❌ La descarga genero un archivo vacio o corrupto para *${query}*. Puede que la fuente haya fallado, intenta de nuevo.` }, { quoted: msg });
        }

        // ── Envio via stream de lectura, no Buffer completo en memoria ──
        // Baileys internamente acepta un ReadStream para el campo `document`,
        // lo que evita cargar el archivo entero en RAM antes de mandarlo.
        const nombreArchivo = `${query.replace(/[^\w\s-]/g, '').trim() || 'novela'} (${capInicio}-${capFin}).epub`;

        await sock.sendMessage(chatId, {
            document: fs.createReadStream(epubPath),
            mimetype: 'application/epub+zip',
            fileName: nombreArchivo
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

    } catch (e) {
        if (e.message === 'TIMEOUT') {
            await sock.sendMessage(chatId, {
                text: `⏱️ La descarga de *${query}* tardo demasiado (mas de 2 minutos) y fue cancelada.\n💡 Prueba con menos capitulos o intenta de nuevo mas tarde.`
            }, { quoted: msg });
        } else {
            console.error('[RECONOVELA] Error:', e.message);
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
