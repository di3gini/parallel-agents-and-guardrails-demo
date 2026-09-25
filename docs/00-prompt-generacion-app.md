# Prompt usado para generar `target-app/`

Este documento reproduce, tal cual, el encargo que dio origen a la app objetivo
(`target-app/`) que los agentes de la Fase 1 analizan. Se incluye para mostrar,
durante la charla, que el ciclo completo (prompt → código → análisis
multi-agente) arranca también en un prompt, no en código escrito a mano.

---

> Generá una app pequeña en Node.js + Express con una base de datos SQLite
> local (usá better-sqlite3 o similar, sin dependencias externas de red). Debe
> ser lo bastante simple para explicarse en 1 minuto en una charla, pero con 3
> PROBLEMAS INTENCIONALES, uno por cada agente que vamos a construir después:
>
> 1. Problema de seguridad, dos variantes para que Snyk tenga algo real que
>    encontrar:
>    - Una query SQL armada por concatenación de strings (inyección SQL) en
>      al menos un endpoint.
>    - Una dependencia npm deliberadamente desactualizada con una
>      vulnerabilidad conocida (por ejemplo una versión vieja de lodash o
>      axios con CVE conocido) — así `snyk test` (análisis de dependencias)
>      encuentra algo real y no solo `snyk code test` (análisis estático).
>    - Opcional: una API key o secreto hardcodeado en el código (para que
>      `snyk code test` también lo marque).
>
> 2. Problema de rendimiento: un endpoint con un patrón N+1 (obtiene una
>    lista y luego hace una query individual por cada elemento en un loop) en
>    vez de una sola query con JOIN.
>
> 3. Problema de calidad/documentación: al menos una función pública sin
>    comentarios/JSDoc, sin manejo de errores, y sin ningún test asociado (el
>    proyecto no debe tener tests para esta función en particular).

---

## Cómo se resolvió cada punto en el código

| Problema | Ubicación | Detalle |
|---|---|---|
| SQL injection | `src/routes/users.js` → `GET /api/users/:id` | El `id` de la URL se concatena directo en el string de la query, sin `?`/parámetro. |
| Dependencia vulnerable | `package.json` → `lodash@4.17.4` | Versión fijada (sin `^`) con CVEs conocidos de prototype pollution, para que `snyk test` encuentre algo real y estable en el tiempo. |
| Secreto hardcodeado | `src/config.js` → `STRIPE_SECRET_KEY` | Constante hardcodeada en el código fuente (clave falsa, formato realista) para que `snyk code test` la marque. |
| N+1 | `src/routes/posts.js` → `GET /api/posts` | Trae todos los posts y después hace un `SELECT` individual por cada `user_id` en un loop, en vez de un `JOIN`. |
| Calidad/documentación | `src/services/postService.js` → `createPost` | Sin JSDoc, sin manejo de errores (no captura el throw de la constraint de FK), y sin test asociado — el resto del proyecto sí tiene tests (`test/app.test.js`), pero no para esta función. |

La app queda committeada en el repo (no se regenera en cada corrida del demo)
para que la demo en vivo sea determinística.
