import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { fmt, SYS_CATS, getCatInfo } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Budget.module.css'

const storageKey = id => `wb_budgets_${id}`

const loadBudgets = (id) => {
  try { return JSON.parse(localStorage.getItem(storageKey(id)) || '{}') } catch { return {} }
}
const saveBudgets = (id, data) => localStorage.setItem(storageKey(id), JSON.stringify(data))

export default function Budget() {
  const toast = useToast()
  const { entries, customCats } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [budgets, setBudgets] = useState(() => loadBudgets(activeCompany?.id))
  const [editing, setEditing] = useState(null)   // category name
  const [draft,   setDraft]   = useState('')

  // Current month totals by category
  const now = new Date()
  const monthTotals = useMemo(() => {
    const m = {}
    entries.forEach(e => {
      const p = e.date?.split('/')
      if (!p || p.length !== 3) return
      if (+p[1] !== now.getMonth()+1 || +p[2] !== now.getFullYear()) return
      m[e.category] = (m[e.category]||0) + (e.amount||0)
    })
    return m
  }, [entries])

  const allCats = [...SYS_CATS, ...customCats.filter(c => !SYS_CATS.find(sc => sc.n === c.n))]

  const saveLimit = () => {
    const val = parseFloat(draft)
    if (isNaN(val) || val < 0) { toast('Enter a valid amount'); return }
    const next = { ...budgets, [editing]: val }
    setBudgets(next)
    saveBudgets(activeCompany?.id, next)
    setEditing(null); setDraft('')
    toast('✓ Budget limit saved')
  }

  const clearLimit = (cat) => {
    const next = { ...budgets }
    delete next[cat]
    setBudgets(next)
    saveBudgets(activeCompany?.id, next)
    toast('Limit removed')
  }

  // Separate: cats with a limit vs without
  const withLimit    = allCats.filter(c => budgets[c.n] !== undefined)
  const withoutLimit = allCats.filter(c => budgets[c.n] === undefined)
  const monthName    = now.toLocaleString('en-IN', { month:'long', year:'numeric' })

  const BudgetRow = ({ cat }) => {
    const limit   = budgets[cat.n]
    const spent   = monthTotals[cat.n] || 0
    const pct     = limit > 0 ? Math.min(spent / limit * 100, 100) : 0
    const status  = !limit ? 'none' : pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok'
    const info    = getCatInfo(cat.n, customCats)

    return (
      <div className={s.catRow}>
        <div className={s.catIcon} style={{ background: info.c + '18' }}>{info.e}</div>
        <div className={s.catBody}>
          <div className={s.catHead}>
            <span className={s.catName}>{cat.n}</span>
            <span className={s.catSpent}>{spent > 0 ? fmt(spent, sym) : '—'}</span>
          </div>
          {limit > 0 ? (
            <>
              <div className={s.barWrap}>
                <div className={s.barFill + ' ' + s['bar_'+status]} style={{ width: pct+'%' }} />
              </div>
              <div className={s.catMeta}>
                <span className={s['status_'+status]}>
                  {status==='over' ? '🔴 Over budget' : status==='warn' ? '🟡 Getting close' : '🟢 On track'}
                </span>
                <span style={{ fontSize:11, color:'var(--txt3)' }}>Limit: {fmt(limit, sym)}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize:11, color:'var(--txt4)', marginTop:2 }}>No limit set</div>
          )}
        </div>
        <div className={s.catActions}>
          <button className={s.editBtn} onClick={() => { setEditing(cat.n); setDraft(limit > 0 ? String(limit) : '') }}>
            {limit > 0 ? '✏️' : '＋'}
          </button>
          {limit > 0 && <button className={s.clearBtn} onClick={() => clearLimit(cat.n)}>✕</button>}
        </div>
      </div>
    )
  }

  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        <h2 className={s.title}>Budget Limits</h2>
        <span className={s.sub}>{monthName}</span>
      </div>
      <p className={s.hint}>Set monthly spend limits per category. Saved on this device.</p>

      {withLimit.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionLbl}>With Limits ({withLimit.length})</div>
          {withLimit.map(c => <BudgetRow key={c.n} cat={c} />)}
        </div>
      )}

      <div className={s.section}>
        <div className={s.sectionLbl}>No Limit ({withoutLimit.length})</div>
        {withoutLimit.map(c => <BudgetRow key={c.n} cat={c} />)}
      </div>

      {/* Edit modal */}
      {editing && (
        <>
          <div className={s.overlay} onClick={() => setEditing(null)} />
          <div className={s.modal + ' rise'}>
            <div className={s.modalHdr}>
              <h3>Set limit for {editing}</h3>
              <button className={s.closeBtn} onClick={() => setEditing(null)}>✕</button>
            </div>
            <div style={{ fontSize:13, color:'var(--txt3)', marginBottom:12 }}>
              Current spend this month: <strong>{fmt(monthTotals[editing]||0, sym)}</strong>
            </div>
            <input
              className="inp"
              type="number"
              placeholder={`Monthly limit in ${activeCompany?.currency || 'INR'}`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
            />
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-amber" style={{ flex:1 }} onClick={saveLimit}>Save Limit</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
