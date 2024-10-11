"My online postgres db alredy linked and if you want to change the database follow the steps below "
# Project Setup

## Installation

1. Run the following command to install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and add the following environment variables:

   ```
   PGUSER=YOUR_USER
   PGHOST=YOUR_DB_HOST
   PGDATABASE=YOUR_DATABASE_NAME
   PGPASSWORD=YOUR_DB_PASSWORD
   PGPORT=YOUR_DB_PORT
   ```

3. In your PostgreSQL database, create the following two tables:

   ```sql
   CREATE TABLE domains (
     id SERIAL PRIMARY KEY,
     domain_name VARCHAR(255) UNIQUE NOT NULL
   );

   CREATE TABLE txt_records (
     id SERIAL PRIMARY KEY,
     domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
     txt_record TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. Create an index on the `txt_records` table for full-text search:

   ```sql
   CREATE INDEX txt_record_full_text_idx 
   ON txt_records USING gin(to_tsvector('english', txt_record));
   ```

5. Run the following command to start the application:

   ```bash
   npm run start
   ```

6. Visit `localhost:3000` in your browser.

**NOTE:** If an error occurs, ensure your Node.js version is `20.10.0`.
