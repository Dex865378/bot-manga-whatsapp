 FROM node:20-slim

# Instalar ffmpeg y git (necesario para algunas dependencias npm)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar configuración e instalar
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev && npm cache clean --force

# Copiar el resto del código
COPY . .

# Directorios y permisos
RUN mkdir -p .bot_session temp stickers \
    && chmod -R 777 /app

ENV PORT=7860
EXPOSE 7860

CMD ["node", "index.js"]
