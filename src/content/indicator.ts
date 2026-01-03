let overlay: HTMLDivElement | null = null;
let stopButton: HTMLButtonElement | null = null;

export function showIndicator(): void {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = 'taskhomie-indicator';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2147483647;
    box-shadow: inset 0 0 0 4px #f97316, inset 0 0 20px rgba(249, 115, 22, 0.3);
  `;
  document.body.appendChild(overlay);

  stopButton = document.createElement('button');
  stopButton.id = 'taskhomie-stop';
  stopButton.textContent = '⬛ Stop';
  stopButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    padding: 8px 16px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    pointer-events: auto;
  `;
  stopButton.onclick = () => {
    chrome.runtime.sendMessage({ type: 'agent:stop' });
  };
  document.body.appendChild(stopButton);
}

export function hideIndicator(): void {
  overlay?.remove();
  overlay = null;
  stopButton?.remove();
  stopButton = null;
}
