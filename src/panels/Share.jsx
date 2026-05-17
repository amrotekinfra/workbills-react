import { useState, useMemo } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { fmt, parseDate, pCode, pName, pColor, pBg, getCatInfo, SYS_CATS } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Share.module.css'

const PERIODS = [
  { v:'month', l:'This Month' },
  { v:'last',  l:'Last Month' },
  { v:'all',   l:'All Time' },
]

export default function SharePanel() {
  const toast = useToast()
  const { entries, customCats } = useStore()
  const { activeCompany } = usePersistedStore()
  const cfg = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [period,     setPeriod]     = useState('month')
  const [inclCats,   setInclCats]   = useState(true)
  const [inclPeople, setInclPeople] = useState(true)
  const [inclList,   setInclList]   = useState(true)
  const [inclSettle, setInclSettle] = useState(true)
  const [generating, setGenerating] = useState(false)

  const now = new Date()
  const src = useMemo(() => {
    const approved = entries.filter(e => e.status !== 'rejected')
    if (period === 'month') return approved.filter(e => {
      const d = parseDate(e.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    if (period === 'last') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return approved.filter(e => {
        const d = parseDate(e.date)
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
      })
    }
    return approved
  }, [entries, period])

  const periodLabel = period === 'month'
    ? now.toLocaleString('en-IN', { month:'long', year:'numeric' })
    : period === 'last'
    ? new Date(now.getFullYear(), now.getMonth()-1, 1).toLocaleString('en-IN', { month:'long', year:'numeric' })
    : 'All Time'

  const total      = src.reduce((t, e) => t + (e.amount||0), 0)
  const byCat      = Object.entries(src.reduce((m,e) => { m[e.category]=(m[e.category]||0)+(e.amount||0); return m }, {})).sort((a,b)=>b[1]-a[1])
  const byPerson   = Object.entries(src.reduce((m,e) => { if(e.person) m[e.person]=(m[e.person]||0)+(e.amount||0); return m }, {})).sort((a,b)=>b[1]-a[1])

  // Settlement (2-partner)
  let settlement = null
  if (cfg.count === 2) {
    const [c0, c1] = [pCode(0), pCode(1)]
    const [n0, n1] = [cfg.partners[0], cfg.partners[1]]
    const [t0, t1] = [
      src.filter(e=>e.partner===c0).reduce((s,e)=>s+(e.amount||0),0),
      src.filter(e=>e.partner===c1).reduce((s,e)=>s+(e.amount||0),0),
    ]
    const diff = t0 - t1
    settlement = { n0, n1, t0, t1, diff }
  }

  const generateHTML = () => {
    setGenerating(true)

    const catRows = byCat.map(([name, amt]) => {
      const info = getCatInfo(name, customCats)
      const pct  = total > 0 ? Math.round(amt/total*100) : 0
      return `<tr><td>${info.e} ${name}</td><td>${sym}${amt.toLocaleString('en-IN')}</td><td>${pct}%</td></tr>`
    }).join('')

    const peopleRows = byPerson.slice(0, 20).map(([name, amt]) =>
      `<tr><td>${name}</td><td>${sym}${amt.toLocaleString('en-IN')}</td></tr>`
    ).join('')

    const entryRows = [...src].sort((a,b)=>parseDate(b.date)-parseDate(a.date)).map(e =>
      `<tr><td>${e.date}</td><td>${e.person||''}</td><td>${e.description||''}</td><td>${e.category}</td><td style="text-align:right;font-weight:700">${sym}${(e.amount||0).toLocaleString('en-IN')}</td><td>${e.payMode||''}</td></tr>`
    ).join('')

    const settleHTML = settlement ? `
      <div class="card">
        <h2>Settlement</h2>
        <table><tr><th>Partner</th><th>Spent</th></tr>
          <tr><td>${settlement.n0}</td><td>${sym}${settlement.t0.toLocaleString('en-IN')}</td></tr>
          <tr><td>${settlement.n1}</td><td>${sym}${settlement.t1.toLocaleString('en-IN')}</td></tr>
        </table>
        <p class="settle">${Math.abs(settlement.diff) < 1
          ? '✅ Both partners are settled'
          : `💸 ${settlement.diff > 0 ? settlement.n1 : settlement.n0} owes ${settlement.diff > 0 ? settlement.n0 : settlement.n1}: <strong>${sym}${Math.abs(settlement.diff).toLocaleString('en-IN')}</strong>`
        }</p>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${activeCompany?.emoji||'💼'} ${activeCompany?.name||'Company'} — Expense Report ${periodLabel}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8faf9; color:#1a1a1a; padding:24px; }
  .header { background:linear-gradient(135deg,#3a6652,#2b4f3e); color:white; border-radius:16px; padding:28px 24px; margin-bottom:20px; }
  .header h1 { font-size:22px; font-weight:800; margin-bottom:6px; }
  .header p  { font-size:13px; opacity:.8 }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
  .kpi  { background:white; border-radius:12px; padding:18px; text-align:center; border:1px solid #e0e7e4; }
  .kpi .val { font-size:22px; font-weight:800; letter-spacing:-1px; color:#e8920a; }
  .kpi .lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#6b7280; margin-top:4px; }
  .card { background:white; border-radius:12px; padding:20px; margin-bottom:16px; border:1px solid #e0e7e4; }
  .card h2 { font-size:15px; font-weight:800; margin-bottom:14px; color:#1a1a1a; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { padding:8px 12px; text-align:left; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#6b7280; border-bottom:2px solid #e0e7e4; }
  td { padding:9px 12px; border-bottom:1px solid #f0f4f2; }
  tr:last-child td { border-bottom:none }
  .settle { margin-top:14px; font-size:14px; padding:12px; background:#f0fdf4; border-radius:8px; color:#065f46; }
  .footer { text-align:center; font-size:11px; color:#9ca3af; margin-top:24px; }
  @media(max-width:600px){.kpis{grid-template-columns:1fr 1fr}}
  @media print{body{padding:0}.header{border-radius:0}}
</style>
</head>
<body>
<div class="header">
  <h1>${activeCompany?.emoji||'💼'} ${activeCompany?.name||'Company'}</h1>
  <p>Expense Report · ${periodLabel} · Generated ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</p>
</div>

<div class="kpis">
  <div class="kpi"><div class="val">${sym}${total.toLocaleString('en-IN')}</div><div class="lbl">Total Spend</div></div>
  <div class="kpi"><div class="val">${src.length}</div><div class="lbl">Entries</div></div>
  <div class="kpi"><div class="val">${byCat.length}</div><div class="lbl">Categories</div></div>
</div>

${inclCats && byCat.length > 0 ? `
<div class="card">
  <h2>Spend by Category</h2>
  <table><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead>
  <tbody>${catRows}</tbody></table>
</div>` : ''}

${inclPeople && byPerson.length > 0 ? `
<div class="card">
  <h2>Top Payees</h2>
  <table><thead><tr><th>Name</th><th>Total Paid</th></tr></thead>
  <tbody>${peopleRows}</tbody></table>
</div>` : ''}

${inclSettle && settlement ? settleHTML : ''}

${inclList && src.length > 0 ? `
<div class="card">
  <h2>All Entries (${src.length})</h2>
  <table><thead><tr><th>Date</th><th>Person</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th><th>Mode</th></tr></thead>
  <tbody>${entryRows}</tbody></table>
</div>` : ''}

<div class="footer">Generated by WorkBills · workbills.app/${activeCompany?.slug||activeCompany?.id||''}</div>
</body>
</html>`

    const blob = new Blob([html], { type:'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${activeCompany?.name||'report'}-${periodLabel.replace(/\s/g,'-')}.html`.toLowerCase()
    a.click()
    URL.revokeObjectURL(url)
    toast('📥 Report downloaded')
    setGenerating(false)
  }

  return (
    <div className={s.panel}>

      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroIcon}>🔗</div>
        <div className={s.heroTitle}>Share Report</div>
        <div className={s.heroSub}>Generate a clean HTML report you can email, print or share</div>
      </div>

      {/* Period selector */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Report Period</div>
        <div className={s.pillRow}>
          {PERIODS.map(p => (
            <button
              key={p.v}
              className={s.pill + (period===p.v ? ' '+s.pillActive : '')}
              onClick={() => setPeriod(p.v)}
            >{p.l}</button>
          ))}
        </div>
      </div>

      {/* Stats preview */}
      <div className={s.previewKpis}>
        <div className={s.pk}><div className={s.pkVal}>{fmt(total,sym)}</div><div className={s.pkLbl}>Total</div></div>
        <div className={s.pk}><div className={s.pkVal}>{src.length}</div><div className={s.pkLbl}>Entries</div></div>
        <div className={s.pk}><div className={s.pkVal}>{byCat.length}</div><div className={s.pkLbl}>Categories</div></div>
      </div>

      {/* Include sections */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Include in Report</div>
        <div className={s.toggleList}>
          {[
            { key:'cats',    label:'Category breakdown',  state:inclCats,    set:setInclCats },
            { key:'people',  label:'Top payees list',     state:inclPeople,  set:setInclPeople },
            { key:'settle',  label:'Settlement summary',  state:inclSettle,  set:setInclSettle },
            { key:'list',    label:'Full entry list',     state:inclList,    set:setInclList },
          ].map(opt => (
            <div key={opt.key} className={s.toggleRow} onClick={() => opt.set(v=>!v)}>
              <div className={s.toggleLabel}>{opt.label}</div>
              <div className={s.toggle + (opt.state ? ' '+s.toggleOn : '')}>
                <div className={s.toggleThumb} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top categories preview */}
      {byCat.length > 0 && (
        <div className="card" style={{ margin:'0 14px 12px' }}>
          <div className="card-hdr">Preview — {periodLabel}</div>
          <div style={{ padding:'8px 0' }}>
            {byCat.slice(0,5).map(([name,amt]) => {
              const info = getCatInfo(name, customCats)
              const pct  = total > 0 ? Math.round(amt/total*100) : 0
              return (
                <div key={name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px' }}>
                  <span style={{ fontSize:18 }}>{info.e}</span>
                  <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{name}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--txt3)', marginRight:6 }}>{pct}%</div>
                  <div style={{ fontWeight:800, fontSize:13 }}>{fmt(amt,sym)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Generate button */}
      {src.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <p>No entries for {periodLabel}</p>
        </div>
      ) : (
        <div className={s.actions}>
          <button className="btn-amber" onClick={generateHTML} disabled={generating}>
            {generating ? 'Generating…' : `⬇ Download Report (${src.length} entries)`}
          </button>
          <div className={s.hint}>
            Downloads as an HTML file — open in any browser, print to PDF, or email directly.
          </div>
        </div>
      )}
    </div>
  )
}
