module.exports = {
    name: '!ping',
    category: 'Sistema',
    async execute(sock, chatId, msg, args, { botState, db, sockOriginal }) {
        const inicio = Date.now();
        // Usar sockOriginal para bypass de cola - mide tiempo real del bot
        const sockExpress = sockOriginal || sock;
        await sockExpress.sendMessage(chatId, { text: '🏓 Calculando...' }, { quoted: msg });
        const ping = Date.now() - inicio;

        const up = Math.floor((Date.now() - botState.startTime) / 1000);
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;

        // Calcular estado de la cola para diagnóstico
        const colaInfo = global.colaSalida?.get(chatId);
        const colaSize = colaInfo?.cola?.length || 0;
        const colaText = colaSize > 0 ? `\n📦 *Cola:* ${colaSize} msgs` : '';

        return sock.sendMessage(chatId, {
            text: `🏓 *PONG! (Express)*\n\n⚡ *Velocidad:* ${ping}ms${colaText}\n⏱️ *Uptime:* ${h}h ${m}m ${s}s\n📨 *Mensajes:* ${botState.msgCount}\n☁️ *DB:* ${db.isConnected() ? 'Turso ✅' : 'Local 📁'}\n🆔 *B-ID:* ${botState.instanceId}`
        });
    }
};
