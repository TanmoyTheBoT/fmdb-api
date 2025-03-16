require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const mysql = require('mysql2/promise');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection pool
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

// Pre-create rate limiter instances for each role at app initialization.
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

// Middleware to apply the appropriate rate limiter based on the validated user's role.
const rateLimiterByRole = (req, res, next) => {
  // Use the rate limiter instance for the user's role or default to free.
  const limiter = rateLimiterInstances[req.role] || rateLimiterInstances.free;
  return limiter(req, res, next);
};
// --------------------- END Rate Limiter Configuration ---------------------

// Configuration Manager
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

// Middleware
app.use(morgan('dev'));

app.get('/config.js', (req, res) => {
  res.header('Content-Type', 'application/javascript');
  res.send(`
    window.APP_CONFIG = {
      SOCKET_SERVER_URL: '${process.env.SOCKET_SERVER_URL}'
    };
  `);
});

// Helper Functions
const mapFields = (data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null) { // Only add the field if the value is not null
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

// API Key Validation Middleware (used in /stats and main API calls)
const validateApiKey = async (req, res, next) => {
  try {
    const { apikey } = req.query;
    
    if (!apikey) {
      return res.status(400).json({ Response: 'False', Error: 'API key required' });
    }

    const [users] = await pool.query(
      'SELECT role FROM users WHERE api_key = ?',
      [apikey]
    );

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

// IMDb ID Lookup Handler
const handleIMDbLookup = async (req, res) => {
  try {
    const { i: imdbId } = req.query;
    
    if (!validateIMDbId(imdbId)) {
      return res.status(400).json({ Response: 'False', Error: 'Invalid IMDb ID format' });
    }

    const endpointConfig = getEndpointConfig(req.role, 'imdbLookup');
    const fields = buildFields(endpointConfig.fields);

    const [data] = await pool.query(
      `SELECT ${fields} FROM imdb_data WHERE imdb_id = ?`,
      [imdbId]
    );

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

// --------------------- Routes with Rate Limiter ---------------------

// Dynamic Stats Endpoint with role-based rate limiting
app.get('/stats', validateApiKey, rateLimiterByRole, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT type, COUNT(*) AS count 
      FROM imdb_data 
      GROUP BY type
    `);

    // Calculate the total count of all items
    const total = stats.reduce((acc, { count }) => acc + count, 0);

    // Create an object for the stats breakdown by type
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

// Main Route: Serve landing page if no query parameters; else validate API key and handle API calls
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