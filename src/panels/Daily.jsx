import { useMemo, useState } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { fmt, parseDate, pCode, pName, pColor } from '../lib/supabase'
import s from './Daily.module.css'

export default function DailyPanel() {
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const cfg = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const now   = new Date()
  const [yr,  setYr]  = useState(now.getFullYear())
  const [mon, setMon] = useState(now.getMonth()) // 0-indexed

  const monthLabel = new Date(yr, mon, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const prevMonth = () => { if (mon === 0) { setMon(11); setYr(y => y - 1) } else setMon(m => m - 1) }
  const nextMonth = () => {
    const n = new Date(); if (yr > n.getFullYear() || (yr === n.getFullYear() && mon >= n.getMonth())) return
    if (mon === 11) { setMon(0); setYr(y => y + 1) } else setMon(m => m + 1)
  }

  // Filter approved entries for selected month
  const src = useMemo(() =>
    entries.filter(e => {
      if (e.status === 'rejected') return false
      const d = parseDate(e.date)
      return d.getMonth() === mon && d.getFullYear() === yr
    }),
  [entries, mon, yr])

  // Group by date, sorted ascending
  const byDate = useMemo(() => {
    const map = {}
    src.forEach(e => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e) })
    return Object.entries(map)
      .sort((a, b) => parseDate(a[0]) - parseDate(b[0]))
      .map(([date, rows]) => ({
        date,
        dayLabel: parseDate(date).toLocaleDateString('en-IN', { weekday:'short', day:'numeric' }),
        total: rows.reduce((s, e) => s + (e.amount || 0), 0),
        rows,
      }))
  }, [src])

  const grandTotal = src.reduce((s, e) => s + (e.amount || 0), 0)
  const maxDay     = Math.max(...byDate.map(d => d.total), 1)

  // Running total data
  const running = useMemo(() => {
    let cum = 0
    return byDate.map(d => { cum += d.total; return cum })
  }, [byDate])

  return (
    <div className={s.panel}>

      {/* Month nav */}
      <div className={s.monthNav}>
        <button className={s.navBtn} onClick={prevMonth}>‹</button>
        <div className={s.monthLabel}>{monthLabel}</div>
        <button className={s.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Month KPI */}
      <div className={s.kpiRow}>
        <div className={s.kpi}>
          <div className={s.kpiVal}>{fmt(grandTotal, sym)}</div>
          <div className={s.kpiLbl}>Total spend</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiVal}>{byDate.length}</div>
          <div className={s.kpiLbl}>Active days</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiVal}>{byDate.length > 0 ? fmt(grandTotal / byDate.length, sym) : '—'}</div>
          <div className={s.kpiLbl}>Avg / day</div>
        </div>
      </div>

      {byDate.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <p>No entries for {monthLabel}</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="card" style={{ margin:'0 14px 12px' }}>
            <div className="card-hdr">Daily Spend — {monthLabel}</div>
            <div className={s.chart}>
              {byDate.map((d, i) => (
                <div key={d.date} className={s.barCol}>
                  <div className={s.barWrap}>
                    <div
                      className={s.bar}
                      style={{ height: Math.max(4, (d.total / maxDay) * 120) + 'px' }}
                      title={fmt(d.total, sym)}
                    />
                    {/* Running total dot */}
                    <div
                      className={s.runDot}
                      style={{ bottom: Math.max(4, (running[i] / (running[running.length - 1] || 1)) * 120) + 'px' }}
                    />
                  </div>
                  <div className={s.barLbl}>{d.dayLabel.split(' ')[1]}</div>
                </div>
              ))}
            </div>
            <div className={s.chartLegend}>
              <span className={s.legendBar}>■ Daily spend</span>
              <span className={s.legendDot}>● Running total</span>
            </div>
          </div>

          {/* Day-by-day table */}
          <div className="card" style={{ margin:'0 14px 12px' }}>
            <div className="card-hdr">Day-by-Day Breakdown</div>
            <table className={s.tbl}>
              <thead>
                <tr>
                  <th>Day</th>
                  {cfg.isMulti && cfg.partners.map((p, i) => (
                    <th key={i} style={{ color: pColor(pCode(i)) }}>{p}</th>
                  ))}
                  <th>Total</th>
                  <th>Running</th>
                </tr>
              </thead>
              <tbody>
                {byDate.map((d, i) => {
                  const partnerTots = cfg.partners.map((_, pi) => {
                    const code = pCode(pi)
                    return d.rows.filter(r => r.partner === code).reduce((s, r) => s + (r.amount || 0), 0)
                  })
                  return (
                    <tr key={d.date}>
                      <td className={s.dayCell}>{d.dayLabel}</td>
                      {cfg.isMulti && partnerTots.map((t, pi) => (
                        <td key={pi} style={{ color: t ? pColor(pCode(pi)) : 'var(--txt4)', fontWeight: t ? 700 : 400 }}>
                          {t ? fmt(t, sym) : '—'}
                        </td>
                      ))}
                      <td className={s.totalCell}>{fmt(d.total, sym)}</td>
                      <td className={s.runCell}>{fmt(running[i], sym)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className={s.footLbl}>Month Total</td>
                  {cfg.isMulti && cfg.partners.map((_, pi) => {
                    const code = pCode(pi)
                    const tot  = src.filter(e => e.partner === code).reduce((s, e) => s + (e.amount || 0), 0)
                    return <td key={pi} style={{ fontWeight:800, color: pColor(code) }}>{fmt(tot, sym)}</td>
                  })}
                  <td className={s.footTotal}>{fmt(grandTotal, sym)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Top spenders this month */}
          <div className="card" style={{ margin:'0 14px 16px' }}>
            <div className="card-hdr">Top Payees this Month</div>
            <div className={s.payeeList}>
              {Object.entries(
                src.reduce((acc, e) => { acc[e.person] = (acc[e.person] || 0) + e.amount; return acc }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([name, amt]) => (
                  <div key={name} className={s.payeeRow}>
                    <div className={s.payeeName}>{name}</div>
                    <div className={s.payeeBar}>
                      <div className={s.payeeBarFill} style={{ width: (amt / grandTotal * 100) + '%' }} />
                    </div>
                    <div className={s.payeeAmt}>{fmt(amt, sym)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
