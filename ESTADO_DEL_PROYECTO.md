# 😺 MEMORIA DE DIKY BOT V2 - [Actualizado: 2026-02-27 21:15]

Este documento es la BIBLIA del proyecto. TODO asistente DEBE leerlo PRIMERO antes de tocar cualquier archivo.

---

## 🚨 ADVERTENCIAS CRÍTICAS (LEER PRIMERO)

### ❌ LO QUE NUNCA DEBES HACER:
1. **NO COMENTAR ni desactivar la autenticación de Turso** (`useTursoAuthState()`). Si lo haces, Render pierde la sesión en cada redeploy.
2. **NO quitar `fetchLatestBaileysVersion()`**. Sin esto el bot da Error 405 infinito.
3. **NO mover el bloque de "Registro Automático de Nombre"** arriba de la definición de `isCommand`. Causa un `ReferenceError` y el bot deja de responder.
4. **NO ignorar el `B-ID` en `!ping`**. Si ves que el ID cambia entre mensajes, significa que hay dos instancias corriendo en Render y hay que apagar la vieja.
5. **NO quitar el Heartbeat (setInterval)**. Es vital para que Turso mantenga la sesión viva en el plan gratuito de Render.
6. **NO editar `index.js` para añadir comandos**. Ahora se deben añadir en la carpeta `commands/` siguiendo la estructura modular.
7. **NO reducir la lista de países en `!bandera`**. La base de datos debe mantener siempre los 196 países registrados en `triviaData.js`.
8. **NO cambiar el temporizador de 1 minuto** en el comando `!bandera`. Es una mecánica de "Muerte Súbita" que debe permanecer inalterable.

- **Rango y Prestigio Dinámico**: 
    - **Nuevos Rangos:** Estudiante, Genin, Chunin, Jonin, Jonin Especial, Kage, Sannin, Maestro Elemental y Deidad.
    - **Títulos de Prestigio:** Al usar `!prestigio`, el usuario gana el título permanente "🌌 Ascendente X".
    - **XP Duplicado:** Se ha duplicado el XP necesario para subir del nivel. Ahora el requerimiento es `Nivel * 200`.
- **🏹 Expansión Masiva de Aventura (150+ ítems):** Se ha llevado la variedad al límite. Cada comando (`!pescar`, `!cazar`, `!minar`) cuenta ahora con **50 ítems exclusivos**, desde basura común hasta objetos ancestrales y míticos.
- **⚖️ Sistema de Subastas Globales:** Los usuarios pueden subastar sus ítems raros con `!subastar`. Otros postores pueden usar `!ofertar` en tiempo real. Sistema automatizado de cobro y entrega.
- **🛡️ Escudo vs Silencio:** El **Escudo de Oro** protege contra la **Tarjeta Silencio**.
- **Ajuste de Bandera:** Multiplicador de apuesta reducido a **1.1x**.
- **Persistencia Inmortal:** `seConectoAlgunaVez` para sesiones estables.

---

