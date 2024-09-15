const { Worker } = require("worker_threads");
const path = require("path");
const { Client } = require("pg");
const broadcastWebSocketMessage = require("./broadcastWebSocketMessage");

async function insertDomainsInBatch(domains, client) {
  const batchSize = 1000;
  const domainBatches = [];
  let completedBatches = 0; // Track completed domain insertions

  for (let i = 0; i < domains.length; i += batchSize) {
    domainBatches.push(domains.slice(i, i + batchSize));
  }

  const workerPromises = domainBatches.map((batch, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.resolve(__dirname, "domainWorker.js"));
      worker.postMessage({ batch, index });

      worker.on("message", (message) => {
        console.log(`Worker ${index} completed.`);
        completedBatches++; // Increment after each worker is done

        // Broadcast progress to WebSocket clients
        const progressPercentage = Math.floor(
          (completedBatches / domainBatches.length) * 100
        );
        broadcastWebSocketMessage({
          type: "domainParsingProgress",
          progress: progressPercentage,
        });

        resolve();
      });

      worker.on("error", (error) => {
        console.error(`Worker ${index} encountered an error:`, error);
        reject(error);
      });
    });
  });

  try {
    await Promise.all(workerPromises);

    // Notify clients that domain parsing is completed

    console.log("All domain batches inserted successfully.");
  } catch (error) {
    console.error("Error inserting domain batches:", error);
  }
}

module.exports = insertDomainsInBatch;
