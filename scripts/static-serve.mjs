import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";

const ROOT = process.argv[2] || "public";
const PORT = Number(process.argv[3] || 3010);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = join(ROOT, p);
    const buf = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404");
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
