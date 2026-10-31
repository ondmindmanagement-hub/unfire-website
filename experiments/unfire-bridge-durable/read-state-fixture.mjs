import { openDurablePolicy } from './durable-policy.mjs';
const [dbPath, tenant] = process.argv.slice(2);
const store=openDurablePolicy({dbPath});
try { process.stdout.write(JSON.stringify(store.snapshot({tenant}))); }
finally { store.close(); }
