const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------- PORTADA ----------
router.get('/', (req, res) => {
  res.render('landing');
});

// ---------- EXPLORAR ----------
router.get('/explore', async (req, res) => {
  try {
    const categories = await pool.query('SELECT * FROM categories ORDER BY name');

    const { q, category } = req.query;
    let baseQuery = `
      SELECT b.id, b.title, b.synopsis, b.created_at,
             u.username AS author, c.name AS category_name
      FROM books b
      JOIN users u ON u.id = b.author_id
      LEFT JOIN categories c ON c.id = b.category_id
    `;
    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(b.title ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`c.name = $${params.length}`);
    }
    if (conditions.length) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }
    baseQuery += ' ORDER BY b.created_at DESC LIMIT 40';

    const books = await pool.query(baseQuery, params);

    let favoriteIds = [];
    if (req.session.userId) {
      const favs = await pool.query('SELECT book_id FROM favorites WHERE user_id = $1', [req.session.userId]);
      favoriteIds = favs.rows.map(r => r.book_id);
    }

    res.render('home', {
      books: books.rows,
      categories: categories.rows,
      favoriteIds,
      activeCategory: category || null,
      query: q || ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando la página.');
  }
});

// ---------- SUBIR LIBRO ----------
router.get('/upload', requireAuth, async (req, res) => {
  const categories = await pool.query('SELECT * FROM categories ORDER BY name');
  res.render('upload', { categories: categories.rows, error: null });
});

router.post('/upload', requireAuth, async (req, res) => {
  const { title, synopsis, category_id, chapter_title, chapter_content } = req.body;

  if (!title || !chapter_content) {
    const categories = await pool.query('SELECT * FROM categories ORDER BY name');
    return res.render('upload', { categories: categories.rows, error: 'Necesitas al menos un título y el contenido del primer capítulo.' });
  }

  try {
    const book = await pool.query(
      'INSERT INTO books (author_id, title, synopsis, category_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.session.userId, title, synopsis || '', category_id || null]
    );
    const bookId = book.rows[0].id;

    await pool.query(
      'INSERT INTO chapters (book_id, chapter_number, title, content) VALUES ($1, 1, $2, $3)',
      [bookId, chapter_title || 'Capítulo 1', chapter_content]
    );

    res.redirect(`/book/${bookId}`);
  } catch (err) {
    console.error(err);
    const categories = await pool.query('SELECT * FROM categories ORDER BY name');
    res.render('upload', { categories: categories.rows, error: 'Algo salió mal al publicar tu libro.' });
  }
});

