# Reporte de Performance — target-app

## Resumen

La app es un CRUD simple de usuarios/posts sobre `better-sqlite3` (driver **síncrono**, bloquea el event loop en cada consulta). El hallazgo más grave es un patrón **N+1** claro en el listado de posts; a esto se suma que ninguna consulta usa *prepared statements* cacheados, generando overhead de parseo repetido en cada request. El volumen de datos actual es mínimo (demo), pero los patrones no escalan.

## Hallazgos (priorizados por impacto)

### 1. [Alto] N+1 queries al listar posts — `target-app/src/routes/posts.js:9-18`
```js
const posts = db.prepare('SELECT id, user_id, title, body, created_at FROM posts').all();
const postsWithAuthor = posts.map((post) => {
  const author = db.prepare('SELECT name FROM users WHERE id = ?').get(post.user_id);
  return { ...post, author: author ? author.name : null };
});
```
**Problema:** por cada post se ejecuta una query adicional para traer el autor. Con N posts esto son N+1 round-trips a la base en vez de 1. Como `better-sqlite3` es síncrono, cada `.get()` bloquea el event loop, así que el costo no solo es de I/O sino de tiempo de CPU/event-loop acumulado proporcional a N. Con una tabla de posts grande (miles de filas) esto degrada linealmente y bloquea el servidor para *todas* las requests concurrentes mientras se resuelve.

**Impacto estimado:** alto — es el endpoint de listado más probable de recibir tráfico, y el costo crece linealmente con la cantidad de posts, sin caching de statement.

**Sugerencia:** reemplazar por un único `JOIN`:
```sql
SELECT p.id, p.user_id, p.title, p.body, p.created_at, u.name AS author
FROM posts p LEFT JOIN users u ON u.id = p.user_id
```
Esto reduce todo el endpoint a una sola query, sin necesidad de mapear en JS.

### 2. [Medio-Alto] Uso de driver 100% síncrono en todos los endpoints — `target-app/src/db.js`, `target-app/src/routes/*.js`, `target-app/src/services/postService.js`
**Problema:** `better-sqlite3` ejecuta todas las operaciones (`.get()`, `.all()`, `.run()`, `.exec()`) de forma **síncrona y bloqueante** sobre el event loop de Node. No es un bug puntual sino la naturaleza de la librería: mientras una query corre, el proceso no puede atender ninguna otra request entrante. Combinado con el N+1 del punto anterior, cualquier pico de tamaño en `posts` bloquea el servidor entero para todos los clientes concurrentes, no solo para quien pidió el listado.

**Impacto estimado:** alto en escenarios de carga concurrente o datasets grandes; bajo en el estado actual (dataset de demo, tráfico bajo). Es un riesgo de escalabilidad más que un bug inmediato.

**Sugerencia:** si se espera crecer en volumen/concurrencia, migrar a un driver async (p. ej. `better-sqlite3` con un worker pool, o pasar a Postgres/MySQL con un cliente async), y en el corto plazo al menos eliminar los N+1 para minimizar el tiempo total bloqueado por request.

### 3. [Medio] Prepared statements no cacheados / re-preparados en cada request — `target-app/src/routes/users.js:8,16-17`, `target-app/src/routes/posts.js:10,13`, `target-app/src/services/postService.js:4,8`
**Problema:** en todos los handlers se llama a `db.prepare(...)` dentro de la función de request, en vez de preparar el statement una sola vez a nivel de módulo y reutilizarlo. `better-sqlite3` cachea internamente por objeto `Statement`, no por texto de query, así que `db.prepare()` repetido implica re-parsear y re-compilar el SQL en cada llamada. En `posts.js:13` esto ocurre además dentro del loop N+1 (punto 1), multiplicando el costo.

**Impacto estimado:** medio — overhead de CPU pequeño por request individualmente, pero se suma en cada endpoint y se agrava en el loop N+1.

**Sugerencia:** mover los `db.prepare(...)` fuera de los handlers, a nivel de módulo (ejecutados una sola vez al arrancar), y reutilizar el objeto `Statement` con `.get()/.all()/.run()` dentro del handler.

### 4. [Bajo] `_.pick` redundante sobre columnas ya proyectadas — `target-app/src/routes/users.js:7-10`
```js
const users = db.prepare('SELECT id, name, email FROM users').all();
res.json(users.map((u) => _.pick(u, ['id', 'name', 'email'])));
```
**Problema:** el `SELECT` ya trae exactamente las columnas `id, name, email`; pasar cada fila por `_.pick` (que crea un objeto nuevo, iterando claves) es trabajo redundante por cada fila, sin beneficio funcional. Con listados grandes de usuarios esto es un recorrido extra O(N) innecesario en JS.

**Impacto estimado:** bajo (dataset chico), pero es trabajo puramente desperdiciado que crece con N.

**Sugerencia:** eliminar el `.map(_.pick(...))` y devolver `users` directamente, ya que la proyección SQL cumple esa función.

### 5. [Bajo] Round-trip extra tras el INSERT — `target-app/src/services/postService.js:7-8`
```js
const result = stmt.run(userId, title, body, new Date().toISOString());
return db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
```
**Problema:** todos los valores del post recién creado (`userId`, `title`, `body`, `created_at`, y el `id` vía `lastInsertRowid`) ya se conocen en memoria antes del INSERT; no hay columnas generadas por la base (como triggers o defaults) que justifiquen releerlo. La segunda consulta es un round-trip evitable.

**Impacto estimado:** bajo (una sola query extra por creación de post, endpoint de baja frecuencia relativa), pero es fácil de eliminar.

**Sugerencia:** construir el objeto de respuesta directamente con los valores ya disponibles (`{ id: result.lastInsertRowid, user_id: userId, title, body, created_at }`), evitando la segunda query salvo que se agreguen columnas calculadas por la DB en el futuro.

## Nota fuera de alcance
`target-app/src/routes/users.js:14-17` concatena el parámetro `id` directamente en el SQL (sin bind), lo cual es una vulnerabilidad de inyección SQL — está marcado en el propio código como intencional para la demo. No es un hallazgo de performance, pero se menciona porque además impide el cacheo del plan de consulta al variar el texto del SQL en cada request (ver hallazgo 3).
