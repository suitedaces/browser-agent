# browser-agent server

websocket server that runs claude agent sdk and bridges to browser extension for tool execution.

## setup

```bash
npm install
```

make sure `.env` in parent directory has `ANTHROPIC_API_KEY` set.

## run

```bash
npm run dev
```

server will listen on `ws://localhost:3000`

## architecture

```
extension ←→ websocket ←→ server
   ↓                        ↓
 chrome                  claude sdk
   ↓                        ↓
 tools ←───executes────── agent
```

1. extension connects via websocket
2. user sends task instructions
3. server runs claude agent with tools
4. when agent calls a tool, server sends `tool_request` to extension
5. extension executes tool in browser, sends `tool_result` back
6. server feeds result to agent, continues loop
7. agent streams thinking/text/tool events to extension for ui