// ---------- AGREGAR CAPÍTULO A LIBRO EXISTENTE ----------
router.post('/book/:id/chapter', requireAuth, async (req, res) => {
  const bookId = req.params.id;
  const { chapter_title, chapter_content } = req.body;

  try {
    const book = await pool.query('SELECT * FROM books WHERE id = $1 AND author_id = $2', [bookId, req.session.userId]);
    if (!book.rows.length) return res.status(403).send('No puedes editar este libro.');

    const countRes = await pool.query('SELECT COUNT(*) FROM chapters WHERE book_id = $1', [bookId]);
    const nextNum = parseInt(countRes.rows[0].count, 10) + 1;

    await pool.query(
      'INSERT INTO chapters (book_id, chapter_number, title, content) VALUES ($1, $2, $3, $4)',
      [bookId, nextNum, chapter_title || `Capítulo ${nextNum}`, chapter_content]
    );
    res.redirect(`/book/${bookId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error agregando capítulo.');
  }
});

// ---------- VER LIBRO ----------
router.get('/book/:id', async (req, res) => {
  try {
    const bookRes = await pool.query(`
      SELECT b.*, u.username AS author, u.id AS author_id, c.name AS category_name
      FROM books b
      JOIN users u ON u.id = b.author_id
      LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.id = $1
    `, [req.params.id]);

    if (!bookRes.rows.length) return res.status(404).send('Libro no encontrado.');
    const book = bookRes.rows[0];

    const chapters = await pool.query(
      'SELECT id, chapter_number, title FROM chapters WHERE book_id = $1 ORDER BY chapter_number',
      [req.params.id]
    );

    const comments = await pool.query(`
      SELECT cm.content, cm.created_at, u.username
      FROM comments cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.book_id = $1
      ORDER BY cm.created_at DESC
    `, [req.params.id]);

    let isFavorite = false;
    if (req.session.userId) {
      const fav = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND book_id = $2', [req.session.userId, req.params.id]);
      isFavorite = fav.rows.length > 0;
    }

    res.render('book', { book, chapters: chapters.rows, comments: comments.rows, isFavorite });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando el libro.');
  }
});

// ---------- LEER CAPÍTULO ----------
router.get('/book/:bookId/chapter/:chapterNum', async (req, res) => {
  try {
    const bookRes = await pool.query(`
      SELECT b.id, b.title, u.username AS author
      FROM books b JOIN users u ON u.id = b.author_id
      WHERE b.id = $1
    `, [req.params.bookId]);
    if (!bookRes.rows.length) return res.status(404).send('Libro no encontrado.');

    const chapterRes = await pool.query(
      'SELECT * FROM chapters WHERE book_id = $1 AND chapter_number = $2',
      [req.params.bookId, req.params.chapterNum]
    );
    if (!chapterRes.rows.length) return res.status(404).send('Capítulo no encontrado.');

    const allChapters = await pool.query(
      'SELECT chapter_number FROM chapters WHERE book_id = $1 ORDER BY chapter_number',
      [req.params.bookId]
    );
    const nums = allChapters.rows.map(r => r.chapter_number);
    const current = parseInt(req.params.chapterNum, 10);
    const prevNum = nums.includes(current - 1) ? current - 1 : null;
    const nextNum = nums.includes(current + 1) ? current + 1 : null;

    res.render('chapter', {
      book: bookRes.rows[0],
      chapter: chapterRes.rows[0],
      prevNum,
      nextNum
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error cargando el capítulo.');
  }
});

// ---------- FAVORITOS ----------
router.post('/book/:id/favorite', requireAuth, async (req, res) => {
  try {
    const exists = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND book_id = $2', [req.session.userId, req.params.id]);
    if (exists.rows.length) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND book_id = $2', [req.session.userId, req.params.id]);
    } else {
      await pool.query('INSERT INTO favorites (user_id, book_id) VALUES ($1, $2)', [req.session.userId, req.params.id]);
    }
    res.redirect(req.get('referer') || '/explore');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error actualizando favoritos.');
  }
});

router.get('/favorites', requireAuth, async (req, res) => {
  const books = await pool.query(`
    SELECT b.id, b.title, b.synopsis, u.username AS author, c.name AS category_name
    FROM favorites f
    JOIN books b ON b.id = f.book_id
    JOIN users u ON u.id = b.author_id
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `, [req.session.userId]);

  res.render('favorites', { books: books.rows });
});

// ---------- COMENTARIOS ----------
router.post('/book/:id/comment', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.redirect(`/book/${req.params.id}`);

  try {
    await pool.query(
      'INSERT INTO comments (book_id, user_id, content) VALUES ($1, $2, $3)',
      [req.params.id, req.session.userId, content.trim()]
    );
    res.redirect(`/book/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error publicando comentario.');
  }
});

// ---------- MI BIBLIOTECA ----------
router.get('/my-books', requireAuth, async (req, res) => {
  const books = await pool.query(`
    SELECT b.id, b.title, b.synopsis, c.name AS category_name,
           (SELECT COUNT(*) FROM chapters WHERE book_id = b.id) AS chapter_count
    FROM books b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.author_id = $1
    ORDER BY b.created_at DESC
  `, [req.session.userId]);

  res.render('my-books', { books: books.rows });
});

module.exports = router;
