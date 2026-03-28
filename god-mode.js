const db = require('./database');
require('dotenv').config();

async function setGodMode() {
    console.log('🌟 Iniciando actualización de modo DIOS...');
    const connected = await db.init();
    if (!connected) {
        console.error('❌ Error: No se pudo conectar a la base de datos.');
        process.exit(1);
    }

    const targetId = '50760541202@s.whatsapp.net';

    // Preparar el inventario legendario
    const inv = {
        pico_platino: 1,
        cebo: 100,
        silencio: 50,
        doble_nada: 10,
        fruta: 1,
        grimorio: 1
    };

    const godData = {
        nombre: '👑 Diky Admin',
        monedas: 1000000,
        nivel: 100,
        xp: 0,
        duelos_ganados: 999,
        titulo: '🔱 CREADOR SUPREMO 🔱',
        descripcion: 'El único y verdadero Dios de este bot.',
        superpoder: 'Haki del Conquistador Infinito',
        inventario: JSON.stringify(inv)
    };

    console.log(`🚀 Actualizando usuario ${targetId}...`);
    const ok = await db.actualizarUsuario(targetId, godData);

    if (ok) {
        console.log('✅ ¡MODO DIOS ACTIVADO! Has recibido 1M de monedas, Nivel 100 y todos los objetos legendarios.');
    } else {
        console.error('❌ Hubo un error al intentar actualizar los datos.');
    }

    process.exit(0);
}

setGodMode();
