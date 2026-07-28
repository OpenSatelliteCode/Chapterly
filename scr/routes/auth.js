const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.render('register', { error: 'Llena todos los campos.' });
  }
  if (password.length < 6) {
    return res.render('register', { error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.render('register', { error: 'Ese usuario o correo ya está en uso.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, hash]
    );

    req.session.userId = result.rows[0].id;
    req.session.username = result.rows[0].username;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Algo salió mal. Intenta de nuevo.' });
  }
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.render('login', { error: 'Correo o contraseña incorrectos.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Algo salió mal. Intenta de nuevo.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
