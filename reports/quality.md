# Reporte de Calidad de Código — target-app

## Resumen
Se encontraron **9 hallazgos críticos y de alta prioridad**: una vulnerabilidad SQL injection sin defensa, ausencia generalizada de manejo de errores en operaciones de BD, falta de validación de entrada en endpoints POST, y cobertura de tests incompleta que deja sin probar los endpoints más riesgosos.

---

## Hallazgos por Prioridad

### 🔴 CRÍTICO — Seguridad

#### 1. **target-app/src/routes/users.js:16** — SQL Injection en GET /:id
- **Qué falta:** Uso de parámetros enlazados en la consulta SQL.
- **Código problemático:**
  ```javascript
  const query = `SELECT id, name, email FROM users WHERE id = ${id}`;
  const user = db.prepare(query).get();
  ```
- **Por qué importa:** Un atacante puede inyectar SQL arbitrario (ej. `GET /api/users/1 OR 1=1`) para bypassear validaciones, extraer datos o modificar la BD. Es una vulnerabilidad CVSS 7.5+.
- **Sugerencia:** Cambiar a:
  ```javascript
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
  ```
- **Nota:** El comentario en línea 12-13 ya lo reconoce como vulnerable.

---

### 🔴 ALTO — Manejo de Errores en BD

#### 2. **target-app/src/db.js:5-6** — Sin manejo de errores en inicialización
- **Qué falta:** Try-catch o validación en `new Database(DB_PATH)`.
- **Código problemático:**
  ```javascript
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  ```
- **Por qué importa:** Si el archivo `data.db` está corrupto, o no hay permisos de escritura en el directorio, la aplicación falla silenciosamente en startup sin mensaje claro. Imposible diagnosticar.
- **Sugerencia:** Envolver en try-catch y loguear:
  ```javascript
  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  } catch (err) {
    console.error(`Failed to initialize database at ${DB_PATH}:`, err.message);
    process.exit(1);
  }
  ```

#### 3. **target-app/src/routes/users.js:7-10** — Sin manejo de errores en GET /
- **Qué falta:** Try-catch en `db.prepare().all()`.
- **Código problemático:**
  ```javascript
  const users = db.prepare('SELECT id, name, email FROM users').all();
  ```
- **Por qué importa:** Error de BD (corrupción, timeout, lock) causa crash no controlado que retorna 500 sin contexto en lugar de un mensaje de error legible.
- **Sugerencia:**
  ```javascript
  try {
    const users = db.prepare('SELECT id, name, email FROM users').all();
    res.json(users.map((u) => _.pick(u, ['id', 'name', 'email'])));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
  ```

#### 4. **target-app/src/routes/users.js:14-24** — Sin manejo de errores en GET /:id
- **Qué falta:** Try-catch en `db.prepare().get()`.
- **Código problemático:**
  ```javascript
  const user = db.prepare(query).get();
  ```
- **Por qué importa:** Error de BD no capturado causa crash. Además, combinado con SQL injection, es crítico.
- **Sugerencia:** Agregar try-catch después de reparar la SQL injection.

#### 5. **target-app/src/routes/posts.js:9-18** — Sin manejo de errores en GET /
- **Qué falta:** Try-catch en `db.prepare().all()` (línea 10) y en el loop de `db.prepare().get()` (línea 13).
- **Código problemático:**
  ```javascript
  const posts = db.prepare('SELECT id, user_id, title, body, created_at FROM posts').all();
  const postsWithAuthor = posts.map((post) => {
    const author = db.prepare('SELECT name FROM users WHERE id = ?').get(post.user_id);
    return { ...post, author: author ? author.name : null };
  });
  ```
- **Por qué importa:** Error de BD en cualquier momento detiene la respuesta sin notificación al cliente.
- **Sugerencia:** Envolver ambos en try-catch.

#### 6. **target-app/src/routes/posts.js:20-24** — Sin validación ni manejo de errores en POST /
- **Qué falta:** Validación de `userId`, `title`, `body` y try-catch en `createPost()`.
- **Código problemático:**
  ```javascript
  router.post('/', (req, res) => {
    const { userId, title, body } = req.body;
    const post = createPost(userId, title, body);
    res.status(201).json(post);
  });
  ```
- **Por qué importa:** Si `userId` no existe en BD, o `title`/`body` son null/undefined, `createPost()` falla sin captura. Si userId no es número, se inserta un valor inválido.
- **Sugerencia:** Validar entrada y envolver `createPost()` en try-catch:
  ```javascript
  router.post('/', (req, res) => {
    const { userId, title, body } = req.body;
    if (typeof userId !== 'number' || !title || !body) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    try {
      const post = createPost(userId, title, body);
      res.status(201).json(post);
    } catch (err) {
      console.error('Error creating post:', err);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });
  ```

