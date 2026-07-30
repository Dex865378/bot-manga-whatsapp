FROM node:20-bullseye

# 1. Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    libwebp-dev \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    imagemagick \
    graphicsmagick \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalar yt-dlp (versión más reciente con soporte iOS client)
# ARG con fecha de build para invalidar el cache de Docker en esta capa:
# sin esto, Docker reutiliza la capa vieja aunque la URL diga "latest",
# porque el comando en si nunca cambia. Cambiar/actualizar este valor
# fuerza una descarga fresca de yt-dlp en el proximo deploy.
ARG YTDLP_CACHE_BUST=2026-07-30
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && yt-dlp --version

# 3. Configurar el directorio de trabajo
WORKDIR /app

# 4. Cache de dependencias de Node (capa separada para builds más rápidos)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# 5. Copiar el código del bot
COPY . .

# 6. Puerto para Render
ENV PORT=10000
EXPOSE 10000

# 7. Comando de arranque
CMD ["npm", "start"]
