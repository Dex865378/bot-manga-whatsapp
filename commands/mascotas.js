/**
 * 🐾 SISTEMA DE MASCOTAS v2.0
 * Categorías, evolución, !lucha, !parque, !escudo, !alimentar mejorado
 */

// ==========================================
//        BASE DE DATOS DE MASCOTAS
// ==========================================

const CATALOG = {
    dinosaurio: {
        emoji: '🦕', label: 'Dinosaurios',
        mascotas: [
            { tipo: 'T-Rex',          e: '🦖', precio: 8000,  atk: 95,  atkTipo: 'fisico',  tecnicas: ['Mordida Colosal', 'Rugido del Terror',   '🌋 Estampida Jurásica'] },
            { tipo: 'Brachiosaurus',  e: '🦕', precio: 5000,  atk: 55,  atkTipo: 'defensa', tecnicas: ['Golpe de Cola',   'Pisotón',              '🌿 Escudo de Cuello'] },
            { tipo: 'Triceratops',    e: '🦴', precio: 6500,  atk: 75,  atkTipo: 'fisico',  tecnicas: ['Embestida Triple','Corneada',             '🛡️ Fortaleza de Cuernos'] },
            { tipo: 'Pterodactyl',    e: '🦅', precio: 7000,  atk: 80,  atkTipo: 'aereo',   tecnicas: ['Picada Aérea',    'Garra Rasante',        '🌪️ Tormenta de Vuelo'] },
            { tipo: 'Velociraptor',   e: '⚡', precio: 9000,  atk: 90,  atkTipo: 'rapido',  tecnicas: ['Zarpazo Rápido',  'Ataque en Manada',     '🔪 Carnicero Veloz'] },
            { tipo: 'Spinosaurus',    e: '🌊', precio: 7500,  atk: 85,  atkTipo: 'fisico',  tecnicas: ['Coletazo',        'Mordida Acuática',     '🌊 Furia del Pantano'] },
            { tipo: 'Ankylosaur',     e: '🛡️', precio: 5500,  atk: 60,  atkTipo: 'defensa', tecnicas: ['Golpe de Maza',   'Escudo Óseo',          '⚙️ Armadura Viviente'] },
            { tipo: 'Parasaurolophus',e: '🌿', precio: 4500,  atk: 50,  atkTipo: 'soporte', tecnicas: ['Sonido Ensordecedor','Topetazo',           '🎵 Canto Paralizante'] },
        ]
    },
    ave: {
        emoji: '🦅', label: 'Aves',
        mascotas: [
            { tipo: 'Águila Real',      e: '🦅', precio: 6000,  atk: 80,  atkTipo: 'aereo',   tecnicas: ['Picada Mortal',   'Garra Imperial',       '👁️ Visión de Cazador'] },
            { tipo: 'Fénix',            e: '🔥', precio: 15000, atk: 100, atkTipo: 'fuego',   tecnicas: ['Ala de Llama',    'Pluma Ardiente',       '♻️ Renacimiento'] },
            { tipo: 'Lechuza Mística',  e: '🦉', precio: 7000,  atk: 70,  atkTipo: 'magico',  tecnicas: ['Maldición Lunar', 'Ojo Hipnótico',        '🌙 Sombra de la Noche'] },
            { tipo: 'Colibrí Rayo',     e: '🐦', precio: 5500,  atk: 65,  atkTipo: 'rapido',  tecnicas: ['Picotazo Sónico', 'Ráfaga Veloz',         '⚡ Velocidad Extrema'] },
            { tipo: 'Halcón de Guerra', e: '🦁', precio: 8500,  atk: 88,  atkTipo: 'aereo',   tecnicas: ['Rasguño Preciso', 'Vuelo en Picada',      '🎯 Ataque Certero'] },
            { tipo: 'Guacamayo',        e: '🦜', precio: 3000,  atk: 35,  atkTipo: 'soporte', tecnicas: ['Picotazo',        'Grito Agudo',          '🌀 Confusión Colorida'] },
            { tipo: 'Flamenco Dorado',  e: '🦩', precio: 4000,  atk: 45,  atkTipo: 'magico',  tecnicas: ['Patada Elegante', 'Destello Rosa',        '✨ Aura de Gracia'] },
            { tipo: 'Pato del Infinito',e: '🦆', precio: 2500,  atk: 30,  atkTipo: 'soporte', tecnicas: ['Aletazo',         'Quack Cósmico',        '🌌 Paradoja del Pato'] },
        ]
    },
    dragon: {
        emoji: '🐉', label: 'Dragones',
        mascotas: [
            { tipo: 'Dragon de Fuego',    e: '🔥', precio: 20000, atk: 110, atkTipo: 'fuego',   tecnicas: ['Llamarada',       'Mordida Ígnea',        '🌋 Aliento del Infierno'] },
            { tipo: 'Dragon de Hielo',    e: '❄️', precio: 18000, atk: 100, atkTipo: 'hielo',   tecnicas: ['Soplido Gélido',  'Garra Helada',         '🧊 Tormenta Ártica'] },
            { tipo: 'Dragon Eléctrico',   e: '⚡', precio: 22000, atk: 115, atkTipo: 'rayo',    tecnicas: ['Rayo Colmillo',   'Descarga',             '☁️ Tormenta Eléctrica'] },
            { tipo: 'Dragon Oscuro',      e: '🌑', precio: 25000, atk: 120, atkTipo: 'oscuro',  tecnicas: ['Garras de Sombra','Maldición Oscura',     '👁️ Eclipse Total'] },
            { tipo: 'Dragon Sagrado',     e: '✨', precio: 30000, atk: 125, atkTipo: 'sagrado', tecnicas: ['Luz Divina',      'Bendición',            '☀️ Juicio Celestial'] },
            { tipo: 'Wyvern',             e: '🐲', precio: 15000, atk: 95,  atkTipo: 'veneno',  tecnicas: ['Veneno Alado',    'Picotazo Tóxico',      '☠️ Nube Venenosa'] },
            { tipo: 'Hydra',              e: '🐍', precio: 17500, atk: 105, atkTipo: 'veneno',  tecnicas: ['Mordida Triple',  'Regeneración',         '🐍 Cabeza Infinita'] },
        ]
    },
    acuatico: {
        emoji: '🌊', label: 'Acuáticos',
        mascotas: [
            { tipo: 'Tiburón Blanco',      e: '🦈', precio: 10000, atk: 90,  atkTipo: 'fisico',  tecnicas: ['Mordida Frenética','Carrera Acuática',     '🌊 Frenzy del Mar'] },
            { tipo: 'Ballena Azul',        e: '🐋', precio: 8000,  atk: 70,  atkTipo: 'defensa', tecnicas: ['Golpe de Cola',   'Canción del Mar',      '🌊 Tsunami'] },
            { tipo: 'Pulpo Gigante',       e: '🐙', precio: 7500,  atk: 80,  atkTipo: 'veneno',  tecnicas: ['Tentáculo Venenoso','Tinta Negra',         '🖤 Oscuridad Total'] },
            { tipo: 'Kraken',              e: '🦑', precio: 20000, atk: 115, atkTipo: 'oscuro',  tecnicas: ['Tentáculo Abisal','Grito del Abismo',     '🌑 Terror de las Profundidades'] },
            { tipo: 'Delfín Albino',       e: '🐬', precio: 5000,  atk: 55,  atkTipo: 'soporte', tecnicas: ['Eco Sónico',      'Salto Acrobático',     '🌀 Sonar Devastador'] },
            { tipo: 'Mantarraya Eléctrica',e: '🌊', precio: 9000,  atk: 85,  atkTipo: 'rayo',    tecnicas: ['Descarga Eléctrica','Aletazo',            '⚡ Campo Eléctrico'] },
            { tipo: 'Cangrejo Gigante',    e: '🦞', precio: 6000,  atk: 65,  atkTipo: 'defensa', tecnicas: ['Pinzazo',         'Escudo de Concha',     '🦀 Fortaleza de Quitina'] },
        ]
    },
    salvaje: {
        emoji: '🐾', label: 'Salvajes',
        mascotas: [
            { tipo: 'León',            e: '🦁', precio: 7000,  atk: 82,  atkTipo: 'fisico',  tecnicas: ['Melena Feroz',    'Zarpazo Real',         '👑 Rugido del Rey'] },
            { tipo: 'Tigre Blanco',    e: '🐯', precio: 8500,  atk: 88,  atkTipo: 'rapido',  tecnicas: ['Zarpazo Veloz',   'Emboscada',            '🌨️ Furia del Tigre'] },
            { tipo: 'Lobo Alfa',       e: '🐺', precio: 6500,  atk: 78,  atkTipo: 'soporte', tecnicas: ['Mordida de Manada','Aullido',             '🌕 Carga Lunar'] },
            { tipo: 'Oso Kodiak',      e: '🐻', precio: 5500,  atk: 72,  atkTipo: 'defensa', tecnicas: ['Manotazo',        'Abrazo Aplastante',    '🏔️ Furia Montañesa'] },
            { tipo: 'Leopardo Negro',  e: '🐆', precio: 9000,  atk: 92,  atkTipo: 'rapido',  tecnicas: ['Zarpazo Sombra',  'Salto Oculto',         '🌑 Cazador de la Noche'] },
            { tipo: 'Gorila Plateado', e: '🦍', precio: 6000,  atk: 75,  atkTipo: 'fisico',  tecnicas: ['Golpe de Pecho',  'Puñetazo',             '💪 Fuerza Primordial'] },
            { tipo: 'Rinoceronte',     e: '🦏', precio: 5000,  atk: 65,  atkTipo: 'defensa', tecnicas: ['Corneada',        'Pisotón',              '🛡️ Carga Imparable'] },
        ]
    },
    mitico: {
        emoji: '🌟', label: 'Míticos',
        mascotas: [
            { tipo: 'Unicornio',   e: '🦄', precio: 12000, atk: 80,  atkTipo: 'sagrado', tecnicas: ['Cuerno Mágico',   'Carga Sagrada',        '✨ Magia Pura'] },
            { tipo: 'Griffin',     e: '🦅', precio: 18000, atk: 105, atkTipo: 'aereo',   tecnicas: ['Garra de Águila', 'Rugido Leonino',        '🌪️ Torbellino Dual'] },
            { tipo: 'Pegaso',      e: '🐴', precio: 15000, atk: 95,  atkTipo: 'aereo',   tecnicas: ['Coz Celestial',   'Vuelo Divino',          '☁️ Carrera de Nubes'] },
            { tipo: 'Quimera',     e: '🔥', precio: 22000, atk: 115, atkTipo: 'fuego',   tecnicas: ['Fuego de Cabra',  'Veneno de Serpiente',   '🦁 Rugido Quimérico'] },
            { tipo: 'Basilisco',   e: '👁️', precio: 20000, atk: 110, atkTipo: 'veneno',  tecnicas: ['Mirada Petrificante','Mordida Letal',      '🗿 Maldición del Ojo'] },
            { tipo: 'Leviatán',    e: '🐉', precio: 28000, atk: 120, atkTipo: 'oscuro',  tecnicas: ['Coletazo Abismal','Maelstrom',             '🌊 Caos del Océano'] },
        ]
    }
};

