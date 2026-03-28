FROM node:20-slim

# Instalar dependencias del sistema básicas
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar solo archivos esenciales primero para usar caché
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev && npm cache clean --force

# Copiar el resto del código ignorando archivos pesados (visto en .dockerignore)
COPY . .

# Crear directorios y permisos
RUN mkdir -p .bot_session temp stickers \
    && chmod -R 777 /app

ENV PORT=7860
EXPOSE 7860

CMD ["node", "index.js"]
