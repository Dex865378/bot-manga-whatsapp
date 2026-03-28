FROM node:20-bullseye

# 1. Instalar dependencias del sistema (ffmpeg crítico para stickers)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 2. Configurar directorio de trabajo
WORKDIR /app

# 3. Copiar configuración de dependencias e instalar
# Usamos --legacy-peer-deps para evitar conflictos y --omit=dev para producción
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev && npm cache clean --force

# 4. Copiar el resto del código fuente
COPY . .

# 5. Crear directorios necesarios y asignar permisos
RUN mkdir -p .bot_session temp stickers \
    && chmod -R 777 /app

# 6. Exponer puerto (Render usa 10000 por defecto)
ENV PORT=10000
EXPOSE 10000

# 7. Comando de arranque
CMD ["node", "index.js"]
