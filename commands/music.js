// Comando de musica eliminado: YouTube bloquea las descargas desde la IP
// de datacenter de Render de forma persistente (ver historial de intentos:
// cookies, actualizacion de yt-dlp, cliente ios/android/web, PO Token
// provider en modo script). Ninguno funciono de forma estable en produccion.
// Este archivo se deja vacio (sin comandos registrados) en vez de borrado
// fisicamente, para que commandHandler.js no falle si algo lo referencia.
module.exports = {
    commands: {}
};
