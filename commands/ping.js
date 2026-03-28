module.exports = {
    name: '!ping',
    category: 'Sistema',
    async execute(sock, chatId, msg, args, { botState, db }) {
        const inicio = Date.now();
        await sock.sendMessage(chatId, { text: '🏓 Calculando...' }, { quoted: msg });
        const ping = Date.now() - inicio;

        const up = Math.floor((Date.now() - botState.startTime) / 1000);
        const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;

        return sock.sendMessage(chatId, {
            text: `🏓 *PONG! (Modular)*\n\n⚡ *Velocidad:* ${ping}ms\n⏱️ *Uptime:* ${h}h ${m}m ${s}s\n📨 *Mensajes:* ${botState.msgCount}\n☁️ *DB:* ${db.isConnected() ? 'Turso ✅' : 'Local 📁'}\n🆔 *B-ID:* ${botState.instanceId}`
        });
    }
};
