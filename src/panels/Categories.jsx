import { useState, useEffect } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { supabase, SYS_CATS } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Categories.module.css'

const CAT_COLORS = ['#3a6652','#ea580c','#7c3aed','#0891b2','#e8920a','#dc2626','#16a34a','#9333ea','#ca8a04','#0f766e','#86198f','#374151']
const COMMON_EMOJIS = ['📦','🔧','⚡','🚿','🪟','🏗️','🧪','🪨','🛡️','📋','🧹','🚛','💡','🔑','🌿','🔥','💧','🎯','🏠','🔩']

export default function Categories() {
  const toast = useToast()
  const { role, customCats, setCustomCats } = useStore()
  const { activeCompany } = usePersistedStore()

  const [showForm, setShowForm] = useState(false)
  const [catName,  setCatName]  = useState('')
  const [catEmoji, setCatEmoji] = useState('📦')
  const [catColor, setCatColor] = useState(CAT_COLORS[0])
  const [saving,   setSaving]   = useState(false)

  const canManage = ROLE.canManageTeam(role) || role === 'partner'

  const allCats = [...SYS_CATS, ...customCats.filter(c => !SYS_CATS.find(sc => sc.n === c.n))]

  const resetForm = () => { setCatName(''); setCatEmoji('📦'); setCatColor(CAT_COLORS[0]) }

  const addCat = async () => {
    if (!catName.trim()) { toast('Enter a category name'); return }
    if (allCats.find(c => c.n.toLowerCase() === catName.toLowerCase())) { toast('Category already exists'); return }
    setSaving(true)
    const row = { company_id: activeCompany.id, name: catName.trim(), emoji: catEmoji, color: catColor }
    const { error } = await supabase.from('categories').insert([row]).catch(() => ({ error: true }))
    const newCat = { n: catName.trim(), e: catEmoji, c: catColor }
    setCustomCats([...customCats, newCat])
    if (error) toast('Saved locally only (table may not exist yet)')
    else       toast('✓ Category added')
    resetForm(); setShowForm(false); setSaving(false)
  }

  const delCat = async (cat) => {
    if (!canManage) { toast('Ask the owner to delete categories'); return }
    if (!confirm(`Delete "${cat.n}"? Existing entries keep this category.`)) return
    await supabase.from('categories').delete().eq('company_id', activeCompany.id).eq('name', cat.n).catch(() => {})
    setCustomCats(customCats.filter(c => c.n !== cat.n))
    toast('Category removed')
  }

  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        <h2 className={s.title}>Categories</h2>
        {canManage && <button className="btn-prim" onClick={() => setShowForm(true)}>+ Add</button>}
      </div>

      <div className={s.section}>
        <div className={s.sectionLbl}>Built-in ({SYS_CATS.length})</div>
        {SYS_CATS.map(c => (
          <div key={c.n} className={s.catRow}>
            <div className={s.catIcon} style={{ background: c.c + '18' }}>{c.e}</div>
            <div className={s.catName}>{c.n}</div>
            <div className={s.catLock}>🔒</div>
          </div>
        ))}
      </div>

      <div className={s.section}>
        <div className={s.sectionLbl}>Custom ({customCats.length})</div>
        {customCats.length === 0 ? (
          <div className={s.empty}>No custom categories yet</div>
        ) : customCats.map(c => (
          <div key={c.n} className={s.catRow}>
            <div className={s.catIcon} style={{ background: c.c + '18' }}>{c.e}</div>
            <div className={s.catName}>{c.n}</div>
            {canManage && (
              <button className={s.delBtn} onClick={() => delCat(c)}>✕</button>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <>
          <div className={s.overlay} onClick={() => setShowForm(false)} />
          <div className={s.modal + ' rise'}>
            <div className={s.modalHdr}>
              <h3>New Category</h3>
              <button className={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Preview */}
            <div className={s.preview}>
              <div className={s.prevIcon} style={{ background: catColor + '18' }}>{catEmoji}</div>
              <span className={s.prevName} style={{ color: catColor }}>{catName || 'Preview'}</span>
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Name</label>
              <input className="inp" placeholder="e.g. Scaffolding" value={catName} onChange={e => setCatName(e.target.value)} />
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Emoji</label>
              <div className={s.emojiGrid}>
                {COMMON_EMOJIS.map(e => (
                  <button key={e} className={s.emojiBtn + (catEmoji===e ? ' '+s.emojiBtnSel : '')} onClick={() => setCatEmoji(e)}>{e}</button>
                ))}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Colour</label>
              <div className={s.colorRow}>
                {CAT_COLORS.map(c => (
                  <button key={c} className={s.colorDot + (catColor===c ? ' '+s.colorDotSel : '')} style={{ background: c }} onClick={() => setCatColor(c)} />
                ))}
              </div>
            </div>

            <button className="btn-prim" onClick={addCat} disabled={saving}>{saving ? 'Saving…' : 'Add Category'}</button>
          </div>
        </>
      )}
    </div>
  )
}
