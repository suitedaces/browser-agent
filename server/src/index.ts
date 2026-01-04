import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { AgentSession } from './session.js';

config({ path: '../.env' });

const PORT = 3000;

const wss = new WebSocketServer({ port: PORT });

console.log(`[server] WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  console.log('[server] extension connected from', req.socket.remoteAddress);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[server] ANTHROPIC_API_KEY not set in .env');
    ws.close(1008, 'Server configuration error');
    return;
  }

  const session = new AgentSession(ws, apiKey);

  // listen for task requests
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'start_task') {
        console.log('[server] starting task:', msg.instructions);
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
