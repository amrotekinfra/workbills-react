import { useState, useEffect } from 'react'
import { useStore, usePersistedStore } from '../store'
import { SYS_CATS, getCatInfo, fmt } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Templates.module.css'

const PAY_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Cheque']
const STORE_KEY = (id) => `wb_templates_${id}`

export default function Templates() {
  const toast  = useToast()
  const { role, entries, customCats, setPanel, setEditingId } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym    = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const key    = STORE_KEY(activeCompany?.id || 'demo')

  const allCats = [...SYS_CATS, ...customCats.filter(c => !SYS_CATS.find(sc=>sc.n===c.n))]

  const [templates, setTemplates] = useState([])
  const [showForm,  setShowForm]  = useState(false)
  const [form, setForm] = useState({ name:'', person:'', description:'', amount:'', category: SYS_CATS[0]?.n || '', payMode:'UPI', notes:'' })

  // Load from localStorage
  useEffect(() => {
    try { setTemplates(JSON.parse(localStorage.getItem(key) || '[]')) } catch { setTemplates([]) }
  }, [key])

  const save = () => {
    if (!form.name.trim()) { toast('Give this template a name'); return }
    if (!form.person.trim() && !form.description.trim()) { toast('Add at least a person or description'); return }
    const t = { id: Date.now(), ...form, amount: parseFloat(form.amount) || 0, createdAt: new Date().toISOString() }
    const next = [...templates, t]
    setTemplates(next)
    localStorage.setItem(key, JSON.stringify(next))
    setShowForm(false)
    setForm({ name:'', person:'', description:'', amount:'', category:SYS_CATS[0]?.n||'', payMode:'UPI', notes:'' })
    toast('✓ Template saved')
  }

  const remove = (id) => {
    if (!confirm('Delete this template?')) return
    const next = templates.filter(t => t.id !== id)
    setTemplates(next)
    localStorage.setItem(key, JSON.stringify(next))
  }

  const useTemplate = (t) => {
    sessionStorage.setItem('wb_prefill', JSON.stringify({
      person: t.person, description: t.description,
      amount: t.amount, category: t.category,
      notes: t.notes, payMode: t.payMode,
    }))
    setPanel('add')
    toast('📋 Template loaded — check & save')
  }

  // Quick-save from recent entries
  const saveFromEntry = (entry) => {
    const t = {
      id: Date.now(),
      name: `${entry.person} — ${entry.category}`,
      person: entry.person, description: entry.description,
      amount: entry.amount, category: entry.category,
      payMode: entry.payMode || 'UPI', notes: entry.notes || '',
      createdAt: new Date().toISOString()
    }
    const next = [...templates, t]
    setTemplates(next)
    localStorage.setItem(key, JSON.stringify(next))
    toast('✓ Saved as template')
  }

  const recentEntries = entries.slice(0, 10)

  return (
    <div className={s.panel}>
      <div className={s.topBar}>
        <h2 className={s.title}>Quick Templates</h2>
        <button className="btn-prim" style={{padding:'8px 14px',fontSize:13}} onClick={() => setShowForm(v=>!v)}>
          {showForm ? 'Cancel' : '＋ New'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card" style={{margin:'0 14px 12px'}}>
          <div className="card-hdr">New Template</div>
          <div className={s.form}>
            <label className={s.lbl}>Template name *</label>
            <input className="inp" placeholder="e.g. JCB Fuel, Daily Labour…" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            <label className={s.lbl}>Person</label>
            <input className="inp" placeholder="Who gets paid" value={form.person} onChange={e=>setForm(f=>({...f,person:e.target.value}))} />
            <label className={s.lbl}>Description</label>
            <input className="inp" placeholder="What for" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
            <div className={s.row2}>
              <div>
                <label className={s.lbl}>Default amount</label>
                <input className="inp" type="number" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
              </div>
              <div>
                <label className={s.lbl}>Pay mode</label>
                <select className="inp" value={form.payMode} onChange={e=>setForm(f=>({...f,payMode:e.target.value}))}>
                  {PAY_MODES.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <label className={s.lbl}>Category</label>
            <select className="inp" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              {allCats.map(c=><option key={c.n} value={c.n}>{c.e} {c.n}</option>)}
            </select>
            <label className={s.lbl}>Notes</label>
            <input className="inp" placeholder="Optional notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            <button className="btn-prim" style={{marginTop:4}} onClick={save}>Save Template</button>
          </div>
        </div>
      )}

      {/* Saved templates */}
      {templates.length > 0 ? (
        <div className="card" style={{margin:'0 14px 12px'}}>
          <div className="card-hdr">{templates.length} Saved Templates</div>
          {templates.map(t => {
            const info = getCatInfo(t.category, customCats)
            return (
              <div key={t.id} className={s.tRow}>
                <div className={s.tCat} style={{background:info.c+'18'}}>{info.e}</div>
                <div className={s.tInfo}>
                  <div className={s.tName}>{t.name}</div>
                  <div className={s.tMeta}>
                    {t.person && <span>{t.person}</span>}
                    {t.description && <span>· {t.description}</span>}
                    {t.amount > 0 && <span className={s.tAmt}>· {fmt(t.amount, sym)}</span>}
                  </div>
                </div>
                <div className={s.tActions}>
                  <button className={s.useBtn} onClick={() => useTemplate(t)}>Use</button>
                  <button className={s.delBtn} onClick={() => remove(t.id)}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : !showForm && (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🔁</div>
          <p>Save common expenses as templates to add them in one tap</p>
        </div>
      )}

      {/* Save from recent entries */}
      {recentEntries.length > 0 && (
        <div className="card" style={{margin:'0 14px 12px'}}>
          <div className="card-hdr">Save from recent entries</div>
          {recentEntries.map(e => {
            const info  = getCatInfo(e.category, customCats)
            const saved = templates.some(t => t.person===e.person && t.description===e.description && t.category===e.category)
            return (
              <div key={e.id} className={s.tRow}>
                <div className={s.tCat} style={{background:info.c+'18'}}>{info.e}</div>
                <div className={s.tInfo}>
                  <div className={s.tName}>{e.person}</div>
                  <div className={s.tMeta}>
                    {e.description && <span>{e.description}</span>}
                    <span className={s.tAmt}>· {fmt(e.amount, sym)}</span>
                  </div>
                </div>
                <button
                  className={saved ? s.savedBtn : s.saveBtn}
                  disabled={saved}
                  onClick={() => saveFromEntry(e)}
                >{saved ? '✓ Saved' : '＋ Save'}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
