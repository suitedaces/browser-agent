let mediaRecorder: MediaRecorder | null = null;
let deepgramSocket: WebSocket | null = null;
let audioQueue: string[] = [];
let isPlaying = false;

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'ptt:start':
      startRecording(message.payload.deepgramKey);
      break;
    case 'ptt:stop':
      stopRecording();
      break;
    case 'tts:play':
      queueAudio(message.payload);
      break;
  }
});

async function startRecording(deepgramKey: string): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    deepgramSocket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true`,
      ['token', deepgramKey]
    );

    let accumulatedText = '';

    deepgramSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;

      if (transcript) {
        if (data.is_final) {
          accumulatedText += (accumulatedText ? ' ' : '') + transcript;
          chrome.runtime.sendMessage({ type: 'ptt:interim', payload: accumulatedText });
        } else {
          chrome.runtime.sendMessage({ type: 'ptt:interim', payload: accumulatedText + ' ' + transcript });
        }
      }
    };

    deepgramSocket.onclose = () => {
      if (accumulatedText) {
        chrome.runtime.sendMessage({ type: 'ptt:final', payload: accumulatedText });
      }
    };

    deepgramSocket.onerror = () => {
      chrome.runtime.sendMessage({ type: 'ptt:error', payload: 'Deepgram connection error' });
    };

    await new Promise<void>((resolve) => {
      deepgramSocket!.onopen = () => resolve();
    });

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && deepgramSocket?.readyState === WebSocket.OPEN) {
        deepgramSocket.send(event.data);
      }
    };

    mediaRecorder.start(250);
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'ptt:error', payload: String(e) });
  }
}

function stopRecording(): void {
  mediaRecorder?.stop();
  mediaRecorder = null;

  deepgramSocket?.close();
  deepgramSocket = null;
}

function queueAudio(base64: string): void {
  audioQueue.push(base64);
  if (!isPlaying) {
    playNext();
  }
}

function playNext(): void {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const base64 = audioQueue.shift()!;

  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.onended = () => playNext();
  audio.onerror = () => playNext();
  audio.play();
}
