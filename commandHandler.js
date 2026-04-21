const fs = require('fs');
const path = require('path');
const { InputValidator, ValidationError } = require('./utils/inputValidator');

const commands = new Map();
const commandValidations = new Map();

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
                console.log(`📦 [CARGANDO] ${file}: ${cmd.names.length} comandos -> ${cmd.names.slice(0,5).join(', ')}...`);
                for (const name of cmd.names) {
                    commands.set(name, cmd);
                }
            } else if (cmd.name && cmd.execute) {
                console.log(`📦 [CARGANDO] ${file}: ${cmd.name}`);
                commands.set(cmd.name, cmd);
            } else {
                console.warn(`⚠️ [IGNORADO] ${file}: No tiene comandos válidos`);
            }
        } catch (e) {
            console.error(`❌ Error cargando ${file}:`, e.message);
        }
    }
    // Solo loguear una vez para no saturar
    if (commands.size > 0) {
        console.log(`✅ [CORE] ${commands.size} comandos disponibles.`);
        // Verificar si !robar está cargado
        if (commands.has('!robar')) {
            console.log('✅ [DEBUG] !robar está registrado');
        } else {
            console.log('❌ [DEBUG] !robar NO está registrado');
        }
    }
}

function reloadCommands() {
    loadCommands(true);
}

// Registra validaciones para un comando
function registerValidation(commandName, validations) {
    commandValidations.set(commandName, validations);
}

// Registra validaciones de todos los comandos que exportan función registerXxxValidations
function registerAllValidations() {
    for (const [fileName, cmdModule] of Object.entries(require.cache)) {
        if (fileName.includes('/commands/') || fileName.includes('\\commands\\')) {
            // Buscar cualquier función que empiece con 'register' y termine con 'Validations'
            const validationFn = Object.entries(cmdModule.exports || {}).find(
                ([key, val]) => key.startsWith('register') && key.endsWith('Validations') && typeof val === 'function'
            );
            if (validationFn) {
                try {
                    validationFn[1](registerValidation);
                    const cmdName = path.basename(fileName, '.js');
                    console.log(`✅ Validaciones registradas: ${cmdName}`);
                } catch (e) {
                    console.error(`❌ Error registrando validaciones de ${fileName}:`, e.message);
                }
            }
        }
    }
}

async function handleCommand(commandName, sock, chatId, msg, args, extras) {
    const cmd = commands.get(commandName);
    if (!cmd) return false;

    try {
        // Validación automática de entradas
        const validations = commandValidations.get(commandName);
        if (validations) {
            try {
                // Validar argumentos
                if (validations.args) {
                    args = InputValidator.validateCommandArgs(
                        args,
                        commandName,
                        validations.args.min || 0,
                        validations.args.max || Infinity
                    );
                }
                // Validar query de búsqueda
                if (validations.query) {
                    const query = args.join(' ');
                    InputValidator.validateString(query, validations.query.fieldName || 'término de búsqueda', {
                        min: validations.query.min || 1,
                        max: validations.query.max || 100,
                        required: validations.query.required !== false
                    });
                }
            } catch (validationError) {
                if (validationError.isValidationError) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ *${validationError.message}*\n\n💡 Uso: ${validations.usage || commandName + ' <argumento>'}`
                    }, { quoted: msg });
                }
                throw validationError;
            }
        }

        await cmd.execute(sock, chatId, msg, args, extras);
        return true;
    } catch (e) {
        console.error(`❌ Error ejecutando ${commandName}:`, e);
        
        // Mensajes de error específicos según el tipo de error
        let errorMsg = `⚠️ Error al ejecutar *${commandName}*`;
        
        if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
            errorMsg = '⏱️ *Tiempo de espera agotado*\nLa API está tardando demasiado. Intenta de nuevo.';
        } else if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
            errorMsg = '🌐 *Error de conexión*\nNo se pudo conectar al servidor. Verifica tu internet.';
        } else if (e.response?.status === 429) {
            errorMsg = '🚫 *Rate limit alcanzado*\nDemasiadas peticiones. Espera un momento.';
        } else if (e.response?.status >= 500) {
            errorMsg = '🔧 *Servidor no disponible*\nLa API de anime está caída. Intenta más tarde.';
        } else if (e.isValidationError) {
            errorMsg = `⚠️ ${e.message}`;
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        return true;
    }
}

module.exports = { loadCommands, handleCommand, commands, registerValidation, registerAllValidations, InputValidator };

// Nota: loadCommands() debe llamarse explícitamente desde index.js
// para evitar problemas de carga circular con registerValidation