// Ventajas de tipo: fuerte[tipo] = lista de tipos contra los que tiene ventaja
const VENTAJAS = {
    fuego:   ['hielo', 'salvaje', 'veneno'],
    hielo:   ['acuatico', 'aereo', 'dragón'],
    rayo:    ['acuatico', 'fuego'],
    oscuro:  ['sagrado', 'magico'],
    sagrado: ['oscuro', 'veneno'],
    veneno:  ['fisico', 'soporte'],
    aereo:   ['fisico', 'rapido'],
    rapido:  ['fisico', 'defensa'],
    defensa: ['soporte'],
    magico:  ['fisico', 'defensa'],
    soporte: [],
    fisico:  [],
};

// Normaliza texto: minúsculas + sin acentos + sin guiones extra
function normStr(s) {
    return (s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
        .replace(/-/g, ' ');                              // guión = espacio
}

// Busca los datos de una mascota por tipo (en todas las categorías) — CASE INSENSITIVE + SIN ACENTOS
function findPetData(tipo) {
    if (!tipo) return null;
    const norm = normStr(tipo);
    for (const [cat, data] of Object.entries(CATALOG)) {
        const found = data.mascotas.find(m => {
            const mNorm = normStr(m.tipo);
            return mNorm === norm ||
                   mNorm.replace(/\s/g, '') === norm.replace(/\s/g, ''); // sin espacios tb
        });
        if (found) return { ...found, categoria: cat };
    }
    return null;
}

// ATK total con bono de evolución
function calcATK(petData, version) {
    return (petData?.atk || 50) + (version || 0) * 3;
}

// Genera el mensaje de batalla completo en 1 solo mensaje
function generarBatalla(mascA, mascB, petA, petB, atkA, atkB) {
    const tipoA = petA?.atkTipo || 'fisico';
    const tipoB = petB?.atkTipo || 'fisico';
    const emojiA = petA?.e || '🐾';
    const emojiB = petB?.e || '🐾';
    const etiquetaA = mascA.version > 0 ? `${emojiA} ${mascA.tipo} v${mascA.version}` : `${emojiA} ${mascA.tipo}`;
    const etiquetaB = mascB.version > 0 ? `${emojiB} ${mascB.tipo} v${mascB.version}` : `${emojiB} ${mascB.tipo}`;

    // Multiplicador por ventaja de tipo
    const multA = (VENTAJAS[tipoA] || []).includes(tipoB) ? 1.3 : 1;
    const multB = (VENTAJAS[tipoB] || []).includes(tipoA) ? 1.3 : 1;

    let dañoA = 0, dañoB = 0;
    let lineas = [];
    const tecnicasA = petA?.tecnicas || ['Ataque Normal', 'Golpe', 'Técnica Especial'];
    const tecnicasB = petB?.tecnicas || ['Ataque Normal', 'Golpe', 'Técnica Especial'];

    // 3 rondas de ataque alternado
    for (let i = 0; i < 3; i++) {
        // Turno A
        const dmgA = Math.floor((atkA * multA * (0.8 + Math.random() * 0.4)));
        dañoA += dmgA;
        const esEfectivo = multA > 1 && i === 2;
        lineas.push(`${emojiA} *${tecnicasA[i]}* → ${dmgA} daño${esEfectivo ? ' ⚡ ¡efectivo!' : ''}`);

        // Turno B
        const dmgB = Math.floor((atkB * multB * (0.8 + Math.random() * 0.4)));
        dañoB += dmgB;
        const esEfectivoB = multB > 1 && i === 2;
        lineas.push(`${emojiB} *${tecnicasB[i]}* → ${dmgB} daño${esEfectivoB ? ' ⚡ ¡efectivo!' : ''}`);
    }

    const ganadorEsA = dañoA >= dañoB;
    const ganadorLabel = ganadorEsA ? etiquetaA : etiquetaB;

    return {
        log: lineas.join('\n'),
        dañoA, dañoB,
        ganadorEsA,
        ganadorLabel,
        etiquetaA,
        etiquetaB,
    };
};

// ==========================================
//        ESTADO TEMPORAL DE DESAFÍOS
// ==========================================
const desafiosPendientes = new Map(); // key: retadoId → { retadorId, chatId, monto, tipo, msgKey, ts }

// ==========================================
//        COMANDO PRINCIPAL
// ==========================================
module.exports = {
    name: 'mascotas',
    isMultiple: true,
    names: [
        '!mascotas', '!dinosaurios', '!aves', '!dragones', '!acuaticos', '!salvajes', '!miticos',
        '!parque', '!principal', '!alimentar', '!escudo',
        '!lucha', '!aceptar_lucha', '!rechazar_lucha',
    ],

    async execute(sock, chatId, msg, args, { start, sender, db, botState, isGlobalAdmin, isAdmin, ADMIN_NUM }) {
        const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
        const cmd = start || texto.split(' ')[0].toLowerCase();
        const u = await db.obtenerUsuario(sender);

        // ──────────────────────────────────────────────
        //  !mascotas — Menú principal
        // ──────────────────────────────────────────────
        if (cmd === '!mascotas') {
            const principal = await db.getMascotaPrincipal(sender);
            let perfilAnimal;
            if (principal) {
                const pd = findPetData(principal.tipo);
                const ver = principal.version > 0 ? ` v${principal.version}` : '';
                const atkTotal = calcATK(pd, principal.version);
                perfilAnimal = `↳ Principal: ${pd?.e || '🐾'} *${principal.tipo}${ver}*\n` +
                               `↳ ❤️ Hambre: ${principal.hambre}% | ⚔️ ATK: ${atkTotal} | 🍴 Comidas: ${principal.comidas_total}`;
            } else {
                perfilAnimal = `↳ _Ninguna — adopta una mascota con_ *!comprar_mascota*`;
            }

            const totalMascotas = (await db.getMascotasUsuario(sender)).length;

            return sock.sendMessage(chatId, { text:
`🐾— *SISTEMA DE MASCOTAS* —🐾

👤 *Tu Perfil Animal*
${perfilAnimal}
↳ Colección: ${totalMascotas > 0 ? `${totalMascotas} mascota(s)` : '_vacío_'} | Fondos: ${(u?.monedas || 0).toLocaleString()} Diky

🏪 *Adoptar (Categorías)*
Busca en: !dinosaurios, !aves, !dragones,
!acuaticos, !salvajes, !miticos.
Comprar: *!comprar <nombre>*

🎮 *Tus Acciones*
🌳 *!parque* — Ver tus mascotas
⭐ *!principal <tipo>* — Equipo de combate
🍖 *!alimentar* — Evoluciona cada 100 comidas
🛡️ *!escudo* — Protección 24h
⚔️ *!lucha mascota @usuario* — ¡A pelear!

💡 _v1→v50 • Cada nivel +3 ATK permanente_`
            }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  TIENDAS POR CATEGORÍA
        // ──────────────────────────────────────────────
        const catMap = { '!dinosaurios': 'dinosaurio', '!aves': 'ave', '!dragones': 'dragon', '!acuaticos': 'acuatico', '!salvajes': 'salvaje', '!miticos': 'mitico' };
        if (catMap[cmd]) {
            const cat = CATALOG[catMap[cmd]];
            let txt = `${cat.emoji} *TIENDA: ${cat.label.toUpperCase()}* ${cat.emoji}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            for (const m of cat.mascotas) {
                txt += `${m.e} *${m.tipo}* — ${m.precio.toLocaleString()} Diky\n`;
                txt += `   ATK: ${m.atk} | Tipo: ${m.atkTipo}\n`;
                txt += `   Técnicas: ${m.tecnicas.join(' · ')}\n\n`;
            }
            txt += `━━━━━━━━━━━━━━━━━━━━━━\n💡 Comprar: *!comprar_mascota <nombre>*\n_Ej: !comprar_mascota ${cat.mascotas[0].tipo}_`;
            return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !comprar_mascota <tipo>
        // ──────────────────────────────────────────────
        if (cmd === '!comprar') {
            const tipoQ = args.join(' ').trim();
            if (!tipoQ) return sock.sendMessage(chatId, { text: '❌ Escribe el nombre de la mascota. Ej: *!comprar T-Rex*' }, { quoted: msg });

            const petData = findPetData(tipoQ);
            if (!petData) return sock.sendMessage(chatId, { text: `❌ No encontré *${tipoQ}*.\nRevisa las categorías con *!mascotas*.` }, { quoted: msg });

            if ((u?.monedas || 0) < petData.precio) {
                return sock.sendMessage(chatId, { text: `💸 No tienes suficiente. Necesitas *${petData.precio.toLocaleString()} Diky*.\nTienes: *${(u?.monedas || 0).toLocaleString()}*` }, { quoted: msg });
            }

            const cant = await db.getCantidadMascota(sender, petData.tipo);
            if (cant >= 50) return sock.sendMessage(chatId, { text: `⚠️ Ya tienes 50 *${petData.tipo}*. Ese es el máximo por tipo.` }, { quoted: msg });

            await db.sumarMonedas(sender, -petData.precio);
            const res = await db.agregarMascota(sender, petData.tipo, petData.categoria);
            if (!res.ok) return sock.sendMessage(chatId, { text: `❌ Error: ${res.msg}` }, { quoted: msg });

            return sock.sendMessage(chatId, { text:
`${petData.e} *¡MASCOTA ADOPTADA!*
━━━━━━━━━━━━━━━━━━━━━━
🐾 *${petData.tipo}* se une a tu parque
💰 Pagaste: *${petData.precio.toLocaleString()} Diky*
⚔️ ATK Base: *${petData.atk}* | Tipo: *${petData.atkTipo}*
🍖 Aliméntala con *!alimentar* — cada 100 comidas evoluciona!
━━━━━━━━━━━━━━━━━━━━━━`
            }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !parque [pagina]
        // ──────────────────────────────────────────────
        if (cmd === '!parque') {
            const pag = parseInt(args[0]) || 1;
            const { mascotas, total, paginas } = await db.getMascotasPaginadas(sender, pag);
            if (total === 0) return sock.sendMessage(chatId, { text: '🌳 Tu parque está vacío. Compra mascotas con *!mascotas*.' }, { quoted: msg });

            let txt = `🌳 *PARQUE DE MASCOTAS*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            for (const m of mascotas) {
                const pd = findPetData(m.tipo);
                const eVersion = m.version > 0 ? ` v${m.version}` : '';
                const esPrincipal = m.es_principal ? ' ★ *PRINCIPAL*' : '';
                const cantLabel = m.cantidad > 1 ? ` ×${m.cantidad}` : '';
                txt += `${pd?.e || '🐾'} *${m.tipo}${eVersion}*${cantLabel}${esPrincipal}\n`;
                txt += `   ❤️ ${m.hambre}% hambre | Comidas: ${m.comidas_total} | ATK: ${calcATK(pd, m.version)}\n\n`;
            }
            txt += `━━━━━━━━━━━━━━━━━━━━━━\n📦 Total: *${total}* mascotas | Página *${pag}/${paginas}*`;
            if (pag < paginas) txt += `\n▶️ _!parque ${pag + 1}_ para ver más`;

            return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !principal <tipo>
        // ──────────────────────────────────────────────
        if (cmd === '!principal') {
            const tipoQ = args.join(' ').trim();
            if (!tipoQ) return sock.sendMessage(chatId, { text: '❌ Indica el tipo. Ej: *!principal T-Rex*' }, { quoted: msg });

            // Normalizar: buscar en el catálogo para obtener el nombre exacto
            const canonico = findPetData(tipoQ);

            // Si no está en catálogo, buscar directamente en las mascotas del usuario (case insensitive)
            const todasMascotas = await db.getMascotasUsuario(sender);
            const encontrada = todasMascotas.find(m => m.tipo.toLowerCase() === (canonico?.tipo || tipoQ).toLowerCase());
            if (!encontrada) return sock.sendMessage(chatId, { text: `❌ No tienes *${canonico?.tipo || tipoQ}* en tu parque.\n🌳 Usa *!parque* para ver tus mascotas.` }, { quoted: msg });

            await db.setPrincipalMascota(sender, encontrada.tipo);
            return sock.sendMessage(chatId, { text: `✅ *${encontrada.tipo}* es ahora tu mascota principal para peleas.` }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !alimentar [tipo]
        // ──────────────────────────────────────────────
        if (cmd === '!alimentar') {
            const inv = JSON.parse(u?.inventario || '{}');
            if ((inv.comida || 0) <= 0) {
                return sock.sendMessage(chatId, { text: '🍖 No tienes comida.\n💡 Compra comida en la *!tienda* (item #15) — 500 Diky.' }, { quoted: msg });
            }

            const mascotas = await db.getMascotasUsuario(sender);
            if (mascotas.length === 0) return sock.sendMessage(chatId, { text: '🐾 No tienes mascotas. ¡Compra una con *!mascotas*!' }, { quoted: msg });

            const tipoQ = args.join(' ').trim();

            // Si especificó cuál
            if (tipoQ) {
                const target = mascotas.find(m => m.tipo.toLowerCase() === tipoQ.toLowerCase());
                if (!target) return sock.sendMessage(chatId, { text: `❌ No tienes *${tipoQ}*. Usa *!parque* para ver tus mascotas.` }, { quoted: msg });

                // Remover comida y obtener cantidad REAL restante (previene bug de spameo)
                const removeResult = await db.removerItem(sender, 'comida');
                if (!removeResult.ok) {
                    return sock.sendMessage(chatId, { text: '🍖 No tienes comida suficiente (¿ya la usaste?).\n💡 Compra más en la *!tienda*.' }, { quoted: msg });
                }

                const res = await db.alimentarMascota(sender, target.id);
                if (!res.ok) {
                    // Devolver la comida si falló alimentar
                    await db.agregarItem(sender, 'comida', 1);
                    return sock.sendMessage(chatId, { text: '❌ Error al alimentar. Se devolvió la comida.' }, { quoted: msg });
                }

                const pd = findPetData(target.tipo);
                const versionActual = target.version > 0 ? ` v${target.version}` : '';
                const nuevaVersion = res.version > 0 ? ` v${res.version}` : '';
                let txt = `🍖 *¡MASCOTA ALIMENTADA!*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                txt += `${pd?.e || '🐾'} *${target.tipo}${versionActual}* comió con felicidad\n`;
                txt += `❤️ Hambre: *${target.hambre}%* → *${res.hambre}%*\n`;
                if (res.evoluciono) {
                    txt += `🍴 Comidas: *100*/100 ✨\n`;
                    txt += `🔄 Contador reiniciado a *${res.comidasFinales}*/100 para siguiente evolución`;
                } else {
                    txt += `🍴 Comidas acumuladas: *${res.comidas}*/100`;
                }
                if (res.evoluciono) txt += `\n\n🌟 *¡EVOLUCIÓN!* ¡Tu *${target.tipo}* pasó a *${nuevaVersion}*! (+3 ATK permanente)`;
                txt += `\n🍗 Comida restante: *${removeResult.restante}*`;
                return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
            }

            // Mostrar lista para elegir
            let txt = `🍖 *¿A cuál mascota alimentas?*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            mascotas.slice(0, 10).forEach((m, i) => {
                const pd = findPetData(m.tipo);
                const eV = m.version > 0 ? ` v${m.version}` : '';
                txt += `*${i + 1}.* ${pd?.e || '🐾'} ${m.tipo}${eV} — ❤️ ${m.hambre}%\n`;
            });
            txt += `━━━━━━━━━━━━━━━━━━━━━━\n💡 _!alimentar <nombre>_ Ej: *!alimentar T-Rex*`;
            return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !escudo
        // ──────────────────────────────────────────────
        if (cmd === '!escudo') {
            const inv = JSON.parse(u?.inventario || '{}');
            if ((inv.escudo || 0) <= 0) {
                return sock.sendMessage(chatId, { text: '🛡️ No tienes un escudo.\n💡 Compra uno en *!tienda*.' }, { quoted: msg });
            }
            const activo = await db.tieneEscudoActivo(sender);
            if (activo) return sock.sendMessage(chatId, { text: '🛡️ Ya tienes un escudo activo. Dura 24 horas desde que lo activaste.' }, { quoted: msg });

            await db.removerItem(sender, 'escudo');
            await db.activarEscudoMascota(sender);
            return sock.sendMessage(chatId, { text: '🛡️ *¡Escudo activado!* Tu mascota principal está protegida durante *24 horas*.\nNadie podrá retarte a pelea.' }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !lucha mascota|pokemon @usuario [monto]
        // ──────────────────────────────────────────────
        if (cmd === '!lucha') {
            const subtipo = args[0]?.toLowerCase(); // 'mascota' o 'pokemon'
            if (!subtipo || !['mascota', 'pokemon'].includes(subtipo)) {
                return sock.sendMessage(chatId, { text: '⚔️ Uso: *!lucha mascota @usuario [monto]*\nEj: *!lucha mascota @Ana 5000*' }, { quoted: msg });
            }

            // Obtener mencionado
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const retadoId = mentioned[0];
            if (!retadoId) return sock.sendMessage(chatId, { text: '❌ Menciona al usuario que quieres retar. Ej: *!lucha mascota @Ana 5000*' }, { quoted: msg });
            if (retadoId === sender) return sock.sendMessage(chatId, { text: '😂 No puedes retarte a ti mismo.' }, { quoted: msg });

            // Monto (opcional)
            const monto = parseInt(args[2]) || 0;
            const MAX_CAP = 1000000;
            if (monto > MAX_CAP) return sock.sendMessage(chatId, { text: `⚠️ El monto máximo por pelea es *1,000,000 Diky*.` }, { quoted: msg });

            // Verificar escudo del retado
            const escudoActivo = await db.tieneEscudoActivo(retadoId);
            if (escudoActivo) {
                return sock.sendMessage(chatId, { text: `🛡️ Ese usuario tiene un *escudo activo*. No puedes retarlo por ahora.` }, { quoted: msg });
            }

            // Verificar que el retador tenga mascota principal
            const miMascota = await db.getMascotaPrincipal(sender);
            if (!miMascota) return sock.sendMessage(chatId, { text: '❌ No tienes una mascota principal. Usa *!principal <tipo>*.' }, { quoted: msg });

            // Verificar fondos si hay monto
            if (monto > 0 && (u?.monedas || 0) < monto) {
                return sock.sendMessage(chatId, { text: `💸 No tienes suficientes Diky. Tienes *${(u?.monedas || 0).toLocaleString()}*.` }, { quoted: msg });
            }

            // Guardar desafío pendiente
            desafiosPendientes.set(retadoId, {
                retadorId: sender,
                chatId,
                monto,
                tipoLucha: subtipo,
                mascotaRetador: miMascota,
                ts: Date.now(),
                msgKey: msg.key,
            });

            // Limpiar desafíos viejos (>90 seg)
            setTimeout(() => { if (desafiosPendientes.has(retadoId)) desafiosPendientes.delete(retadoId); }, 90000);

            const pd = findPetData(miMascota.tipo);
            const eV = miMascota.version > 0 ? ` v${miMascota.version}` : '';
            const montoTxt = monto > 0 ? `\n💰 Apuesta: *${monto.toLocaleString()} Diky* (ambos ponen ${monto.toLocaleString()})` : '\n🤝 Pelea de honor (sin dinero)';

            return sock.sendMessage(chatId, {
                text: `⚔️ *¡DESAFÍO DE MASCOTA!* ⚔️\n━━━━━━━━━━━━━━━━━━━━━━\n@${sender.split('@')[0]} reta a @${retadoId.split('@')[0]} con:\n${pd?.e || '🐾'} *${miMascota.tipo}${eV}* (ATK: ${calcATK(pd, miMascota.version)})${montoTxt}\n━━━━━━━━━━━━━━━━━━━━━━\n@${retadoId.split('@')[0]} responde *!aceptar_lucha* ✅ o *!rechazar_lucha* ❌ en 90 segundos`,
                mentions: [sender, retadoId]
            }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !aceptar (responde al desafío)
        // ──────────────────────────────────────────────
        if (cmd === '!aceptar' || cmd === '!aceptar_lucha') {
            const desafio = desafiosPendientes.get(sender);
            if (!desafio) return; // Ignorar silenciosamente

            desafiosPendientes.delete(sender);

            const { retadorId, monto, mascotaRetador } = desafio;
            const retadoU = await db.obtenerUsuario(sender);
            const retadorU = await db.obtenerUsuario(retadorId);

            // Verificar mascota del retado
            const miMascota = await db.getMascotaPrincipal(sender);
            if (!miMascota) return sock.sendMessage(chatId, { text: `@${sender.split('@')[0]} no tiene mascota principal. Usa *!principal <tipo>*.`, mentions: [sender] }, { quoted: msg });

            // Verificar fondos si hay monto
            if (monto > 0) {
                if ((retadoU?.monedas || 0) < monto) return sock.sendMessage(chatId, { text: `❌ @${sender.split('@')[0]} no tiene suficientes Diky.`, mentions: [sender] }, { quoted: msg });
                if ((retadorU?.monedas || 0) < monto) return sock.sendMessage(chatId, { text: `❌ El retador ya no tiene suficientes Diky.` }, { quoted: msg });
                await db.sumarMonedas(sender, -monto);
                await db.sumarMonedas(retadorId, -monto);
            }

            // Calcular ATK de ambos
            const pdA = findPetData(mascotaRetador.tipo);
            const pdB = findPetData(miMascota.tipo);
            const atkA = calcATK(pdA, mascotaRetador.version);
            const atkB = calcATK(pdB, miMascota.version);

            // Generar batalla
            const batalla = generarBatalla(mascotaRetador, miMascota, pdA, pdB, atkA, atkB);
            const ganadorId = batalla.ganadorEsA ? retadorId : sender;
            const perdedorId = batalla.ganadorEsA ? sender : retadorId;

            // Pagar al ganador
            if (monto > 0) await db.sumarMonedas(ganadorId, monto * 2);
            await db.registrarVictoriaDuelo(ganadorId);
            await db.registrarDerrotaDuelo(perdedorId);

            const montoTxt = monto > 0 ? `\n💰 @${ganadorId.split('@')[0]} recibe *${(monto * 2).toLocaleString()} Diky*` : '\n🏅 ¡Pelea de honor resuelta!';

            return sock.sendMessage(chatId, {
                text:
`⚔️ *BATALLA DE MASCOTAS* ⚔️
━━━━━━━━━━━━━━━━━━━━━━
${batalla.etiquetaA} (${atkA} ATK) VS ${batalla.etiquetaB} (${atkB} ATK)
━━━━━━━━━━━━━━━━━━━━━━
${batalla.log}
━━━━━━━━━━━━━━━━━━━━━━
💢 Daño total → ${batalla.etiquetaA}: *${batalla.dañoA}* | ${batalla.etiquetaB}: *${batalla.dañoB}*
🏆 *¡${batalla.ganadorLabel} GANA!*${montoTxt}`,
                mentions: [retadorId, sender]
            }, { quoted: msg });
        }

        // ──────────────────────────────────────────────
        //  !rechazar
        // ──────────────────────────────────────────────
        if (cmd === '!rechazar' || cmd === '!rechazar_lucha') {
            const desafio = desafiosPendientes.get(sender);
            if (!desafio) return;
            desafiosPendientes.delete(sender);
            return sock.sendMessage(chatId, {
                text: `❌ @${sender.split('@')[0]} rechazó el desafío.`,
                mentions: [sender, desafio.retadorId]
            }, { quoted: msg });
        }
    }
};

// Exportar helpers para uso en otros módulos (economy.js)
module.exports.findPetData = findPetData;
module.exports.calcATK = calcATK;
