import { useState, useRef, useEffect } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { fmt, parseDate, SYS_CATS, pName } from '../lib/supabase'
import s from './AIAssistant.module.css'

const SUGGESTIONS = [
  'What did I spend the most on this month?',
  'Who received the highest total payments?',
  'Compare partner spending this month',
  'Which category is over budget?',
  'What were the largest single payments?',
  'Give me a weekly summary for this month',
  'Any unusual or suspicious entries?',
  'What\'s the trend in my labour costs?',
]

function buildContext(entries, company, customCats) {
  const cfg = partnerConfig(company)
  const now  = new Date()
  // Last 3 months of approved entries only
  const cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 3)
  const src = entries.filter(e => e.status !== 'rejected' && parseDate(e.date) >= cutoff)

  const lines = src.map(e =>
    `${e.date} | ${e.category} | ${e.person || '—'} | ${e.description || '—'} | ₹${e.amount} | ${pName(e.partner, company) || '—'} | ${e.payMode || '—'}`
  ).join('\n')

  const totByCat = {}
  src.forEach(e => { totByCat[e.category] = (totByCat[e.category] || 0) + e.amount })
  const catSummary = Object.entries(totByCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ₹${v.toLocaleString('en-IN')}`).join(', ')

  return `You are a construction expense analyst for "${company?.name || 'this company'}" in India.
Currency: ${company?.currency || 'INR'}. Partners: ${cfg.partners.join(', ') || 'Solo'}.

EXPENSE DATA (last 3 months, ${src.length} entries):
Date | Category | Person | Description | Amount | Partner | PayMode
${lines}

CATEGORY TOTALS: ${catSummary}

Answer questions about these expenses directly and concisely. Use ₹ for amounts. Be specific with numbers. If data is missing or unclear, say so.`
}

export default function AIAssistant() {
  const { entries, customCats } = useStore()
  const { activeCompany }       = usePersistedStore()

  const [messages, setMessages]   = useState([{
    role: 'assistant',
    content: `👋 Hi! I can answer questions about your expenses — spending patterns, top categories, partner comparisons, unusual entries, and more.\n\nI have access to your last 3 months of data (${entries.filter(e=>e.status!=='rejected').length} entries). What would you like to know?`
  }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg  = { role: 'user', content: q }
    const thinking = { role: 'assistant', content: '...', thinking: true }
    setMessages(prev => [...prev, userMsg, thinking])
    setLoading(true)

    try {
      const systemPrompt = buildContext(entries, activeCompany, customCats)
      // Build conversation history (exclude the thinking placeholder)
      const history = [...messages, userMsg]
        .filter(m => !m.thinking)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: history,
        })
      })

      const data = await res.json()
      const reply = data.content?.find(b => b.type === 'text')?.text
        || data.error?.message
        || 'Sorry, I couldn\'t get a response. Please try again.'

      setMessages(prev => [
        ...prev.filter(m => !m.thinking),
        { role: 'assistant', content: reply }
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => !m.thinking),
        { role: 'assistant', content: '⚠️ Connection error. Make sure you\'re online and try again.' }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const clearChat = () => setMessages([{
    role: 'assistant',
    content: `Chat cleared. I still have access to your ${entries.filter(e=>e.status!=='rejected').length} entries. What would you like to know?`
  }])

  return (
    <div className={s.panel}>

      {/* Header */}
      <div className={s.hdr}>
        <div className={s.hdrLeft}>
          <div className={s.aiIcon}>🤖</div>
          <div>
            <div className={s.title}>AI Assistant</div>
            <div className={s.sub}>{entries.filter(e=>e.status!=='rejected').length} entries in context</div>
          </div>
        </div>
        <button className={s.clearBtn} onClick={clearChat} title="Clear chat">↺ Clear</button>
      </div>

      {/* Messages */}
      <div className={s.messages}>
        {messages.map((m, i) => (
          <div key={i} className={s.msg + ' ' + (m.role === 'user' ? s.msgUser : s.msgAI)}>
            {m.role === 'assistant' && (
              <div className={s.aiAvatar}>🤖</div>
            )}
            <div className={s.bubble + ' ' + (m.role === 'user' ? s.bubbleUser : s.bubbleAI)}>
              {m.thinking
                ? <ThinkingDots />
                : <MessageText text={m.content} />
              }
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only if no user messages yet) */}
      {messages.filter(m => m.role === 'user').length === 0 && (
        <div className={s.suggestions}>
          {SUGGESTIONS.map(sug => (
            <button key={sug} className={s.sug} onClick={() => send(sug)}>
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className={s.inputRow}>
        <input
          ref={inputRef}
          className={s.input}
          placeholder="Ask about your expenses…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          className={s.sendBtn + (loading ? ' ' + s.sendBtnLoading : '')}
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '▶'}
        </button>
      </div>
    </div>
  )
}

// Renders text with basic markdown (bold, newlines, lists)
function MessageText({ text }) {
  const lines = text.split('\n')
  return (
    <div className={s.msgText}>
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <br key={i} />
        // Bold **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <div key={i} className={trimmed.startsWith('- ') || trimmed.startsWith('• ') ? s.listItem : ''}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className={s.dots}>
      <span /><span /><span />
    </div>
  )
}
