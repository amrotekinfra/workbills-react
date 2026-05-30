import { useState, useMemo, useEffect } from 'react'
import { useStore, usePersistedStore } from '../store'
import { fmt, parseDate, getCatInfo, SYS_CATS, todayISO } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Inventory.module.css'

// ── Default materials ───────────────────────────────────────────────────────

const DEFAULT_MATERIALS = [
  { id: 'mat_cement',    name: 'Cement',     unit: 'Bags',   emoji: '🧱', linkedCat: 'Cement',                 threshold: 50,  color: '#8a4a00' },
  { id: 'mat_sand',      name: 'Sand',       unit: 'Loads',  emoji: '⛱️', linkedCat: 'Aggregates & Materials', threshold: 4,   color: '#ca8a04' },
  { id: 'mat_aggregate', name: 'Aggregate',  unit: 'Loads',  emoji: '🪨', linkedCat: 'Aggregates & Materials', threshold: 4,   color: '#0369a1' },
  { id: 'mat_steel',     name: 'Steel',      unit: 'MT',     emoji: '🔩', linkedCat: 'Steel & Iron',           threshold: 1,   color: '#374151' },
  { id: 'mat_bricks',    name: 'Bricks',     unit: '×1000',  emoji: '🏠', linkedCat: null,                     threshold: 2,   color: '#dc2626' },
]

const UNITS = ['Bags', 'Loads', 'MT', 'Nos', '×1000', 'Sqm', 'Cum', 'Rmt', 'Ltr', 'Kg', 'Sets']

const COLORS_PALETTE = [
  '#3a6652','#e8920a','#0369a1','#7c3aed',
  '#8a4a00','#374151','#ca8a04','#dc2626','#16a34a','#0891b2',
]

// ── localStorage helpers ────────────────────────────────────────────────────

const KEY      = id => `wb_inv_${id}`
const loadData = id => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(id)) || 'null')
    if (!raw) return { materials: DEFAULT_MATERIALS, movements: [] }
    if (!raw.materials?.length) raw.materials = DEFAULT_MATERIALS
    return raw
  } catch { return { materials: DEFAULT_MATERIALS, movements: [] } }
}
const saveData = (id, data) => localStorage.setItem(KEY(id), JSON.stringify(data))

const loadProjects = id => {
  try { return JSON.parse(localStorage.getItem(`wb_projects_${id}`) || '[]') } catch { return [] }
}

