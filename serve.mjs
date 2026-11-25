import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path === "/" ? "index.html" : path.slice(1);
    const type = types[extname(file)];
    const allowed = /^(index\.html|\(수정\)음성 인식 구현\.html|voice\.mjs|voice-screens\.css|photo-proof\.css|(?:mainhome|phone)\.assets\/[^/\\]+\.(?:png|svg))$/u;
    if (!type || !allowed.test(file)) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(new URL(file, import.meta.url));
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    response.end(content);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 400).end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`오느른  http://localhost:${port}`);
});
