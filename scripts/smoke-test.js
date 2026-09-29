/**
 * 🧪 Smoke test del bot (sin conexión a WhatsApp ni a Turso).
 * Uso: npm test
 * Verifica: carga de comandos, sin colisiones inesperadas, whitelist
 * sincronizada con el Map, y que los módulos core carguen sin errores.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fallos = 0;
function check(cond, msg) {
    if (cond) { console.log(`✅ ${msg}`); }
    else { fallos++; console.error(`❌ ${msg}`); }
}

// 1. Carga de comandos (también valida sintaxis de cada commands/*.js)
const handler = require(path.join(ROOT, 'commandHandler.js'));
handler.loadCommands();
const names = [...handler.commands.keys()];
check(names.length >= 208, `Comandos registrados: ${names.length} (esperado >= 208)`);
check(!names.includes('__help_data__'), 'Sin entrada basura __help_data__ en el Map');
check(!names.some(n => n.startsWith('__')), 'Sin comandos internos __* en el Map');

// 2. Colisiones: solo se permite !manga (settings delega a media por diseño)
const vistos = new Set();
const colisiones = [];
// Re-simular el orden de carga para detectar pisadas
const files = fs.readdirSync(path.join(ROOT, 'commands')).filter(f => f.endsWith('.js')).sort();
const owner = new Map();
for (const file of files) {
    try {
        const cmd = require(path.join(ROOT, 'commands', file));
        const list = (cmd.isMultiple && Array.isArray(cmd.names)) ? cmd.names : (cmd.name ? [cmd.name] : []);
        for (const n of list) {
            if (n === '__help_data__' || n.startsWith('__')) continue;
            if (owner.has(n)) colisiones.push(`${n} (${owner.get(n)} → ${file})`);
            else owner.set(n, file);
        }
    } catch (e) { check(false, `${file} carga sin errores: ${e.message}`); }
}
const inesperadas = colisiones.filter(c => !c.startsWith('!manga '));
check(inesperadas.length === 0, `Sin colisiones inesperadas${inesperadas.length ? ': ' + inesperadas.join(', ') : ''}`);

// 3. Comandos críticos existen
for (const c of ['!ping', '!menu', '!leer', '!manga', '!modomanga', '!recomanga', '!parar',
    '!setmanga', '!sincronizar', '!reconovela', '!comprar_mascota', '!rechazar',
    '!broadcast', '!anuncio', '!news', '!aceptar_lucha', '!rechazar_lucha', '!waifus', '!setdecir',
    '!emojimix', '!ttt', '!warn', '!unwarn', '!warns', '!afk', '!encuesta', '!topactivos', '!recordar', '!recordatorios',
    '!pptpvp', '!c4', '!quizduelo', '!bingo',
    '!dados', '!tirar', '!numero', '!mates', '!carrera2', '!avanza', '!naval', '!fuego', '!reflejos', '!maraton', '!simon',
    '!hongbao', '!abrir', '!mentiroso', '!apuesta', '!duda', '!cadena', '!traidor', '!soy', '!votar', '!botella', '!girar']) {
    check(handler.commands.has(c), `Existe ${c}`);
}

// 4. Whitelist de index.js: sin duplicados y cubre todo el Map
const src = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
const m = src.match(/const comandosValidos = \[([\s\S]*?)\];/);
check(!!m, 'Whitelist localizada en index.js');
if (m) {
    const wl = [...m[1].matchAll(/'(![^']+)'/g)].map(x => x[1]);
    check(new Set(wl).size === wl.length, `Whitelist sin duplicados (${wl.length})`);
    const faltantes = names.filter(n => !wl.includes(n));
    check(faltantes.length === 0, `Whitelist cubre todo el Map${faltantes.length ? ' (faltan: ' + faltantes.join(', ') + ')' : ''}`);
}

// 5. Módulos core cargan (utils, servicios, responders, database sin init)
for (const mod of ['utils', 'utils/inputValidator', 'utils/apiClient', 'utils/lruCache',
    'services/mangadex', 'services/anilist',
    'gameResponder', 'mangaResponder', 'novelaResponder', 'database', 'turso-auth']) {
    try { require(path.join(ROOT, mod)); check(true, `Carga ${mod}`); }
    catch (e) { check(false, `Carga ${mod}: ${e.message}`); }
}
check(typeof handler.handleCommand === 'function', 'handleCommand exportado');

// 6. music.js eliminado (era stub vacío que el loader ignoraba)
check(!fs.existsSync(path.join(ROOT, 'commands', 'music.js')), 'commands/music.js eliminado');

console.log(fallos === 0 ? '\n🎉 SMOKE TEST OK' : `\n💥 SMOKE TEST: ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
