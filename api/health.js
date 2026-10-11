module.exports = function healthHandler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({
    aiConfigured: Boolean(process.env.GROQ_API_KEY?.trim())
  });
};
