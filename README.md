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

Open the URL printed by `npm start`, not `index.html` directly or a static-hosting URL such as GitHub Pages. The `/api/chat` and `/api/health` routes only exist on the Node.js server; static hosting returns an HTML page for those API requests.

## Deploy on Vercel

This repository includes Vercel serverless endpoints under `api/`. Import the repository into Vercel, add `GROQ_API_KEY` under **Project Settings → Environment Variables**, and redeploy. Open the Vercel deployment URL to use live AI. GitHub Pages only serves static files, so it cannot provide these API endpoints; the app will use offline responses there.

`GROQ_MODEL` can optionally select another model available to your Groq account. The default is `llama-3.3-70b-versatile`.

When deploying, configure `GROQ_API_KEY` as a server-side environment secret and run `npm start`, then use that server's URL to access the app. Never expose it in browser JavaScript or a public client-side `.env` file.
