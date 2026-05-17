import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { SYS_CATS, fmt, parseDate, pCode, pName, pColor } from '../lib/supabase'
import s from './AIChat.module.css'

const QUICK = [
  'What is my total spend this month?',
  'Which category has the highest spend?',
  'Who are my top 5 payees?',
  'What is the partner split this month?',
  'How much have I spent on Labour this month?',
  'Show me all advances given this month',
  'What was the biggest single expense?',
  'Give me a closing summary for today',
]

function buildContext(entries, company, customCats) {
  const sym = company?.currency === 'USD' ? '$' : company?.currency === 'EUR' ? '€' : '₹'
  const now  = new Date()
  const thisMonth = entries.filter(e => {
    const d = parseDate(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      && e.status !== 'rejected'
  })
  const allApproved = entries.filter(e => e.status !== 'rejected')

  const catTotals = {}
  allApproved.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0) })

  const monthCatTotals = {}
  thisMonth.forEach(e => { monthCatTotals[e.category] = (monthCatTotals[e.category] || 0) + (e.amount || 0) })

  const personTotals = {}
  allApproved.forEach(e => { personTotals[e.person] = (personTotals[e.person] || 0) + (e.amount || 0) })

  const cfg = partnerConfig(company)
  const partnerTotals = cfg.partners.map((name, i) => {
    const code = pCode(i)
    const tot  = allApproved.filter(e => e.partner === code).reduce((s, e) => s + (e.amount || 0), 0)
    return `${name}: ${fmt(tot, sym)}`
  })

  const monthTotal = thisMonth.reduce((s, e) => s + (e.amount || 0), 0)
  const allTotal   = allApproved.reduce((s, e) => s + (e.amount || 0), 0)

  const topPayees = Object.entries(personTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, amt]) => `  ${name}: ${fmt(amt, sym)}`).join('\n')

  const catBreakdown = Object.entries(monthCatTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  ${cat}: ${fmt(amt, sym)}`).join('\n')

  const recent50 = [...allApproved]
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    .slice(0, 50)
    .map(e => `  ${e.date} | ${e.person} | ${e.description || ''} | ${e.category} | ${fmt(e.amount, sym)} | Partner:${e.partner || '?'}`)
    .join('\n')

  const pendingCount = entries.filter(e => e.status === 'pending').length

  return `You are a smart expense analysis assistant for WorkBills, a construction expense tracking app.

COMPANY: ${company?.emoji || '🏗️'} ${company?.name || 'Unknown'}
CURRENCY: ${company?.currency || 'INR'} (symbol: ${sym})
PARTNERS: ${cfg.partners.join(', ') || 'Solo'}
TODAY: ${now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}

SUMMARY:
- Total all-time spend: ${fmt(allTotal, sym)}
- This month spend: ${fmt(monthTotal, sym)}
- Total entries: ${allApproved.length}
- Pending approval: ${pendingCount}

PARTNER TOTALS (all time):
${partnerTotals.join('\n') || '  N/A'}

THIS MONTH — BY CATEGORY:
${catBreakdown || '  No entries this month'}

TOP PAYEES (all time):
${topPayees || '  No payees yet'}

RECENT 50 ENTRIES (date | person | description | category | amount | partner):
${recent50 || '  No entries yet'}

Answer questions about these expenses clearly and helpfully. Use ${sym} for amounts. Be concise. If asked for a summary, format it nicely with bullet points. Always answer in the same language the user writes in.`
}

export default function AIChat() {
  const { entries, customCats } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const systemContext = useMemo(
    () => buildContext(entries, activeCompany, customCats),
    [entries, activeCompany, customCats]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const userMsg = { role: 'user', content: q }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemContext,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not get a response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Check your internet and try again.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => setMessages([])

  return (
    <div className={s.panel}>

      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.aiAvatar}>🤖</div>
          <div>
            <div className={s.aiName}>WorkBills AI</div>
            <div className={s.aiSub}>Knows your {entries.length} entries · {activeCompany?.name}</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button className={s.clearBtn} onClick={clearChat}>Clear</button>
        )}
      </div>

      {/* Messages */}
      <div className={s.messages}>
        {messages.length === 0 ? (
          <div className={s.welcome}>
            <div className={s.welcomeIcon}>💬</div>
            <div className={s.welcomeTitle}>Ask anything about your expenses</div>
            <div className={s.welcomeSub}>
              I have full access to your {entries.length} entries and can answer questions,
              calculate totals, find patterns, or give you a closing summary.
            </div>
            <div className={s.quickGrid}>
              {QUICK.map(q => (
                <button key={q} className={s.quickBtn} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={s.msgRow + ' ' + (m.role === 'user' ? s.msgUser : s.msgAI)}>
              {m.role === 'assistant' && <div className={s.msgAvatar}>🤖</div>}
              <div className={s.bubble}>
                {m.content.split('\n').map((line, j) => (
                  <div key={j} className={line.startsWith('  ') || line.startsWith('- ') || line.startsWith('•') ? s.bulletLine : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className={s.msgRow + ' ' + s.msgAI}>
            <div className={s.msgAvatar}>🤖</div>
            <div className={s.bubble + ' ' + s.typingBubble}>
              <span className={s.dot} /><span className={s.dot} /><span className={s.dot} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips (show while chatting) */}
      {messages.length > 0 && (
        <div className={s.chips}>
          {QUICK.slice(0, 4).map(q => (
            <button key={q} className={s.chip} onClick={() => send(q)} disabled={loading}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className={s.inputRow}>
        <textarea
          ref={inputRef}
          className={s.inputBox}
          placeholder="Ask about your expenses…"
          value={input}
          rows={1}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button
          className={s.sendBtn + ((!input.trim() || loading) ? ' ' + s.sendBtnOff : '')}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >➤</button>
      </div>
    </div>
  )
}
