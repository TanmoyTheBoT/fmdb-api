---
# FMDb API
## The Free Movie Database

FMDb API is a Node.js backend that provides access to movie data stored in an IMDb-based MySQL database. The API includes endpoints for IMDb lookup, title search, aggregate statistics, and user registration to obtain an API key. It features secure API key validation, role-based rate limiting, and a static documentation page.
---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [User Registration](#user-registration)
- [Rate Limiting](#rate-limiting)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **IMDb Lookup:** Retrieve detailed movie information using a valid IMDb ID.
- **Title Search:** Search movies by title with pagination support.
- **Stats Endpoint:** Get aggregate statistics (e.g. counts of movie types).
- **User Registration:** Register via a web form to receive an API key via email.
- **API Key Validation:** All endpoints are secured by validating API keys.
- **Role-Based Rate Limiting:** Different request limits for free, paid, and admin users.
- **Static Documentation:** A landing page in the public folder provides API usage examples.
- **Security:** Uses parameterized queries to protect against SQL injection.

---

## Project Structure

```
/fmdb-api
├── app.js           // Main Express application: configuration, routes, middleware, and error handling
├── package.json     // Project configuration and dependencies
├── .env             // Environment variables (e.g. DB credentials, PORT, API keys)
└── public
    └── index.html   // Static landing page, API documentation, and user registration form
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

3. **Create a `.env` file** in the project root and set the following variables:

   ```env
   PORT=5000
   MYSQL_HOST=your_mysql_host
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=your_mysql_database
   MYSQL_PORT=3306
   EMAIL_USER=fmdb-api@free.com
   EMAIL_PASS=your_google_app_password
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   For development, you can run:

   ```bash
   npm run dev
   ```

---

## Configuration

The application is configured using environment variables and settings in `app.js`. Key configuration aspects include:

- **MySQL Database:** Uses `mysql2/promise` to create a connection pool.
- **API Endpoints:** Provides endpoints for IMDb lookup, title search, and aggregate statistics.
- **User Registration:** A POST endpoint accepts registration data and sends an API key via email.
- **Rate Limiting:** Configurable limits for free, paid, and admin users, enforced by `express-rate-limit`.
- **API Key Validation:** All protected endpoints verify that a valid API key is present in the request.

---

## Usage

Once the server is running, you can access the API endpoints using HTTP requests.

- **Landing Page:**  
  Visit [http://localhost:5000](http://localhost:5000) in your browser to view the static documentation and registration form.

- **IMDb Lookup:**  
  ```bash
  http://localhost:5000/?i=tt0111161&apikey=your_api_key
  ```

- **Title Search:**  
  ```bash
  http://localhost:5000/?s=batman&page=1&apikey=your_api_key
  ```

- **Statistics:**  
  ```bash
  http://localhost:5000/stats?apikey=your_api_key
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
- **Description:** Returns aggregate statistics, such as the count of movies per type.

---

## User Registration

The registration endpoint allows users to register via a web form to obtain an API key:

- **Method:** POST  
- **URL:** `/register`  
- **Description:** Accepts user details (first name, last name, email, and use case) and sends an API key to the provided email address.

> **Note:** The registration page is available at the landing page under the "Get API Key" section.

---

## Rate Limiting (default)

The API implements role-based rate limiting to prevent abuse:


Role-based rate limiting is implemented to prevent abuse:

- **Free Plan:** 1,000 requests per day
- **Paid Plan:** 10,000 requests per day
- **Admin Plan:** Higher limits or bypass

Rate limits are enforced using the `express-rate-limit` package based on the user's role determined by their API key.

---

## Database Schema

The application uses two primary tables: `imdb_data` and `users`.

### `imdb_data` Table

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

### `users` Table

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

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, please open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---