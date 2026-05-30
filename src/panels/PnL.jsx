import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { fmt, parseDate } from '../lib/supabase'
import s from './PnL.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#3a6652','#e8920a','#2563eb','#7c3aed',
  '#0891b2','#dc2626','#16a34a','#9a3412',
  '#0f766e','#be185d','#ca8a04','#1d4ed8',
]

const PERIODS = [
  { v: 'all',   l: 'All Time'    },
  { v: 'month', l: 'This Month'  },
  { v: 'q',     l: 'This Quarter'},
  { v: 'year',  l: 'This Year'   },
]

const loadProjects = cid => {
  try { return JSON.parse(localStorage.getItem(`wb_projects_${cid}`) || '[]') } catch { return [] }
}

const periodFilter = (dateStr, period) => {
  const d = parseDate(dateStr)
  const now = new Date()
  if (period === 'all')   return true
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (period === 'year')  return d.getFullYear() === now.getFullYear()
  if (period === 'q') {
    const q = Math.floor(now.getMonth() / 3)
    return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === q
  }
  return true
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MarginBar({ pct, positive }) {
  const clamped = Math.min(Math.abs(pct), 100)
  return (
    <div className={s.marginBarWrap}>
      <div className={s.marginBarTrack}>
        <div
          className={s.marginBarFill + ' ' + (positive ? s.barGrn : s.barRed)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={s.marginPct + ' ' + (positive ? s.pctGrn : s.pctRed)}>
        {positive ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </div>
  )
}

function MiniDonut({ slices }) {
  // slices: [{pct, color}]
  const R = 36, CX = 40, CY = 40, SW = 12
  let ang = 0
  const arc = (start, end) => {
    if (end - start >= 2 * Math.PI) end = start + 2 * Math.PI - 0.001
    const x1 = CX + R * Math.cos(start - Math.PI / 2)
    const y1 = CY + R * Math.sin(start - Math.PI / 2)
    const x2 = CX + R * Math.cos(end   - Math.PI / 2)
    const y2 = CY + R * Math.sin(end   - Math.PI / 2)
    return `M${x1} ${y1} A${R} ${R} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2}`
  }
  return (
    <svg viewBox="0 0 80 80" className={s.donut}>
      {slices.map((sl, i) => {
        const a = sl.pct * 2 * Math.PI
        const start = ang; ang += a
        return (
          <path key={i} d={arc(start, ang)}
            fill="none" stroke={sl.color} strokeWidth={SW} />
        )
      })}
    </svg>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PnL() {
  const { entries, incomes, setPanel } = useStore()
  const { activeCompany }             = usePersistedStore()
  const sym  = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const cid  = activeCompany?.id || 'demo'
  const projects = useMemo(() => loadProjects(cid), [cid])
  const projMap  = useMemo(() =>
    Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  const [period,    setPeriod]    = useState('all')
  const [view,      setView]      = useState('summary')  // 'summary' | 'project' | 'detail'
  const [selProjId, setSelProjId] = useState(null)

  // ── Period-filtered slices ─────────────────────────────────────────────────
  const filtIncome  = useMemo(() =>
    incomes.filter(i  => periodFilter(i.date, period)), [incomes, period])
  const filtExpense = useMemo(() =>
    entries.filter(e  => periodFilter(e.date, period) && e.status !== 'rejected'), [entries, period])

  // ── Company-level totals ───────────────────────────────────────────────────
  const totalIncome  = filtIncome.reduce((t, i) => t + i.amount, 0)
  const totalReceived = filtIncome.filter(i => i.status !== 'pending').reduce((t, i) => t + i.amount, 0)
  const totalPending  = filtIncome.filter(i => i.status === 'pending').reduce((t, i) => t + i.amount, 0)
  const totalExpense = filtExpense
    .filter(e => e.category !== 'Advance / Hand Loan')
    .reduce((t, e) => t + (e.amount || 0), 0)
  const grossProfit  = totalIncome - totalExpense
  const margin       = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0

  // ── Expense breakdown by category ─────────────────────────────────────────
  const expByCat = useMemo(() => {
    const m = {}
    filtExpense
      .filter(e => e.category !== 'Advance / Hand Loan')
      .forEach(e => { m[e.category] = (m[e.category] || 0) + (e.amount || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtExpense])

  const donutSlices = expByCat.slice(0, 12).map(([, amt], i) => ({
    pct:   totalExpense > 0 ? amt / totalExpense : 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  // ── Income breakdown by type ───────────────────────────────────────────────
  const incByType = useMemo(() => {
    const m = {}
    filtIncome.forEach(i => { m[i.income_type] = (m[i.income_type] || 0) + i.amount })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtIncome])

  const typeLabels = { ra_bill: '📋 RA Bill', milestone: '🏁 Milestone', advance: '💰 Advance', final_bill: '✅ Final', retention: '🔓 Retention' }

  // ── Per-project P&L ────────────────────────────────────────────────────────
  const projectPnL = useMemo(() => {
    const map = {}

    // Projects with income
    filtIncome.forEach(i => {
      const pid = i.project_id || '__none__'
      if (!map[pid]) map[pid] = { income: 0, expense: 0, incomeTxns: 0, expenseTxns: 0 }
      map[pid].income     += i.amount
      map[pid].incomeTxns += 1
    })

    // Projects with expense (rough match: use project_id on expense if available)
    filtExpense
      .filter(e => e.category !== 'Advance / Hand Loan')
      .forEach(e => {
        const pid = e.project_id || '__none__'
        if (!map[pid]) map[pid] = { income: 0, expense: 0, incomeTxns: 0, expenseTxns: 0 }
        map[pid].expense      += e.amount || 0
        map[pid].expenseTxns  += 1
      })

    return Object.entries(map)
      .map(([pid, d]) => ({
        pid,
        proj:   pid === '__none__' ? null : projMap[pid],
        ...d,
        profit: d.income - d.expense,
        margin: d.income > 0 ? ((d.income - d.expense) / d.income) * 100 : null,
      }))
      .filter(p => p.income > 0 || p.expense > 0)
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
  }, [filtIncome, filtExpense, projMap])

  // ── Selected project detail ────────────────────────────────────────────────
  const selProj       = selProjId ? projectPnL.find(p => p.pid === selProjId) : null
  const selProjIncome = filtIncome.filter(i => (i.project_id || '__none__') === selProjId)
  const selProjExp    = filtExpense
    .filter(e => (e.project_id || '__none__') === selProjId && e.category !== 'Advance / Hand Loan')
  const selProjExpByCat = useMemo(() => {
    if (!selProjId) return []
    const m = {}
    selProjExp.forEach(e => { m[e.category] = (m[e.category] || 0) + (e.amount || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [selProjExp, selProjId])

  // ── No data guard ──────────────────────────────────────────────────────────
  if (incomes.length === 0) return (
    <div className={s.panel}>
      <div className={s.empty}>
        <div className={s.emptyIcon}>📊</div>
        <div className={s.emptyTitle}>P&L needs income data</div>
        <p className={s.emptyHint}>
          Record your first client payment to unlock profit & loss analysis
        </p>
        <button className="btn-amber" onClick={() => setPanel('addincome')}>
          💰 Record First Income
        </button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // ── VIEW: Project detail ──────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'detail' && selProj) {
    const projLabel = selProj.proj
      ? `${selProj.proj.emoji || '📁'} ${selProj.proj.name}`
      : 'Unassigned Entries'
    return (
      <div className={s.panel}>
        <div className={s.detailHdr}>
          <button className={s.backBtn} onClick={() => setView('project')}>← Back</button>
          <h2 className={s.detailTitle}>{projLabel}</h2>
        </div>

        {/* Project KPIs */}
        <div className={s.detailKpis}>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + s.kpiGrn}>{fmt(selProj.income, sym)}</div>
            <div className={s.dKpiLbl}>Income</div>
          </div>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + s.kpiRed}>{fmt(selProj.expense, sym)}</div>
            <div className={s.dKpiLbl}>Expense</div>
          </div>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + (selProj.profit >= 0 ? s.kpiGrn : s.kpiRed)}>
              {fmt(Math.abs(selProj.profit), sym)}
            </div>
            <div className={s.dKpiLbl}>{selProj.profit >= 0 ? 'Profit' : 'Loss'}</div>
          </div>
        </div>

        {selProj.margin !== null && (
          <div className={s.detailMarginCard}>
            <span className={s.dmLabel}>Gross Margin</span>
            <MarginBar pct={selProj.margin} positive={selProj.margin >= 0} />
          </div>
        )}

        {/* Income breakdown */}
        <div className={s.detailSection}>
          <div className={s.dSecHdr}>Income ({selProjIncome.length} entries)</div>
          {selProjIncome
            .sort((a, b) => parseDate(b.date) - parseDate(a.date))
            .map(i => (
              <div key={i.id} className={s.detailRow}>
                <div className={s.drLeft}>
                  <div className={s.drDate}>{i.date}</div>
                  <div className={s.drBadge + ' ' + s.drBadgeInc}>
                    {typeLabels[i.income_type]?.split(' ')[0]} {typeLabels[i.income_type]?.split(' ')[1]}
                  </div>
                </div>
                <div className={s.drMid}>
                  <div className={s.drClient}>{i.client}</div>
                  {i.description && <div className={s.drDesc}>{i.description}</div>}
                </div>
                <div className={s.drAmt + ' ' + s.drAmtInc}>{fmt(i.amount, sym)}</div>
              </div>
            ))}
        </div>

        {/* Expense breakdown by category */}
        <div className={s.detailSection}>
          <div className={s.dSecHdr}>Expenses by Category</div>
          {selProjExpByCat.map(([cat, amt], i) => (
            <div key={cat} className={s.catDetailRow}>
              <div className={s.catDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <div className={s.catName}>{cat}</div>
              <div className={s.catAmt}>{fmt(amt, sym)}</div>
              <div className={s.catPct + ' ' + s.pctRed}>
                {selProj.expense > 0 ? ((amt / selProj.expense) * 100).toFixed(0) : 0}%
              </div>
            </div>
          ))}
          {selProjExpByCat.length === 0 && (
            <div className={s.detailEmpty}>No expense entries linked to this project</div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── VIEW: Per-project P&L table ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'project') return (
    <div className={s.panel}>
      <div className={s.viewHdr}>
        <button className={s.backBtn} onClick={() => setView('summary')}>← Summary</button>
        <h2 className={s.viewTitle}>Project P&L</h2>
      </div>

      {projectPnL.length === 0 ? (
        <div className={s.noProj}>
          Link income entries to projects to see per-project P&L
        </div>
      ) : (
        projectPnL.map(p => {
          const positive = p.profit >= 0
          const projLabel = p.proj
            ? `${p.proj.emoji || '📁'} ${p.proj.name}`
            : '📋 Unassigned'
          return (
            <div
              key={p.pid}
              className={s.projCard}
              onClick={() => { setSelProjId(p.pid); setView('detail') }}
            >
              <div className={s.projCardTop}>
                <div className={s.projName}>{projLabel}</div>
                <div className={s.projProfit + ' ' + (positive ? s.kpiGrn : s.kpiRed)}>
                  {positive ? '+' : '−'}{fmt(Math.abs(p.profit), sym)}
                </div>
              </div>

              <div className={s.projMiniRow}>
                <span className={s.projInc}>↑ {fmt(p.income, sym)}</span>
                <span className={s.projExp}>↓ {fmt(p.expense, sym)}</span>
                {p.margin !== null && (
                  <span className={positive ? s.projMrgGrn : s.projMrgRed}>
                    {positive ? '+' : ''}{p.margin.toFixed(1)}% margin
                  </span>
                )}
              </div>

              {p.income > 0 && (
                <MarginBar pct={p.margin ?? 0} positive={positive} />
              )}

              <div className={s.projFooter}>
                <span>{p.incomeTxns} income · {p.expenseTxns} expense entries</span>
                <span className={s.projChev}>›</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // ── VIEW: Company Summary (default) ──────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={s.panel}>

      {/* Period selector */}
      <div className={s.periods}>
        {PERIODS.map(p => (
          <button
            key={p.v}
            className={s.periodBtn + (period === p.v ? ' ' + s.periodBtnOn : '')}
            onClick={() => setPeriod(p.v)}
          >{p.l}</button>
        ))}
      </div>

      {/* ── Hero P&L card ───────────────────────────────────────────────────── */}
      <div className={s.heroCard + ' ' + (grossProfit >= 0 ? s.heroProfit : s.heroLoss)}>
        <div className={s.heroLabel}>{grossProfit >= 0 ? '📈 Gross Profit' : '📉 Net Loss'}</div>
        <div className={s.heroVal}>{fmt(Math.abs(grossProfit), sym)}</div>
        <div className={s.heroSub}>
          {margin >= 0 ? '+' : ''}{margin.toFixed(1)}% margin
          {period !== 'all' ? ` · ${PERIODS.find(p => p.v === period)?.l}` : ''}
        </div>

        <div className={s.heroBar}>
          {totalIncome + totalExpense > 0 && (
            <>
              <div
                className={s.heroBarInc}
                style={{ width: `${(totalIncome / (totalIncome + totalExpense)) * 100}%` }}
              />
              <div className={s.heroBarExp}
                style={{ width: `${(totalExpense / (totalIncome + totalExpense)) * 100}%` }}
              />
            </>
          )}
        </div>

        <div className={s.heroRow}>
          <div className={s.heroCol}>
            <div className={s.heroColVal + ' ' + s.kpiGrn}>{fmt(totalIncome, sym)}</div>
            <div className={s.heroColLbl}>Total Income</div>
          </div>
          <div className={s.heroDivider} />
          <div className={s.heroCol}>
            <div className={s.heroColVal + ' ' + s.kpiRed}>{fmt(totalExpense, sym)}</div>
            <div className={s.heroColLbl}>Total Expense</div>
          </div>
        </div>

        {totalPending > 0 && (
          <div className={s.pendingNote}>
            ⏳ {fmt(totalPending, sym)} income still pending
          </div>
        )}
      </div>

      {/* ── Quick nav ────────────────────────────────────────────────────────── */}
      <div className={s.navRow}>
        <button className={s.navBtn} onClick={() => setPanel('income')}>
          <span>💰</span> Income Ledger
        </button>
        <button className={s.navBtn} onClick={() => setView('project')}>
          <span>🏗️</span> Project P&L
        </button>
        <button className={s.navBtn} onClick={() => setPanel('addincome')}>
          <span>＋</span> Add Income
        </button>
      </div>

      {/* ── Income by type ───────────────────────────────────────────────────── */}
      {incByType.length > 0 && (
        <div className={s.section}>
          <div className={s.secHdr}>
            <span>Income by Type</span>
            <span className={s.secTotal}>{fmt(totalIncome, sym)}</span>
          </div>
          {incByType.map(([type, amt]) => {
            const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0
            const label = typeLabels[type] || type
            return (
              <div key={type} className={s.catRow}>
                <div className={s.catRowIcon}>{label.split(' ')[0]}</div>
                <div className={s.catRowMid}>
                  <div className={s.catRowName}>{label.split(' ').slice(1).join(' ')}</div>
                  <div className={s.catRowBar}>
                    <div className={s.catRowFillInc} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className={s.catRowRight}>
                  <div className={s.catRowAmt + ' ' + s.kpiGrn}>{fmt(amt, sym)}</div>
                  <div className={s.catRowPct}>{pct.toFixed(0)}%</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Expense by category ──────────────────────────────────────────────── */}
      {expByCat.length > 0 && (
        <div className={s.section}>
          <div className={s.secHdr}>
            <span>Cost Breakdown</span>
            <div className={s.secRight}>
              <MiniDonut slices={donutSlices} />
              <span className={s.secTotal}>{fmt(totalExpense, sym)}</span>
            </div>
          </div>
          {expByCat.map(([cat, amt], i) => {
            const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0
            return (
              <div key={cat} className={s.catRow}>
                <div className={s.catDotSm} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div className={s.catRowMid}>
                  <div className={s.catRowName}>{cat}</div>
                  <div className={s.catRowBar}>
                    <div
                      className={s.catRowFillExp}
                      style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                  </div>
                </div>
                <div className={s.catRowRight}>
                  <div className={s.catRowAmt}>{fmt(amt, sym)}</div>
                  <div className={s.catRowPct}>{pct.toFixed(0)}%</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Project mini-cards ───────────────────────────────────────────────── */}
      {projectPnL.length > 0 && (
        <div className={s.section}>
          <div className={s.secHdr}>
            <span>By Project</span>
            <button className={s.secLink} onClick={() => setView('project')}>See all →</button>
          </div>
          {projectPnL.slice(0, 4).map(p => {
            const pos   = p.profit >= 0
            const label = p.proj ? `${p.proj.emoji || '📁'} ${p.proj.name}` : '📋 Unassigned'
            return (
              <div key={p.pid} className={s.miniProjRow}
                onClick={() => { setSelProjId(p.pid); setView('detail') }}>
                <div className={s.mpLabel}>{label}</div>
                <div className={s.mpRight}>
                  <div className={s.mpProfit + ' ' + (pos ? s.kpiGrn : s.kpiRed)}>
                    {pos ? '+' : '−'}{fmt(Math.abs(p.profit), sym)}
                  </div>
                  {p.margin !== null && (
                    <div className={s.mpMargin + ' ' + (pos ? s.pctGrn : s.pctRed)}>
                      {pos ? '+' : ''}{p.margin.toFixed(0)}%
                    </div>
                  )}
                  <span className={s.mpChev}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
