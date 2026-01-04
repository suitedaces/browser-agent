# browser-agent

ai browser automation extension powered by claude + websocket architecture

![demo](vaporlofi.gif)

## architecture

the extension now runs in **client-server mode** where claude agent sdk runs on your local server:

```
extension ←→ websocket ←→ server
   ↓                        ↓
 chrome                  claude sdk
   ↓                        ↓
 tools ←───executes────── agent
```

**benefits:**
- server holds api keys (users never see them)
- you control the ai loop server-side
- easy to add usage tracking/billing
- sdk features: retries, observability, structured events

## setup

1. **install dependencies:**
   ```bash
   npm install
   cd server && npm install
   ```

2. **set up environment:**
   make sure `.env` has:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   DEEPGRAM_API_KEY=...
   ELEVENLABS_API_KEY=...
   ```

3. **build extension:**
   ```bash
   npm run build
   ```

4. **start server:**
   ```bash
   cd server
   npm run dev
   ```
   server runs on `ws://localhost:3000`

5. **load extension in chrome:**
   - go to `chrome://extensions`
   - enable developer mode
   - click "load unpacked"
   - select the `dist` folder

## features

- **see_page** - a11y tree snapshot with element IDs
- **page_action** - click, fill, hover, scroll, press key
- **browser_navigate** - goto, back, forward, reload, tabs

## usage

1. make sure server is running (see terminal output: `[server] WebSocket server running`)
2. click extension icon to open sidepanel
3. extension auto-connects to websocket server
4. give it a task and watch the magic happen

## how it works

1. user sends task from extension
2. extension sends task to server via websocket
3. server runs claude agent with browser tools
4. when agent needs to use a tool (click, type, screenshot), server sends `tool_request` to extension
5. extension executes tool in actual browser tab
6. extension sends `tool_result` back to server
7. server feeds result to claude, agent continues
8. server streams thinking/text/events back to extension for ui
9. loop continues until task complete

## development

**extension:**
- [src/background/websocket.ts](src/background/websocket.ts) - websocket client, handles tool execution
- [src/background/tools.ts](src/background/tools.ts) - browser automation tools
- `src/sidepanel/` - react ui

**server:**
- [server/src/index.ts](server/src/index.ts) - websocket server
- [server/src/session.ts](server/src/session.ts) - agent session with claude sdk
- [server/src/tools.ts](server/src/tools.ts) - tool definitions

dev mode:
```bash
npm run dev  # watch mode for extension
```
