import { useMemo, useState } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { fmt, parseDate, pCode, pName, pColor, pBg } from '../lib/supabase'
import s from './DashPanel.module.css'

export default function DashPanel() {
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const cfg = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const [filterP, setFilterP] = useState('all')

  const src = useMemo(() =>
    entries.filter(e => e.status !== 'rejected' && (filterP === 'all' || e.partner === filterP))
  , [entries, filterP])

  // ── Today / week / month totals ────────────────────────────
  const now     = new Date()
  const todayStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
  const weekAgo  = new Date(now); weekAgo.setDate(now.getDate() - 7)
  const monthSrc = src.filter(e => {
    const d = parseDate(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const todaySrc  = src.filter(e => e.date === todayStr)
  const weekSrc   = src.filter(e => parseDate(e.date) >= weekAgo)
  const todayAmt  = todaySrc.reduce((s,e)=>s+e.amount,0)
  const weekAmt   = weekSrc.reduce((s,e)=>s+e.amount,0)
  const monthAmt  = monthSrc.reduce((s,e)=>s+e.amount,0)

  // ── Bar chart — last 14 days ───────────────────────────────
  const bars = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      const amt = src.filter(e => e.date === key).reduce((s,e)=>s+e.amount,0)
      const isToday = i === 0
      const label = i === 0 ? 'T' : i === 7 ? '-7' : d.getDate() === 1 ? `${d.getDate()}` : String(d.getDate())
      days.push({ key, amt, isToday, label, d })
    }
    return days
  }, [src])

  const maxAmt = Math.max(...bars.map(b => b.amt), 1)

  // ── Recent entries (today or last 5) ──────────────────────
  const recentEntries = src.slice(0, 8)

  return (
    <div className={s.panel}>

      {/* Partner tabs */}
      {cfg.isMulti && (
        <div className={s.tabs}>
          <button className={s.tab+(filterP==='all'?' '+s.tabActive:'')} onClick={()=>setFilterP('all')}>All</button>
          {cfg.partners.map((n,i)=>{
            const code = pCode(i)
            return <button key={code} className={s.tab+(filterP===code?' '+s.tabActive:'')}
              style={filterP===code?{background:pColor(code),color:'white',borderColor:pColor(code)}:{}}
              onClick={()=>setFilterP(filterP===code?'all':code)}>{n}</button>
          })}
        </div>
      )}

      {/* KPI strip */}
      <div className={s.kpis}>
        <Kpi label="Today"     val={fmt(todayAmt, sym)} count={todaySrc.length}  color="#3a6652" />
        <Kpi label="This Week" val={fmt(weekAmt,  sym)} count={weekSrc.length}   color="#7c3aed" />
        <Kpi label="Month"     val={fmt(monthAmt, sym)} count={monthSrc.length}  color="#e8920a" />
      </div>

      {/* Bar chart */}
      <div className="card" style={{margin:'0 14px 12px'}}>
        <div className="card-hdr">Last 14 Days</div>
        <div className={s.chartWrap}>
          {bars.map(b => (
            <div key={b.key} className={s.barCol}>
              <div className={s.barTrack}>
                <div
                  className={s.barFill+(b.isToday?' '+s.barToday:'')}
                  style={{ height: b.amt > 0 ? Math.max(4, Math.round(b.amt/maxAmt*100))+'%' : '2px', opacity: b.amt>0?1:0.3 }}
                  title={fmt(b.amt,sym)}
                />
              </div>
              <div className={s.barLabel+(b.isToday?' '+s.barLabelToday:'')}>{b.label}</div>
            </div>
          ))}
        </div>
        <div className={s.chartFooter}>
          <span>Max day: {fmt(maxAmt, sym)}</span>
          <span>Avg: {fmt(monthSrc.reduce((s,e)=>s+e.amount,0) / (new Set(monthSrc.map(e=>e.date)).size||1), sym)}/day</span>
        </div>
      </div>

      {/* Today's entries */}
      <div className="card" style={{margin:'0 14px 12px'}}>
        <div className="card-hdr">{todaySrc.length > 0 ? "Today's Entries" : "Recent Entries"}</div>
        {recentEntries.length === 0
          ? <div className={s.empty}>No entries yet today</div>
          : recentEntries.map(e => (
            <div key={e.id} className={s.eRow}>
              <div className={s.ePerson}>{e.person}</div>
              <div className={s.eDesc}>{e.description}</div>
              <div className={s.eAmt}>{fmt(e.amount, sym)}</div>
              {cfg.isMulti && <div className={s.eDot} style={{background:pBg(e.partner),color:pColor(e.partner)}}>{(pName(e.partner,activeCompany)||'?').charAt(0)}</div>}
            </div>
          ))
        }
        {todaySrc.length > 0 && (
          <div className={s.dayTotal}>
            <span>Today total</span>
            <span className={s.dayTotalAmt}>{fmt(todayAmt,sym)}</span>
          </div>
        )}
      </div>

      {/* Daily table — last 7 days */}
      <div className="card" style={{margin:'0 14px 12px'}}>
        <div className="card-hdr">Day-by-Day</div>
        <table className={s.tbl}>
          <thead><tr><th>Date</th><th>Entries</th><th>Amount</th></tr></thead>
          <tbody>
            {bars.slice(-7).reverse().map(b => (
              <tr key={b.key} className={b.isToday ? s.tblToday : ''}>
                <td>{b.isToday ? 'Today' : b.d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</td>
                <td style={{color:'var(--txt3)'}}>{src.filter(e=>e.date===b.key).length}</td>
                <td className={s.tblAmt}>{b.amt>0?fmt(b.amt,sym):'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function Kpi({ label, val, count, color }) {
  return (
    <div className={s.kpi}>
      <div className={s.kpiStripe} style={{background:color}} />
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiVal}>{val}</div>
      <div className={s.kpiCount}>{count} entries</div>
    </div>
  )
}