#### 7. **target-app/src/services/postService.js:3-9** — Sin documentación, validación ni manejo de errores
- **Qué falta:** JSDoc, validación de parámetros, try-catch.
- **Código problemático:**
  ```javascript
  function createPost(userId, title, body) {
    const stmt = db.prepare(
      'INSERT INTO posts (user_id, title, body, created_at) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(userId, title, body, new Date().toISOString());
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  }
  ```
- **Por qué importa:** 
  - Sin documentación, otros desarrolladores no saben qué retorna o qué parámetros espera.
  - `stmt.run()` puede fallar si userId no existe en BD (constraint violation).
  - `db.prepare().get()` puede fallar por error de BD.
  - Sin validación, userId puede ser null/undefined/string.
- **Sugerencia:**
  ```javascript
  /**
   * Creates a new post for a user.
   * @param {number} userId - The ID of the user creating the post
   * @param {string} title - The post title (required, non-empty)
   * @param {string} body - The post body (required, non-empty)
   * @returns {Object} The created post with id, user_id, title, body, created_at
   * @throws {Error} If userId doesn't exist, or title/body are invalid
   */
  function createPost(userId, title, body) {
    if (typeof userId !== 'number' || userId <= 0) {
      throw new Error('Invalid userId');
    }
    if (typeof title !== 'string' || !title.trim()) {
      throw new Error('Title is required');
    }
    if (typeof body !== 'string' || !body.trim()) {
      throw new Error('Body is required');
    }
    const stmt = db.prepare(
      'INSERT INTO posts (user_id, title, body, created_at) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(userId, title, body, new Date().toISOString());
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  }
  ```

#### 8. **target-app/scripts/seed.js:3-44** — Sin manejo de errores en seed
- **Qué falta:** Try-catch en `db.exec()` (línea 3) y en loops de `insertUser.run()` / `insertPost.run()` (líneas 41-42).
- **Código problemático:**
  ```javascript
  db.exec(`DROP TABLE IF EXISTS ...`);
  for (const u of users) insertUser.run(...u);
  ```
- **Por qué importa:** Si la creación de tablas falla, o un INSERT falla (ej. por constraint), el script termina sin mensaje claro. El test es imposible de debuggear.
- **Sugerencia:**
  ```javascript
  try {
    db.exec(`DROP TABLE IF EXISTS ...`);
  } catch (err) {
    console.error('Failed to create tables:', err.message);
    process.exit(1);
  }
  try {
    for (const u of users) insertUser.run(...u);
  } catch (err) {
    console.error('Failed to insert users:', err.message);
    process.exit(1);
  }
  ```

---

### 🟡 ALTO — Cobertura de Tests

#### 9. **target-app/test/app.test.js** — Pruebas incompletas, endpoints críticos sin cobertura
- **Qué falta:** 
  - Tests para `GET /api/users/:id` (el endpoint con SQL injection).
  - Tests para `POST /api/posts`.
  - Tests para `postService.createPost()` unitarios.
  - Tests para casos de error (usuario no encontrado, datos inválidos, BD inaccessible).
  - Tests de validación de entrada.
- **Código problema:** El archivo solo tiene 2 tests (líneas 25-41):
  ```javascript
  test('GET /api/users returns the seeded users', async () => { ... });
  test('GET /api/posts attaches the author name to each post', async () => { ... });
  ```
- **Por qué importa:** Sin tests para el endpoint vulnerable (GET /:id) y para creación (POST /), los bugs en validación y manejo de errores no se detectan. Tests de error son esenciales para confianza en BD.
- **Sugerencia:** Agregar:
  ```javascript
  test('GET /api/users/:id returns a single user', async () => {
    const res = await fetch(`${baseUrl}/api/users/1`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.id, 1);
  });

  test('GET /api/users/:id returns 404 for nonexistent user', async () => {
    const res = await fetch(`${baseUrl}/api/users/999`);
    assert.equal(res.status, 404);
  });

  test('POST /api/posts creates a post', async () => {
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1, title: 'Test', body: 'Test body' }),
    });
    assert.equal(res.status, 201);
  });

  test('POST /api/posts returns 400 for invalid input', async () => {
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'invalid', title: '', body: null }),
    });
    assert.equal(res.status, 400);
  });
  ```

---

## Resumen de Riesgo

| Riesgo | Archivos | Hallazgos |
|--------|----------|-----------|
| **SQL Injection** | users.js | 1 |
| **Falta manejo de errores BD** | db.js, users.js, posts.js, postService.js, seed.js | 5 |
| **Falta validación de entrada** | posts.js, postService.js | 2 |
| **Falta documentación** | postService.js | 1 |
| **Tests incompletos** | app.test.js | 1 |

**Total: 10 hallazgos**, siendo 1 **crítico** (SQL injection), 6 **altos** (errores BD + validación), y 3 **medios** (documentación + tests).
