# 📋 DOCUMENTO MAESTRO DE VARIABLES - DIKY BOT V3
# 🤗 Plataforma: Hugging Face Spaces

> [!CAUTION]
> **ESTE DOCUMENTO ES CRÍTICO.** No debe borrarse, moverse ni editarse bajo ninguna circunstancia. Contiene las credenciales vitales para el funcionamiento del bot.

Este es el respaldo de todas las variables que DEBEN estar configuradas en **Hugging Face Spaces → Settings → Repository secrets** para que el bot funcione correctamente.

> [!NOTE]
> Las claves de OpenRouter (IA) fueron **eliminadas** de este documento: la IA se quitó del bot en el commit `6ef48ff`. No hace falta configurar ninguna API de IA.

| VARIABLE | VALOR EXACTO (COPIAR Y PEGAR) | NOTA |
| :--- | :--- | :--- |
| **TURSO_DATABASE_URL** | `libsql://manga-bot-dex865378.aws-us-east-1.turso.io` | Dirección de tu base de datos. |
| **TURSO_AUTH_TOKEN** | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIyMzMwNzksImlkIjoiNzBjZjYyYmItOTdmNS00OTEyLWI2NmItMGVhMDkxNWNkZDdkIiwicmlkIjoiNzllZDU3MDQtZTYxMi00MGMwLWE1YzMtYTUzZDRmNmY3NDMzIn0.NQ7nTgWNmK07uRi8MT2MONNBKE1y-IWTxSabwFROdYT4XPxNXwzuE0IBPxVC7Rwl8eNx0v1hnO83GeIGZZ45BA` | El token de persistencia (NO CAMBIAR). |
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
