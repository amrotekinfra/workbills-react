import { useState } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { SYS_CATS, getCatInfo, todayISO, pCode } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './WA.module.css'

const EXAMPLES = [
  'Guravaiah 8500 cement bags 50',
  'Pullaiah diesel 3200 JCB',
  'Sai Mestri labour 15000',
  'Raju 500 advance',
  'Sand 3 loads 9600 yesterday',
  'Electrician wiring 4th floor 12000',
]

export default function WAPanel() {
  const toast = useToast()
  const { entries, customCats, setPanel } = useStore()
  const { activeCompany } = usePersistedStore()
  const cfg = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const allCats = [...SYS_CATS, ...customCats.filter(c => !SYS_CATS.find(sc => sc.n === c.n))]
  const catNames = allCats.map(c => c.n).join(', ')

  const [text,    setText]    = useState('')
  const [parsed,  setParsed]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab,     setTab]     = useState('quick') // 'quick' | 'setup'

  const parse = async () => {
    if (!text.trim() || loading) return
    setLoading(true)
    setParsed(null)

    const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) // DD/MM/YYYY
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) })()
    const partners = cfg.partners.map((n, i) => `${n} = code ${pCode(i)}`).join(', ') || 'Single owner (use S)'

    const prompt = `Extract expense details from this text and return ONLY valid JSON (no markdown, no explanation):
Text: "${text}"

Today is ${today}, yesterday is ${yesterday}.
Partners: ${partners}
Categories: ${catNames}

Return JSON with these exact fields:
{
  "person": "payee name",
  "description": "what was it for",
  "amount": 0,
  "category": "best matching category from the list",
  "date": "DD/MM/YYYY",
  "payMode": "UPI",
  "partner": "S",
  "notes": ""
}

Rules:
- person: the name of the person/vendor being paid
- description: brief description of goods/services
- amount: number only, no symbols
- category: must be one of the exact names from the category list
- date: default to ${today} unless text says yesterday or a specific date
- payMode: default to UPI
- partner: default to ${pCode(0)} (first partner)
- notes: any remaining context

Return ONLY the JSON object.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await res.json()
      const raw  = data.content?.find(b => b.type === 'text')?.text || ''
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed  = JSON.parse(cleaned)
      setParsed(parsed)
    } catch (e) {
      toast('Could not parse — try rephrasing')
    }

    setLoading(false)
  }

  const useEntry = () => {
    sessionStorage.setItem('wb_prefill', JSON.stringify(parsed))
    setPanel('add')
    toast('📋 Entry pre-filled — check & save')
  }

  const info = parsed ? getCatInfo(parsed.category, customCats) : null

  return (
    <div className={s.panel}>
      {/* Tab nav */}
      <div className={s.tabs}>
        <button className={s.tab + (tab==='quick' ? ' '+s.tabActive : '')} onClick={() => setTab('quick')}>
          ⚡ Quick Add
        </button>
        <button className={s.tab + (tab==='setup' ? ' '+s.tabActive : '')} onClick={() => setTab('setup')}>
          💬 WhatsApp Setup
        </button>
      </div>

      {tab === 'quick' ? (
        /* ── Quick natural language add ── */
        <div className={s.quickTab}>
          <div className={s.intro}>
            <div className={s.introIcon}>⚡</div>
            <div>
              <div className={s.introTitle}>Quick Add by Text</div>
              <div className={s.introSub}>Type an expense naturally — AI extracts the details for you</div>
            </div>
          </div>

          {/* Example chips */}
          <div className={s.exRow}>
            {EXAMPLES.map(ex => (
              <button key={ex} className={s.exChip} onClick={() => setText(ex)} disabled={loading}>{ex}</button>
            ))}
          </div>

          {/* Input */}
          <div className={s.inputWrap}>
            <textarea
              className={s.textarea}
              placeholder="e.g. Guravaiah 8500 cement bags&#10;Pullaiah diesel 3200 for JCB&#10;Sai Mestri 15000 drain work"
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button
              className={s.parseBtn + (loading || !text.trim() ? ' '+s.parseBtnDis : '')}
              onClick={parse}
              disabled={loading || !text.trim()}
            >
              {loading ? '…Parsing' : '✦ Parse with AI'}
            </button>
          </div>

          {/* Parsed preview */}
          {parsed && (
            <div className={s.preview}>
              <div className={s.previewHdr}>✅ Parsed — check and confirm</div>
              <div className={s.previewCard}>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Person</span>
                  <input className={s.previewInput} value={parsed.person} onChange={e => setParsed({...parsed, person: e.target.value})} />
                </div>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Description</span>
                  <input className={s.previewInput} value={parsed.description} onChange={e => setParsed({...parsed, description: e.target.value})} />
                </div>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Amount</span>
                  <input className={s.previewInput} type="number" value={parsed.amount} onChange={e => setParsed({...parsed, amount: +e.target.value})} />
                </div>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Category</span>
                  <select className={s.previewInput} value={parsed.category} onChange={e => setParsed({...parsed, category: e.target.value})}>
                    {allCats.map(c => <option key={c.n}>{c.n}</option>)}
                  </select>
                </div>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Date</span>
                  <input className={s.previewInput} value={parsed.date} onChange={e => setParsed({...parsed, date: e.target.value})} />
                </div>
                <div className={s.previewRow}>
                  <span className={s.previewKey}>Category match</span>
                  <span className={s.catBadge} style={{ background: info?.c+'18', color: info?.c }}>{info?.e} {parsed.category}</span>
                </div>
              </div>
              <div className={s.previewActions}>
                <button className="btn-ghost" onClick={() => { setParsed(null); setText('') }}>✕ Discard</button>
                <button className="btn-amber" onClick={useEntry}>Use this entry →</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── WhatsApp Setup guide ── */
        <div className={s.setupTab}>
          <div className={s.setupHero}>
            <div className={s.waIcon}>💬</div>
            <h2>Log expenses via WhatsApp</h2>
            <p>Coming in a future update — here's how it will work and how to prepare.</p>
          </div>

          <div className="card" style={{ margin:'0 14px 12px' }}>
            <div className="card-hdr">How it will work</div>
            <div className={s.stepList}>
              {[
                { n:'1', t:'Send a WhatsApp message', d:'Just text your expense like you\'d tell someone: "Raju 5000 sand" or "Guravaiah cement bags 8400"' },
                { n:'2', t:'AI extracts the details',  d:'The bot identifies person, amount, category and date automatically — no fixed format needed' },
                { n:'3', t:'Confirms before saving',   d:'You\'ll get a reply to confirm. Say "yes" to save or "edit amount 9000" to correct it' },
                { n:'4', t:'Entry appears in the app', d:'The expense is saved and visible to your whole team in real time' },
              ].map(step => (
                <div key={step.n} className={s.step}>
                  <div className={s.stepNum}>{step.n}</div>
                  <div>
                    <div className={s.stepTitle}>{step.t}</div>
                    <div className={s.stepDesc}>{step.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ margin:'0 14px 12px' }}>
            <div className="card-hdr">Your company URL</div>
            <div style={{ padding:'12px 14px' }}>
              <p style={{ fontSize:13, color:'var(--txt3)', marginBottom:12, lineHeight:1.6 }}>
                Share this link with your team — they can log in and access the app directly:
              </p>
              <div className={s.urlBox}>
                <span className={s.urlText}>workbills.app/{activeCompany?.slug || activeCompany?.id || 'your-company'}</span>
                <button className={s.copyBtn} onClick={() => {
                  navigator.clipboard?.writeText(`https://workbills.app/${activeCompany?.slug || activeCompany?.id}`)
                  toast('Copied!')
                }}>Copy</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ margin:'0 14px 16px' }}>
            <div className="card-hdr">In the meantime</div>
            <div style={{ padding:'12px 14px 14px' }}>
              <p style={{ fontSize:13, color:'var(--txt3)', marginBottom:12, lineHeight:1.6 }}>
                Use the <strong>⚡ Quick Add</strong> tab above to log expenses by typing naturally — same AI parsing, works right now.
              </p>
              <button className="btn-prim" onClick={() => setTab('quick')}>Try Quick Add →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
