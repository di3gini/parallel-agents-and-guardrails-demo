const express = require('express');
const { STRIPE_SECRET_KEY } = require('./src/config');
const usersRouter = require('./src/routes/users');
const postsRouter = require('./src/routes/posts');

const app = express();
app.use(express.json());

app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);

app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'target-app', billingConfigured: Boolean(STRIPE_SECRET_KEY) });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`target-app listening on port ${PORT}`));
}

module.exports = app;
