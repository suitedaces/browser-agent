// CDP wrapper using chrome.debugger API

let attachedTabId: number | null = null;

export async function attach(tabId: number): Promise<void> {
  if (attachedTabId === tabId) return;

  if (attachedTabId !== null) {
    await detach();
  }

  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabId = tabId;
}

export async function detach(): Promise<void> {
  if (attachedTabId === null) return;

  try {
    await chrome.debugger.detach({ tabId: attachedTabId });
  } catch {
    // already detached
  }
  attachedTabId = null;
}

export async function sendCommand<T>(method: string, params?: unknown): Promise<T> {
  if (attachedTabId === null) {
    throw new Error('Not attached to any tab');
  }

  return chrome.debugger.sendCommand({ tabId: attachedTabId }, method, params) as Promise<T>;
}

// mouse events
export async function mouseMove(x: number, y: number): Promise<void> {
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y
  });
}

export async function click(x: number, y: number, button: 'left' | 'right' = 'left', clickCount = 1): Promise<void> {
  await mouseMove(x, y);

  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button,
    clickCount
  });

  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button,
    clickCount
  });
}

export async function doubleClick(x: number, y: number): Promise<void> {
  await click(x, y, 'left', 2);
}

export async function rightClick(x: number, y: number): Promise<void> {
  await click(x, y, 'right', 1);
}

// keyboard events
export async function type(text: string): Promise<void> {
  for (const char of text) {
    await sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      text: char
    });
    await sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      text: char
    });
  }
}

export async function pressKey(key: string, modifiers: string[] = []): Promise<void> {
  let modifierFlags = 0;
  if (modifiers.includes('Alt')) modifierFlags |= 1;
  if (modifiers.includes('Control')) modifierFlags |= 2;
  if (modifiers.includes('Meta')) modifierFlags |= 4;
  if (modifiers.includes('Shift')) modifierFlags |= 8;

  await sendCommand('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers: modifierFlags
  });

  await sendCommand('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    modifiers: modifierFlags
  });
}

// scroll
export async function scroll(direction: 'up' | 'down' | 'left' | 'right', pixels = 500): Promise<void> {
  const deltaX = direction === 'left' ? -pixels : direction === 'right' ? pixels : 0;
  const deltaY = direction === 'up' ? -pixels : direction === 'down' ? pixels : 0;

  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 400,
    y: 300,
    deltaX,
    deltaY
  });
}

// screenshot
export async function screenshot(): Promise<string> {
  const result = await sendCommand<{ data: string }>('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 60
  });
  return result.data;
}

// evaluate JS
export async function evaluate(expression: string): Promise<unknown> {
  const result = await sendCommand<{ result: { value: unknown } }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return result.result.value;
}

// get element center from backendNodeId
export async function getElementCenter(backendNodeId: number): Promise<{ x: number; y: number }> {
  const { model } = await sendCommand<{ model: { content: number[] } }>('DOM.getBoxModel', {
    backendNodeId
  });

  const [x1, y1, x2, , , y3] = model.content;
  const x = (x1 + x2) / 2;
  const y = (y1 + y3) / 2;

  return { x, y };
}
