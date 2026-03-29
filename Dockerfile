FROM node:20-bullseye

# 1. Instalar dependencias del SISTEMA (FFMPEG, WebP, librerías de stickers, Python para yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    python3 \
    libwebp-dev \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    imagemagick \
    graphicsmagick \
    && rm -rf /var/lib/apt/lists/*


# 2. Configurar el directorio de trabajo
WORKDIR /app

# 3. Cache de dependencias de Node
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# 4. Copiar el resto del bot e ignorar lo innecesario vía .dockerignore
COPY . .

# 5. Hugging Face usa el puerto 7860 por defecto
ENV PORT=7860
EXPOSE 7860

# 6. Comando de arranque principal (No usar nodemon en producción)
CMD ["npm", "start"]
