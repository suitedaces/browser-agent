import * as cdp from './cdp';
import { emitToSidepanel } from './index';

export const TOOLS = [
  {
    name: 'see_page',
    description: 'Get page elements with IDs for interaction. Returns accessibility tree. Use screenshot=true to get visual image instead.',
    input_schema: {
      type: 'object',
      properties: {
        screenshot: { type: 'boolean', description: 'Return screenshot instead of elements' },
        verbose: { type: 'boolean', description: 'Include all elements, not just interactive' }
      }
    }
  },
  {
    name: 'page_action',
    description: 'Interact with page. Use element IDs from see_page.',
    input_schema: {
      type: 'object',
      properties: {
        click: { type: 'string', description: 'Click element ID' },
        right_click: { type: 'string', description: 'Right-click element ID' },
        double_click: { type: 'string', description: 'Double-click element ID' },
        type_into: { type: 'string', description: 'Element ID to type into' },
        text: { type: 'string', description: 'Text to type' },
        hover: { type: 'string', description: 'Hover element ID' },
        scroll: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        scroll_pixels: { type: 'number' },
        press_key: { type: 'string', description: 'Key to press (Enter, Tab, Escape, etc)' }
      }
    }
  },
  {
    name: 'browser_navigate',
    description: 'Navigate browser. Go to URLs, manage tabs.',
    input_schema: {
      type: 'object',
      properties: {
        go_to_url: { type: 'string' },
        go_back: { type: 'boolean' },
        go_forward: { type: 'boolean' },
        reload: { type: 'boolean' },
        open_new_tab: { type: 'string', description: 'URL to open in new tab' },
        switch_to_tab: { type: 'number', description: 'Tab index to switch to' },
        close_tab: { type: 'number', description: 'Tab index to close' },
        list_tabs: { type: 'boolean' }
      }
    }
  },
  {
    name: 'get_page_text',
    description: 'Extract all text content from the page.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'find',
    description: 'Find elements matching search query. Returns IDs for page_action.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for' }
      },
      required: ['query']
    }
  },
  {
    name: 'run_javascript',
    description: 'Execute JavaScript in page context.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS code to execute' }
      },
      required: ['code']
    }
  }
];

// track current snapshot id for stale element detection
let currentSnapshotId = 0;

export function setSnapshotId(snapshotId: number) {
  currentSnapshotId = snapshotId;
}

async function getElementPosition(uid: string): Promise<{ x: number; y: number }> {
  const [snapId] = uid.split('_').map(Number);
  if (snapId !== currentSnapshotId) {
    throw new Error(`Stale element ID ${uid}. Take a new snapshot with see_page.`);
  }

  const backendNodeId = await cdp.getBackendNodeId(uid);
  return cdp.getElementCenter(backendNodeId);
}

async function ensureContentScript(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js']
    });
  }
}

