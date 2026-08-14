FROM node:20-bullseye

# 1. Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    unzip \
    libwebp-dev \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    imagemagick \
    graphicsmagick \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 1.1 lightnovel-crawler (!novela / !reconovela) esta PAUSADO por ahora
# (ver comments/novel.js) - el paquete Python sufrio una reescritura
# arquitectonica grande y su cadena de dependencias resulto inestable de
# instalar de forma reproducible aqui (varios ImportError en cadena al
# fijar distintas versiones: TextCleaner, luego AbortedException). Se
# quita la instalacion del Dockerfile mientras tanto para no pagar el
# costo de build mas largo ni el riesgo de que ese paso rompa el deploy
# entero. Si se retoma en el futuro, reinstalar aqui con pip3.

# 2. Configurar el directorio de trabajo
WORKDIR /app

# 3. Cache de dependencias de Node (capa separada para builds más rápidos)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# 4. Copiar el código del bot
COPY . .

# 5. Puerto para Render
ENV PORT=10000
EXPOSE 10000

# 6. Comando de arranque
CMD ["npm", "start"]
