const dns = require("dns").promises;
const os = require("os");
const { Pool } = require("pg");
const _ = require("lodash");
const broadcastWebSocketMessage = require("./broadcastWebSocketMessage");

async function lookupAndInsertTxtRecords(subdomains, client) {
  const txtRecordBatches = [];
  const batchSize = 5000; // Increased batch size for efficient DB insertions
  const maxConcurrentWorkers = os.cpus().length * 3; // Double the number of CPU cores for concurrency
  let activeWorkers = 0;
  let completedLookups = 0;

  console.log(
    `Starting TXT record lookup with ${maxConcurrentWorkers} workers...`
  );

  // Throttling WebSocket progress updates to reduce frequency
  const broadcastWebSocketMessageThrottled = _.throttle(
    broadcastWebSocketMessage,
    1000
  ); // Update once per second

  // DNS resolver with a timeout and custom servers (Google DNS as fallback)
  dns.setServers(["8.8.8.8", "1.1.1.1"]); // Google Public DNS and Cloudflare DNS

  // DNS Lookup Processing Function
  const processSubdomain = async (subdomain) => {
    try {
      activeWorkers++;

      // Set lookup options with a timeout
      const lookupOptions = { timeout: 2000 }; // 2-second timeout for DNS lookup
      const records = await dns.resolveTxt(subdomain, lookupOptions);
      completedLookups++;

      const progressPercentage = Math.floor(
        (completedLookups / subdomains.length) * 100
      );
      broadcastWebSocketMessageThrottled({
        type: "txtLookupProgress",
        progress: progressPercentage,
      });

      const flattenedRecords = records.map((recordArray) =>
        recordArray.join(" ")
      );
      if (flattenedRecords.length > 0) {
        const domainId = await getDomainId(subdomain, client);
        if (domainId) {
          txtRecordBatches.push([domainId, ...flattenedRecords]);
        }

        // Insert in batches
        if (txtRecordBatches.length >= batchSize) {
          await insertTxtRecordsBatch(txtRecordBatches, client);
          txtRecordBatches.length = 0; // Clear batch after insertion
        }
      }
    } catch (error) {
      if (error.code === "ENODATA") {
        console.log(`No TXT records for ${subdomain}: ${error.message}`);
      } else {
        console.error(`Failed to lookup TXT records for ${subdomain}:`, error);
      }
    } finally {
      completedLookups++;
      const progressPercentage = Math.floor(
        (completedLookups / subdomains.length) * 100
      );
      broadcastWebSocketMessageThrottled({
        type: "txtLookupProgress",
        progress: progressPercentage,
      });
      activeWorkers--; // Reduce active worker count when done
    }
  };

  // Worker Throttling to limit concurrency
  const throttleWorkers = async () => {
    for (let i = 0; i < subdomains.length; i++) {
      while (activeWorkers >= maxConcurrentWorkers) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait before creating more workers
      }

      processSubdomain(subdomains[i]);
    }
  };

  await throttleWorkers();

  while (activeWorkers > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for remaining workers to finish
  }

  if (txtRecordBatches.length > 0) {
    await insertTxtRecordsBatch(txtRecordBatches, client); // Insert any remaining records
  }

  // Notify WebSocket clients that lookup and insertion is complete
  broadcastWebSocketMessage({
    type: "txtLookupProgress",
    progress: 100,
  });

  console.log("TXT record lookup and insertion completed.");
}

// Helper to get the domain ID from the database
async function getDomainId(domain, client) {
  try {
    const result = await client.query(
      "SELECT id FROM domains WHERE domain_name = $1",
      [domain]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (error) {
    console.error("Error fetching domain ID:", error);
  }
}

// Batch insert TXT records into the database
async function insertTxtRecordsBatch(txtRecordBatches, client) {
  const placeholders = [];
  const values = [];
  let index = 1; // This will help to keep track of placeholder indices

  txtRecordBatches.forEach((batch) => {
    const [domainId, ...txtRecords] = batch;
    txtRecords.forEach((txtRecord) => {
      placeholders.push(`($${index++}, $${index++})`);
      values.push(domainId, txtRecord); // Push both domainId and its corresponding TXT record
    });
  });

  try {
    await client.query(
      `INSERT INTO txt_records (domain_id, txt_record) VALUES ${placeholders.join(
        ", "
      )}`,
      values
    );
    console.log(
      `Inserted ${txtRecordBatches.length} domain TXT records into the database.`
    );
  } catch (error) {
    console.error("Error inserting TXT records:", error);
  }
}

// Connection pool setup for PostgreSQL
const pool = new Pool({
  max: 20, // Adjust based on your system and DB capabilities
  idleTimeoutMillis: 30000,
});

module.exports = lookupAndInsertTxtRecords;
