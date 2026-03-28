const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Usar FFmpeg del sistema (instalado en Dockerfile)
const FFMPEG_PATH = 'ffmpeg';

module.exports = {
    name: 'reactions',
    isMultiple: true,
    names: [
        '!pat', '!hug', '!kill', '!kiss', '!slap', '!punch', '!cry', '!dance', '!bite', '!highfive',
        '!fumar', '!cafe', '!puchero', '!sonrojar', '!baka', '!dormir', '!comiendo', '!pensar',
        '!patear', '!celebrar', '!aburrido', '!risa', '!smug', '!stare'
    ],
    category: 'Social',
    async execute(sock, chatId, msg, args, { start, sender }) {
        const reccionesGif = {
            '!pat': { api: 'https://nekos.best/api/v2/pat', txt: 'acarició a', solo: 'se acaricia el pelito...', source: 'nekos' },
            '!hug': { api: 'https://nekos.best/api/v2/hug', txt: 'le dio un abrazo a', solo: 'se abraza a sí mismo...', source: 'nekos' },
            '!kill': { api: 'https://api.waifu.pics/sfw/kill', txt: 'eliminó de la existencia a', solo: 'murió de forma dramática...', source: 'waifu' },
            '!kiss': { api: 'https://nekos.best/api/v2/kiss', txt: 'le dio un beso a', solo: 'lanza un beso al aire... 😘', source: 'nekos' },
            '!slap': { api: 'https://nekos.best/api/v2/slap', txt: 'le dio una bofetada a', solo: '¡Se dio un facepalm!', source: 'nekos' },
            '!punch': { api: 'https://nekos.best/api/v2/punch', txt: 'le dio un puñetazo a', solo: 'da golpes al aire...', source: 'nekos' },
            '!cry': { api: 'https://api.waifu.pics/sfw/cry', txt: 'se puso a llorar frente a', solo: 'está llorando en un rincón... 😭', source: 'waifu' },
            '!dance': { api: 'https://api.waifu.pics/sfw/dance', txt: 'se puso a bailar con', solo: 'se puso a bailar solo/a 💃', source: 'waifu' },
            '!bite': { api: 'https://api.waifu.pics/sfw/bite', txt: 'le dio una mordidita a', solo: 'se muerde las uñas...', source: 'waifu' },
            '!highfive': { api: 'https://api.waifu.pics/sfw/highfive', txt: 'chocó esos cinco con', solo: 'chocó esos cinco consigo mismo...', source: 'waifu' },
            // MEJORADOS CON FALLBACK O CAMBIO DE API
            '!fumar': {
                api: 'https://api.otakugifs.xyz/gif?reaction=smug', // Otaku no tiene smoke oficial, usamos smug como base de API pero con fallback real
                txt: 'fuma frente a', solo: 'está fumando un buen cigarro... 🚬', source: 'otaku',
                fallbacks: [
                    'https://media.tenor.com/6Xun6YIdXfIAAAAC/anime-smoke.gif',
                    'https://media.tenor.com/k6O6_1XpB1AAAAAC/sanji-smoke.gif',
                    'https://media.tenor.com/D9fE4lT22L4AAAAC/spike-spiegel-cowboy-bebop.gif'
                ]
            },
            '!cafe': {
                api: 'https://api.otakugifs.xyz/gif?reaction=sip',
                txt: 'toma un cafecito con', solo: 'está disfrutando de un cafecito... ☕', source: 'otaku',
                fallbacks: [
                    'https://media.tenor.com/EwaP1V2W5pAAAAAC/anime-coffee.gif',
                    'https://media.tenor.com/XpAihp3LlsAAAAAC/sip-coffee.gif'
                ]
            },
            '!puchero': { api: 'https://nekos.best/api/v2/pout', txt: 'le hace un puchero a', solo: 'hace un puchero tierno... 🥺', source: 'nekos' },
            '!sonrojar': { api: 'https://nekos.best/api/v2/blush', txt: 'se sonroja frente a', solo: 'se sonrojó tod@... 😳', source: 'nekos' },
            '!baka': { api: 'https://nekos.best/api/v2/baka', txt: 'le dice baka a', solo: '¡Grita: BAKA! 💢', source: 'nekos' },
            '!dormir': { api: 'https://nekos.best/api/v2/sleep', txt: 'se fue a mimir junto a', solo: 'se quedó bien dormid@... 😴', source: 'nekos' },
            '!comiendo': { api: 'https://nekos.best/api/v2/nom', txt: 'está comiendo con', solo: 'está disfrutando de su comida... 🍱', source: 'nekos' },
            '!pensar': { api: 'https://nekos.best/api/v2/think', txt: 'se puso a pensar junto a', solo: 'se puso en modo pensativo... 🤔', source: 'nekos' },
            '!patear': { api: 'https://nekos.best/api/v2/kick', txt: 'le dio una patada a', solo: 'está pateando el aire... 👟', source: 'nekos' },
            '!celebrar': { api: 'https://nekos.best/api/v2/happy', txt: 'celebra con', solo: 'está saltando de alegría... 🎉', source: 'nekos' },
            '!aburrido': { api: 'https://nekos.best/api/v2/bored', txt: 'está aburrido junto a', solo: 'está muriendo de aburrimiento... 🥱', source: 'nekos' },
            '!risa': { api: 'https://nekos.best/api/v2/laugh', txt: 'se ríe de', solo: 'se ríe a carcajadas 😂', source: 'nekos' },
            '!smug': { api: 'https://nekos.best/api/v2/smug', txt: 'mira con superioridad a', solo: 'actúa de forma presumida 😏', source: 'nekos' },
            '!stare': { api: 'https://nekos.best/api/v2/stare', txt: 'mira fijamente a', solo: 'mira a la nada fijamente... 👁️', source: 'nekos' }
        };

        const config = reccionesGif[start];
        const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = (ment.length > 0) ? ment[0] : null;

        let caption = '';
        if (target) {
            caption = `✨ *@${sender.split('@')[0]}* ${config.txt} *@${target.split('@')[0]}*`;
        } else {
            caption = `✨ *@${sender.split('@')[0]}* ${config.solo}`;
        }

        try {
            let gifUrl = '';
            try {
                const res = await axios.get(config.api, { timeout: 8000 });
                gifUrl = (config.source === 'nekos') ? res.data.results[0].url : res.data.url;
            } catch (apiErr) {
                // Fallback si la API falla o no tiene la categoría
                if (config.fallbacks) {
                    gifUrl = config.fallbacks[Math.floor(Math.random() * config.fallbacks.length)];
                } else {
                    throw apiErr;
                }
            }

            const tmpOut = path.join(os.tmpdir(), `reac_out_${Date.now()}.mp4`);

            try {
                const ffmpegArgs = [
                    '-i', gifUrl, '-movflags', 'faststart', '-pix_fmt', 'yuv420p',
                    '-vf', 'scale=400:-2', '-c:v', 'libx264', '-crf', '32',
                    '-preset', 'ultrafast', '-tune', 'zerolatency', '-an', '-y', tmpOut
                ];

                await execFileAsync(FFMPEG_PATH, ffmpegArgs, { timeout: 45000, windowsHide: true });
                const mp4Buffer = fs.readFileSync(tmpOut);

                await sock.sendMessage(chatId, {
                    video: mp4Buffer,
                    caption: caption,
                    gifPlayback: true,
                    mentions: target ? [sender, target] : [sender]
                }, { quoted: msg });

                try { fs.unlinkSync(tmpOut); } catch (e) { }
            } catch (ffErr) {
                console.error(`⚠️ FFmpeg falló para ${start}: ${ffErr.message}. Usando fallback. `);
                try { fs.unlinkSync(tmpOut); } catch (e) { }
                const gifRes = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 15000 });
                const gifBuffer = Buffer.from(gifRes.data);
                try {
                    await sock.sendMessage(chatId, {
                        video: gifBuffer, caption: caption, gifPlayback: true,
                        mentions: target ? [sender, target] : [sender]
                    }, { quoted: msg });
                } catch (vidErr) {
                    await sock.sendMessage(chatId, {
                        image: gifBuffer, caption: caption,
                        mentions: target ? [sender, target] : [sender]
                    }, { quoted: msg });
                }
            }
        } catch (e) {
            console.error(`❌ Error en reaccion modular ${start}:`, e.message);
            return sock.sendMessage(chatId, { text: `❌ No pude procesar el GIF. La API de ${config.source} puede estar caída.` }, { quoted: msg });
        }
    }
};
