const MAX_PROMPT_LENGTH = 8000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 4000;

function validatePrompt(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const systemInstruction = typeof body.systemInstruction === "string"
    ? body.systemInstruction.trim()
    : "";
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || systemInstruction.length > MAX_SYSTEM_INSTRUCTION_LENGTH) {
    return { error: "Prompt or system instruction is empty or too long." };
  }

  return { prompt, systemInstruction };
}

async function createGroqReply(body, apiKey = process.env.GROQ_API_KEY) {
  if (!apiKey?.trim()) {
    return { status: 503, body: { error: "Live AI is not configured on this server." } };
  }

  const validated = validatePrompt(body);
  if (validated.error) {
    return { status: 400, body: { error: validated.error } };
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          ...(validated.systemInstruction
            ? [{ role: "system", content: validated.systemInstruction }]
            : []),
          { role: "user", content: validated.prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!upstream.ok) {
      console.error(`Groq API request failed with HTTP ${upstream.status}.`);
      return { status: 502, body: { error: "The Groq AI service could not complete the request." } };
    }

    const result = await upstream.json();
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("Groq API returned no assistant message.");
      return { status: 502, body: { error: "The Groq AI service returned an empty response." } };
    }
    return { status: 200, body: { reply } };
  } catch (error) {
    console.error("Groq API request failed:", error.message);
    return { status: 502, body: { error: "Could not connect to the Groq AI service." } };
  }
}

module.exports = { createGroqReply };
