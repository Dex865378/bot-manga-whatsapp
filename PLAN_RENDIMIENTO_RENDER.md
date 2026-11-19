# ⚡ Plan de Rendimiento — Diky Bot V3 en Render Free (512 MB / 0.1 vCPU)

> **Versión de este plan: `v11.1.0`** — implementada en el código (no requiere migración de base de datos ni cambios de variables obligatorios).
> Próxima revisión: `v11.2.0` (ajuste fino con datos reales de `/health`).

**Objetivo:** que el bot responda rápido sin agregar esperas a los usuarios y sin ponerse lento ni crashear con el tiempo.

**Regla que se respetó en TODOS los cambios:** no se agregó ninguna espera artificial, ningún cooldown nuevo y ningún límite a la gente. Solo se eliminó trabajo, se lo movió fuera del camino crítico o se lo hizo más barato. La única protección nueva (semáforo de mensajes) se activa únicamente bajo sobrecarga real, donde antes el proceso directamente se caía.

---

## 1. Diagnóstico (qué lo hacía lento)

| # | Problema | Dónde estaba | Costo real |
|---|---|---|---|
| 1 | `flushStatsBatch` hacía `SELECT` + `UPDATE` **por cada usuario** (2 roundtrips), en tandas de 5, cada 60 s | `index.js` | Con 100 usuarios activos: ~200 viajes de red por minuto, y conteos que se pisaban entre sí |
| 2 | `sumarActividadBatch` ejecutaba **un `execute()` por fila** | `database.js` | 20 viajes por tanda, cada minuto |
| 3 | Cola de salida con piso fijo de **250 ms** entre mensajes | `index.js` `procesarColaSalida` | `!leer`, `!perfil`, `!menu` con 3-4 mensajes: +0.75-1 s solo en pausas |
| 4 | ffmpeg: intentaba convertir como imagen y, al fallar, **repetía todo como video** | `index.js` `convertirAWebp` | GIF/WebP animado: el **doble** de CPU y de tiempo |
| 5 | ffmpeg sin límite de threads + hasta **9** conversiones simultáneas | `MAX_PROCESOS` | En 0.1 vCPU se pelean por el CPU y congelan todos los demás comandos |
| 6 | Arranque en frío con dos esperas de red **en serie** y sync de 21 mangas **en serie** dentro del handler de conexión | `startBot` | Cold start más largo; tardaba en quedar listo tras cada reinicio |
| 7 | Llamadas externas (AniList, MangaDex, traductor) **sin keep-alive** | `utils/apiClient.js` + `axios` | +100-300 ms de handshake TLS en cada llamada |
| 8 | Un `SELECT` de usuario **por cada comando** solo para actualizar el nombre de WhatsApp | `procesarMensaje` | Lecturas innecesarias (tráfico y latencia) |
| 9 | Mensajes procesados **sin tope de concurrencia** | `messages.upsert` | Un pico disparaba cientos de handlers a la vez → RAM y queries simultáneas → OOM |
| 10 | Mapa de deduplicación de mensajes **sin tope** entre barridos | `messages.upsert` | Crecimiento de memoria en ráfagas |
| 11 | Dos pares de handlers `SIGINT`/`SIGTERM` registrados | `index.js` | El primero cortaba al segundo: el flush podía quedar a medias |

**Bug funcional encontrado y corregido (no era de rendimiento):** `activarModoAdmin`, `activarAntiSpam` y `activarModoManga` devolvían `true` aunque el `UPDATE` afectara **0 filas**. En grupos que nunca se activaron con `!bot on` no existe la fila en `grupos_activados`, así que el bot respondía “activado” sin guardar nada. Ahora esas funciones informan si realmente guardaron y los comandos avisan.

---

## 2. Qué se implementó en `v11.1.0`

