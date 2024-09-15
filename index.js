const express = require("express");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Client } = require("pg");
const lookupAndInsertTxtRecords = require("./utils/lookupAndInsertTxtRecords");
const insertDomainsInBatch = require("./utils/domainInsertion");
const app = express();
const port = 3000;
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: { rejectUnauthorized: false },
});

client.connect();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static("public"));
app.post("/upload-chunk", upload.single("chunk"), (req, res) => {
  const { chunkIndex, totalChunks, fileName } = req.body;
  const chunk = req.file;

  const tempFilePath = path.join(__dirname, "uploads", fileName);
  fs.appendFileSync(tempFilePath, chunk.buffer);

  console.log(`Received chunk ${chunkIndex} of ${totalChunks}`);
  if (parseInt(chunkIndex, 10) + 1 === parseInt(totalChunks, 10)) {
    console.log("All chunks received. Processing file...");
    processFile(tempFilePath, res);
  } else {
    res.status(200).send("Chunk received");
  }
});

async function processFile(filePath, res) {
  console.log("Proccesing file...");
  const subdomains = [];

  console.log("Streaming creation...");

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  console.log("Stream Created");

  fileStream.on("data", (chunk) => {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    console.log("processing lines");
    subdomains.push(...lines);
  });

  fileStream.on("end", async () => {
    try {
      console.log(
        "Starting parallel execution for domain insertion and TXT lookup..."
      );
      await lookupAndInsertTxtRecords(subdomains, client), 
        await insertDomainsInBatch(subdomains, client), 
        res
          .status(200)
          .send("File uploaded and subdomains processed successfully");
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send("Error processing file");
    } finally {
      fs.unlinkSync(filePath); 
    }
  });

  fileStream.on("error", (error) => {
    console.error("Error reading file:", error);
    res.status(500).send("Error reading file");
  });
}

app.get("/search", async (req, res) => {
  const keyword = req.query.keyword;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  if (!keyword) {
    return res.status(400).send("Keyword query parameter is required");
  }

  try {
    const result = await client.query(
      `SELECT d.domain_name, tr.txt_record
       FROM domains d
       JOIN txt_records tr ON d.id = tr.domain_id
       WHERE to_tsvector('english', tr.txt_record) @@ plainto_tsquery('english', $1)
       LIMIT $2 OFFSET $3`,
      [keyword, limit, offset]
    );

    const countResult = await client.query(
      `SELECT COUNT(*) AS count
       FROM domains d
       JOIN txt_records tr ON d.id = tr.domain_id
       WHERE to_tsvector('english', tr.txt_record) @@ plainto_tsquery('english', $1)`,
      [keyword]
    );
    const totalResults = parseInt(countResult.rows[0].count);

    res.json({
      results: result.rows,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Error performing search");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
