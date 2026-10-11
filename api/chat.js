const { createGroqReply } = require("../lib/groq");

module.exports = async function chatHandler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader("Cache-Control", "no-store");
  const result = await createGroqReply(request.body);
  return response.status(result.status).json(result.body);
};
