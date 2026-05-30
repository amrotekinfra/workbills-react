import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { useIncome } from '../hooks/useIncome'
import { useToast } from '../components/Toast'
import { fmt, parseDate } from '../lib/supabase'
import s from './IncomeLedger.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const INCOME_TYPES = [
  { v: 'ra_bill',    l: 'RA Bill',          e: '📋' },
  { v: 'milestone',  l: 'Milestone',         e: '🏁' },
  { v: 'advance',    l: 'Advance',           e: '💰' },
  { v: 'final_bill', l: 'Final Bill',        e: '✅' },
  { v: 'retention',  l: 'Retention',         e: '🔓' },
]

const typeInfo = v => INCOME_TYPES.find(t => t.v === v) || { e: '💰', l: v }

const statusBadge = st => {
  if (st === 'pending') return { label: 'Pending',  cls: 'pending'  }
  if (st === 'partial') return { label: 'Partial',  cls: 'partial'  }
  return                       { label: 'Received', cls: 'received' }
}

const loadProjects = cid => {
  try { return JSON.parse(localStorage.getItem(`wb_projects_${cid}`) || '[]') } catch { return [] }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IncomeLedger() {
  const toast  = useToast()
  const { incomes, setPanel, setEditingIncomeId } = useStore()
  const { activeCompany } = usePersistedStore()
  const { remove, refetch, isFetching } = useIncome()
  const sym      = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const cid      = activeCompany?.id || 'demo'
  const projects = useMemo(() => loadProjects(cid), [cid])
  const projMap  = useMemo(() =>
    Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState('all')
  const [projFilter, setProjFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [monthFilter, setMonthFilter] = useState(null)

  // ── Derived month chips ──────────────────────────────────────────────────────
  const months = useMemo(() => {
    const m = {}
    incomes.forEach(inc => {
      const p = inc.date?.split('/')
      if (!p || p.length !== 3) return
      const key = `${p[2]}-${p[1]}`
      if (!m[key]) m[key] = {
        key,
        label: new Date(+p[2], +p[1]-1, 1)
          .toLocaleString('en-IN', { month: 'short', year: '2-digit' })
      }
    })
    return Object.values(m).slice(0, 12)
  }, [incomes])

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return incomes.filter(inc => {
      if (typeFilter !== 'all'   && inc.income_type !== typeFilter)             return false
      if (projFilter !== 'all'   && inc.project_id   !== projFilter)            return false
      if (statusFilter !== 'all' && inc.status        !== statusFilter)          return false
      if (monthFilter) {
        const p = inc.date?.split('/')
        if (!p || p.length !== 3 || `${p[2]}-${p[1]}` !== monthFilter) return false
      }
      if (searchQ) {
        const q = searchQ.toLowerCase()
        return (inc.client||'').toLowerCase().includes(q) ||
               (inc.description||'').toLowerCase().includes(q) ||
               (inc.bill_no||'').toLowerCase().includes(q) ||
               String(inc.amount).includes(q)
      }
      return true
    })
  }, [incomes, typeFilter, projFilter, statusFilter, monthFilter, searchQ])

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalReceived = filtered
    .filter(i => i.status !== 'pending')
    .reduce((s, i) => s + i.amount, 0)
  const totalPending = filtered
    .filter(i => i.status === 'pending')
    .reduce((s, i) => s + i.amount, 0)
  const grandTotal = filtered.reduce((s, i) => s + i.amount, 0)

  // ── Group by date ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const m = {}
    filtered.forEach(inc => {
      const key = inc.date || '?'
      if (!m[key]) m[key] = []
      m[key].push(inc)
    })
    return Object.entries(m)
      .sort((a, b) => parseDate(b[0]) - parseDate(a[0]))
  }, [filtered])

  // ── Format date label ─────────────────────────────────────────────────────
  const fmtDayLabel = str => {
    const p = str?.split('/')
    if (!p || p.length !== 3) return str
    const d = new Date(+p[2], +p[1]-1, +p[0]); d.setHours(0,0,0,0)
    const t = new Date(); t.setHours(0,0,0,0)
    const y = new Date(t); y.setDate(t.getDate()-1)
    if (d.getTime() === t.getTime()) return 'Today'
    if (d.getTime() === y.getTime()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // ── Edit / delete ──────────────────────────────────────────────────────────
  const handleEdit = inc => {
    setEditingIncomeId(inc.id)
    setPanel('addincome')
  }
  const handleDelete = async id => {
    if (!confirm('Delete this income record?')) return
    await remove(id)
  }

  // ── Type breakdown ─────────────────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const m = {}
    filtered.forEach(i => {
      m[i.income_type] = (m[i.income_type] || 0) + i.amount
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtered])

  // ─────────────────────────────────────────────────────────────────────────────

  if (incomes.length === 0) return (
    <div className={s.panel}>
      <div className={s.empty}>
        <div className={s.emptyIcon}>💰</div>
        <div className={s.emptyTitle}>No income recorded yet</div>
        <p className={s.emptyHint}>Record your first RA bill, milestone, or client payment</p>
        <button className="btn-amber" onClick={() => setPanel('addincome')}>
          + Record Income
        </button>
      </div>
    </div>
  )

  return (
    <div className={s.panel}>

      {/* ── Top KPI strip ─────────────────────────────────────────────────── */}
      <div className={s.kpiStrip}>
        <div className={s.kpiCard}>
          <div className={s.kpiVal}>{fmt(totalReceived, sym)}</div>
          <div className={s.kpiLbl}>Received</div>
        </div>
        {totalPending > 0 && (
          <div className={s.kpiCard}>
            <div className={s.kpiVal + ' ' + s.kpiAmb}>{fmt(totalPending, sym)}</div>
            <div className={s.kpiLbl}>Pending</div>
          </div>
        )}
        <div className={s.kpiCard}>
          <div className={s.kpiVal + ' ' + s.kpiGrn}>{fmt(grandTotal, sym)}</div>
          <div className={s.kpiLbl}>Grand Total</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiVal}>{filtered.length}</div>
          <div className={s.kpiLbl}>Entries</div>
        </div>
      </div>

      {/* ── Type breakdown chips ──────────────────────────────────────────── */}
      {typeBreakdown.length > 1 && (
        <div className={s.typeBreakRow}>
          {typeBreakdown.map(([v, amt]) => {
            const ti = typeInfo(v)
            return (
              <div key={v} className={s.typeBreakChip}
                onClick={() => setTypeFilter(typeFilter === v ? 'all' : v)}>
                <span>{ti.e}</span>
                <span className={s.tbLabel}>{ti.l}</span>
                <span className={s.tbAmt}>{fmt(amt, sym)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className={s.searchBar}>
        <span>🔍</span>
        <input
          className={s.searchIn}
          placeholder="Search client, bill no, description…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        {searchQ && <button className={s.clr} onClick={() => setSearchQ('')}>✕</button>}
        <button className={s.refBtn} onClick={() => refetch()}>
          {isFetching ? '⏳' : '↻'}
        </button>
      </div>

      {/* ── Month chips ───────────────────────────────────────────────────── */}
      {months.length > 1 && (
        <div className={s.chips}>
          <button
            className={s.chip + (!monthFilter ? ' ' + s.chipOn : '')}
            onClick={() => setMonthFilter(null)}
          >All</button>
          {months.map(m => (
            <button
              key={m.key}
              className={s.chip + (monthFilter === m.key ? ' ' + s.chipOn : '')}
              onClick={() => setMonthFilter(monthFilter === m.key ? null : m.key)}
            >{m.label}</button>
          ))}
        </div>
      )}

      {/* ── Type + status filters ─────────────────────────────────────────── */}
      <div className={s.filterRow}>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Type</span>
          <div className={s.filterPills}>
            <button className={s.fp + (typeFilter === 'all' ? ' ' + s.fpOn : '')}
              onClick={() => setTypeFilter('all')}>All</button>
            {INCOME_TYPES.map(t => (
              <button key={t.v}
                className={s.fp + (typeFilter === t.v ? ' ' + s.fpOn : '')}
                onClick={() => setTypeFilter(typeFilter === t.v ? 'all' : t.v)}>
                {t.e} {t.l.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Status</span>
          <div className={s.filterPills}>
            {['all','received','pending','partial'].map(st => (
              <button key={st}
                className={s.fp + (statusFilter === st ? ' ' + s.fpOn : '')}
                onClick={() => setStatusFilter(st)}>
                {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {projects.length > 0 && (
          <div className={s.filterGroup}>
            <span className={s.filterLabel}>Project</span>
            <div className={s.filterPills}>
              <button className={s.fp + (projFilter === 'all' ? ' ' + s.fpOn : '')}
                onClick={() => setProjFilter('all')}>All</button>
              {projects.slice(0, 5).map(p => (
                <button key={p.id}
                  className={s.fp + (projFilter === p.id ? ' ' + s.fpOn : '')}
                  onClick={() => setProjFilter(projFilter === p.id ? 'all' : p.id)}>
                  {p.emoji || '📁'} {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Add button ────────────────────────────────────────────────────── */}
      <div className={s.addBtnRow}>
        <button className={s.addBtn} onClick={() => setPanel('addincome')}>
          + Record Income
        </button>
        <button className={s.plBtn} onClick={() => setPanel('pnl')}>
          📊 P&L View
        </button>
      </div>

      {/* ── Ledger ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className={s.noMatch}>
          No entries match your filters
        </div>
      ) : (
        grouped.map(([date, rows]) => {
          const dayTotal = rows.reduce((s, i) => s + i.amount, 0)
          return (
            <div key={date} className={s.dayGroup}>
              <div className={s.dayHdr}>
                <span className={s.dayLabel}>{fmtDayLabel(date)}</span>
                <span className={s.dayDate}>{date}</span>
                <span className={s.dayTotal}>{fmt(dayTotal, sym)}</span>
              </div>

              {rows.map(inc => {
                const ti  = typeInfo(inc.income_type)
                const sb  = statusBadge(inc.status)
                const proj = inc.project_id ? projMap[inc.project_id] : null
                return (
                  <div key={inc.id} className={s.incRow}>

                    <div className={s.incIcon}>{ti.e}</div>

                    <div className={s.incMain}>
                      <div className={s.incClient}>{inc.client || '—'}</div>
                      <div className={s.incMeta}>
                        <span className={s.incType}>{ti.l}</span>
                        {inc.bill_no && <span className={s.incBill}>#{inc.bill_no}</span>}
                        {proj && <span className={s.incProj}>📁 {proj.name}</span>}
                      </div>
                      {inc.description && (
                        <div className={s.incDesc}>{inc.description}</div>
                      )}
                    </div>

                    <div className={s.incRight}>
                      <div className={s.incAmt}>{fmt(inc.amount, sym)}</div>
                      <div className={s.incBadgeRow}>
                        <span className={s['badge_' + sb.cls]}>{sb.label}</span>
                        {inc.pay_mode && inc.status !== 'pending' && (
                          <span className={s.payMode}>{inc.pay_mode}</span>
                        )}
                      </div>
                      <div className={s.incActions}>
                        <button className={s.editBtn} onClick={() => handleEdit(inc)}>✏️</button>
                        <button className={s.delBtn}  onClick={() => handleDelete(inc.id)}>🗑</button>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )
        })
      )}

    </div>
  )
}
