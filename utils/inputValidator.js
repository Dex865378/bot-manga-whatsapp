/**
 * ✅ Validador de Entradas para Comandos
 * Previene crashes por datos inesperados
 */

class InputValidator {
    static validateString(value, fieldName, options = {}) {
        const { min = 1, max = 1000, required = true } = options;
        
        if (!value && required) {
            throw new ValidationError(`${fieldName} es requerido`);
        }
        
        if (value !== undefined && value !== null) {
            const str = String(value).trim();
            
            if (str.length < min) {
                throw new ValidationError(`${fieldName} debe tener al menos ${min} caracteres`);
            }
            
            if (str.length > max) {
                throw new ValidationError(`${fieldName} no puede exceder ${max} caracteres`);
            }
            
            return str;
        }
        
        return value;
    }

    static validateNumber(value, fieldName, options = {}) {
        const { min, max, integer = false, required = true } = options;
        
        if ((value === undefined || value === null) && required) {
            throw new ValidationError(`${fieldName} es requerido`);
        }
        
        if (value !== undefined && value !== null) {
            let num = Number(value);
            
            if (isNaN(num)) {
                throw new ValidationError(`${fieldName} debe ser un número válido`);
            }
            
            if (integer && !Number.isInteger(num)) {
                throw new ValidationError(`${fieldName} debe ser un número entero`);
            }
            
            if (min !== undefined && num < min) {
                throw new ValidationError(`${fieldName} debe ser mayor o igual a ${min}`);
            }
            
            if (max !== undefined && num > max) {
                throw new ValidationError(`${fieldName} debe ser menor o igual a ${max}`);
            }
            
            return num;
        }
        
        return value;
    }

    static validateArray(value, fieldName, options = {}) {
        const { minLength = 0, maxLength, required = true } = options;
        
        if (!value && required) {
            throw new ValidationError(`${fieldName} es requerido`);
        }
        
        if (value !== undefined && value !== null) {
            if (!Array.isArray(value)) {
                throw new ValidationError(`${fieldName} debe ser una lista`);
            }
            
            if (value.length < minLength) {
                throw new ValidationError(`${fieldName} debe tener al menos ${minLength} elementos`);
            }
            
            if (maxLength !== undefined && value.length > maxLength) {
                throw new ValidationError(`${fieldName} no puede tener más de ${maxLength} elementos`);
            }
            
            return value;
        }
        
        return value;
    }

    static validateMention(jid, fieldName = 'usuario') {
        if (!jid || typeof jid !== 'string') {
            throw new ValidationError(`${fieldName} no es válido`);
        }
        
        // Formato WhatsApp JID
        const jidRegex = /^\d+@(s\.whatsapp\.net|g\.us)$/;
        if (!jidRegex.test(jid)) {
            throw new ValidationError(`${fieldName} no tiene formato válido de WhatsApp`);
        }
        
        return jid;
    }

    static validateCommandArgs(args, commandName, minArgs = 0, maxArgs = Infinity) {
        if (!args || !Array.isArray(args)) {
            if (minArgs > 0) {
                throw new ValidationError(`El comando ${commandName} requiere al menos ${minArgs} argumento(s)`);
            }
            return [];
        }
        
        if (args.length < minArgs) {
            throw new ValidationError(`El comando ${commandName} requiere al menos ${minArgs} argumento(s). Recibidos: ${args.length}`);
        }
        
        if (args.length > maxArgs) {
            throw new ValidationError(`El comando ${commandName} acepta máximo ${maxArgs} argumento(s). Recibidos: ${args.length}`);
        }
        
        return args;
    }

    static sanitizeString(str, options = {}) {
        const { 
            removeHtml = true, 
            trim = true, 
            maxLength = 1000,
            allowNewlines = false 
        } = options;
        
        if (typeof str !== 'string') return '';
        
        let sanitized = str;
        
        if (removeHtml) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }
        
        if (!allowNewlines) {
            sanitized = sanitized.replace(/[\n\r]/g, ' ');
        }
        
        if (trim) {
            sanitized = sanitized.trim();
        }
        
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    }
}

class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.isValidationError = true;
    }
}

// Wrapper para comandos que aplica validación automática
function validateCommand(handler, validations) {
    return async function(sock, chatId, msg, args, extras) {
        try {
            // Validar argumentos
            if (validations.args) {
                args = InputValidator.validateCommandArgs(
                    args, 
                    extras.start, 
                    validations.args.min, 
                    validations.args.max
                );
            }

            // Validar query (para comandos de búsqueda)
            if (validations.query) {
                const query = args.join(' ');
                InputValidator.validateString(query, 'término de búsqueda', {
                    min: validations.query.min || 1,
                    max: validations.query.max || 100,
                    required: validations.query.required !== false
                });
            }

            // Validar número de página (para comandos con paginación)
            if (validations.page && extras.page) {
                InputValidator.validateNumber(extras.page, 'página', {
                    min: 1,
                    integer: true,
                    required: false
                });
            }

            return await handler(sock, chatId, msg, args, extras);
            
        } catch (error) {
            if (error.isValidationError) {
                return sock.sendMessage(chatId, { 
                    text: `⚠️ *Error:* ${error.message}` 
                }, { quoted: msg });
            }
            throw error; // Re-lanzar otros errores
        }
    };
}

module.exports = { 
    InputValidator, 
    ValidationError, 
    validateCommand 
};
