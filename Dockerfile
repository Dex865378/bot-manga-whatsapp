FROM node:20-bullseye

# 1. Instalar dependencias del sistema
# (python3/pip/unzip/curl ya no son necesarios para yt-dlp/PO Token provider,
# que fueron eliminados: YouTube bloqueaba las descargas desde la IP de
# datacenter de Render de forma persistente y ningun metodo probado lo
# resolvio de forma estable. Se dejan curl y python3 porque otras partes
# del bot pueden depender de ellos indirectamente; se quitan pip y unzip,
# que solo se usaban para el plugin de PO Token ya eliminado.)
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
