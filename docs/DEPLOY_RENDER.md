# 🚀 Guía de Deploy en Render

## Pre-requisitos
1. Cuenta en [Render](https://render.com) (gratis)
2. Cuenta en [Turso](https://app.turso.tech) (gratis)
3. Repositorio en GitHub con el código del bot

---

## Paso 1: Configurar Turso (Base de Datos)

1. Ve a [app.turso.tech](https://app.turso.tech) → Crear cuenta
2. Crear una nueva base de datos (ej: `manga-bot`)
3. Ve a **"Generate Token"** → Copia el token
4. Anota estos dos valores:
   - `TURSO_DATABASE_URL` → `libsql://tu-db.turso.io`
   - `TURSO_AUTH_TOKEN` → `eyJ...`

---

## Paso 2: Subir código a GitHub

```bash
git init
git add .
git commit -m "Neko Bot v11.0"
git remote add origin https://github.com/TU_USUARIO/neko-manga-bot.git
git push -u origin main
```

---

## Paso 3: Crear servicio en Render

1. Ve a [dashboard.render.com](https://dashboard.render.com)
2. Clic en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name:** `neko-manga-bot`
   - **Runtime:** `Docker`
   - **Plan:** `Free`

---

## Paso 4: Variables de Entorno en Render

En la sección **"Environment"** del servicio, agrega:

| Variable | Valor |
|----------|-------|
| `TURSO_DATABASE_URL` | `libsql://tu-db.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...tu-token...` |
| `NUMERO_ADMIN` | `50760541202` (tu número sin +) |
| `PORT` | `10000` |

> ⚠️ `RENDER_EXTERNAL_URL` se configura automáticamente por Render.

---

## Paso 5: Deploy

1. Render hará el deploy automáticamente al hacer push a GitHub
2. Espera 2-3 minutos mientras construye el Docker
3. Ve a la URL de tu servicio (ej: `https://neko-manga-bot.onrender.com`)
4. Verás el dashboard con el **código de vinculación**
5. En WhatsApp → **Dispositivos vinculados** → **Vincular dispositivo** → Ingresa el código

---

## 🔄 Cómo actualizar el bot

```bash
git add .
git commit -m "Actualización"
git push
```
Render redesplegará automáticamente. **La sesión se mantiene en Turso** (no necesitas re-vincular).

---

## ⚠️ Limitaciones de Render Free

- El servicio se duerme tras 15 min de inactividad
- El bot tiene un keep-alive que hace ping cada 4 min para evitar esto
- Si se duerme, se reconecta automáticamente al recibir una request

---

## 🔧 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Connection Closed" al generar código | El bot espera 20s antes de pedir código. Si falla, reintenta en 30s automáticamente |
| Bot no responde en grupo | Escribe `!bot on` para activarlo |
| DB offline en dashboard | Verifica las variables TURSO_* en Render |
| Stickers no se crean | ffmpeg está incluido en el Docker, debería funcionar |
