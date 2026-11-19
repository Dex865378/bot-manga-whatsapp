# 📋 DOCUMENTO MAESTRO DE VARIABLES - DIKY BOT V3
# 🤗 Plataforma: Hugging Face Spaces

> [!CAUTION]
> **ESTE DOCUMENTO ES CRÍTICO.** No debe borrarse, moverse ni editarse bajo ninguna circunstancia. Contiene las credenciales vitales para el funcionamiento del bot.

Este es el respaldo de todas las variables que DEBEN estar configuradas en **Hugging Face Spaces → Settings → Repository secrets** para que el bot funcione correctamente.

> [!WARNING]
> Este repo es **público**. Nunca pegues tokens reales acá: los valores van en Render → Environment (o en el archivo `.env` local, que no se versiona).

> [!NOTE]
> Las claves de OpenRouter (IA) fueron **eliminadas** de este documento: la IA se quitó del bot en el commit `6ef48ff`. No hace falta configurar ninguna API de IA.

| VARIABLE | VALOR EXACTO (COPIAR Y PEGAR) | NOTA |
| :--- | :--- | :--- |
| **TURSO_DATABASE_URL** | *(oculto — está en Render → Environment y en el .env local)* | Dirección de tu base de datos. |
| **TURSO_AUTH_TOKEN** | *(oculto — está en Render → Environment y en el .env local)* | El token de persistencia (NO CAMBIAR). |
| **NUMERO_ADMIN** | `109938613481683,50760541202` | Permisos de administrador. |
| **PORT** | `7860` | Puerto fijo de Hugging Face. |

---

### 🛠️ ¿Cómo actualizar variables en Hugging Face?
1. Ve a tu Space: `https://huggingface.co/spaces/Luis-047595/diky-bot-v2`
2. Haz clic en **Settings**.
3. Baja hasta la sección **Repository secrets** (variables de entorno privadas).
4. Para agregar/editar: clic en **New secret**, ingresa el nombre y valor.
5. El Space se reiniciará automáticamente al guardar.

### 🐳 Infraestructura actual
- **Plataforma:** Hugging Face Spaces
- **Hardware:** CPU basic (2 vCPU, 16 GB RAM) — **Gratis**
- **Runtime:** Docker (Dockerfile incluido en el repo)
- **Puerto:** 7860 (configurado en Dockerfile y ENV)
- **yt-dlp:** Instalado como binario en el Dockerfile (sin Python)

*Última actualización: 2026-04-07*
