FROM node:20-bullseye

# 1. Instalar dependencias del sistema
# (python3/pip/unzip/curl ya no son necesarios para yt-dlp/PO Token provider,
# que fueron eliminados: YouTube bloqueaba las descargas desde la IP de
# datacenter de Render de forma persistente y ningun metodo probado lo
# resolvio de forma estable. Se dejan curl y python3 porque otras partes
# del bot pueden depender de ellos indirectamente; se agrega python3-pip
# para instalar lightnovel-crawler, usado por !reconovela.)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
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

# 1.1 Instalar lightnovel-crawler (comando lncrawl) para !reconovela.
# IMPORTANTE: no se instala Calibre. lncrawl genera EPUB, TXT y JSON de
# forma nativa sin necesitarlo; formatos como PDF requieren Calibre, que
# es una suite pesada (motor Qt, cientos de MB de RAM) inviable en este
# plan gratuito de 512MB compartido con WhatsApp/Baileys. Por eso
# !reconovela genera solo EPUB - ver comentario en commands/novel.js.
#
# FIX: pip3 con --break-system-packages en Debian a veces instala los
# scripts de consola (el binario `lncrawl`) en una ruta de usuario que NO
# esta en el PATH que usa child_process.spawn() (que no es un shell
# interactivo con login, no carga .bashrc/.profile). Esto causaba
# "spawn lncrawl ENOENT" en produccion aunque el paquete si se instalara
# bien. Se agrega PATH explicito con las rutas donde pip puede dejar el
# binario, y se verifica con `which` (sin ||, para que el build FALLE
# ruidosamente si lncrawl no quedo accesible, en vez de fallar en
# silencio y descubrirlo recien en produccion).
# FIX 2: --break-system-packages no es reconocido por la version de pip3
# que trae node:20-bullseye (ese flag se agrego en versiones de pip mas
# nuevas que Debian Bullseye no incluye). Como el contenedor corre como
# root sin restriccion "externally-managed-environment", no hace falta
# ese flag aqui - se quita.
ENV PATH="/usr/local/bin:/root/.local/bin:${PATH}"
# Variables explicitas de bundle de certificados: algunas librerias Python
# (requests, httpx, etc.) no siempre confian en el almacen del sistema por
# defecto y necesitan que se les apunte directamente. Esto solucionaba
# errores CertificateVerifyError vistos en produccion al hacer scraping.
ENV SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"
ENV REQUESTS_CA_BUNDLE="/etc/ssl/certs/ca-certificates.crt"
# --force-reinstall + --no-deps primero desinstala/limpia cualquier rastro
# de instalaciones previas corruptas (se vio en produccion un ImportError
# circular de "TextCleaner" en lncrawl.core.cleaner, tipico de un paquete
# parcialmente instalado o con archivos mezclados de distintas versiones
# tras varios redeploys reinstalando encima de si mismo).
RUN pip3 uninstall -y lightnovel-crawler 2>/dev/null; \
    pip3 install --no-cache-dir --force-reinstall -U certifi lightnovel-crawler \
    && which lncrawl \
    && lncrawl --help > /dev/null 2>&1 \
    && echo "lncrawl instalado correctamente en: $(which lncrawl)"

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
