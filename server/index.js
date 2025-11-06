import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientBuildDir = path.resolve(__dirname, '..', 'dist');

const app = express();
app.use(express.json({ limit: '2mb' }));

const port = process.env.PORT ?? 3001;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn('[warn] OPENAI_API_KEY is not set. Streaming responses will fail.');
}

const openai = new OpenAI({
  apiKey: openaiApiKey
});

app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const { messages, model = 'gpt-4o-mini' } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: 'Request body must include a non-empty messages array.'
      })}\n\n`
    );
    res.end();
    return;
  }

  if (!openaiApiKey) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: 'OPENAI_API_KEY is not configured on the server.'
      })}\n\n`
    );
    res.end();
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      stream: true,
      messages
    });

    for await (const chunk of completion) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'content', content: delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    console.error('[error] Failed to stream completion', error);
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error?.message ?? 'Unknown error streaming completion.'
      })}\n\n`
    );
  } finally {
    res.end();
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
  app.use(express.static(clientBuildDir));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.resolve(clientBuildDir, 'index.html'), (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

const server = createServer(app);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
