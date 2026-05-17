import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { fmt, parseDate, pName, SYS_CATS } from '../lib/supabase'
import s from './AI.module.css'

const QUICK = [
  'Summarise this month\'s spending',
  'Who received the most payments?',
  'Which category is costing the most?',
  'Show me the advance/loan balance',
  'How much did each partner spend this month?',
  'What are my top 5 payees overall?',
  'Any unusual or large expenses?',
  'Compare this month vs last month',
]

function buildContext(entries, activeCompany) {
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const cfg  = partnerConfig(activeCompany)
  const now  = new Date()

  // Summary stats
  const approved = entries.filter(e => e.status !== 'rejected')
  const total    = approved.reduce((s, e) => s + (e.amount || 0), 0)

  const thisMonth = approved.filter(e => {
    const d = parseDate(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthTotal = thisMonth.reduce((s, e) => s + (e.amount || 0), 0)

  // By category
  const byCat = {}
  approved.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })
  const catSummary = Object.entries(byCat).sort((a,b) => b[1]-a[1])
    .map(([n, a]) => `  ${n}: ${sym}${a.toLocaleString('en-IN')}`).join('\n')

  // By person (top 10)
  const byPerson = {}
  approved.forEach(e => { if (e.person) byPerson[e.person] = (byPerson[e.person] || 0) + (e.amount || 0) })
  const personSummary = Object.entries(byPerson).sort((a,b) => b[1]-a[1]).slice(0,10)
    .map(([n, a]) => `  ${n}: ${sym}${a.toLocaleString('en-IN')}`).join('\n')

  // Partner split
  const partnerSplit = cfg.partners.map((name, i) => {
    const code = ['S','R','P3','P4','P5','P6','P7','P8'][i] || `P${i+1}`
    const tot  = approved.filter(e => e.partner === code).reduce((s, e) => s + (e.amount || 0), 0)
    return `  ${name}: ${sym}${tot.toLocaleString('en-IN')}`
  }).join('\n')

  // Recent 20 entries (formatted)
  const recent = [...approved].sort((a,b) => parseDate(b.date) - parseDate(a.date)).slice(0, 20)
    .map(e => `  ${e.date} | ${e.person} | ${e.description || e.category} | ${sym}${e.amount} | ${e.category}${e.payMode ? ' | '+e.payMode : ''}`)
    .join('\n')

  // This month entries
  const thisMonthEntries = thisMonth.sort((a,b) => parseDate(b.date) - parseDate(a.date))
    .map(e => `  ${e.date} | ${e.person} | ${e.description || e.category} | ${sym}${e.amount} | ${e.category}`)
    .join('\n')

  // Advances
  const advances = approved.filter(e => e.category === 'Advance / Hand Loan')
  const advTotal  = advances.reduce((s, e) => s + (e.amount || 0), 0)

  return `You are a helpful construction finance assistant for WorkBills.
Company: ${activeCompany?.name || 'Unknown'} (${activeCompany?.currency || 'INR'})
Partners: ${cfg.partners.join(', ') || 'Solo'}
Today: ${now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}

=== OVERALL SUMMARY ===
Total entries: ${approved.length}
All-time spend: ${sym}${total.toLocaleString('en-IN')}
This month (${now.toLocaleString('en-IN', { month:'long', year:'numeric' })}): ${sym}${monthTotal.toLocaleString('en-IN')} across ${thisMonth.length} entries
Total advances outstanding: ${sym}${advTotal.toLocaleString('en-IN')}

=== SPEND BY CATEGORY ===
${catSummary || '  No data'}

=== TOP PAYEES (all time) ===
${personSummary || '  No data'}

=== PARTNER SPLIT (all time) ===
${partnerSplit || '  N/A (solo mode)'}

=== THIS MONTH'S ENTRIES ===
${thisMonthEntries || '  No entries this month'}

=== RECENT 20 ENTRIES ===
${recent || '  No entries'}

Answer questions about the company's construction expenses concisely. Use ${sym} for amounts. If asked to summarise, give a short paragraph then bullet points. Be direct.`
}

export default function AIPanel() {
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()

  const [messages, setMessages] = useState([
    { role: 'assistant', text: `👋 Hi! I'm your WorkBills AI assistant. I can analyse ${entries.length} expense entries for **${activeCompany?.name || 'your company'}**.\n\nAsk me anything — spending trends, top payees, monthly summaries, advance balances, or anything else.` }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const context = useMemo(() => buildContext(entries, activeCompany), [entries, activeCompany])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg = { role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Build history for multi-turn (last 6 messages, skip the welcome)
    const history = messages.slice(1).concat(userMsg)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: context,
          messages: history,
        })
      })

      const data = await res.json()
      const reply = data.content?.find(b => b.type === 'text')?.text || 'Sorry, I could not get a response. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Connection error. Please check your internet and try again.' }])
    }

    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const clear = () => setMessages([{
    role: 'assistant',
    text: `👋 Conversation cleared. I still have access to all **${entries.length} entries** for ${activeCompany?.name}. Ask me anything!`
  }])

  return (
    <div className={s.panel}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.aiIcon}>🤖</div>
          <div>
            <div className={s.headerTitle}>AI Assistant</div>
            <div className={s.headerSub}>{entries.length} entries · {activeCompany?.name}</div>
          </div>
        </div>
        <button className={s.clearBtn} onClick={clear} title="Clear chat">↺ Clear</button>
      </div>

      {/* Quick prompts */}
      <div className={s.quickRow}>
        {QUICK.map(q => (
          <button key={q} className={s.quickBtn} onClick={() => send(q)} disabled={loading}>{q}</button>
        ))}
      </div>

      {/* Messages */}
      <div className={s.messages}>
        {messages.map((m, i) => (
          <div key={i} className={s.msgWrap + ' ' + (m.role === 'user' ? s.msgUser : s.msgBot)}>
            {m.role === 'assistant' && <div className={s.botAvatar}>🤖</div>}
            <div className={s.bubble}>
              <MdText text={m.text} />
            </div>
          </div>
        ))}
        {loading && (
          <div className={s.msgWrap + ' ' + s.msgBot}>
            <div className={s.botAvatar}>🤖</div>
            <div className={s.bubble + ' ' + s.thinking}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={s.inputBar}>
        <input
          ref={inputRef}
          className={s.input}
          placeholder="Ask anything about your expenses…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          className={s.sendBtn + (loading || !input.trim() ? ' ' + s.sendDisabled : '')}
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}

// Minimal markdown renderer (bold, newlines, bullets)
function MdText({ text }) {
  const lines = text.split('\n')
  return (
    <div className={s.mdText}>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />
        const isBullet = /^[-•*]\s/.test(line)
        const content  = parseBold(isBullet ? line.replace(/^[-•*]\s/, '') : line)
        return isBullet
          ? <div key={i} className={s.mdBullet}>• {content}</div>
          : <div key={i}>{content}</div>
      })}
    </div>
  )
}

function parseBold(line) {
  const parts = line.split(/\*\*(.*?)\*\*/)
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : p
  )
}
