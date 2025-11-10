import { createServer } from "http";
import { readFile } from "fs";
import { extname, join } from "path";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer((req, res) => {
  const url = req.url || "/";
  const filePath = join(
    __dirname,
    "..",
    "dist",
    url === "/" ? "index.html" : url
  );

  const ext = extname(filePath);
  let contentType = "text/html";

  switch (ext) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
      contentType = "image/jpg";
      break;
  }

  readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        readFile(
          join(__dirname, "..", "dist", "index.html"),
          (error, content) => {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(content, "utf-8");
          }
        );
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