## 🚀 ESTADO GENERAL
- **Nombre:** Diky Bot V2
- **Motor:** Baileys v7.0.0-rc.9
- **Hosting:** Render (Cloud) - Plan Free (512MB RAM)
- **Base de Datos:** Turso Cloud
- **Persistencia:** Turso Cloud (Heartbeat 10 min) + Local fallback.
- **Repositorio:** [GitHub - Dex865378/bot-manga-whatsapp](https://github.com/Dex865378/bot-manga-whatsapp)

## 🛠️ ARQUITECTURA TÉCNICA (MODULAR V3)

### Estructura de Archivos:
- `index.js`: Motor principal, conexión y enrutamiento ligero.
- `commandHandler.js`: Cargador dinámico de módulos de comandos.
- `gameResponder.js`: Gestor centralizado de respuestas para juegos activos (trivia, ahorcado, etc.).
- `database.js`: Operaciones de DB (Turso/SQLite).
- `commands/`: Carpeta con módulos categorizados (casino, economy, fun, main, media, ping, pptx, settings, social_reactions, trivia).

### Sistema de Comandos:
- Cada archivo en `commands/` exporta un objeto con `name`, `names` (array de disparadores) y `execute`.
- Se usa un objeto `extras` compartido para pasar utilidades (db, botState, socket, etc.) a los módulos.

## 💰 SISTEMA ECONÓMICO (ACTUALIZADO)
- **Moneda:** diky.
- **Clases (`!clase`):** Sistema de profesiones (Cazador, Pescador, Apostador, Empresario, Hacker) con bonos pasivos.
- **Logros:** Medallas visuales permanentes en `!perfil` (Millonario, Leyenda, Gladiador).
- **Comandos:** `!daily`, `!w` (trabajo), `!slut`, `!tienda`, `!comprar`, `!dar`, `!clase`, `!perfil`.
- **Ranking:** `!mejor` muestra el Top 20 de nivel y riqueza.

## 🐛 HISTORIAL DE CAMBIOS Y CORRECCIONES (Últimas 24h)

### Expansión de Geografía y Reforma Económica (2026-02-26)
- **Nuevo Sub-comando `!bandera capitales`**: Añadida modalidad de adivinar capitales con nombres complejos.
    - **Lógica de Dificultad:** El bot prioriza nombres largos y difíciles (70% de probabilidad).
    - **Apuestas en Trivia:** Implementado sistema de dinero en juego (`!bandera [sub] [monto]`) con pago de x3 al ganar.
- **Sistema de Clases (`!clase`)**: Los usuarios ahora pueden elegir una profesión que otorga bonos específicos (ej: Hacker tiene -10% de descuento en la tienda).
- **Sistema de Logros**: Añadidas columnas `clase` y `logros` en la DB. Los logros se desbloquean por hitos (100k dikys, Nivel 50, 50 victorias en duelos).
- **Overhaul de Casino (`!slot`)**:
    - Probabilidad de ganar aumentada al 50%.
    - Coste de entrada aleatorio entre 50 y 100 dikys.
    - Recompensa fija de 500 dikys (más bonos de clase).
- **Remodelación de la Tienda**: Ítems organizados por categorías (Básicos, Protección, Especiales, Míticos).
    - **Nuevos Ítems:** Anillo de Bodas, Guardaespalda, Grimorio de Diky, Ticket Lotería.
- **Eliminación de Contenido Obsoleto**:
    - Se eliminó el comando `!deseo` y todas las referencias a las "Esferas del Dragón" por petición del usuario.
    - Limpieza del inventario inicial del "Modo Dios".
- **Correcciones Menores:** Ajustados mensajes de victoria en `gameResponder.js` para ser dinámicos según el tipo de trivia.

### Sistema de Prestigio y Lotería Automática (2026-02-26 14:05)
- **Sistema de Prestigio (Endgame)**: Los usuarios que alcancen el **Nivel 500** pueden usar `!prestigio` para reiniciar a nivel 1 a cambio de un rango de prestigio permanente que otorga un multiplicador de monedas acumulativo (10% por rango).
- **Lotería Global Automática**: Se ha implementado un sorteo de lotería que ocurre cada 6 horas. Los usuarios compran tickets en la tienda (`!comprar 3`) para participar. El pozo se acumula con cada compra.
- **Activación Instantánea de Ítems**: Los ítems de la tienda (`!tienda`) ahora se activan automáticamente al comprarlos.
    - **Ítems de Tiempo:** Pico, Cebo, Escudo y Guardaespalda activan beneficios por 2 horas.
    - **Pociones/Frutas:** Se consumen inmediatamente otorgando XP o efectos aleatorios (títulos, dinero).
- **Media Search V2 (Jikan Integration)**: Mejorados los comandos `!anime` y `!manga`.
    - **Híbrido Manga:** `!manga` busca primero en el catálogo local y, si no existe, busca en la base de datos mundial de MyAnimeList.
    - **Formatos Enriquecidos:** Resultados con géneros, estudios, autores, puntuaciones y links directos.
- **Seguridad en DB**: Implementada columna `prestigio` y temporizadores de ítems en Turso.

### Correcciones de Estabilidad y Variedad (2026-02-26 21:25)
- **Equilibrio en Duelos (`!duelo`)**: Se randomizó el atacante inicial y se corrigió la lógica de victoria para evitar que el iniciador gane siempre por ventaja de turno.
- **Variedad en Trivia (`!bandera`)**: Eliminada la lógica que priorizaba países con nombres largos (70% de probabilidad). Ahora la selección es 100% aleatoria para evitar repeticiones constantes.
- **Restauración de Comandos Fun**: Implementados los comandos que faltaban en `fun.js` (`!8ball`, `!dado`, `!moneda`, `!ship`, `!love`, `!gay`, `!iq`, `!suerte`, `!horoscopo`, `!ppt`).

### Expansión de Clases y Corrección de Perfil (2026-02-26 21:30)
- **Nuevas Clases Añadidas**: Implementadas 4 nuevas profesiones en `!clase`:
    - **Minero**: +15% de monedas en `!minar`.
    - **Guerrero**: +10% de daño en `!duelo`.
    - **Mercader**: +20% de probabilidad de ganar en subastas.
    - **Sacerdote**: Multiplicador de XP x1.5 permanente en todos los comandos.
- **Corrección de Perfil (`!perfil`)**: Se corrigió el error donde el Rango de Prestigio no aparecía. Ahora se muestra claramente el nivel de prestigio y el multiplicador de monedas actual.
- **Sincronización de XP**: La lógica de la DB ahora reconoce el bono de clase del Sacerdote al ganar XP.

### Reforma de Mecánicas en Banderas (2026-02-26 21:35)
- **Nuevo Modificador en `!bandera`**: Se eliminó el sistema de 3 vidas.
    - **Muerte Súbita**: Una respuesta incorrecta ahora resulta en la pérdida inmediata del juego y la apuesta.
    - **Límite de Tiempo**: Se implementó un temporizador estricto de **1 minuto**. Si el usuario no responde en ese tiempo, el bot cancela el juego y el usuario pierde su apuesta automáticamente.
- **Sincronización de Temporizadores**: Se añadió lógica para limpiar los procesos de fondo una vez que el usuario responde, optimizando el uso de memoria.

### Ajuste de Dificultad: Prestigio Escalonado (2026-02-26 21:55)
- **Escalamiento de Prestigio**: Se modificó el comando `!prestigio` para que el requisito de nivel aumente en **+500 niveles** por cada ascenso.
    - **Nivel 500**: Requerido para Prestigio 1.
    - **Nivel 1000**: Requerido para Prestigio 2.
    - **Nivel 1500**: Requerido para Prestigio 3 (y así sucesivamente).
- **Interfaz de Prestigio**: El mensaje de advertencia ahora muestra dinámicamente cuántos niveles le faltan al usuario basándose en su rango actual.

### Megay-Expansión de Tienda y Sistema Alfabético (2026-02-26 22:35)
- **Tienda DIKY V3**: Añadidos nuevos objetos:
    - **🧭 Brújula del Destino**: Otorga suerte extra en exploraciones.
    - **🍀 Poción de Suerte**: Aumenta el multiplicador de premios en juegos por 2h.
    - **✨ Fragmento Estelar**: Objeto de colección rarísimo para futuras actualizaciones.
- **Poderes de la Fruta del Diablo**: Implementada una lista masiva de efectos (titles de fuego/hielo/rayo, grandes sumas de dinero y XP, pero también efectos negativos por "fruta podrida").
- **Grimorio de Diky (Reforma Mítica)**: Ahora el grimorio es un ítem de "Un solo uso" extremadamente poderoso que puede:
    - Ganar **100,000 dikys** de golpe.
    - Subir **+50 niveles** y **+1 Prestigio** instantáneamente.
    - Otorgar títulos ancestrales como "Archimaggo Supremo".
- **Sistema de Banderas Alfabético**: Para eliminar la repetición, la trivia ahora sigue un ciclo estricto de la **A a la Z**. Cada vez que se usa el comando, el bot busca un lugar que empiece por la siguiente letra del alfabeto, reiniciándose al llegar a la Z.

### Restauración Masiva de Geografía y Reforma de Media (2026-02-27)
- **Base de Datos Masiva (`triviaData.js`)**: Restaurados los **196 países del mundo** con sus respectivas banderas y pistas personalizadas.
    - **Expansión de Categorías**: Añadidas 19 nuevas provincias/estados y 19 capitales complejas.
    - **Sistema Alfabético**: La trivia ahora sigue un ciclo de la **A a la Z** para evitar repeticiones.
- **Corrección de Pinterest (`!pinterest`)**: Implementado sistema de manejo de errores y servicio de respaldo (Fallback) con Pollinations AI.

### Integración Global de IA y Mejoras de Estabilidad (2026-02-27 Final)
- **🧠 Nueva IA: Liquid AI LFM 2.5 (1.2B Thinking)**: 
    - Migración total a OpenRouter para usar modelos de "pensamiento".
    - **Detección Universal:** El bot ahora responde a **todos los usuarios** por nombre ("Diky"), tag (@bot) o Reply.
    - **Filtro de Mensajes:** La IA solo procesa texto, ignorando multimedia para ahorrar recursos.
- **🛡️ Sistema de Resiliencia de IA**:
    - **Rotación de Llaves:** Soporte para múltiples API Keys separadas por coma.
    - **Fallback a Gemini:** Respaldo automático a **Gemini 1.5 Flash** si falla OpenRouter.
- **🖼️ Solución a errores visuales**: 
    - **Fix "Borde Rojo":** Descarga automática a buffer para `!pinterest` y `!waifu`.
    - **Búsqueda Multi-palabra:** Pinterest ahora detecta frases completas separadas por comas.
- **📦 Documento Maestro de Configuración**: Creado `CONFIGURACION_RENDER.md` como respaldo crítico de credenciales.
### Parche v11.1: Estabilización de Manga y Casino (2026-02-27)
- **Corrección de Catálogo de Mangas**: 
    - Corregida la ruta de `mangas.json` (estaba apuntando a una carpeta inexistente).
    - Arreglada la propiedad `.resumen` que causaba que las descripciones locales no se mostraran.
    - Soporte para portadas automáticas (`portada.png`) en el comando `!manga`.
    - Comando `!leer` mejorado con soporte para `.png`, `.webp` y un orden alfanumérico estricto.
- **Seguridad y Balance en !minas**:
    - **Bloqueo de Intrusos:** Ahora solo el usuario que inicia el juego puede enviar números.
    - **Ajuste de Bombas:** Reducido de 5 a 3 bombas. El juego ahora es matemáticamente ganable (antes era imposible ganar).
- **Nuevo Comando !sincronizar**: Permite al Administrador Maestro sincronizar manualmente el archivo JSON con la base de datos Turso Cloud.

### Optimización Crítica de Rendimiento (2026-03-05)
- **Procesamiento de Mensajes Concurrente**: Eliminada la ejecución secuencial. El bot ahora procesa mensajes en paralelo, evitando que comandos pesados (IA) bloqueen el resto del chat.
- **Eficiencia en Turso Cloud**: Implementada recuperación de claves de sesión por lotes (`getAuthKeys`). Reduce las llamadas a la red durante el inicio y la reconexión.
- **Caché Inteligente de Grupos**: Sistema de caché con TTL de 5 min para configuraciones de grupo y administradores, minimizando consultas a la base de datos.
- **Acciones No Bloqueantes**: Los logs de estadísticas y registros de racha ahora se ejecutan en segundo plano (sin `await` innecesario) para acelerar la respuesta al usuario.
- **Throttling de IA**: Control de concurrencia para evitar saturar las APIs de OpenRouter/Gemini.

### Reforma de Perfil: Enfoque en Waifus (2026-03-11)
- **Limpieza de Perfil (`!perfil`)**: 
    - Se eliminó la sección de **"Últimas Actividades"** (historial de pescas/cazas) para un diseño más limpio.
    - Se mantuvo la **"Mejor Pesca"** como récord personal.
- **Integración de Top Waifu**: 
    - Añadida sección **"👑 Top 1 Waifu"** en el perfil, que muestra automáticamente la primera waifu de la lista personalizada del usuario (`!waifus top`).
- **Sincronización de Inventario**: La lógica del perfil ahora parsea el inventario en tiempo real para extraer el ranking de waifus.

---
*Documento actualizado por Antigravity (IA) — 2026-03-11 17:27 EST*