export async function executeTool(tabId: number, name: string, input: Record<string, unknown>): Promise<{ text?: string; image?: string }> {
  console.log('[tools] executing', name, input);

  await ensureContentScript(tabId);

  try {
    await cdp.attach(tabId);
    console.log('[tools] attached to tab', tabId);
  } catch (e) {
    console.log('[tools] attach failed:', e);
    throw e;
  }

  switch (name) {
    case 'see_page': {
      if (input.screenshot) {
        console.log('[tools] taking screenshot');
        const data = await cdp.screenshot();
        console.log('[tools] screenshot taken, size:', data.length);
        emitToSidepanel({ type: 'agent:screenshot', payload: data });
        return { image: data };
      }

      console.log('[tools] getting a11y snapshot');
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'snapshot:get',
        payload: { verbose: !!input.verbose }
      });
      console.log('[tools] snapshot received, length:', response?.payload?.length);
      return { text: response.payload };
    }

    case 'page_action': {
      if (input.click) {
        const pos = await getElementPosition(input.click as string);
        await cdp.click(pos.x, pos.y);
        return { text: `Clicked element ${input.click}` };
      }

      if (input.right_click) {
        const pos = await getElementPosition(input.right_click as string);
        await cdp.rightClick(pos.x, pos.y);
        return { text: `Right-clicked element ${input.right_click}` };
      }

      if (input.double_click) {
        const pos = await getElementPosition(input.double_click as string);
        await cdp.doubleClick(pos.x, pos.y);
        return { text: `Double-clicked element ${input.double_click}` };
      }

      if (input.type_into) {
        const pos = await getElementPosition(input.type_into as string);
        await cdp.click(pos.x, pos.y);
        await cdp.type(input.text as string);
        return { text: `Typed into element ${input.type_into}` };
      }

      if (input.hover) {
        const pos = await getElementPosition(input.hover as string);
        await cdp.mouseMove(pos.x, pos.y);
        return { text: `Hovered element ${input.hover}` };
      }

      if (input.scroll) {
        await cdp.scroll(input.scroll as 'up' | 'down' | 'left' | 'right', (input.scroll_pixels as number) || 500);
        return { text: `Scrolled ${input.scroll}` };
      }

      if (input.press_key) {
        const key = input.press_key as string;
        const modifiers: string[] = [];
        let mainKey = key;

        if (key.includes('+')) {
          const parts = key.split('+');
          mainKey = parts.pop()!;
          modifiers.push(...parts);
        }

        await cdp.pressKey(mainKey, modifiers);
        return { text: `Pressed ${key}` };
      }

      return { text: 'No action specified' };
    }

    case 'browser_navigate': {
      if (input.go_to_url) {
        await chrome.tabs.update(tabId, { url: input.go_to_url as string });
        return { text: `Navigated to ${input.go_to_url}` };
      }

      if (input.go_back) {
        await chrome.tabs.goBack(tabId);
        return { text: 'Went back' };
      }

      if (input.go_forward) {
        await chrome.tabs.goForward(tabId);
        return { text: 'Went forward' };
      }

      if (input.reload) {
        await chrome.tabs.reload(tabId);
        return { text: 'Reloaded page' };
      }

      if (input.open_new_tab) {
        await chrome.tabs.create({ url: input.open_new_tab as string });
        return { text: `Opened new tab: ${input.open_new_tab}` };
      }

      if (input.switch_to_tab !== undefined) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs[input.switch_to_tab as number];
        if (tab?.id) {
          await chrome.tabs.update(tab.id, { active: true });
          return { text: `Switched to tab ${input.switch_to_tab}` };
        }
        return { text: `Tab ${input.switch_to_tab} not found` };
      }

      if (input.close_tab !== undefined) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tab = tabs[input.close_tab as number];
        if (tab?.id) {
          await chrome.tabs.remove(tab.id);
          return { text: `Closed tab ${input.close_tab}` };
        }
        return { text: `Tab ${input.close_tab} not found` };
      }

      if (input.list_tabs) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const list = tabs.map((t, i) => `${i}: ${t.title} (${t.url})`).join('\n');
        return { text: `Open tabs:\n${list}` };
      }

      return { text: 'No navigation action specified' };
    }

    case 'get_page_text': {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'text:get' });
      return { text: response.payload };
    }

    case 'find': {
      const snapshot = await chrome.tabs.sendMessage(tabId, {
        type: 'snapshot:get',
        payload: { verbose: false }
      });

      const query = (input.query as string).toLowerCase();
      const matches = snapshot.payload.split('\n').filter((line: string) =>
        line.toLowerCase().includes(query)
      );

      if (matches.length === 0) {
        return { text: `No elements found matching "${input.query}"` };
      }

      return { text: `Found ${matches.length} matches:\n${matches.slice(0, 20).join('\n')}` };
    }

    case 'run_javascript': {
      const result = await cdp.evaluate(input.code as string);
      return { text: JSON.stringify(result, null, 2) };
    }

    default:
      return { text: `Unknown tool: ${name}` };
  }
}
