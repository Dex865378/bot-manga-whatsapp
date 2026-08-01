const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Usar FFmpeg del sistema (instalado en Dockerfile)
const FFMPEG_PATH = 'ffmpeg';

const OTAKU_REACTIONS = {
    '!pat': 'pat',
    '!hug': 'hug',
    '!kiss': 'kiss',
    '!slap': 'slap',
    '!punch': 'punch',
    '!cry': 'cry',
    '!dance': 'dance',
    '!bite': 'bite',
    '!puchero': 'pout',
    '!sonrojar': 'blush',
    '!dormir': 'sleep',
    '!comiendo': 'nom',
    '!celebrar': 'happy',
    '!risa': 'laugh',
    '!smug': 'smug',
    '!stare': 'stare',
    '!cafe': 'sip'
};

const GIFUKAI_REACTIONS = {
    '!pat': 'pat',
    '!hug': 'hug',
    '!kill': 'kill',
    '!kiss': 'kiss',
    '!slap': 'slap',
    '!punch': 'punch',
    '!cry': 'cry',
    '!dance': 'dance',
    '!bite': 'bite',
    '!highfive': 'highfive',
    '!puchero': 'pout',
    '!sonrojar': 'blush',
    '!dormir': 'sleep',
    '!comiendo': 'nom',
    '!pensar': 'think',
    '!patear': 'kick',
    '!celebrar': 'happy',
    '!aburrido': 'bored',
    '!risa': 'laugh',
    '!smug': 'smug',
    '!stare': 'stare',
    '!cafe': 'sip',
    '!baka': 'angry'
};

function extractGifUrl(config, data) {
    if (config.source === 'nekos') return data?.results?.[0]?.url;
    return data?.url;
}

function isExpectedGifUrl(source, reaction, url) {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    if (source === 'otaku') return url.includes(`/gifs/${reaction}/`);
    if (source === 'gifukai') return url.includes(`/${reaction}/`) || (reaction === 'nom' && url.includes('/eat/'));
    return true;
}

