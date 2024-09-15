Installation :
1- run 'npm install'
2- create .env file in the root dir and add the following :
        PGUSER=YOUR USER
        PGHOST=YOUR DB HOST
        PGDATABASE=YOUR DATABASE NAME
        PGPASSWORD=YOUR DB PASSWORD
        PGPORT=YOUR DB PORT
3- on your database make sure to create those 2 tables: 
'
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
'
4- create index on txt_records : 
'
CREATE INDEX txt_record_full_text_idx ON txt_records USING gin(to_tsvector('english', txt_record));
'

5- run 'npm run start' and visit localhost:3000
NOTE: if error happened make sure your node version is 20.10.0