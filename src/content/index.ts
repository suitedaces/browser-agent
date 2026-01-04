import { getA11ySnapshot } from './a11y';
import { showIndicator, hideIndicator } from './indicator';
import { getPageText } from './text';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: { type: string; payload?: unknown }) {
  switch (message.type) {
    case 'snapshot:get': {
      const verbose = (message.payload as { verbose: boolean })?.verbose ?? false;
      const { snapshot, snapshotId } = getA11ySnapshot(verbose);

      // send snapshot id back to background
      chrome.runtime.sendMessage({
        type: 'snapshot:update',
        payload: { snapshotId }
      });

      return { type: 'snapshot:result', payload: snapshot };
    }

    case 'text:get': {
      const text = getPageText();
      return { type: 'text:result', payload: text };
    }

    case 'indicator:show': {
      showIndicator();
      return { ok: true };
    }

    case 'indicator:hide': {
      hideIndicator();
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
