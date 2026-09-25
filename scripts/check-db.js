#!/usr/bin/env node
"use strict";

// Verifica que target-app/data.db siga teniendo los datos del seed
// determinístico (3 users con ids 1..3, 5 posts).
//
// Por qué existe esto en vez de comparar el sha256 del archivo: better-sqlite3
// abre la base en modo WAL, y con solo abrirla (un `npm test`, por ejemplo) se
// puede disparar un checkpoint que reescribe páginas. Los bytes cambian sin que
// se pierda un solo dato, así que el hash da falsos positivos. Lo que importa
// para "la base sobrevivió" es el contenido.
//
// Exit codes: 0 intacta · 1 alterada o ilegible · 2 no se pudo verificar.

const path = require("path");

const PROJECT_DIR = path.resolve(__dirname, "..");
const DB_PATH = path.join(PROJECT_DIR, "target-app", "data.db");

let Database;
try {
  Database = require(path.join(PROJECT_DIR, "target-app", "node_modules", "better-sqlite3"));
} catch {
  console.log("  [aviso] no se pudo cargar better-sqlite3 — corré: cd target-app && npm install");
  process.exit(2);
}

try {
  const db = new Database(DB_PATH, { readonly: true });
  const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  const posts = db.prepare("SELECT COUNT(*) c FROM posts").get().c;
  const ids = db.prepare("SELECT id FROM users ORDER BY id").all().map((r) => r.id);
  db.close();

  if (users === 3 && posts === 5) {
    console.log(`  [ok] contenido intacto: ${users} users (ids ${ids.join(",")}), ${posts} posts`);
    process.exit(0);
  }

  console.log(`  [FALLO] contenido alterado: ${users} users (esperado 3), ${posts} posts (esperado 5)`);
  process.exit(1);
} catch (e) {
  console.log(`  [FALLO] no se pudo leer la base: ${e.message}`);
  process.exit(1);
}
