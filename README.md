# LLM Chatbot Site

A full-stack demo that showcases a streaming OpenAI chatbot with multiple conversations, persistent history, and safe HTML rendering via a sandboxed iframe.

## Features

- ⚡️ **Streaming responses** from the OpenAI Chat Completions API via a lightweight Express proxy.
- 🗃 **Per-chat history** stored in `localStorage`, surfaced in a sidebar for quick context switching.
- ➕ **Deep-link prompts** using the `?q=` query parameter to spawn a new chat and auto-send the prompt.
- 🛡 **Isolated HTML rendering**: assistant replies that look like HTML render inside a sandboxed iframe (`https://xssdoctor.com/frame.html`) after a postMessage handshake.
- 💅 **Modern React UI** powered by Vite, with responsive styling and keyboard-friendly chat input.

## Requirements

- Node.js 18+
- An OpenAI API key with access to `gpt-4o-mini` or an alternative chat model

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a `.env` file**

   ```bash
   OPENAI_API_KEY=sk-your-key
   PORT=3001            # optional; defaults to 3001
   ```

   The Express server reads environment variables via `dotenv/config`.

3. **Run the client and server together**

   ```bash
   npm run dev
   ```

   - Vite serves the React app at `http://localhost:5173`
   - The Express proxy listens on `http://localhost:3001`
   - The Vite dev server forwards `/api/*` requests to the Express instance (see `vite.config.js`)

## Usage Notes

- Open the app at `http://localhost:5173` and start chatting.
- Use the **New Chat** button to begin a fresh conversation.
- All chats persist between reloads in browser `localStorage`.
- Append `?q=Your%20Question` to the URL to auto-create a new conversation and send that prompt.
- HTML responses are auto-detected:
  - The app loads a sandboxed iframe (`allow-same-origin allow-scripts`) from `https://xssdoctor.com/frame.html`.
  - It waits for the iframe to emit `{"message": "ready"}` via `postMessage`.
  - Once ready, the assistant HTML is posted to the iframe for rendering.

## Available Scripts

| Command           | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Concurrent Vite + Express development servers              |
| `npm run dev:client` | Vite dev server only                                    |
| `npm run dev:server` | Express server with nodemon                             |
| `npm run build`   | Production build (`dist/`) with Vite                       |
| `npm run preview` | Preview the built client bundle                            |
| `npm start`       | Start the Express server in production mode                |

## Production Build

```bash
npm run build
```

This outputs the static client bundle to `dist/`. You can serve it with Vite preview (`npm run preview`), or host it behind any static server. Ensure the Express server (or a compatible backend) is running so the client can reach `/api/chat`.

## Security Considerations

- HTML replies render in a remote, sandboxed document without DOM access to the parent page.
- The iframe communication is restricted to messages from `https://xssdoctor.com`.
- Always validate or sanitize assistant output on the server if integrating beyond this demo.

## License

MIT © Your Name
