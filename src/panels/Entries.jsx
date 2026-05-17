import { useState, useRef } from 'react'
import { useStore, usePersistedStore, ROLE, partnerConfig } from '../store'
import { useEntries } from '../hooks/useEntries'
import { useToast } from '../components/Toast'
import { fmt, parseDate, getCatInfo, pCode, pName, pColor, pBg } from '../lib/supabase'
import s from './Entries.module.css'

export default function Entries() {
  const toast = useToast()
  const { activeCompany } = usePersistedStore()
  const { entries, role, customCats, filterPartner, filterMonth, searchQ,
          setFilterPartner, setFilterMonth, setSearchQ, setPanel, setEditingId, isFetching } = useStore()
  const { remove, bulkDelete, refetch } = useEntries()
  const cfg = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const longRef = useRef()

  // Month chips
  const months = (() => {
    const m = {}
    entries.forEach(e => {
      const p = e.date?.split('/')
      if (!p || p.length !== 3) return
      const key = `${p[2]}-${p[1]}`
      if (!m[key]) m[key] = { key, label: new Date(+p[2], +p[1]-1, 1).toLocaleString('en-IN', { month:'short', year:'2-digit' }) }
    })
    return Object.values(m).slice(0, 12)
  })()

  // Filter
  const filtered = entries.filter(e => {
    if (filterMonth) {
      const p = e.date?.split('/')
      if (!p || p.length !== 3 || `${p[2]}-${p[1]}` !== filterMonth) return false
    }
    if (filterPartner !== 'all' && e.partner !== filterPartner) return false
    if (searchQ) {
      const q = searchQ.toLowerCase()
      return (e.person||'').toLowerCase().includes(q) || (e.description||'').toLowerCase().includes(q) ||
             (e.category||'').toLowerCase().includes(q) || String(e.amount).includes(q)
    }
    return true
  })

  const grouped = filtered.reduce((a, e) => { (a[e.date||'?'] = a[e.date||'?']||[]).push(e); return a }, {})
  const dates   = Object.keys(grouped).sort((a,b) => parseDate(b)-parseDate(a))
  const total   = filtered.reduce((s,e) => s+(e.amount||0), 0)

  const fmtDayLabel = str => {
    const p = str?.split('/')
    if (!p || p.length !== 3) return str
    const d = new Date(+p[2], +p[1]-1, +p[0]); d.setHours(0,0,0,0)
    const t = new Date(); t.setHours(0,0,0,0)
    const y = new Date(t); y.setDate(t.getDate()-1)
    if (d.getTime()===t.getTime()) return 'Today'
    if (d.getTime()===y.getTime()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })
  }

  const toggleBulk = id => { setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n }) }
  const exitBulk   = () => { setBulkMode(false); setSelected(new Set()) }

  const csvExport = () => {
    const rows = [['Date','Partner','Person','Description','Amount','Category']]
    entries.filter(e => selected.has(e.id)).forEach(e =>
      rows.push([e.date, pName(e.partner, activeCompany), e.person, e.description, e.amount, e.category]))
    const blob = new Blob([rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')], { type:'text/csv' })
    Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`WorkBills_${new Date().toISOString().slice(0,10)}.csv` }).click()
    toast(`⬇ ${selected.size} entries exported`); exitBulk()
  }

  return (
    <div className={s.panel}>
      {/* Search */}
      <div className={s.search}>
        <span>🔍</span>
        <input className={s.searchIn} type='search' placeholder='Search entries…' value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {searchQ && <button className={s.clr} onClick={() => setSearchQ('')}>✕</button>}
        <button className={s.refBtn} onClick={() => refetch()}>{isFetching ? '⏳' : '↻'}</button>
      </div>

      {/* Month chips */}
      {months.length > 1 && (
        <div className={s.chips}>
          <button className={s.chip+(filterMonth===null?' '+s.chipOn:'')} onClick={() => setFilterMonth(null)}>All</button>
          {months.map(m => (
            <button key={m.key} className={s.chip+(filterMonth===m.key?' '+s.chipOn:'')}
              onClick={() => setFilterMonth(filterMonth===m.key?null:m.key)}>{m.label}</button>
          ))}
        </div>
      )}

      {/* Partner tabs */}
      {cfg.isMulti && (
        <div className={s.pTabs}>
          <button className={s.pTab+(filterPartner==='all'?' '+s.pTabOn:'')} onClick={() => setFilterPartner('all')}>All</button>
          {cfg.partners.map((name, i) => {
            const code = pCode(i)
            return (
              <button key={code} className={s.pTab+(filterPartner===code?' '+s.pTabOn:'')}
                style={filterPartner===code ? { background:pColor(code), color:'white' } : {}}
                onClick={() => setFilterPartner(filterPartner===code?'all':code)}>{name}</button>
            )
          })}
        </div>
      )}

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className={s.strip}>
          <span className={s.stripCt}>{filtered.length} entries</span>
          <span className={s.stripTot}>{fmt(total, sym)}</span>
        </div>
      )}

      {/* Bulk bar */}
      {bulkMode && (
        <div className={s.bulkBar}>
          <button className={s.bClose} onClick={exitBulk}>✕</button>
          <span className={s.bCt}>{selected.size} selected</span>
          <button className={s.bBtn} onClick={csvExport}>⬇ Export</button>
          <button className={s.bBtn+' '+s.bDel} onClick={async()=>{ if(!confirm(`Delete ${selected.size}?`))return; await bulkDelete([...selected]); exitBulk() }}>🗑 Delete</button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className='empty'><div className='icon'>{searchQ?'🔍':'📋'}</div><p>{searchQ?'No results':'No entries yet'}</p></div>
      ) : (
        <div>
          {dates.map(dk => {
            const items = grouped[dk]
            const dayTot = items.reduce((s,e)=>s+(e.amount||0),0)
            return (
              <div key={dk}>
                <div className={s.dhdr}>
                  <span className={s.dLabel}>{fmtDayLabel(dk)}</span>
                  <span className={s.dTot}>{fmt(dayTot, sym)}</span>
                </div>
                {items.map(e => (
                  <EntryRow key={e.id} entry={e} cfg={cfg} co={activeCompany} sym={sym} customCats={customCats}
                    canEdit={ROLE.canEdit(role)} canDelete={ROLE.canDelete(role)}
                    bulkMode={bulkMode} selected={selected.has(e.id)}
                    onTap={() => bulkMode && toggleBulk(e.id)}
                    onLongPress={() => { setBulkMode(true); setSelected(new Set([e.id])) }}
                    onEdit={() => { setEditingId(e.id); setPanel('add') }}
                    onDelete={async() => { if(confirm('Delete?')) await remove(e.id) }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Single row ────────────────────────────────────────────────
function EntryRow({ entry, cfg, co, sym, customCats, canEdit, canDelete, bulkMode, selected, onTap, onLongPress, onEdit, onDelete }) {
  const rowRef = useRef()
  const startX = useRef(0)
  const lpRef  = useRef()
  const [open, setOpen] = useState(false)

  const info = getCatInfo(entry.category, customCats)
  const partnerLabel = cfg.isMulti ? pName(entry.partner, co) : null
  const pc = cfg.isMulti ? pColor(entry.partner) : null
  const pb = cfg.isMulti ? pBg(entry.partner)    : null

  const onTS = e => { startX.current = e.touches[0].clientX; lpRef.current = setTimeout(onLongPress, 500) }
  const onTM = e => {
    clearTimeout(lpRef.current)
    if (bulkMode) return
    const dx = e.touches[0].clientX - startX.current
    if (dx < 0 && rowRef.current) rowRef.current.style.transform = `translateX(${Math.max(dx,-160)}px)`
    e.preventDefault()
  }
  const onTE = () => {
    clearTimeout(lpRef.current)
    if (!rowRef.current) return
    const cur = parseFloat(rowRef.current.style.transform?.replace('translateX(','') || '0')
    if (cur < -60) { rowRef.current.style.transform = 'translateX(-160px)'; setOpen(true) }
    else { rowRef.current.style.transform = ''; setOpen(false) }
  }
  const close = () => { if(rowRef.current) rowRef.current.style.transform=''; setOpen(false) }

  return (
    <div className={s.rowWrap} onClick={close}>
      {/* Actions behind */}
      <div className={s.swipe}>
        {canEdit  && <button className={s.aEdit} onClick={e=>{e.stopPropagation();close();onEdit()}}>✏️<br/><span>Edit</span></button>}
        {canDelete && <button className={s.aDel} onClick={e=>{e.stopPropagation();close();onDelete()}}>🗑<br/><span>Del</span></button>}
      </div>
      {/* Row */}
      <div ref={rowRef} className={s.row+(selected?' '+s.rowSel:'')+(bulkMode?' '+s.rowBulk:'')}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={onTap}>
        {bulkMode && <div className={s.check+(selected?' '+s.checkSel:'')}>{selected&&'✓'}</div>}
        <div className={s.catEm} style={{background:info.c+'18'}}>{info.e}</div>
        <div className={s.info}>
          <div className={s.person}>{entry.person}</div>
          {entry.description && <div className={s.desc}>{entry.description}</div>}
          <div className={s.meta}>
            <span className={s.catTag} style={{background:info.c+'18',color:info.c}}>{info.e} {entry.category}</span>
            {entry.payMode && entry.payMode!=='UPI' && <span className={s.payTag}>{entry.payMode}</span>}
            {entry.status==='pending'  && <span className={s.pend}>⏳</span>}
            {entry.status==='rejected' && <span className={s.rej}>✕</span>}
            {entry.photoUrl && <span>📎</span>}
          </div>
        </div>
        <div className={s.right}>
          <div className={s.amount}>{fmt(entry.amount, sym)}</div>
          {partnerLabel && <div className={s.pdot} style={{background:pb,color:pc}}>{partnerLabel[0]}</div>}
        </div>
      </div>
    </div>
  )
}
