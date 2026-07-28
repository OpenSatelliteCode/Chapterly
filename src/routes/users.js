const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/u/:username', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, username, bio, avatar_url, created_at FROM users WHERE username = $1', [req.params.username]);
    if (!userRes.rows.length) return res.status(404).send('Usuario no encontrado.');
    const profileUser = userRes.rows[0];

    const books = await pool.query(`
      SELECT b.id, b.title, b.synopsis, c.name AS category_name
      FROM books b
      LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.author_id = $1
      ORDER BY b.created_at DESC
    `, [profileUser.id]);

    res.render('profile', { profileUser, books: books.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando el perfil.');
  }
});

router.get('/settings', requireAuth, async (req, res) => {
  const userRes = await pool.query('SELECT bio, avatar_url FROM users WHERE id = $1', [req.session.userId]);
  res.render('settings', { profile: userRes.rows[0], error: null, success: false });
});

router.post('/settings', requireAuth, async (req, res) => {
  const { bio, avatar_url } = req.body;

  try {
    await pool.query(
      'UPDATE users SET bio = $1, avatar_url = $2 WHERE id = $3',
      [bio || '', avatar_url || '', req.session.userId]
    );
    req.session.avatarUrl = avatar_url || '';
    res.render('settings', { profile: { bio, avatar_url }, error: null, success: true });
  } catch (err) {
    console.error(err);
    const userRes = await pool.query('SELECT bio, avatar_url FROM users WHERE id = $1', [req.session.userId]);
    res.render('settings', { profile: userRes.rows[0], error: 'Algo salió mal al guardar.', success: false });
  }
});

module.exports = router;
