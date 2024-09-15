const { parentPort } = require("worker_threads");
const { Client } = require("pg");

parentPort.on("message", async ({ batch, index }) => {
  const client = new Client({
    user: "brahim_owner",
    host: "ep-raspy-truth-a2dwec1m.eu-central-1.aws.neon.tech",
    database: "brahim",
    password: "COH5oef1qlpI",
    port: 5432,
    ssl: { rejectUnauthorized: false }, // Adjust according to your SSL configuration
  });

  try {
    await client.connect();
    const placeholders = batch.map((_, i) => `($${i + 1})`).join(", ");
    const values = batch;

    await client.query(
      `INSERT INTO domains (domain_name) VALUES ${placeholders} ON CONFLICT (domain_name) DO NOTHING`,
      values
    );

    parentPort.postMessage(`Worker ${index} completed.`);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  } finally {
    await client.end();
  }
});