// Movido fuera de execute(): se crea 1 sola vez al cargar el modulo,
// en vez de reconstruirse en cada ejecucion del comando (ahorra CPU/RAM en Render).
const reccionesGif = {
            '!pat': { api: 'https://nekos.best/api/v2/pat', txt: ['acarició a', 'le hace mimos a', 'le da palmaditas en la cabeza a', 'consiente a'], solo: ['se acaricia el pelito...', 'se siente solo/a y se acaricia la cabeza', 'necesita mimos...'], source: 'nekos' },
            '!hug': { api: 'https://nekos.best/api/v2/hug', txt: ['le dio un abrazo a', 'está abrazando fuerte a', 'le da un cálido abrazo a', 'no quiere soltar a'], solo: ['se abraza a sí mismo...', 'quiere un abrazo...', 'abraza su almohada'], source: 'nekos' },
            '!kill': { api: 'https://api.waifu.pics/sfw/kill', txt: ['eliminó de la existencia a', 'le dio cuello a', 'acabó con', 'mandó al lobby a'], solo: ['murió de forma dramática...', 'se autodestruyó 💥', 'se desvanece...'], source: 'waifu' },
            '!kiss': { api: 'https://nekos.best/api/v2/kiss', txt: ['le dio un beso a', 'besó apasionadamente a', 'le robó un beso a', 'le da un besito tierno a'], solo: ['lanza un beso al aire... 😘', 'sopla un beso', 'espera un beso...'], source: 'nekos' },
            '!slap': { api: 'https://nekos.best/api/v2/slap', txt: ['le dio una bofetada a', 'le cruzó la cara a', 'le dio un sopapo a', 'le dio una cachetada a'], solo: ['¡Se dio un facepalm!', 'se dio un golpe accidental', 'se abofetea por error'], source: 'nekos' },
            '!punch': { api: 'https://nekos.best/api/v2/punch', txt: ['le dio un puñetazo a', 'le metió un viaje a', 'golpeó a', 'le dio un combo a'], solo: ['da golpes al aire...', 'está practicando boxeo', 'golpea la pared por frustración'], source: 'nekos' },
            '!cry': { api: 'https://api.waifu.pics/sfw/cry', txt: ['se puso a llorar frente a', 'no puede parar de llorar con', 'está inundando la sala frente a'], solo: ['está llorando en un rincón... 😭', 'se puso modo sad', 'necesita consuelo'], source: 'waifu' },
            '!dance': { api: 'https://api.waifu.pics/sfw/dance', txt: ['se puso a bailar con', 'está sacando los pasos prohibidos con', 'perrea intenso con'], solo: ['se puso a bailar solo/a 💃', 'está bailando un cumbión', 'saca sus mejores pasos'], source: 'waifu' },
            '!bite': { api: 'https://api.waifu.pics/sfw/bite', txt: ['le dio una mordidita a', 'mordió a', 'le dio un mordisco juguetón a'], solo: ['se muerde las uñas...', 'está mordiendo su labio', 'tiene hambre de algo...'], source: 'waifu' },
            '!highfive': { api: 'https://api.waifu.pics/sfw/highfive', txt: ['chocó esos cinco con', 'le dio un hi-five a', 'choca las palmas con'], solo: ['chocó esos cinco consigo mismo...', 'espera que alguien le choque los cinco', 'está feliz celebrando'], source: 'waifu' },
            '!fumar': {
                api: null,
                txt: ['fuma frente a', 'suelta el humo sobre', 'mira con estilo mientras fuma ante'], solo: ['está fumando un buen cigarro... 🚬', 'exhala una nube de humo', 'está en modo relax con un cigarro'], source: 'otaku',
                fallbacks: [
                    'https://media.tenor.com/6Xun6YIdXfIAAAAC/anime-smoke.gif',
                    'https://media.tenor.com/k6O6_1XpB1AAAAAC/sanji-smoke.gif',
                    'https://media.tenor.com/D9fE4lT22L4AAAAC/spike-spiegel-cowboy-bebop.gif'
                ]
            },
            '!cafe': {
                api: 'https://api.otakugifs.xyz/gif?reaction=sip',
                txt: ['toma un cafecito con', 'disfruta una taza de café junto a', 'bebe su café mirando a'], solo: ['está disfrutando de un cafecito... ☕', 'toma su bebida favorita', 'está relax tomando algo'], source: 'otaku',
                fallbacks: [
                    'https://media.tenor.com/EwaP1V2W5pAAAAAC/anime-coffee.gif',
                    'https://media.tenor.com/XpAihp3LlsAAAAAC/sip-coffee.gif'
                ]
            },
            '!puchero': { api: 'https://nekos.best/api/v2/pout', txt: ['le hace un puchero a', 'pone cara triste frente a', 'hace un pucherito a'], solo: ['hace un puchero tierno... 🥺', 'está molesto/a de forma tierna', 'quiere atención'], source: 'nekos' },
            '!sonrojar': { api: 'https://nekos.best/api/v2/blush', txt: ['se sonroja frente a', 'se puso rojo como tomate ante', 'no puede evitar sonrojarse con'], solo: ['se sonrojó tod@... 😳', 'le dio mucha vergüenza', 'está apenad@'], source: 'nekos' },
            '!baka': { api: 'https://nekos.best/api/v2/baka', txt: ['le dice baka a', 'insulta tiernamente a', 'llama tonto a'], solo: ['¡Grita: BAKA! 💢', 'está indignad@', '¡Qué tont@!'], source: 'nekos' },
            '!dormir': { api: 'https://nekos.best/api/v2/sleep', txt: ['se fue a mimir junto a', 'se quedó dormido/a sobre', 'ya se durmió con'], solo: ['se quedó bien dormid@... 😴', 'está en el séptimo sueño', 'zZzZzZzZ...'], source: 'nekos' },
            '!comiendo': { api: 'https://nekos.best/api/v2/nom', txt: ['está comiendo con', 'comparte su comida con', 'está devorando algo frente a'], solo: ['está disfrutando de su comida... 🍱', '¡Qué delicia!', 'ñam ñam ñam...'], source: 'nekos' },
            '!pensar': { api: 'https://nekos.best/api/v2/think', txt: ['se puso a pensar junto a', 'analiza la situación con', 'está meditando algo sobre'], solo: ['se puso en modo pensativo... 🤔', 'está filosofando', '¿Qué estará pasando por su mente?'], source: 'nekos' },
            '!patear': { api: 'https://nekos.best/api/v2/kick', txt: ['le dio una patada a', 'pateó a', 'le dio un puntapié a'], solo: ['está pateando el aire... 👟', 'está practicando patadas', '¡Toma eso!'], source: 'nekos' },
            '!celebrar': { api: 'https://nekos.best/api/v2/happy', txt: ['celebra con', 'salta de alegría junto a', 'festeja con'], solo: ['está saltando de alegría... 🎉', '¡Wooohooo!', '¡Qué felicidad!'], source: 'nekos' },
            '!aburrido': { api: 'https://nekos.best/api/v2/bored', txt: ['está aburrido junto a', 'se muere de aburrimiento con', 'no sabe qué hacer con'], solo: ['está muriendo de aburrimiento... 🥱', 'esperando que pase algo', 'zzzzzz qué hueva'], source: 'nekos' },
            '!risa': { api: 'https://nekos.best/api/v2/laugh', txt: ['se ríe de', 'se burla de', 'está carcajeando con'], solo: ['se ríe a carcajadas 😂', '¡JAJAJA!', 'no puede parar de reír'], source: 'nekos' },
            '!smug': { api: 'https://nekos.best/api/v2/smug', txt: ['mira con superioridad a', 'se cree mejor que', 'mira con una sonrisa presumida a'], solo: ['actúa de forma presumida 😏', 'se siente el/la mejor', 'mira a todos hacia abajo'], source: 'nekos' },
    '!stare': { api: 'https://nekos.best/api/v2/stare', txt: ['mira fijamente a', 'le clava la mirada a', 'no le quita los ojos de encima a'], solo: ['mira a la nada fijamente... 👁️', 'está viendo tu alma', 'no parpadea...'], source: 'nekos' }
};

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
        const config = { ...reccionesGif[start] };
        const gifukaiReaction = GIFUKAI_REACTIONS[start];
        const otakuReaction = OTAKU_REACTIONS[start];
        config.apis = [];
        if (gifukaiReaction) config.apis.push({ source: 'gifukai', reaction: gifukaiReaction, api: `https://api.gifukai.com/${gifukaiReaction}` });
        if (otakuReaction) config.apis.push({ source: 'otaku', reaction: otakuReaction, api: `https://api.otakugifs.xyz/gif?reaction=${otakuReaction}` });
        if (config.api) config.apis.push({ source: config.source, reaction: null, api: config.api });
        const ment = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = (ment.length > 0) ? ment[0] : null;

        let caption = '';
        const pick = (v) => Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;

        if (target) {
            caption = `✨ *@${sender.split('@')[0]}* ${pick(config.txt)} *@${target.split('@')[0]}*`;
        } else {
            caption = `✨ *@${sender.split('@')[0]}* ${pick(config.solo)}`;
        }

        try {
            let gifUrl = '';
            let lastApiError = null;
            for (const provider of config.apis) {
                try {
                    const res = await axios.get(provider.api, { timeout: 8000 });
                    const url = extractGifUrl(provider, res.data);
                    if (!isExpectedGifUrl(provider.source, provider.reaction, url)) {
                        throw new Error(`URL invalida para ${provider.source}:${provider.reaction || 'default'}`);
                    }
                    gifUrl = url;
                    break;
                } catch (apiErr) {
                    lastApiError = apiErr;
                }
            }

            try {
                if (!gifUrl || !/^https?:\/\//i.test(gifUrl)) {
                    throw new Error('La API no devolvio una URL valida');
                }
                if (config.source === 'otaku' && config.reaction && !gifUrl.includes(`/gifs/${config.reaction}/`)) {
                    throw new Error(`La API devolvio una categoria distinta para ${start}`);
                }
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
