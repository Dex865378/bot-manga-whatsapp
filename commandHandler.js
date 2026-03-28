const fs = require('fs');
const path = require('path');

const commands = new Map();

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;

    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            // Limpiar cache por si estamos recargando
            delete require.cache[require.resolve(`./commands/${file}`)];
            const cmd = require(`./commands/${file}`);

            if (cmd.isMultiple && Array.isArray(cmd.names)) {
                for (const name of cmd.names) {
                    commands.set(name, cmd);
                    console.log(`✅ Comando cargado (Multi): ${name}`);
                }
            } else if (cmd.name && cmd.execute) {
                commands.set(cmd.name, cmd);
                console.log(`✅ Comando cargado: ${cmd.name}`);
            }
        } catch (e) {
            console.error(`❌ Error cargando ${file}:`, e.message);
        }
    }
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

module.exports = { loadCommands, handleCommand, commands };
