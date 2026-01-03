import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const SERVER_URL = 'http://localhost:19989'

function App() {
  const [task, setTask] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const submit = async () => {
    if (!task.trim() || running) return

    setRunning(true)
    setMessages(['starting...'])

    try {
      const res = await fetch(`${SERVER_URL}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('no reader')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        setMessages(m => [...m, text])
      }
    } catch (e) {
      setMessages(m => [...m, `error: ${(e as Error).message}`])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-screen p-4 bg-neutral-900 text-white">
      <h1 className="text-lg font-bold mb-4">taskhomie</h1>

      <div className="flex-1 overflow-auto mb-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className="text-sm text-neutral-300 font-mono">
            {msg}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="what do you want to do?"
          className="flex-1 px-3 py-2 bg-neutral-800 rounded border border-neutral-700 text-sm focus:outline-none focus:border-blue-500"
          disabled={running}
        />
        <button
          onClick={submit}
          disabled={running}
          className="px-4 py-2 bg-blue-600 rounded text-sm font-medium disabled:opacity-50"
        >
          {running ? '...' : 'go'}
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
