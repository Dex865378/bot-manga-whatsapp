# 📖 Documentación Oficial del Diky Bot

¡Bienvenido a la guía completa del Diky Bot! Este documento explica detalladamente cómo funcionan todos los comandos, qué recompensas existen y cómo progresar en el juego.

---

## 👤 1. Perfil y Personalización

El bot incluye un sistema de perfil expansivo donde los usuarios pueden tener títulos, niveles, prestigio, matrimonios, herramientas, historial de pesca y más.

* **`!perfil` o `!p`**: Muestra tu tarjeta de jugador con todas tus estadísticas, nivel, rango (ej. *Genin, Hokage, Deidad*), historial reciente y herramientas activas.
* **`!config <tipo> <valor>`**: Personaliza la información de tu perfil. Se aplican de inmediato en `!perfil`. Los tipos son:
  * `bio` o `descripcion` (ej. `!config bio Estudiando magia`)
  * `edad` (ej. `!config edad 20`)
  * `nombre` (para cambiar tu apodo visible)
  * `nacimiento` (ej. `!config nacimiento 30/05/2005`)
  * `altura` (ej. `!config altura 1.80m`)
  * `power` o `poder` (ej. `!config poder Kamehameha`)
  * `fav anime` o `fav manga` (ej. `!config fav manga One Piece`)

* **`!clase <nombre>`**: Elige una clase o profesión (Cuesta 20k Diky excepto la primera vez). Las clases dan bonificaciones:
  * `Cazador`: +20% recompensas en `!cazar`.
  * `Pescador`: +30% peso en los peces de `!pescar`.
  * `Minero`: +15% de suerte extra al `!minar`.
  * `Guerrero`: +10% de daño en `!duelo`.
  * `Apostador`: +15% en el premio de `!slot`.
  * `Empresario`: Diky extra (+1,000) en `!daily`.
  * `Hacker`: 10% de descuento en la `!tienda`.
  * `Sacerdote`: +50% XP extra en toda acción.
  * `Mercader`: +20% de chances secretas en las subastas.

---

## 💰 2. Economía y Nivel

Acumula `dikys` (la moneda oficial) y `XP` para subir de rango.

* **`!daily`**: Reclamas tu recompensa de oro diaria (cada 24h). (Da 5,000 Diky, u 6,000 si eres Empresario).
* **`!w` / `!slut`**: Trabajos rápidos para ganar un poco de dinero. (Rutinarios con *cooldowns*).
* **`!dar @usuario <monto>`**: Transfiere tus dikys a otro usuario (incluye un 8% de impuesto).
* **`!bounty @usuario <monto>`**: Pones precio a la cabeza de un usuario. Solo se puede hacer **una vez cada 24h**. Quien derrote al usuario marcado en un `!duelo` se lleva este dinero acumulado.
* **`!prestigio`**: Cuando alcanzas un nivel muy alto, puedes resetear tu nivel al Nivel 1 para ganar un multiplicador pasivo permanente al conseguir dikys (+10% por Prestigio) y un nuevo Título brillante (Cuesta dikys progresivamente).
* **`!canjear <monto>`**: Canjeas tus dikys sobrantes directamente por experiencia (Ratio 2 Dikys = 1 XP).
* **`!mejor`**: Muestra las tablas de clasificación de prestigio y dinero global (Top millonarios y niveles).

---

## 🎒 3. Inventario y Tienda

Absolutamente todo el bot está conectado. Necesitas comprar herramientas de la tienda para realizar exploraciones, y todo lo que consientres terminará en tu inventario con un **Límite de 10 acumulaciones** por objeto.

* **`!tienda`**: Ve el catálogo de objetos. Hay picos, cebos, lotería, objetos míticos, protección (Escudos y Guardaespaldas), anillos y **Pokebolas**.
* **`!comprar <numero>`**: Usa el número del objeto de la tienda para comprarlo. Todo lo comprado va al inventario o se activa como un límite de tiempo (ej. Pociones o Escudos por horas). 
* **`!inventario`**: Te muestra todo lo que tienes guardado (Herramientas, Minerales, Peces, Modificadores, Pokémon, etc).
* **`!vender <item> <cantidad>`** o **`!vender <item> todo`**: Te permite vender los ítems inútiles y las sobras del inventario. El bot ya conoce el valor real de cada objeto según su rareza (ej. un Megalodón vale 9,500 dikys y un Pez Payaso vale 30 dikys). Puedes vender varias unidades a la vez o usar "todo" para vaciar el stock de ese ítem.

