const { parentPort } = require("worker_threads");
const dns = require("dns").promises;

async function lookupTXTRecords(domain) {
  try {
    const records = await dns.resolveTxt(domain);
    return records.map((recordArray) => [domain, recordArray.join(" ")]);
  } catch (error) {
    console.error(`Failed to lookup TXT records for ${domain}:`, error);
    return [];
  }
}

parentPort.on("message", async ({ batch }) => {
  const txtRecords = [];
  for (const domain of batch) {
    const records = await lookupTXTRecords(domain);
    txtRecords.push(...records);
  }
  parentPort.postMessage(txtRecords);
});
