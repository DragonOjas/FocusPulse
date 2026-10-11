const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createGroqReply } = require("./lib/groq");

const ROOT = __dirname;
const MAX_BODY_BYTES = 16 * 1024;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    request.on("data", chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
      }
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendJson(response, 200, { aiConfigured: Boolean(process.env.GROQ_API_KEY?.trim()) });
  }

  if (url.pathname === "/api/chat") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "Method not allowed." });
    }
    if (!process.env.GROQ_API_KEY?.trim()) {
      return sendJson(response, 503, { error: "Live AI is not configured on this server." });
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        sendJson(response, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    const result = await createGroqReply(body);
    return sendJson(response, result.status, result.body);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const fileName = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!["index.html", "app.js", "style.css"].includes(fileName)) {
    response.writeHead(404);
    return response.end("Not found");
  }
  const filePath = path.join(ROOT, fileName);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      console.error(`Failed to read ${fileName}:`, error.message);
      response.writeHead(500);
      return response.end("Unable to load the app.");
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(fileName)],
      "Cache-Control": "no-cache"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}

function createAppServer() {
  return http.createServer((request, response) => {
    handleRequest(request, response).catch(error => {
      console.error("Unhandled request error:", error.message);
      if (!response.headersSent) sendJson(response, 500, { error: "An internal server error occurred." });
      else response.destroy();
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";
  createAppServer().listen(port, host, () => {
    console.log(`FocusPulse is running at http://${host}:${port}`);
  });
}

module.exports = { createAppServer };
