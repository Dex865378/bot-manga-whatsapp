/**
 * ⚖️ MÓDULO DE MERCADO Y SUBASTAS
 */
module.exports = {
    name: 'market',
    isMultiple: true,
    names: ['!subastar', '!subastas', '!ofertar'],
    async execute(sock, chatId, msg, args, { start, cmd, txt, sender, db, botState }) {

        // !subastar <item> <precio>
        if (start === '!subastar') {
            const startPrice = parseInt(args[args.length - 1]);
            const itemInput = args.slice(0, args.length - 1).join(' ').toLowerCase();

            if (!itemInput || isNaN(startPrice) || startPrice <= 0) {
                return sock.sendMessage(chatId, { text: '⚖️ **CÓMO SUBASTAR**\nUso: *!subastar <item> <monto_inicial>*\nEjemplo: `!subastar diamante 5000`' }, { quoted: msg });
            }

            // Verificar si tiene el ítem por nombre aproximado
            const u = await db.obtenerUsuario(sender);
            let inv = {}; try { inv = JSON.parse(u.inventario || '{}'); } catch (e) { }
            const itemKey = Object.keys(inv).find(k => k.toLowerCase().includes(itemInput));

            if (!itemKey || inv[itemKey] < 1) return sock.sendMessage(chatId, { text: `❌ No tienes *${itemInput}* en tu inventario para subastar.` }, { quoted: msg });

            const removed = await db.removerItem(sender, itemKey, 1);
            if (!removed) {
                return sock.sendMessage(chatId, { text: `❌ Error al retirar *${itemKey}* de tu inventario.` }, { quoted: msg });
            }

            const auctionId = await db.crearSubasta(sender, chatId, itemKey, startPrice, 3600000); // 1 hora
            if (!auctionId) {
                await db.agregarItem(sender, itemKey, 1); // Devolver ítem si falla
                return sock.sendMessage(chatId, { text: '❌ Error al crear la subasta.' });
            }

            return sock.sendMessage(chatId, { text: `⚖️ **¡SUBASTA INICIADA!**\n━━━━━━━━━━━━━━\n📦 Objeto: *${itemKey.toUpperCase()}*\n💰 Precio Base: *${startPrice}* diky\n🆔 ID Subasta: *${auctionId}*\n⏳ Duración: 1 hora\n━━━━━━━━━━━━━━\n💡 Usa \`!ofertar ${auctionId} <monto>\` para participar.` }, { quoted: msg });
        }

        // !subastas
        if (start === '!subastas') {
            const activas = await db.obtenerSubastasActivas();
            if (activas.length === 0) return sock.sendMessage(chatId, { text: '⚖️ No hay subastas activas en este momento.' });

            let m = '⚖️ **SUBASTAS ACTIVAS**\n━━━━━━━━━━━━━━\n';
            for (const s of activas) {
                const minsLeft = Math.ceil((s.end_time - Date.now()) / 60000);
                m += `🆔 ID: *${s.id}*\n📦 Objeto: *${s.item_name.toUpperCase()}*\n💰 Oferta Actual: *${s.current_bid}* diky\n👤 Postor: ${s.highest_bidder_id ? '@' + s.highest_bidder_id.split('@')[0] : 'Nadie'}\n⏳ Termina en: ${minsLeft} min\n━━━━━━━━━━━━━━\n`;
            }
            return sock.sendMessage(chatId, { text: m, mentions: activas.map(s => s.highest_bidder_id).filter(h => h) });
        }

        // !ofertar <id> <monto>
        if (start === '!ofertar') {
            const id = parseInt(args[0]);
            const bid = parseInt(args[1]);

            if (isNaN(id) || isNaN(bid)) return sock.sendMessage(chatId, { text: '⚖️ Uso: *!ofertar <id> <monto>*' });

            const s = await db.obtenerSubasta(id);
            if (!s || s.status !== 'active') return sock.sendMessage(chatId, { text: '❌ Esta subasta no existe o ya terminó.' });
            if (Date.now() > s.end_time) return sock.sendMessage(chatId, { text: '❌ La subasta ha expirado.' });

            if (bid <= s.current_bid) return sock.sendMessage(chatId, { text: `❌ Tu oferta debe ser mayor a *${s.current_bid}* diky.` });

            const balance = await db.obtenerBalance(sender);
            if (balance < bid) return sock.sendMessage(chatId, { text: '💸 No tienes suficiente dinero para esta oferta.' });

            if (sender === s.seller_id) return sock.sendMessage(chatId, { text: '🚫 No puedes ofertar en tu propia subasta, tramposo.' });

            await db.pujarSubasta(id, sender, bid);
            return sock.sendMessage(chatId, { text: `✅ ¡Oferta de *${bid}* dikys aceptada para la subasta #${id}!` }, { quoted: msg });
        }
    }
};
