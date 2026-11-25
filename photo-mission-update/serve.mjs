import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const port = Number(process.env.PORT || 4174);
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/photo-proof.css", ["photo-proof.css", "text/css; charset=utf-8"]],
]);

createServer(async (request, response) => {
  const path = request.url.split("?", 1)[0];
  const resource = files.get(path);
  if (!resource) {
    response.writeHead(404).end();
    return;
  }
  const [file, type] = resource;
  try {
    const contents = await readFile(new URL(file, import.meta.url));
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    response.end(contents);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log("오느른 사진 미션 인증  http://localhost:" + port);
});
