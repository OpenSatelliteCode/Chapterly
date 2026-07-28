const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/u/:username', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id, username, bio, created_at FROM users WHERE username = $1', [req.params.username]);
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

module.exports = router;
