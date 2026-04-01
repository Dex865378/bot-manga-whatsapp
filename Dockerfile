FROM node:20-bullseye

# 1. Instalar dependencias del SISTEMA (SIN Python - ya no lo necesitamos)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
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

# 2. Descargar binario INDEPENDIENTE de yt-dlp (NO necesita Python, lo trae integrado)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# 3. Configurar el directorio de trabajo
WORKDIR /app

# 4. Cache de dependencias de Node
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# 5. Copiar el resto del bot
COPY . .

# 6. Hugging Face usa el puerto 7860
ENV PORT=7860
EXPOSE 7860

# 7. Comando de arranque
CMD ["npm", "start"]
