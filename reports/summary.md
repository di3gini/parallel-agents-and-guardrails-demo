# Resumen Ejecutivo — Análisis Consolidado target-app
**Fecha:** 2026-09-24

---

## Hallazgos Críticos (5 puntos priorizados)

1. **[CRÍTICO] SQL Injection en GET /api/users/:id** — *Calidad de Código*  
   El parámetro `id` se interpola directamente en el SQL sin parámetros enlazados (línea 16 de users.js). Permite inyección de queries arbitrarias. **Acción inmediata:** cambiar a `db.prepare('... WHERE id = ?').get(id)`.

2. **[CRÍTICO] 12 vulnerabilidades en lodash@4.17.4** — *Seguridad (SCA)*  
   7 HIGH (incluidas Arbitrary Code Injection CVSS 8.6 y Prototype Pollution) y 5 MEDIUM detectadas por Snyk. **Acción inmediata:** actualizar lodash a versión 4.18.1 o superior (cubre todos los fixes reportados).

3. **[ALTO] N+1 queries en listado de posts + ausencia de try-catch en todas las operaciones BD** — *Performance + Calidad*  
   El endpoint GET /api/posts ejecuta N+1 queries (1 SELECT posts + N SELECT author) bloqueando el event loop (better-sqlite3 es síncrono). Además, ningún endpoint tiene manejo de errores de BD. **Acción:** reemplazar por JOIN en posts.js:9-18 y envolver en try-catch (afecta db.js, users.js, posts.js, postService.js, seed.js).

4. **[ALTO] Driver síncrono (better-sqlite3) sin async/await** — *Performance*  
   Cada operación de BD bloquea el event loop de Node. En carga concurrente o con datasets grandes, todas las requests se cuelgan mientras se procesan queries. **Acción a mediano plazo:** migrar a driver async (p. ej. Postgres + async client) o usar worker pool; en corto plazo, al menos eliminar N+1.

5. **[ALTO] Cobertura de tests incompleta** — *Calidad*  
   Faltan tests para GET /api/users/:id (endpoint vulnerable), POST /api/posts, casos de error BD, y validación de entrada. Solo 2 tests existentes. **Acción:** agregar tests de cobertura para los 3 endpoints y casos de error (usuario no encontrado, datos inválidos).

---

## Conclusión

**Hay 2 bloqueantes críticos que deben resolverse antes de continuar en producción:**
- La SQL Injection en `/api/users/:id` debe parcharse inmediatamente (5 minutos de código).
- Las vulnerabilidades de lodash deben actualizarse (cambio de versión en package.json).

El N+1 y falta de manejo de errores en BD son de alta prioridad pero algo más tolerables en demo; sin embargo, con datos reales o tráfico concurrente, el servidor fallará silenciosamente o se colgará.
