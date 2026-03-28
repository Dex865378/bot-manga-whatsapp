const db = require('./database');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, '.bot_session');

(async () => {
    console.log('☢️ INICIANDO RESETEO DE EMERGENCIA ☢️');
    console.log('========================================');

    // 1. Conectar y Limpiar DB Turso
    console.log('1️⃣ Conectando a Base de Datos...');
    await db.init();

    if (db.isConnected()) {
        console.log('   ✅ Conectado. Borrando claves de sesión en la nube...');
        const ok = await db.nukeSession();
        if (ok) console.log('   ✅ Sesión remota eliminada con éxito.');
        else console.log('   ❌ Error intentando borrar sesión remota.');
    } else {
        console.log('   ⚠️ No se pudo conectar a Turso (¿credenciales mal?). Saltando paso remoto.');
    }

    // 2. Limpiar Carpeta Local
    console.log('2️⃣ Borrando archivos locales...');
    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            console.log('   ✅ Carpeta .bot_session eliminada.');
        } else {
            console.log('   ℹ️ No existía carpeta local.');
        }
    } catch (e) {
        console.error('   ❌ Error borrando archivos locales:', e.message);
    }

    console.log('========================================');
    console.log('✨ RESETEO COMPLETO. Ahora ejecuta "npm start" y ESCANEA EL QR NUEVO.');
})();
