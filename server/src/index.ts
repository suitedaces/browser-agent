import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { AgentSession } from './session.js';

config({ path: '../.env' });

const PORT = 3000;

const wss = new WebSocketServer({ port: PORT });

const MODEL = process.env.MODEL || 'claude-sonnet-4-5-20250929';

console.log(`[server] WebSocket server running on ws://localhost:${PORT}`);
console.log(`[server] Using model: ${MODEL}`);

wss.on('connection', (ws, req) => {
  console.log('[server] extension connected from', req.socket.remoteAddress);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const basetenKey = process.env.BASETEN_API_KEY;

  if (!anthropicKey && !basetenKey) {
    console.error('[server] No API keys set in .env');
    ws.close(1008, 'Server configuration error');
    return;
  }

  let session: AgentSession | null = null;

  // listen for task requests
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'start_task') {
        const taskModel = msg.model || MODEL;
        console.log('[server] starting task with model:', taskModel);

        // recreate session if model changed
        if (!session || session.currentModel !== taskModel) {
          session = new AgentSession(ws, {
            anthropicKey,
            basetenKey,
            model: taskModel
          });
        }

        session.runTask(msg.instructions).catch(e => {
          console.error('[server] task error:', e);
        });
      }
    } catch (e) {
      console.error('[server] message parse error:', e);
    }
  });

  ws.on('error', (error) => {
    console.error('[server] websocket error:', error);
  });

  ws.on('close', () => {
    console.log('[server] extension disconnected');
  });
});

wss.on('error', (error) => {
  console.error('[server] server error:', error);
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] shutting down...');
  wss.close(() => {
    process.exit(0);
  });
});