*¿Cómo se consigue el poder oculto y los **Títulos Míticos**?*
Debes comprar y consumir una **Fruta del Diablo** (25k) o el **Grimorio Ancestral** (250k) en la `!tienda`. Tienen un factor de probabilidad inmenso: Pueden envenenarte, hacerte perder dinero, pero también **pueden otorgarte un Título Mítico único en tu `!perfil` y niveles ilimitados.**

---

## 🎮 4. Cacería, Pesca y Minería (Farmeo)
Requieren usar las herramientas de la tienda, ¡y todo te deja XP y botín!
*(NOTA: Si pescas, minas o cazas y ya tienes 10 veces exactamente el mismo espécimen en tu inventario, lo acabas vendiendo automáticamente por el doble del precio real como bonus pasivo).*

* **`!cazar`**: Puedes matar desde Jabalíes y Lobos, hasta Quimeras y Dragones si tienes suerte. Aparecen en el perfil como Últimas Actividades.
* **`!pescar`**: Requiere `Cebo` (`!comprar 2`). Mientras más grande y raro sea el pez, se **Actualizará Automáticamente tu Mejor Pesca (Récord de Peso)** en tu perfil para presumir a tus amigos. Va desde un pez payaso, hasta un Megalodón o un Cofre Hundido. 
* **`!minar`**: Requiere un `Pico` (`!comprar 1`). Minas un fragmento, de Piedra basura y metales preciosos (Diamante, Rubí) hasta Materia Oscura o Antimateria.
* **`!pokemon`**: ¡Debes tener **Pokebolas** para participar (`!comprar 14`)! Lanzas una Pokebola, gastas el ítem y atrapas aleatoriamente un Pokémon que se guarda directamente a tu `!inventario` y te genera un pequeño ingreso de dikys instantáneos. (¡Vender o subastar un Kyogre luego es fácil!).

---

## ⚔️ 5. Casino y Minijuegos Activos
Estos minijuegos no requieren herramientas, solo apostar dikys y depender de tu suerte y cerebro.

* **Juegos Clásicos**: `!slot <apuesta>`, `!ruleta <color>`, `!dado <numero> <apuesta>`, `!ppt <tu_eleccion>`.
* **`!carta`**: Apuestas si la siguiente carta será Mayor o Menor que la actual.
* **`!cofre`**: Eliges 1 de 3 cofres frente a ti esperando el premio y esquivando estar vacío.
* **`!donde`**: Radar localizador aleatorio por diversión.
* **`!bomba`**: ¿Cortar el cable verde o rojo? ¡Cortas el cable erróneo y mueres, cortas el correcto de los 4 y ganas!
* **`!bandera <país> <apuesta>`**: (Con multiplicador x1.2) Tienes que leer la descripción cultural enigmática sobre un país y adivinar su nombre real antes que se corte el tiempo de la API de trivia.

### 🛡️ Los Duelos
* **`!duelo @usuario <monto>`**: Retas a otra persona por billetes. Sistema anti-spam habilitado con turnos interactivos simulados estilo rol. Durante un duelo alguien puede **perder su propio inventario/ítems aleatorios**.
Si tu oponente tiene "Recompensa" activa `(!bounty)`, el sistema **solo dejará atacarlo cada 1 HORA**. ¡Pero si matas al usuario que tiene una recompensa de dinero encima, te lo quedas TODO!

---

## ⚖️ 6. Mercado Negro y Subastas Multijugador
El módulo de capitalismo entre usuarios. 

* **`!subastar <nombre del objeto> <dinero inicial>`**: Pones a la venta en tiempo real cualquier objeto que poseas en tu `!inventario`. ¡La lectura ahora es *aproximada*! Si tienes `Pokemon: Lucario 👊` basta con poner `!subastar lucario 500` y el bot lo detectará. Le dará una dura de 1 HORA.
* **`!ofertar <ID de Subasta> <monto a pujar>`**: Superar la actual puja de subasta con el dinero a la mano. ¡El mejor postor cuando termine lo ganará en su inventario para siempre!
* **`!subastas`**: Podrás escanear cómo van las guerras de mercado y su tiempo restante.

---

## 💖 7. Matrimonio Virtual
* **`!marry @usuario`**: ¡Necesitas un `Anillo de Bodas` comprándolo muy caro en la tienda (`!comprar 9`)! Se empaqueta un compromiso local entre usuarios. Aparecerán oficialmente vinculados con un enlace rojo en su `!perfil`. 
* **`!divorce`**: Terminación unilateral de la relación digital (sin costo).
