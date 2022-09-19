const dns = require("dns");

const email = "example@example.com";

const [_, domain] = email.split("@");

let rrtype = "MX";

let mxRecords = []; // { exchange: string, priority: number }[];
dns.resolveMx(domain, rrtype, (err, records) => {
  console.log("records: %j", records);
  console.log(JSON.stringify(records, null, 2));
  mxRecords = records;
});

// string[]
const exchangeServers = mxRecords.map(({ exchange }) => exchange);

console.log(exchangeServers);
