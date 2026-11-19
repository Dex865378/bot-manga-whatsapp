# 📋 DOCUMENTO MAESTRO DE VARIABLES - DIKY BOT V3

> [!CAUTION]
> **ESTE DOCUMENTO ES CRÍTICO.** No debe borrarse, moverse ni editarse bajo ninguna circunstancia. Contiene las credenciales vitales para el funcionamiento del bot.

Este es el respaldo de todas las variables que DEBEN estar en Render para que el bot funcione correctamente.

> [!NOTE]
> Las claves de OpenRouter (IA) fueron **eliminadas** de este documento: la IA se quitó del bot en el commit `6ef48ff`. No hace falta configurar ninguna API de IA.

| VARIABLE | VALOR EXACTO (COPIAR Y PEGAR) | NOTA |
| :--- | :--- | :--- |
| **TURSO_DATABASE_URL** | `libsql://manga-bot-dex865378.aws-us-east-1.turso.io` | Dirección de tu base de datos. |
| **TURSO_AUTH_TOKEN** | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIyMzMwNzksImlkIjoiNzBjZjYyYmItOTdmNS00OTEyLWI2NmItMGVhMDkxNWNkZDdkIiwicmlkIjoiNzllZDU3MDQtZTYxMi00MGMwLWE1YzMtYTUzZDRmNmY3NDMzIn0.NQ7nTgWNmK07uRi8MT2MONNBKE1y-IWTxSabwFROdYT4XPxNXwzuE0IBPxVC7Rwl8eNx0v1hnO83GeIGZZ45BA` | El token de persistencia (NO CAMBIAR). |
| **NUMERO_ADMIN** | `109938613481683,50760541202` | Permisos de administrador. |
| **RENDER_EXTERNAL_URL** | `https://diky1.onrender.com` | URL para evitar que el bot se duerma. |
| **PORT** | `10000` | Puerto fijo. |

---

### 🛠️ ¿Cómo actualizar en Render?
1. Ve a tu servicio en **Render**.
2. Entra en la pestaña **Environment**.
3. Editá la variable que necesites y dale a **Save Changes**. El bot se reiniciará solo.

*Última actualización: 2026-02-27 22:51 EST*
