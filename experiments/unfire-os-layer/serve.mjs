import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const routes = Object.freeze({ "/": ["index.html","text/html; charset=utf-8"],
  "/app.mjs": ["app.mjs","text/javascript; charset=utf-8"],
  "/core.mjs": ["core.mjs","text/javascript; charset=utf-8"] });
const port = 4177;
const server = createServer(async (req,res) => {
  const route = routes[req.url];
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'");
  if (!route || req.method !== "GET") { res.writeHead(404); res.end("Not found"); return; }
  try { const buf = await readFile(join(dir,route[0])); res.writeHead(200,{"Content-Type":route[1]}); res.end(buf); }
  catch { res.writeHead(500); res.end("Local file unavailable"); }
});
server.listen(port,"127.0.0.1",()=>console.log("Unfire OS Layer demo: http://127.0.0.1:"+port));