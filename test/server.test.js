const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createAppServer } = require("../server");

function request(server, { method = "GET", path = "/", body } = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: address.port,
      method,
      path,
      headers: body === undefined ? {} : { "Content-Type": "application/json" }
    }, response => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", chunk => responseBody += chunk);
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: responseBody
      }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test("serves the app and reports when Groq is not configured", async t => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  });

  const page = await request(server);
  assert.equal(page.status, 200);
  assert.match(page.body, /FocusPulse/);
  assert.deepEqual(JSON.parse((await request(server, { path: "/api/health" })).body), { aiConfigured: false });

  const chat = await request(server, { method: "POST", path: "/api/chat", body: { prompt: "Hello" } });
  assert.equal(chat.status, 503);
  assert.match(JSON.parse(chat.body).error, /not configured/);
});

test("proxies validated chat requests to Groq without exposing the key to the client", async t => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = "test-server-only-key";
  let upstreamRequest;
  global.fetch = async (url, options) => {
    upstreamRequest = { url, options };
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Keep going!" } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  });

  const chat = await request(server, {
    method: "POST",
    path: "/api/chat",
    body: { prompt: "Help me focus", systemInstruction: "Be encouraging." }
  });
  assert.equal(chat.status, 200);
  assert.deepEqual(JSON.parse(chat.body), { reply: "Keep going!" });
  assert.equal(upstreamRequest.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(upstreamRequest.options.headers.Authorization, "Bearer test-server-only-key");
  assert.equal(JSON.parse(upstreamRequest.options.body).messages[1].content, "Help me focus");
  assert.equal(chat.body.includes("test-server-only-key"), false);
});

test("rejects invalid chat prompts before making an upstream request", async t => {
  const previousKey = process.env.GROQ_API_KEY;
  const previousFetch = global.fetch;
  process.env.GROQ_API_KEY = "test-server-only-key";
  global.fetch = async () => {
    throw new Error("Upstream must not be called for invalid input.");
  };
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  });

  const chat = await request(server, { method: "POST", path: "/api/chat", body: { prompt: " " } });
  assert.equal(chat.status, 400);
});
