import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { fmt, parseDate } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Workers.module.css'

export default function Workers() {
  const toast = useToast()
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)   // selected worker name
  const [showAddAdv, setShowAddAdv] = useState(false)

  // Build worker ledger from entries
  // Workers are people who appear in Labour/Advance categories
  const WORKER_CATS = ['Labour & Wages', 'Advance / Hand Loan']

  const workerMap = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const isWorker = WORKER_CATS.includes(e.category) || e.category?.toLowerCase().includes('labour') || e.category?.toLowerCase().includes('advance')
      if (!isWorker && !e.person) return
      const name = e.person?.trim()
      if (!name) return
      if (!map[name]) map[name] = { name, advances: 0, wages: 0, other: 0, entries: [] }
      if (e.category === 'Advance / Hand Loan') map[name].advances += e.amount || 0
      else if (e.category === 'Labour & Wages')  map[name].wages    += e.amount || 0
      else                                        map[name].other    += e.amount || 0
      map[name].entries.push(e)
    })
    return map
  }, [entries])

  // Include ALL persons (not just workers) — more useful
  const allPersonMap = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const name = e.person?.trim()
      if (!name) return
      if (!map[name]) map[name] = { name, total: 0, advances: 0, wages: 0, other: 0, entries: [] }
      if (e.category === 'Advance / Hand Loan') map[name].advances += e.amount || 0
      else if (e.category === 'Labour & Wages')  map[name].wages    += e.amount || 0
      else                                        map[name].other    += e.amount || 0
      map[name].total += e.amount || 0
      map[name].entries.push(e)
    })
    return map
  }, [entries])

  const workers = Object.values(allPersonMap)
    .filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.total - a.total)

  const sel = selected ? allPersonMap[selected] : null

  // Ledger sorted by date
  const ledger = sel ? [...sel.entries].sort((a,b) => parseDate(b.date) - parseDate(a.date)) : []

  return (
    <div className={s.panel}>
      {!selected ? (
        <>
          <div className={s.toolbar}>
            <h2 className={s.title}>Workers & Payees</h2>
            <span className={s.count}>{workers.length} people</span>
          </div>

          <div className={s.searchBar}>
            <span>🔍</span>
            <input className={s.searchInput} placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {workers.length === 0 ? (
            <div className="empty-state"><div className="icon">👷</div><p>Add entries with a person name to see the ledger</p></div>
          ) : (
            <div className={s.list}>
              {workers.map(w => {
                const balance = w.wages - w.advances
                return (
                  <div key={w.name} className={s.workerRow} onClick={() => setSelected(w.name)}>
                    <div className={s.avatar}>{w.name.charAt(0).toUpperCase()}</div>
                    <div className={s.workerInfo}>
                      <div className={s.workerName}>{w.name}</div>
                      <div className={s.workerMeta}>
                        {w.advances > 0 && <span className={s.tag + ' '+s.tagAdv}>Adv {fmt(w.advances,sym)}</span>}
                        {w.wages    > 0 && <span className={s.tag + ' '+s.tagWage}>Wages {fmt(w.wages,sym)}</span>}
                        <span className={s.tag}>{w.entries.length} entries</span>
                      </div>
                    </div>
                    <div className={s.workerRight}>
                      <div className={s.workerTotal}>{fmt(w.total, sym)}</div>
                      <div className={s.chevron}>›</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* ── Worker detail ledger ── */
        <div className={s.detail}>
          <div className={s.detailHdr}>
            <button className={s.backBtn} onClick={() => setSelected(null)}>← Back</button>
            <h2 className={s.detailName}>{sel.name}</h2>
          </div>

          {/* Summary cards */}
          <div className={s.detailKpis}>
            <div className={s.dKpi}>
              <div className={s.dKpiVal}>{fmt(sel.wages, sym)}</div>
              <div className={s.dKpiLbl}>Wages Paid</div>
            </div>
            <div className={s.dKpi}>
              <div className={s.dKpiVal + ' ' + s.red}>{fmt(sel.advances, sym)}</div>
              <div className={s.dKpiLbl}>Advances</div>
            </div>
            <div className={s.dKpi}>
              <div className={s.dKpiVal + ' ' + s.accent}>{fmt(sel.total, sym)}</div>
              <div className={s.dKpiLbl}>Total Paid</div>
            </div>
          </div>

          {/* Ledger */}
          <div className="card" style={{ margin:'0 14px' }}>
            <div className="card-hdr">Full Ledger</div>
            {ledger.map(e => (
              <div key={e.id} className={s.ledgerRow}>
                <div className={s.ledgerDate}>{e.date}</div>
                <div className={s.ledgerDesc}>
                  <div style={{ fontWeight:600 }}>{e.description || e.category}</div>
                  <div style={{ fontSize:11, color:'var(--txt3)' }}>{e.category}</div>
                </div>
                <div className={s.ledgerAmt + (e.category==='Advance / Hand Loan' ? ' '+s.red : '')}>{fmt(e.amount, sym)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
