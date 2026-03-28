# 📋 DOCUMENTO MAESTRO DE VARIABLES - DIKY BOT V2

> [!CAUTION]
> **ESTE DOCUMENTO ES CRÍTICO.** No debe borrarse, moverse ni editarse bajo ninguna circunstancia. Contiene las credenciales vitales para el funcionamiento del bot.

Este es el respaldo de todas las variables que DEBEN estar en Render para que el bot funcione correctamente, recupere tu dinero/niveles y la IA responda.

| VARIABLE | VALOR EXACTO (COPIAR Y PEGAR) | NOTA |
| :--- | :--- | :--- |
| **TURSO_DATABASE_URL** | `libsql://manga-bot-dex865378.aws-us-east-1.turso.io` | Dirección de tu base de datos. |
| **TURSO_AUTH_TOKEN** | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIyMzMwNzksImlkIjoiNzBjZjYyYmItOTdmNS00OTEyLWI2NmItMGVhMDkxNWNkZDdkIiwicmlkIjoiNzllZDU3MDQtZTYxMi00MGMwLWE1YzMtYTUzZDRmNmY3NDMzIn0.NQ7nTgWNmK07uRi8MT2MONNBKE1y-IWTxSabwFROdYT4XPxNXwzuE0IBPxVC7Rwl8eNx0v1hnO83GeIGZZ45BA` | El token de persistencia (NO CAMBIAR). |
| **OPENROUTER_KEY** | `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,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,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,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,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,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,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,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` | **ROTACIÓN DE 8 LLAVES:** El bot usará la siguiente si una falla. |
| **NUMERO_ADMIN** | `109938613481683,50760541202` | Permisos de administrador. |
| **RENDER_EXTERNAL_URL** | `https://diky1.onrender.com` | URL para evitar que el bot se duerma. |
| **PORT** | `10000` | Puerto fijo. |

---

### 🛠️ ¿Cómo actualizar en Render?
1. Ve a tu servicio en **Render**.
2. Entra en la pestaña **Environment**.
3. Busca `OPENROUTER_KEY` y pega toda la cadena de llaves (la larga que ves arriba).
4. Dale a **Save Changes**. El bot se reiniciará con las nuevas llaves.

*Última actualización: 2026-02-27 22:51 EST*
