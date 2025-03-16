---

# FMDb API

A Node.js API for retrieving movie data from an !MDb-based MySQL database. The API offers endpoints for IMDb lookup, title search, and retrieving aggregate statistics, complete with rate limiting and API key validation.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Rate Limiting](#rate-limiting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **IMDb Lookup:** Retrieve detailed movie information by IMDb ID.
- **Title Search:** Search movies by title with pagination.
- **Stats Endpoint:** Get aggregate statistics of movie types.
- **API Key Validation:** Secure your endpoints with API keys.
- **Role-Based Rate Limiting:** Different limits for free, paid, and admin users.
- **Static Documentation:** Includes a landing page for documentation and usage examples.

---

## Project Structure

```
/fmdb-api
├── app.js           // Main Express application: configuration, routes, middleware, and error handling
├── package.json     // Project configuration and dependencies
├── .env             // Environment variables (e.g. DB credentials, PORT, API keys)
└── public
    └── index.html   // Static landing page and API documentation
```

---

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/TanmoyTheBoT/fmdb-api.git
   cd fmdb-api
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create a `.env` file in the project root and set the following variables:**

   ```env
   PORT=5000
   MYSQL_HOST=your_mysql_host
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=your_mysql_database
   MYSQL_PORT=3306
   SOCKET_SERVER_URL=your_socket_server_url
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   Or if you're in a development environment:

   ```bash
   npm run dev
   ```

---

## Configuration

The application is configured through environment variables and the `app.js` file. Key configuration aspects include:

- **MySQL Database:** Uses `mysql2/promise` to create a connection pool.
- **API Endpoints:** Provides endpoints for IMDb lookup, title search, and statistics.
- **Rate Limiting:** Configurable rate limits for free, paid, and admin users.
- **API Key Validation:** Ensures that each request contains a valid API key.

---

## Usage

Once the server is running, you can access the API endpoints using HTTP requests.

- **Landing Page:**  
  Visit [http://localhost:5000](http://localhost:5000) in your browser to view the static documentation.

- **IMDb Lookup:**  
  ```bash
  curl "http://localhost:5000/?i=tt0111161&apikey=your_api_key"
  ```

- **Title Search:**  
  ```bash
  curl "http://localhost:5000/?s=batman&page=1&apikey=your_api_key"
  ```

- **Statistics:**  
  ```bash
  curl "http://localhost:5000/stats?apikey=your_api_key"
  ```

---

## API Endpoints

### IMDb Lookup Endpoint
- **Method:** GET
- **URL Format:** `/?i={imdb_id}&apikey={your_api_key}`
- **Description:** Returns detailed information about a movie based on its IMDb ID.
- **Parameters:**
  - `i`: Valid IMDb ID (e.g. `tt0111161`)
  - `apikey`: Your registered API key

### Title Search Endpoint
- **Method:** GET
- **URL Format:** `/?s={search_term}&page={page}&apikey={your_api_key}`
- **Description:** Searches for movies by title.
- **Parameters:**
  - `s`: Search term (e.g. `"batman"`)
  - `page`: Page number (default: 1)
  - `apikey`: Your registered API key

### Stats Endpoint
- **Method:** GET
- **URL Format:** `/stats?apikey={your_api_key}`
- **Description:** Returns aggregate statistics (e.g., count of movies per type).

---

## Rate Limiting (default)

The API implements role-based rate limiting to prevent abuse:

- **Free Plan:** 1,000 requests/day
- **Paid Plan:** 10,000 requests/day
- **Admin Plan:** Bypass or higher limits

Rate limits are enforced using the `express-rate-limit` package based on the user's role as determined by their API key.

---
## Database Schema

The application uses two primary tables: `imdb_data` and `users`.

**`imdb_data` Table:**

```sql
CREATE TABLE `imdb_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `imdb_id` varchar(20) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `original_title` varchar(255) DEFAULT NULL,
  `release_year` varchar(50) DEFAULT NULL,
  `release_date` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `content_rating` varchar(50) DEFAULT NULL,
  `runtime` varchar(50) DEFAULT NULL,
  `genres` text,
  `subgenres` text,
  `country` text,
  `language` text,
  `director` text,
  `writer` text,
  `actors` text,
  `awards` text,
  `imdb_rating` varchar(10) DEFAULT NULL,
  `imdb_votes` varchar(20) DEFAULT NULL,
  `metascore` varchar(10) DEFAULT NULL,
  `box_office` varchar(50) DEFAULT NULL,
  `episodes` varchar(50) DEFAULT NULL,
  `total_seasons` varchar(10) DEFAULT NULL,
  `episode` varchar(50) DEFAULT NULL,
  `season` varchar(10) DEFAULT NULL,
  `series_id` varchar(20) DEFAULT NULL,
  `tagline` text,
  `plot` text,
  `imdb_link` text,
  `og_poster` text,
  `poster` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `imdb_id` (`imdb_id`)
);
```

**`users` Table:**

```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `api_key` varchar(255) NOT NULL,
  `role` enum('free','paid','admin') NOT NULL DEFAULT 'free',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `use_case` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
);
```





---

## License

This project is licensed under the [MIT License](LICENSE).

---
