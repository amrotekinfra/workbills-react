import { useState, useRef, useEffect } from 'react'
import { useStore, usePersistedStore, partnerConfig, ROLE } from '../store'
import { useEntries } from '../hooks/useEntries'
import { useToast } from '../components/Toast'
import { SYS_CATS, pCode, pColor, pBg, fmt, todayISO } from '../lib/supabase'
import s from './AddEntry.module.css'

const PAY_MODES = ['UPI','Cash','Bank Transfer','Cheque']

export default function AddEntry() {
  const toast  = useToast()
  const { activeCompany } = usePersistedStore()
  const { user, role, entries, selPartner, selPayMode, editingId, customCats,
          setSelPartner, setSelPayMode, setEditingId, setPanel } = useStore()
  const { save, isSaving } = useEntries()
  const cfg    = partnerConfig(activeCompany)
  const isEmp  = role === 'employee'
  const sym    = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const allCats = [...SYS_CATS, ...customCats.filter(c => !SYS_CATS.find(sc => sc.n === c.n))]

  const [date,   setDate]   = useState(todayISO())
  const [person, setPerson] = useState('')
  const [desc,   setDesc]   = useState('')
  const [amt,    setAmt]    = useState('')
  const [cat,    setCat]    = useState('')
  const [notes,  setNotes]  = useState('')
  const [photo,  setPhoto]  = useState(null)
  const [preview,setPreview]= useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [showSug, setShowSug] = useState(false)
  const camRef = useRef(), galRef = useRef()

  // Populate when editing
  useEffect(() => {
    if (!editingId) { resetForm(); return }
    const e = entries.find(x => x.id === editingId)
    if (!e) return
    const p = e.date?.split('/')
    setDate(p?.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : todayISO())
    setPerson(e.person || '')
    setDesc(e.description || '')
    setAmt(String(e.amount || ''))
    setCat(e.category || '')
    setNotes(e.notes || '')
    setSelPayMode(e.payMode || 'UPI')
    if (e.partner) setSelPartner(e.partner)
    if (e.photoUrl) { setExistingPhotoUrl(e.photoUrl); setPreview(e.photoUrl) }
  }, [editingId])

  const resetForm = () => {
    setDate(todayISO()); setPerson(''); setDesc(''); setAmt(''); setCat(''); setNotes('')
    setPhoto(null); setPreview(null); setExistingPhotoUrl(null)
    setSelPayMode('UPI'); setEditingId(null)
  }

  const handlePhoto = f => {
    if (!f) return
    setPhoto(f); setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    const amount = parseFloat(amt.replace(/,/g, ''))
    if (!date)             { toast('Pick a date'); return }
    if (!person.trim())    { toast('Enter a person'); return }
    if (!desc.trim())      { toast('Enter a description'); return }
    if (!amount || amount <= 0) { toast('Enter a valid amount'); return }
    if (!cat)              { toast('Select a category'); return }
    try {
      await save({ date, person: person.trim(), description: desc.trim(), amount, category: cat,
                   notes: notes.trim(), payMode: selPayMode, photoFile: photo,
                   existingPhotoUrl, partnerCode: cfg.isSolo ? null : selPartner, editingId })
      resetForm()
      setPanel('entries')
    } catch { /* toast shown in hook */ }
  }

  const suggestions = person.length >= 1
    ? [...new Set(entries.map(e => e.person).filter(Boolean))]
        .filter(n => n.toLowerCase().startsWith(person.toLowerCase()) && n !== person)
        .slice(0, 5)
    : []

  return (
    <div className={s.panel}>
      {editingId && (
        <div className={s.editBanner}>
          ✏️ Editing entry
          <button onClick={() => { resetForm(); setEditingId(null) }}>✕ Cancel</button>
        </div>
      )}
      {isEmp && <div className={s.empNotice}>📤 Your entries will need owner approval before appearing in reports.</div>}

      <div className={s.form}>
        {/* Date */}
        <div><label className='lbl'>Date</label>
          <input className='inp' type='date' value={date} onChange={e => setDate(e.target.value)} /></div>

        {/* Partner buttons */}
        {cfg.isMulti && !isEmp && (
          <div><label className='lbl'>Partner</label>
            <div className={s.pGrid} style={{ gridTemplateColumns: `repeat(${Math.min(cfg.count, 4)}, 1fr)` }}>
              {cfg.partners.map((name, i) => {
                const code = pCode(i), sel = selPartner === code
                return (
                  <button key={code} className={s.pBtn}
                    style={sel ? { borderColor: pColor(code), background: pBg(code), color: pColor(code) } : {}}
                    onClick={() => setSelPartner(code)}>
                    <span className={s.pName}>{name}</span>
                    <span className={s.pSub}>Partner {i + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Person with autocomplete */}
        <div style={{ position: 'relative' }}>
          <label className='lbl'>Person / Company</label>
          <input className='inp' placeholder='e.g. Sai Mestri, Raju Lorry' value={person}
            onChange={e => { setPerson(e.target.value); setShowSug(true) }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            onFocus={() => setShowSug(true)} autoComplete='off' />
          {showSug && suggestions.length > 0 && (
            <div className={s.sug}>
              {suggestions.map(n => (
                <button key={n} className={s.sugItem} onMouseDown={() => { setPerson(n); setShowSug(false) }}>{n}</button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div><label className='lbl'>Description</label>
          <input className='inp' placeholder='e.g. 50 bags OPC cement' value={desc} onChange={e => setDesc(e.target.value)} /></div>

        {/* Amount */}
        <div>
          <label className='lbl'>Amount ({sym})</label>
          <input className='inp' type='text' inputMode='numeric' placeholder='0' value={amt}
            onChange={e => setAmt(e.target.value.replace(/[^0-9,]/g, ''))}
            style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.5px' }} />
          {amt && !isNaN(parseFloat(amt.replace(/,/g, ''))) && (
            <div className={s.amtPreview}>{fmt(parseFloat(amt.replace(/,/g, '')), sym)}</div>
          )}
        </div>

        {/* Pay mode */}
        <div>
          <label className='lbl'>Payment mode</label>
          <div className={s.chips}>
            {PAY_MODES.map(m => (
              <button key={m} className={s.chip + (selPayMode === m ? ' ' + s.chipSel : '')} onClick={() => setSelPayMode(m)}>{m}</button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div><label className='lbl'>Category</label>
          <select className='inp' value={cat} onChange={e => setCat(e.target.value)}>
            <option value=''>Select category…</option>
            {allCats.map(c => <option key={c.n} value={c.n}>{c.e} {c.n}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div><label className='lbl'>Notes <span style={{fontWeight:400,color:'var(--txt4)'}}>optional</span></label>
          <input className='inp' placeholder='Any extra details' value={notes} onChange={e => setNotes(e.target.value)} /></div>

        {/* Photo */}
        <div>
          <label className='lbl'>Receipt photo <span style={{fontWeight:400,color:'var(--txt4)'}}>optional</span></label>
          {preview ? (
            <div className={s.photoWrap}>
              <img src={preview} alt='receipt' className={s.photoImg} />
              <button className={s.clearPhoto} onClick={() => { setPhoto(null); setPreview(null); setExistingPhotoUrl(null) }}>✕ Remove</button>
            </div>
          ) : (
            <div className={s.photoBtns}>
              <label className={s.photoBtn}>📷 Camera
                <input ref={camRef} type='file' accept='image/*' capture='environment' style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
              </label>
              <label className={s.photoBtn}>🖼️ Gallery
                <input ref={galRef} type='file' accept='image/*' style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
              </label>
            </div>
          )}
        </div>

        {/* Save */}
        <button className='btn-amber' onClick={submit} disabled={isSaving} style={{marginTop:8}}>
          {isSaving ? 'Saving…' : isEmp ? '📤 Submit for Approval' : editingId ? '✓ Update Entry' : '💾 Save Entry'}
        </button>
        {editingId && (
          <button className='btn-ghost' onClick={() => { resetForm(); setEditingId(null) }} style={{marginTop:8}}>Cancel</button>
        )}
      </div>
    </div>
  )
}
