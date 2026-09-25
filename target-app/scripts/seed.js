const db = require('../src/db');

db.exec(`
  DROP TABLE IF EXISTS posts;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL
  );

  CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const insertUser = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
const insertPost = db.prepare(
  'INSERT INTO posts (id, user_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)'
);

const users = [
  [1, 'Ada Lovelace', 'ada@example.com'],
  [2, 'Alan Turing', 'alan@example.com'],
  [3, 'Grace Hopper', 'grace@example.com'],
];

const posts = [
  [1, 1, 'Analytical Engine notes', 'Some early thoughts on programmable machines.', '2024-01-10T09:00:00.000Z'],
  [2, 1, 'On loops and conditionals', 'Sketching what a subroutine could look like.', '2024-01-12T10:30:00.000Z'],
  [3, 2, 'Computable numbers', 'Draft on the halting problem.', '2024-02-01T08:15:00.000Z'],
  [4, 3, 'Compiler design ideas', 'A translator from human-readable code to machine code.', '2024-03-05T14:00:00.000Z'],
  [5, 3, 'On debugging', 'Where the term "bug" really comes from.', '2024-03-06T11:45:00.000Z'],
];

for (const u of users) insertUser.run(...u);
for (const p of posts) insertPost.run(...p);

console.log(`Seeded ${users.length} users and ${posts.length} posts into data.db`);
