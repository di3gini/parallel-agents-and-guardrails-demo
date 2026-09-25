const express = require('express');
const db = require('../db');
const { createPost } = require('../services/postService');

const router = express.Router();

// PERFORMANCE ISSUE (N+1): fetches all posts and then queries the author
// individually for each one in a loop, instead of a single JOIN.
router.get('/', (req, res) => {
  const posts = db.prepare('SELECT id, user_id, title, body, created_at FROM posts').all();

  const postsWithAuthor = posts.map((post) => {
    const author = db.prepare('SELECT name FROM users WHERE id = ?').get(post.user_id);
    return { ...post, author: author ? author.name : null };
  });

  res.json(postsWithAuthor);
});

router.post('/', (req, res) => {
  const { userId, title, body } = req.body;
  const post = createPost(userId, title, body);
  res.status(201).json(post);
});

module.exports = router;
