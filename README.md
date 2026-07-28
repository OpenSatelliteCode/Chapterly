# Chapterly

Librería online donde cualquiera puede subir su libro, leer, comentar, buscar por categoría y guardar favoritos.

## Correrlo en tu computadora

1. Instala las dependencias:
   ```
   npm install
   ```

2. Necesitas una base de datos PostgreSQL. Si no tienes una local, la más fácil es crear una gratis en [Railway](https://railway.com) o usar [Neon](https://neon.tech).

3. Copia `.env.example` a `.env` y llena `DATABASE_URL` con la de tu base de datos:
   ```
   cp .env.example .env
   ```

4. Corre el servidor:
   ```
   npm start
   ```

5. Abre `http://localhost:3000` — el esquema de la base de datos se crea solo la primera vez que arranca.

## Subirlo a Railway

1. Sube este proyecto a un repositorio de GitHub (crea uno nuevo y haz push de esta carpeta).
2. En Railway, crea un nuevo proyecto → "Deploy from GitHub repo" → selecciona el repo.
3. Agrega un servicio de PostgreSQL al mismo proyecto (Railway → "New" → "Database" → "PostgreSQL"). Railway conecta automáticamente la variable `DATABASE_URL` si usas la referencia de variable `${{Postgres.DATABASE_URL}}` en el servicio de la app.
4. En las variables del servicio de la app, agrega `SESSION_SECRET` con cualquier texto random.
5. Railway va a detectar que es Node.js y correr `npm start` solo. Genera un dominio público desde la pestaña "Settings" del servicio.

## Estructura

- `src/server.js` — servidor Express
- `src/routes/` — rutas de auth, libros y perfiles
- `src/db.js` + `src/schema.sql` — conexión y esquema de base de datos
- `views/` — plantillas EJS
- `public/` — CSS y el logo
