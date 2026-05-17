import { useMemo, useState } from 'react'
import { useStore, usePersistedStore } from '../store'
import { fmt, parseDate, pName, pCode, pColor, pBg } from '../lib/supabase'
import s from './DailyDash.module.css'

export default function DailyDash() {
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })

  // Build month options from entries
  const months = useMemo(() => {
    const m = {}
    entries.forEach(e => {
      const p = e.date?.split('/')
      if (!p || p.length !== 3) return
      const k = `${p[2]}-${p[1].padStart(2,'0')}`
      if (!m[k]) m[k] = new Date(+p[2], +p[1]-1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    })
    return Object.entries(m).sort((a,b) => b[0].localeCompare(a[0]))
  }, [entries])

  // Filter to selected month
  const monthEntries = useMemo(() => entries.filter(e => {
    const p = e.date?.split('/')
    if (!p || p.length !== 3) return false
    return `${p[2]}-${p[1].padStart(2,'0')}` === viewMonth
  }), [entries, viewMonth])

  // Group by date, sorted desc
  const byDate = useMemo(() => {
    const map = {}
    monthEntries.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return Object.entries(map)
      .sort((a,b) => parseDate(b[0]) - parseDate(a[0]))
      .map(([date, rows]) => ({
        date,
        rows,
        total: rows.reduce((s,e) => s + (e.amount||0), 0),
      }))
  }, [monthEntries])

  const monthTotal = monthEntries.reduce((s,e) => s + (e.amount||0), 0)
  const maxDay     = Math.max(...byDate.map(d => d.total), 1)

  // Running balance (cumulative from start of month)
  const runningData = [...byDate].reverse().map((d, i, arr) => ({
    ...d,
    running: arr.slice(0, i+1).reduce((s,x) => s + x.total, 0),
  }))

  const today = new Date()
  const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`
  const todayTotal = byDate.find(d => d.date === todayStr)?.total || 0
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)
  const weekTotal = monthEntries.filter(e => parseDate(e.date) >= weekAgo).reduce((s,e) => s + (e.amount||0), 0)

  const fmtDateLabel = str => {
    const p = str?.split('/')
    if (!p || p.length !== 3) return str
    const d = new Date(+p[2], +p[1]-1, +p[0])
    const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === yesterday.getTime()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })
  }

  return (
    <div className={s.panel}>

      {/* Month picker */}
      <div className={s.monthRow}>
        {months.map(([k, label]) => (
          <button key={k} className={s.chip + (viewMonth===k ? ' '+s.chipOn : '')} onClick={() => setViewMonth(k)}>
            {label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className={s.kpis}>
        <div className={s.kpi}>
          <div className={s.kpiVal}>{fmt(todayTotal, sym)}</div>
          <div className={s.kpiLbl}>Today</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiVal}>{fmt(weekTotal, sym)}</div>
          <div className={s.kpiLbl}>Last 7 days</div>
        </div>
        <div className={s.kpi + ' '+s.kpiAccent}>
          <div className={s.kpiVal}>{fmt(monthTotal, sym)}</div>
          <div className={s.kpiLbl}>Month total</div>
        </div>
      </div>

      {/* Day bars */}
      {byDate.length === 0 ? (
        <div className="empty-state"><div className="icon">📅</div><p>No entries for this month</p></div>
      ) : (
        <div className={s.list}>
          {byDate.map(({ date, rows, total }) => (
            <div key={date} className={s.dayBlock}>
              {/* Bar header */}
              <div className={s.dayHdr}>
                <span className={s.dayLbl}>{fmtDateLabel(date)}</span>
                <span className={s.dayTotal}>{fmt(total, sym)}</span>
              </div>
              <div className={s.barWrap}>
                <div className={s.bar} style={{ width: `${Math.round(total/maxDay*100)}%` }} />
              </div>
              {/* Entry mini-rows */}
              <div className={s.entries}>
                {rows.map(e => (
                  <div key={e.id} className={s.eRow}>
                    <span className={s.ePerson}>{e.person}</span>
                    <span className={s.eCat}>{e.category}</span>
                    <span className={s.eAmt}>{fmt(e.amount, sym)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Running total chart (simple line) */}
      {runningData.length > 1 && (
        <div className="card" style={{ margin:'12px 14px' }}>
          <div className="card-hdr">Running Total</div>
          <RunningChart data={runningData} sym={sym} />
        </div>
      )}
    </div>
  )
}

function RunningChart({ data, sym }) {
  const max = data[data.length-1]?.running || 1
  const W = 320, H = 100, PAD = 16
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length-1)) * (W - PAD*2)
    const y = H - PAD - ((d.running / max) * (H - PAD*2))
    return `${x},${y}`
  })
  const last = pts[pts.length-1]?.split(',')

  return (
    <div className={s.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height: H }}>
        <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {last && <circle cx={last[0]} cy={last[1]} r="4" fill="var(--accent)" />}
      </svg>
      <div className={s.chartLabels}>
        <span>{data[0]?.date?.split('/')[0]}</span>
        <span style={{ fontWeight:700, color:'var(--accent)' }}>{fmt(max, sym)}</span>
        <span>{data[data.length-1]?.date?.split('/')[0]}</span>
      </div>
    </div>
  )
}