### 2.1 Base de datos — de ~200 viajes por minuto a 1-3
- **Nuevo `ejecutarEnLotes()`** en `database.js`: manda las sentencias con `dbClient.batch(..., 'write')`, en tandas de 100 (para no exceder el tamaño máximo de request del protocolo HTTP de Turso).
- **`registrarComandosBatch()`**: UPSERT atómico `total_comandos = total_comandos + N`. Sin `SELECT` previo, sin pisar conteos concurrentes.
- **`actualizarRachasBatch()`**: la misma lógica de `actualizarRacha()` resuelta en **SQL con `CASE`** (1 día / 2 días / reinicio), sin leer la fila.
- **`sumarActividadBatch()`**: ahora un batch en vez de un `execute()` por fila.
- **`recordatoriosVencidos()`**: los `DELETE` van en un solo batch.
- **Orden garantizado** en el flush: primero el contador (crea la fila si falta) y después la racha (es un `UPDATE`).

> ✅ **Verificación hecha:** la lógica SQL nueva se probó contra una base **libSQL real local** (misma librería, sin tocar Turso), con 9 casos: acumulación, creación de fila, defaults (`monedas=100`), racha primera vez, <1 día sin cambios, 1-2 días +1, >2 días reinicio, acumulación de actividad y `rowsAffected = 0` cuando no existe la fila.

### 2.2 Cola de salida
- Piso de **80 ms** (`PERF_QUEUE_MIN_MS`) en vez de 250 ms fijos.
- Modo turbo (25/50 ms) cuando la cola está cargada.
- Si el chat viene de un timeout/429, `esChatLento()` (ya existía) lo devuelve a 250 ms durante 5 minutos. El circuito de protección sigue vivo, pero solo se activa cuando hace falta.

### 2.3 ffmpeg / stickers
- **Detección de animado por firma del buffer** (`GIF`, `WebP` con chunk `ANIM`, `MP4` con `ftyp`): se arranca directo por la ruta correcta y se elimina la doble conversión.
- **Extensión correcta** del temporal (`.gif`, `.webp`, `.mp4`, `.png`) para que ffmpeg no adivine.
- **`-threads` acotado**: 1 para video, 2 para imagen (antes: todos los cores → thrashing).
- **`MAX_PROCESOS` default 3** (antes 9).
- La calidad NO se tocó: sigue `lanczos`, 512×512, `quality 75` imagen / `quality 50` video.

### 2.4 Arranque en frío
- `db.init()` y `fetchLatestBaileysVersion()` **en paralelo**. `fetchLatestBaileysVersion` se mantiene (sin ella WhatsApp devuelve 405 — regla del proyecto).
- Sincronización de los 21 mangas **en segundo plano** con `setImmediate`, en vez de bloquear el handler de conexión.

### 2.5 Red externa
- Agentes `http`/`https` con **keep-alive** compartidos por todo `axios` del proyecto (`maxSockets: 16`, `maxFreeSockets: 8`).

### 2.6 Memoria y estabilidad
- **Semáforo de 16 mensajes en vuelo** (`PERF_MAX_MSG_CONCURRENT`): solo frena bajo sobrecarga real.
- **Tope del mapa de deduplicación** (2000 → purga a 1500).
- **Un solo par** de handlers `SIGINT`/`SIGTERM`, con `flushStatsBatch()` + guard `cerrando`.
- **Throttle del nombre de WhatsApp** (1 lectura cada 10 min por usuario en vez de por comando).
- **Early-out** de los barridos de `mangaSessions` / `novelaSessions` cuando están vacíos (antes se recorrían siempre, dos veces por mensaje).
- **Métricas nuevas en `/health`**: `latencia` con `p50`, `p95`, `max` y los 5 comandos más lentos.

---

## 3. Cómo verificar después del deploy

1. **`/health`** en la URL del servicio:
   - `memMB.rss` estable por debajo de **400 MB**.
   - `latencia.p50` de un comando simple (ej. `!ping`, `!perfil`) por debajo de **400 ms**.
   - `latencia.masLentos` para ver qué comando conviene optimizar después.
2. **Log esperado en el arranque:** `📊 [Batch] Sincronizados N usuarios...` y **una sola línea** de sync de catálogo “(fondo)”.
3. **Prueba manual rápida:** `!ping`, `!perfil`, `!s` (imagen), `!s` (video/GIF), `!anime naruto`, `!leer` (2-3 páginas), `!bot on`, `!adm on` en un grupo activado.
4. **Economía (crítico):** `!daily` → `!tienda` → `!comprar` y confirmar que el saldo descuenta bien (la caché de usuario sigue invalidándose en cada escritura).

