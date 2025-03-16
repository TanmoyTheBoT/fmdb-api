require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const mysql = require('mysql2/promise');
const path = require('path');
const rateLimit = require('express-rate-limit');
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable JSON and URL-encoded body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --------------------- Database Connection ---------------------
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// --------------------- Nodemailer Setup ---------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // Your Gmail address
    pass: process.env.EMAIL_PASS    // Your App Password
  }
});

// --------------------- Registration Route ---------------------
// Since the frontend and server are on the same domain, no explicit CORS middleware is needed.
app.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, use_case } = req.body;

    if (!firstName || !lastName || !email || !use_case) {
      return res.status(400).json({ Response: "False", Error: "All fields are required." });
    }

    // Check if email is already registered
    const [existingUsers] = await pool.query("SELECT api_key FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ Response: "False", Error: "Email already registered. Check your email for your API key." });
    }

    // Generate API key
    const apiKey = crypto.randomBytes(16).toString("hex");

    // Insert user into the database
    await pool.query(
      "INSERT INTO users (first_name, last_name, email, api_key, use_case) VALUES (?, ?, ?, ?, ?)",
      [firstName, lastName, email, apiKey, use_case]
    );

    // Send API key via email
    await transporter.sendMail({
      from: `The FMDb API <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your FMDb API Key",
      text: `Hello ${firstName},\n\nYour API key is: ${apiKey}\n\nBest regards,\nThe FMDb Team`
    });

    res.json({ Response: "True", Message: "API key sent to your email!" });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ Response: "False", Error: "Internal server error" });
  }
});

// --------------------- Rate Limiter Configuration ---------------------
const rateLimitConfig = {
  free: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 1000,
    message: { Response: 'False', Error: 'Too many requests for free plan. Please try again later.' }
  },
  paid: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 10000,
    message: { Response: 'False', Error: 'Too many requests for paid plan. Please try again later.' }
  },
  admin: {
    windowMs: 24 * 60 * 60 * 1000,
    max: 100000,
    message: { Response: 'False', Error: 'Too many requests for admin plan. Please try again later.' }
  }
};

const rateLimiterInstances = {
  free: rateLimit({
    windowMs: rateLimitConfig.free.windowMs,
    max: rateLimitConfig.free.max,
    keyGenerator: (req) => req.query.apikey || req.ip,
    handler: (req, res) => {
      res.status(429).json(rateLimitConfig.free.message);
    }
  }),
  paid: rateLimit({
    windowMs: rateLimitConfig.paid.windowMs,
    max: rateLimitConfig.paid.max,
    keyGenerator: (req) => req.query.apikey || req.ip,
    handler: (req, res) => {
      res.status(429).json(rateLimitConfig.paid.message);
    }
  }),
  admin: rateLimit({
    windowMs: rateLimitConfig.admin.windowMs,
    max: rateLimitConfig.admin.max,
    keyGenerator: (req) => req.query.apikey || req.ip,
    handler: (req, res) => {
      res.status(429).json(rateLimitConfig.admin.message);
    }
  })
};

const rateLimiterByRole = (req, res, next) => {
  const limiter = rateLimiterInstances[req.role] || rateLimiterInstances.free;
  return limiter(req, res, next);
};

// --------------------- Configuration Manager ---------------------
const config = {
  pagination: {
    resultsPerPage: 10,
    maxPage: 100
  },
  endpoints: {
    imdbLookup: {
      roles: {
        free: { fields: ['imdb_id', 'title', 'release_year', 'type', 'poster'] },
        paid: { fields: ['imdb_id', 'title', 'release_year', 'type', 'poster', 'genres', 'director'] },
        admin: { fields: ['*'] }
      }
    },
    titleSearch: {
      roles: {
        free: { fields: ['imdb_id', 'title', 'release_year', 'type', 'poster'] },
        paid: { fields: ['imdb_id', 'title', 'release_year', 'type', 'poster', 'genres'] },
        admin: { fields: ['imdb_id', 'title', 'release_year', 'type', 'poster', 'genres', 'director', 'actors'] }
      }
    }
  },
  fieldMappings: {
    imdb_id: 'imdbID',
    title: 'Title',
    release_year: 'Year',
    type: 'Type',
    poster: 'Poster',
    genres: 'Genre',
    director: 'Director',
    actors: 'Actors'
  }
};

// --------------------- Helper Functions ---------------------
const mapFields = (data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null) {
      acc[config.fieldMappings[key] || key] = value;
    }
    return acc;
  }, {});
};

const validateIMDbId = (imdbId) => /^tt\d{7,8}$/.test(imdbId);

const getEndpointConfig = (role, endpoint) => {
  return config.endpoints[endpoint].roles[role] || config.endpoints[endpoint].roles.free;
};

const buildFields = (fields) => {
  return fields.includes('*') ? '*' : fields.join(', ');
};

// --------------------- API Key Validation Middleware ---------------------
const validateApiKey = async (req, res, next) => {
  try {
    const { apikey } = req.query;
    if (!apikey) {
      return res.status(400).json({ Response: 'False', Error: 'API key required' });
    }
    const [users] = await pool.query('SELECT role FROM users WHERE api_key = ?', [apikey]);
    if (users.length === 0) {
      return res.status(403).json({ Response: 'False', Error: 'Invalid API key' });
    }
    req.role = users[0].role;
    next();
  } catch (error) {
    console.error('API Key Validation Error:', error);
    res.status(500).json({ Response: 'False', Error: 'Internal server error' });
  }
};

// --------------------- API Endpoints ---------------------
// IMDb ID Lookup Handler
const handleIMDbLookup = async (req, res) => {
  try {
    const { i: imdbId } = req.query;
    if (!validateIMDbId(imdbId)) {
      return res.status(400).json({ Response: 'False', Error: 'Invalid IMDb ID format' });
    }
    const endpointConfig = getEndpointConfig(req.role, 'imdbLookup');
    const fields = buildFields(endpointConfig.fields);
    const [data] = await pool.query(`SELECT ${fields} FROM imdb_data WHERE imdb_id = ?`, [imdbId]);
    if (data.length === 0) {
      return res.status(404).json({ Response: 'False', Error: 'Title not found' });
    }
    const result = mapFields(data[0]);
    res.json({ ...result, Response: 'True' });
  } catch (error) {
    console.error('IMDb Lookup Error:', error);
    res.status(500).json({ Response: 'False', Error: 'Internal server error' });
  }
};

// Title Search Handler
const handleTitleSearch = async (req, res) => {
  try {
    const { s: searchTerm, page = 1 } = req.query;
    const pageNumber = Math.max(1, parseInt(page));
    const offset = (pageNumber - 1) * config.pagination.resultsPerPage;
    const endpointConfig = getEndpointConfig(req.role, 'titleSearch');
    const fields = buildFields(endpointConfig.fields);
    const [data] = await pool.query(
      `SELECT ${fields} FROM imdb_data WHERE title LIKE ? LIMIT ? OFFSET ?`,
      [`%${searchTerm}%`, config.pagination.resultsPerPage, offset]
    );
    const [[{ totalResults }]] = await pool.query(
      `SELECT COUNT(*) AS totalResults FROM imdb_data WHERE title LIKE ?`,
      [`%${searchTerm}%`]
    );
    if (data.length === 0) {
      return res.status(404).json({ Response: 'False', Error: 'No results found' });
    }
    const mappedData = data.map(item => mapFields(item));
    res.json({
      Search: mappedData,
      totalResults: totalResults.toString(),
      Response: 'True'
    });
  } catch (error) {
    console.error('Title Search Error:', error);
    res.status(500).json({ Response: 'False', Error: 'Internal server error' });
  }
};

// Stats Endpoint with Rate Limiter
app.get('/stats', validateApiKey, rateLimiterByRole, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT type, COUNT(*) AS count 
      FROM imdb_data 
      GROUP BY type
    `);
    const total = stats.reduce((acc, { count }) => acc + count, 0);
    const statsByType = stats.reduce((acc, { type, count }) => {
      acc[type] = count;
      return acc;
    }, {});
    res.json({
      stats: statsByType,
      total,
      Response: 'True'
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ Response: 'False', Error: 'Internal server error' });
  }
});

// Main Route: Serve landing page or process API requests
app.get('/', async (req, res, next) => {
  if (!req.query.i && !req.query.s && !req.query.apikey) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
}, validateApiKey, rateLimiterByRole, async (req, res) => {
  if (req.query.i) {
    return handleIMDbLookup(req, res);
  }
  if (req.query.s) {
    return handleTitleSearch(req, res);
  }
  return res.status(400).json({ Response: 'False', Error: 'Invalid parameters' });
});

// 404 and Global Error Handling
app.use((req, res) => res.status(404).json({ Response: 'False', Error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(500).json({ Response: 'False', Error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;