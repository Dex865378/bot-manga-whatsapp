const fs = require('fs');
const path = require('path');

const commands = new Map();

function loadCommands(isReload = false) {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;

    if (commands.size > 0 && !isReload) return;

    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            // Limpiar cache por si estamos recargando
            delete require.cache[require.resolve(`./commands/${file}`)];
            const cmd = require(`./commands/${file}`);

            if (cmd.isMultiple && Array.isArray(cmd.names)) {
                for (const name of cmd.names) {
                    commands.set(name, cmd);
                }
            } else if (cmd.name && cmd.execute) {
                commands.set(cmd.name, cmd);
            }
        } catch (e) {
            console.error(`❌ Error cargando ${file}:`, e.message);
        }
    }
    // Solo loguear una vez para no saturar
    if (commands.size > 0) {
        console.log(`✅ [CORE] ${commands.size} comandos disponibles.`);
    }
}

function reloadCommands() {
    loadCommands(true);
}

async function handleCommand(commandName, sock, chatId, msg, args, extras) {
    const cmd = commands.get(commandName);
    if (!cmd) return false;

    try {
        await cmd.execute(sock, chatId, msg, args, extras);
        return true;
    } catch (e) {
        console.error(`❌ Error ejecutando ${commandName}:`, e);
        await sock.sendMessage(chatId, { text: `⚠️ Error al ejecutar *${commandName}*` }, { quoted: msg });
        return true;
    }
}

// Autollamado para inicializar al importar
loadCommands();

module.exports = { loadCommands, handleCommand, commands };

