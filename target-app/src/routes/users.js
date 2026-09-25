const express = require('express');
const _ = require('lodash');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, email FROM users').all();
  res.json(users.map((u) => _.pick(u, ['id', 'name', 'email'])));
});

// VULNERABLE: builds the query by concatenating the raw param instead of using
// a bound parameter, so this is a classic SQL injection (e.g. GET /api/users/1%20OR%201=1).
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const query = `SELECT id, name, email FROM users WHERE id = ${id}`;
  const user = db.prepare(query).get();

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

module.exports = router;
