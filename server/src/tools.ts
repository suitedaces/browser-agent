import type Anthropic from '@anthropic-ai/sdk';

export const BROWSER_TOOLS: Anthropic.Tool[] = [
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
