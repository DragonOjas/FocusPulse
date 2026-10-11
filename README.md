# FocusPulse

FocusPulse is a static study-planning app served by a small Node.js server. Live AI requests are proxied through the server so the Groq API key is never exposed to the browser.

## Run locally

Requires Node.js 18 or newer.

1. Set `GROQ_API_KEY` in the server's environment. Do not put a real key in source control.
2. Start the app:

   ```powershell
   $env:GROQ_API_KEY = "your-groq-api-key"
   npm start
   ```

3. Open http://localhost:3000.

If `GROQ_API_KEY` is not configured, the app remains usable with its built-in offline mentor responses.

`GROQ_MODEL` can optionally select another model available to your Groq account. The default is `llama-3.3-70b-versatile`.

When deploying, configure `GROQ_API_KEY` as a server-side environment secret and run `npm start`. Never expose it in browser JavaScript or a public client-side `.env` file.
