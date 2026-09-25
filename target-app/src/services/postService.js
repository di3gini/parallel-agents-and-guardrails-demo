const db = require('../db');

function createPost(userId, title, body) {
  const stmt = db.prepare(
    'INSERT INTO posts (user_id, title, body, created_at) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(userId, title, body, new Date().toISOString());
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
}

module.exports = { createPost };