---

## 4. Variables de entorno (todas opcionales)

| Variable | Default | Para qué |
|---|---|---|
| `MAX_PROCESOS` | `3` | Conversiones pesadas simultáneas. En Render Free dejar 3. En un server de 2 vCPU se puede subir a 6. |
| `PERF_QUEUE_MIN_MS` | `80` | Pausa base entre mensajes del mismo chat. Si aparecen 429, subir a 150-250. |
| `PERF_MAX_MSG_CONCURRENT` | `16` | Mensajes procesados en paralelo como máximo. |
| `MAX_COLA_HEAVY` | `10` | Cuántas tareas pesadas pueden esperar en cola. |
| `SEND_MESSAGE_TIMEOUT_MS` | `25000` | Timeout de envío (sin cambios). |
| `BAILEYS_LOG_LEVEL` | `silent` | Verbosidad de Baileys. |

Ninguna es obligatoria: si no están, el bot usa los defaults de arriba.

---

## 5. Rollback

- **Sin redeploy:** volver a los valores viejos con variables de entorno en Render:
  - `PERF_QUEUE_MIN_MS=250` (vuelve al ritmo conservador de antes).
  - `MAX_PROCESOS=9` (vuelve al paralelismo viejo).
  - `PERF_MAX_MSG_CONCURRENT=1000` (desactiva de hecho el semáforo).
- **Rollback total:** `git revert <commit de v11.1.0>` (o `git checkout` del tag anterior).
- **No hay cambios de esquema:** la base de datos no se toca, así que revertir el código no deja nada roto.

---

## 6. Riesgos conocidos y su mitigación

| Riesgo | Mitigación |
|---|---|
| 429 de WhatsApp por bajar la pausa a 80 ms | Reintento que ya existía + `marcarChatLento()` que devuelve ese chat a 250 ms por 5 min. Contramedida inmediata: `PERF_QUEUE_MIN_MS=250`. |
| Batch de Turso demasiado grande | Tandas de 100 sentencias. |
| Pérdida de estadísticas si falla el flush | Solo afecta `total_comandos` / racha / actividad (no economía). Era igual o peor antes. |
| Sticker animado que ffmpeg no detecta | Respaldo: si falla, reintenta UNA vez por la otra ruta (como antes). |
| Keep-alive reutilizando un socket muerto | Node descarta sockets cerrados; además los servicios tienen reintentos (`fetchWithRetry`). |

---

## 7. Qué NO se hizo (y por qué)

- **Hacer esperar a la gente / subir cooldowns / encolar comandos:** pedido explícito en contra.
- **Quitar o cachear `fetchLatestBaileysVersion()`:** causa el error 405 (regla del proyecto).
- **Tocar `useTursoAuthState()`:** regla del proyecto.
- **`worker_threads` / `cluster`:** clonan el heap; con 512 MB empeora.
- **Turso embedded replica (lecturas locales):** mejora mucho la lectura, pero una réplica atrasada puede devolver credenciales viejas y tumbar la sesión de WhatsApp. Riesgo inaceptable para “sin que rompa nada”.
- **ffmpeg por pipe (sin archivos temporales):** analizado y descartado. El I/O del temporal son ~1-5 ms; no compensa el riesgo de reescribir la conversión con `spawn`.
- **Cachear el array de la whitelist (`comandosValidos`) en un `Set`:** medido como irrelevante (248 strings por comando) y el smoke test depende de esa declaración literal en `index.js`. No se tocó para no romper la verificación.
- **Cachear el texto de `!menu`:** el menú incluye nombre, uptime y una frase aleatoria por llamada; cachearlo cambiaría el producto.
- **Bajar calidad de stickers:** se nota en el resultado y no ahorra tiempo real.

---

## 8. Pendiente para `v11.2.0` (con datos reales)

1. Mirar `latencia.masLentos` en `/health` durante 48 h y atacar el comando con peor p50.
2. Evaluar caché de segundo nivel para AniList/MangaDex si las APIs aparecen en los más lentos.
3. Revisar si `!leer` conviene enviar en PDF/imágenes según memoria observada.
4. Confirmar en el dashboard de Turso cuántos requests/minuto quedan (debería caer fuerte respecto de antes).
