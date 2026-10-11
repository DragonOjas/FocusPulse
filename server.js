const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

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

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const systemInstruction = typeof body.systemInstruction === "string"
      ? body.systemInstruction.trim()
      : "";
    if (!prompt || prompt.length > 8000 || systemInstruction.length > 4000) {
      return sendJson(response, 400, { error: "Prompt or system instruction is empty or too long." });
    }

    try {
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!upstream.ok) {
        console.error(`Groq API request failed with HTTP ${upstream.status}.`);
        return sendJson(response, 502, { error: "The Groq AI service could not complete the request." });
      }

      const result = await upstream.json();
      const reply = result.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        console.error("Groq API returned no assistant message.");
        return sendJson(response, 502, { error: "The Groq AI service returned an empty response." });
      }
      return sendJson(response, 200, { reply });
    } catch (error) {
      console.error("Groq API request failed:", error.message);
      return sendJson(response, 502, { error: "Could not connect to the Groq AI service." });
    }
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