const uid = () => crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const isoToDMY = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const stockColor = (qty, threshold) => {
  if (qty <= 0)              return 'empty'
  if (qty < threshold * 0.5) return 'critical'
  if (qty < threshold)       return 'low'
  return 'ok'
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Inventory() {
  const toast = useToast()
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const cid  = activeCompany?.id || 'demo'
  const sym  = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  // ── Persist state ─────────────────────────────────────────────────────────
  const [data,      setData]      = useState(() => loadData(cid))
  const [projects,  setProjects]  = useState(() => loadProjects(cid))
  useEffect(() => { setData(loadData(cid)); setProjects(loadProjects(cid)) }, [cid])

  const persist = updated => { saveData(cid, updated); setData(updated) }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view,        setView]      = useState('list')      // 'list' | 'detail'
  const [selectedId,  setSelectedId] = useState(null)
  const [projFilter,  setProjFilter] = useState('all')
  const [showAddMat,  setShowAddMat] = useState(false)
  const [editingMat,  setEditingMat] = useState(null)       // material obj or null
  const [showMovForm, setShowMovForm] = useState(false)
  const [movType,     setMovType]    = useState('in')       // 'in' | 'out'

  // ── Material form ─────────────────────────────────────────────────────────
  const [mName,   setMName]   = useState('')
  const [mUnit,   setMUnit]   = useState('Bags')
  const [mEmoji,  setMEmoji]  = useState('📦')
  const [mCat,    setMCat]    = useState('')
  const [mThr,    setMThr]    = useState('10')
  const [mColor,  setMColor]  = useState(COLORS_PALETTE[0])

  const openAddMat = () => {
    setEditingMat(null)
    setMName(''); setMUnit('Bags'); setMEmoji('📦'); setMCat('')
    setMThr('10'); setMColor(COLORS_PALETTE[0])
    setShowAddMat(true)
  }
  const openEditMat = mat => {
    setEditingMat(mat)
    setMName(mat.name); setMUnit(mat.unit); setMEmoji(mat.emoji)
    setMCat(mat.linkedCat || ''); setMThr(String(mat.threshold)); setMColor(mat.color)
    setShowAddMat(true)
  }
  const saveMat = () => {
    if (!mName.trim())            { toast('Enter a material name'); return }
    if (!mThr || isNaN(+mThr))    { toast('Enter a valid threshold'); return }
    const mat = {
      id:        editingMat?.id || `mat_${uid()}`,
      name:      mName.trim(),
      unit:      mUnit,
      emoji:     mEmoji,
      linkedCat: mCat || null,
      threshold: +mThr,
      color:     mColor,
    }
    const mats = editingMat
      ? data.materials.map(m => m.id === editingMat.id ? mat : m)
      : [...data.materials, mat]
    persist({ ...data, materials: mats })
    setShowAddMat(false)
    toast(editingMat ? '✓ Material updated' : '✓ Material added')
  }
  const deleteMat = id => {
    if (!confirm('Delete this material and all its movements?')) return
    persist({
      materials: data.materials.filter(m => m.id !== id),
      movements: data.movements.filter(mv => mv.materialId !== id),
    })
    if (selectedId === id) { setSelectedId(null); setView('list') }
    setShowAddMat(false)
  }

  // ── Movement form ─────────────────────────────────────────────────────────
  const [mvDate,  setMvDate]  = useState(todayISO())
  const [mvQty,   setMvQty]   = useState('')
  const [mvDesc,  setMvDesc]  = useState('')
  const [mvProj,  setMvProj]  = useState('')

  const openMovForm = type => {
    setMovType(type)
    setMvDate(todayISO()); setMvQty(''); setMvDesc(''); setMvProj('')
    setShowMovForm(true)
  }
  const saveMovement = () => {
    if (!mvQty || isNaN(+mvQty) || +mvQty <= 0) { toast('Enter a valid quantity'); return }
    const mv = {
      id:         uid(),
      materialId: selectedId,
      type:       movType,
      qty:        +mvQty,
      desc:       mvDesc.trim() || (movType === 'in' ? 'Delivery' : 'Used on site'),
      date:       isoToDMY(mvDate) || isoToDMY(todayISO()),
      projectId:  mvProj || null,
      source:     'manual',
    }
    persist({ ...data, movements: [...data.movements, mv] })
    setShowMovForm(false)
    toast(movType === 'in' ? '📦 Stock received' : '🔨 Usage logged')
  }
  const deleteMovement = id => {
    persist({ ...data, movements: data.movements.filter(mv => mv.id !== id) })
    toast('Deleted')
  }

  // ── Derived: stock per material ───────────────────────────────────────────
  const stockMap = useMemo(() => {
    const map = {}
    data.materials.forEach(m => { map[m.id] = { in: 0, out: 0 } })
    data.movements.forEach(mv => {
      if (!map[mv.materialId]) return
      if (projFilter !== 'all' && mv.projectId && mv.projectId !== projFilter) return
      if (mv.type === 'in')  map[mv.materialId].in  += mv.qty
      if (mv.type === 'out') map[mv.materialId].out += mv.qty
    })
    return map
  }, [data, projFilter])

  const stockQty = id => (stockMap[id]?.in || 0) - (stockMap[id]?.out || 0)

  // ── Linked entries (by category) ─────────────────────────────────────────
  const linkedEntries = useMemo(() => {
    if (!selectedId) return []
    const mat = data.materials.find(m => m.id === selectedId)
    if (!mat?.linkedCat) return []
    return [...entries]
      .filter(e => e.category === mat.linkedCat &&
        (projFilter === 'all' || !e.project_id || e.project_id === projFilter))
      .sort((a, b) => parseDate(b.date) - parseDate(a.date))
      .slice(0, 20)
  }, [selectedId, entries, data.materials, projFilter])

  // ── Selected material ─────────────────────────────────────────────────────
  const selMat  = selectedId ? data.materials.find(m => m.id === selectedId) : null
  const selMovs = useMemo(() => {
    if (!selectedId) return []
    return data.movements
      .filter(mv => mv.materialId === selectedId &&
        (projFilter === 'all' || !mv.projectId || mv.projectId === projFilter))
      .sort((a, b) => parseDate(b.date) - parseDate(a.date))
  }, [selectedId, data.movements, projFilter])

  const selIn   = selMovs.filter(mv => mv.type === 'in').reduce((s, mv) => s + mv.qty, 0)
  const selOut  = selMovs.filter(mv => mv.type === 'out').reduce((s, mv) => s + mv.qty, 0)
  const selQty  = selIn - selOut

  // ── Low-stock alerts ──────────────────────────────────────────────────────
  const alerts = data.materials.filter(m => {
    const qty = stockQty(m.id)
    return qty <= m.threshold
  })

  // ── Project display name ──────────────────────────────────────────────────
  const projName = id => projects.find(p => p.id === id)?.name || 'Project'

  // ── MODAL: Add/Edit Material ──────────────────────────────────────────────
  const MatModal = () => (
    <>
      <div className={s.overlay} onClick={() => setShowAddMat(false)} />
      <div className={s.modal + ' rise'}>
        <div className={s.modalHdr}>
          <h3>{editingMat ? 'Edit Material' : 'New Material'}</h3>
          <button className={s.closeBtn} onClick={() => setShowAddMat(false)}>✕</button>
        </div>

        <div className={s.mfield}>
          <label className="lbl">Material Name</label>
          <input className="inp" value={mName} onChange={e => setMName(e.target.value)}
            placeholder="e.g. River Sand, OPC Cement" />
        </div>

        <div className={s.mrow2}>
          <div className={s.mfield}>
            <label className="lbl">Unit</label>
            <select className="inp" value={mUnit} onChange={e => setMUnit(e.target.value)}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className={s.mfield}>
            <label className="lbl">Emoji</label>
            <input className="inp" value={mEmoji} onChange={e => setMEmoji(e.target.value)}
              maxLength={2} style={{ fontSize: 20, textAlign: 'center' }} />
          </div>
        </div>

        <div className={s.mrow2}>
          <div className={s.mfield}>
            <label className="lbl">Low-Stock Alert Below</label>
            <input className="inp" type="number" min="0" value={mThr}
              onChange={e => setMThr(e.target.value)} placeholder="e.g. 50" />
          </div>
          <div className={s.mfield}>
            <label className="lbl">Link to Category</label>
            <select className="inp" value={mCat} onChange={e => setMCat(e.target.value)}>
              <option value="">None</option>
              {SYS_CATS.map(c => <option key={c.n} value={c.n}>{c.e} {c.n}</option>)}
            </select>
          </div>
        </div>

        <div className={s.mfield}>
          <label className="lbl">Colour</label>
          <div className={s.colorRow}>
            {COLORS_PALETTE.map(c => (
              <button key={c}
                className={s.colorDot + (mColor === c ? ' ' + s.colorDotSel : '')}
                style={{ background: c }}
                onClick={() => setMColor(c)}
              />
            ))}
          </div>
        </div>

        <div className={s.modalActions}>
          {editingMat && (
            <button className={s.delMatBtn} onClick={() => deleteMat(editingMat.id)}>
              🗑 Delete
            </button>
          )}
          <button className="btn-amber" style={{ flex: 1 }} onClick={saveMat}>
            {editingMat ? 'Update' : 'Add Material'}
          </button>
        </div>
      </div>
    </>
  )

  // ── MODAL: Log Movement ───────────────────────────────────────────────────
  const MovModal = () => (
    <>
      <div className={s.overlay} onClick={() => setShowMovForm(false)} />
      <div className={s.modal + ' rise'}>
        <div className={s.modalHdr}>
          <h3>{movType === 'in' ? '📦 Log Delivery' : '🔨 Log Usage'}</h3>
          <button className={s.closeBtn} onClick={() => setShowMovForm(false)}>✕</button>
        </div>

        <div className={s.movTypeToggle}>
          <button className={s.movTypeBtn + (movType === 'in' ? ' ' + s.movTypeBtnIn : '')}
            onClick={() => setMovType('in')}>
            📦 Delivery (Stock In)
          </button>
          <button className={s.movTypeBtn + (movType === 'out' ? ' ' + s.movTypeBtnOut : '')}
            onClick={() => setMovType('out')}>
            🔨 Usage (Stock Out)
          </button>
        </div>

        <div className={s.movHint + ' ' + (movType === 'in' ? s.movHintIn : s.movHintOut)}>
          {movType === 'in'
            ? `➕ Adds to stock. Current: ${selQty} ${selMat?.unit}`
            : `➖ Reduces stock. Current: ${selQty} ${selMat?.unit}`}
        </div>

        <div className={s.mrow2}>
          <div className={s.mfield}>
            <label className="lbl">Date</label>
            <input className="inp" type="date" value={mvDate} onChange={e => setMvDate(e.target.value)} />
          </div>
          <div className={s.mfield}>
            <label className="lbl">Qty ({selMat?.unit})</label>
            <input className={'inp ' + s.qtyInp} type="number" min="0" inputMode="decimal"
              value={mvQty} onChange={e => setMvQty(e.target.value)} placeholder="0"
              autoFocus />
          </div>
        </div>

        <div className={s.mfield}>
          <label className="lbl">Description</label>
          <input className="inp" value={mvDesc} onChange={e => setMvDesc(e.target.value)}
            placeholder={movType === 'in'
              ? 'e.g. Delivery from Sai Traders — 200 bags'
              : 'e.g. Used for column shuttering — Block A'} />
        </div>

        {projects.length > 0 && (
          <div className={s.mfield}>
            <label className="lbl">Project / Site <span style={{ fontWeight: 400, color: 'var(--txt4)' }}>optional</span></label>
            <select className="inp" value={mvProj} onChange={e => setMvProj(e.target.value)}>
              <option value="">All sites</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.emoji || '📁'} {p.name}</option>)}
            </select>
          </div>
        )}

        <button className="btn-amber" style={{ marginTop: 8 }} onClick={saveMovement}>
          {movType === 'in' ? '📦 Log Delivery' : '🔨 Log Usage'}
        </button>
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setShowMovForm(false)}>
          Cancel
        </button>
      </div>
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // ── VIEW: Material Detail ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'detail' && selMat) {
    const status  = stockColor(selQty, selMat.threshold)
    const pct     = selMat.threshold > 0
      ? Math.min((selQty / (selMat.threshold * 2)) * 100, 100)
      : 50

    return (
      <div className={s.panel}>

        {/* Header */}
        <div className={s.detailHdr}>
          <button className={s.backBtn} onClick={() => setView('list')}>← Back</button>
          <div className={s.detailTitle}>
            <div className={s.detailBadge} style={{ background: selMat.color + '22', color: selMat.color }}>
              {selMat.emoji}
            </div>
            <div>
              <h2 className={s.detailName}>{selMat.name}</h2>
              <div className={s.detailSub}>
                {selMat.unit} · alert below {selMat.threshold}
                {selMat.linkedCat && ` · ${selMat.linkedCat}`}
              </div>
            </div>
          </div>
          <button className={s.editMatBtn} onClick={() => openEditMat(selMat)}>✏️</button>
        </div>

        {/* Status bar */}
        <div className={s.detailStatus + ' ' + s['status_' + status]}>
          <div className={s.statusIcon}>
            {status === 'empty' ? '🚫' : status === 'critical' ? '🔴' : status === 'low' ? '🟡' : '🟢'}
          </div>
          <div className={s.statusText}>
            {status === 'empty'
              ? 'Out of stock — log a delivery'
              : status === 'critical'
              ? `Critical: ${selQty} ${selMat.unit} remaining — reorder now`
              : status === 'low'
              ? `Low stock: ${selQty} ${selMat.unit} — below alert threshold of ${selMat.threshold}`
              : `In stock: ${selQty} ${selMat.unit}`}
          </div>
        </div>

        {/* KPI row */}
        <div className={s.detailKpis}>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + (status !== 'ok' && status !== 'empty' ? s.kpiWarn : '')}
              style={{ color: status === 'ok' ? selMat.color : undefined }}>
              {selQty}
            </div>
            <div className={s.dKpiLbl}>On Hand ({selMat.unit})</div>
          </div>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + s.kpiIn}>{selIn}</div>
            <div className={s.dKpiLbl}>Total In</div>
          </div>
          <div className={s.dKpi}>
            <div className={s.dKpiVal + ' ' + s.kpiOut}>{selOut}</div>
            <div className={s.dKpiLbl}>Total Used</div>
          </div>
        </div>

        {/* Stock bar */}
        <div className={s.stockBarWrap}>
          <div className={s.stockBar}>
            <div
              className={s.stockBarFill + ' ' + s['bar_' + status]}
              style={{ width: `${pct}%` }}
            />
            <div
              className={s.stockBarThreshold}
              style={{ left: `50%` }}
              title={`Alert at ${selMat.threshold}`}
            />
          </div>
          <div className={s.stockBarLabels}>
            <span>0</span>
            <span style={{ color: '#ca8a04', fontWeight: 700 }}>⚠ {selMat.threshold}</span>
            <span>{selMat.threshold * 2}+</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className={s.detailActions}>
          <button className={s.inBtn} onClick={() => openMovForm('in')}>
            <span>📦</span> Log Delivery
          </button>
          <button className={s.outBtn} onClick={() => openMovForm('out')}
            disabled={selQty <= 0}>
            <span>🔨</span> Log Usage
          </button>
        </div>

        {/* Movement log */}
        <div className={s.ledgerSection}>
          <div className={s.ledgerHdr}>
            <span className={s.ledgerHdrTitle}>Stock Movements</span>
            <span className={s.ledgerHdrCount}>{selMovs.length} records</span>
          </div>

          {selMovs.length === 0 ? (
            <div className={s.emptyLedger}>
              No movements yet — log a delivery to start tracking stock
            </div>
          ) : (
            selMovs.map(mv => (
              <div key={mv.id} className={s.movRow}>
                <div className={s.movLeft}>
                  <div className={s.movDate}>{mv.date}</div>
                  <div className={mv.type === 'in' ? s.movBadgeIn : s.movBadgeOut}>
                    {mv.type === 'in' ? 'IN' : 'OUT'}
                  </div>
                </div>
                <div className={s.movMid}>
                  <div className={s.movDesc}>{mv.desc}</div>
                  {mv.projectId && (
                    <div className={s.movProj}>📁 {projName(mv.projectId)}</div>
                  )}
                </div>
                <div className={s.movRight}>
                  <div className={mv.type === 'in' ? s.movQtyIn : s.movQtyOut}>
                    {mv.type === 'in' ? '+' : '−'}{mv.qty} <span className={s.movUnit}>{selMat.unit}</span>
                  </div>
                  <button className={s.movDel} onClick={() => deleteMovement(mv.id)}
                    title="Remove record">✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Linked entries from Supabase */}
        {linkedEntries.length > 0 && (
          <div className={s.linkedSection}>
            <div className={s.ledgerHdr}>
              <span className={s.ledgerHdrTitle}>
                Linked Expense Entries
                <span className={s.linkedHint}> · {selMat.linkedCat}</span>
              </span>
              <span className={s.ledgerHdrCount}>{linkedEntries.length}</span>
            </div>
            {linkedEntries.map(e => (
              <div key={e.id} className={s.entryRow}>
                <div className={s.movLeft}>
                  <div className={s.movDate}>{e.date}</div>
                  <div className={s.entryBadge}>{e.payMode || 'Cash'}</div>
                </div>
                <div className={s.movMid}>
                  <div className={s.movDesc}>{e.description || e.category}</div>
                  <div className={s.movProj}>{e.person}</div>
                </div>
                <div className={s.movRight}>
                  <div className={s.entryAmt}>{fmt(e.amount, sym)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showMovForm && <MovModal />}
        {showAddMat  && <MatModal />}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── VIEW: Stock Dashboard (list) ──────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  const openDetail = id => { setSelectedId(id); setView('detail') }

  return (
    <div className={s.panel}>

      {/* Toolbar */}
      <div className={s.toolbar}>
        <div>
          <h2 className={s.title}>Material Inventory</h2>
          <div className={s.subtitle}>{data.materials.length} materials tracked</div>
        </div>
        <button className={s.addMatBtn} onClick={openAddMat}>＋ Material</button>
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className={s.projFilterRow}>
          <button
            className={s.projPill + (projFilter === 'all' ? ' ' + s.projPillOn : '')}
            onClick={() => setProjFilter('all')}
          >All Sites</button>
          {projects.map(p => (
            <button
              key={p.id}
              className={s.projPill + (projFilter === p.id ? ' ' + s.projPillOn : '')}
              onClick={() => setProjFilter(p.id)}
            >
              {p.emoji || '📁'} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Low-stock alert banner */}
      {alerts.length > 0 && (
        <div className={s.alertBanner}>
          <div className={s.alertIconWrap}>
            <span className={s.alertIconPulse} />
            <span className={s.alertIcon}>⚠️</span>
          </div>
          <div className={s.alertBody}>
            <div className={s.alertTitle}>
              {alerts.length} material{alerts.length > 1 ? 's' : ''} need restocking
            </div>
            <div className={s.alertItems}>
              {alerts.map(m => {
                const qty = stockQty(m.id)
                return (
                  <button key={m.id} className={s.alertChip} onClick={() => openDetail(m.id)}>
                    {m.emoji} {m.name}:
                    <strong>{qty <= 0 ? ' OUT' : ` ${qty} ${m.unit}`}</strong>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Material cards grid */}
      <div className={s.matGrid}>
        {data.materials.map(mat => {
          const qty    = stockQty(mat.id)
          const status = stockColor(qty, mat.threshold)
          const pct    = mat.threshold > 0
            ? Math.min((qty / (mat.threshold * 2)) * 100, 100)
            : 50

          const totalIn  = stockMap[mat.id]?.in  || 0
          const totalOut = stockMap[mat.id]?.out || 0

          return (
            <div key={mat.id} className={s.matCard} onClick={() => openDetail(mat.id)}>
              {/* Status pip */}
              <div className={s.matCardPip + ' ' + s['pip_' + status]} />

              {/* Header */}
              <div className={s.matCardHdr}>
                <div className={s.matCardIcon} style={{ background: mat.color + '1a', color: mat.color }}>
                  {mat.emoji}
                </div>
                <div className={s.matCardInfo}>
                  <div className={s.matCardName}>{mat.name}</div>
                  <div className={s.matCardUnit}>{mat.unit}</div>
                </div>
                <div className={s.matCardQty + ' ' + s['qty_' + status]}>
                  {qty}
                </div>
              </div>

              {/* Progress bar */}
              <div className={s.matBar}>
                <div
                  className={s.matBarFill + ' ' + s['bar_' + status]}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>

              {/* Meta row */}
              <div className={s.matCardMeta}>
                <span className={s.metaIn}>↑ {totalIn} in</span>
                <span className={s.metaOut}>↓ {totalOut} used</span>
                {status !== 'ok' && (
                  <span className={s['alert_' + status]}>
                    {status === 'empty' ? '🚫 Out' : status === 'critical' ? '🔴 Critical' : '🟡 Low'}
                  </span>
                )}
                {status === 'ok' && <span className={s.alertOk}>🟢 OK</span>}
              </div>

              {/* Threshold label */}
              <div className={s.matCardThreshold}>
                Alert at {mat.threshold} {mat.unit}
              </div>
            </div>
          )
        })}

        {/* Add card */}
        <div className={s.addCard} onClick={openAddMat}>
          <div className={s.addCardIcon}>＋</div>
          <div className={s.addCardLabel}>Add Material</div>
        </div>
      </div>

      {/* Summary footer */}
      {data.materials.length > 0 && (
        <div className={s.summaryFooter}>
          <div className={s.summaryItem}>
            <span className={s.summaryDot} style={{ background: '#16a34a' }} />
            {data.materials.filter(m => stockColor(stockQty(m.id), m.threshold) === 'ok').length} in stock
          </div>
          <div className={s.summaryItem}>
            <span className={s.summaryDot} style={{ background: '#ca8a04' }} />
            {data.materials.filter(m => stockColor(stockQty(m.id), m.threshold) === 'low').length} low
          </div>
          <div className={s.summaryItem}>
            <span className={s.summaryDot} style={{ background: '#dc2626' }} />
            {data.materials.filter(m => ['critical','empty'].includes(stockColor(stockQty(m.id), m.threshold))).length} critical/out
          </div>
        </div>
      )}

      {showAddMat  && <MatModal />}
    </div>
  )
}
