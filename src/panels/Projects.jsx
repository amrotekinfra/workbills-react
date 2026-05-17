import { useState, useEffect } from 'react'
import { useStore, usePersistedStore } from '../store'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { fmt } from '../lib/supabase'
import s from './Projects.module.css'

const COLORS = ['#3a6652','#ea580c','#7c3aed','#0891b2','#e8920a','#dc2626','#16a34a','#9333ea']
const EMOJIS = ['📁','🏗️','🏠','🏢','🏭','🌿','⚡','🚧','🔑','📐']

export default function Projects() {
  const toast = useToast()
  const { entries, setPanel, setFilterMonth } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  const [name,   setName]   = useState('')
  const [site,   setSite]   = useState('')
  const [budget, setBudget] = useState('')
  const [color,  setColor]  = useState(COLORS[0])
  const [emoji,  setEmoji]  = useState('📁')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [activeCompany?.id])

  const load = async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    // Gracefully handle if table doesn't exist yet
    const { data, error } = await supabase
      .from('projects').select('*').eq('company_id', activeCompany.id).order('created_at', { ascending: false })
      .catch(() => ({ data: null, error: { message: 'table missing' } }))
    if (error) {
      // Fall back to localStorage
      const local = JSON.parse(localStorage.getItem(`wb_projects_${activeCompany.id}`) || '[]')
      setProjects(local)
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  const resetForm = () => { setName(''); setSite(''); setBudget(''); setColor(COLORS[0]); setEmoji('📁'); setEditing(null) }
  const openNew  = () => { resetForm(); setShowForm(true) }
  const openEdit = (p) => { setName(p.name); setSite(p.site||''); setBudget(p.budget||''); setColor(p.color||COLORS[0]); setEmoji(p.emoji||'📁'); setEditing(p); setShowForm(true) }

  const save = async () => {
    if (!name.trim()) { toast('Enter a project name'); return }
    setSaving(true)
    const row = { company_id: activeCompany.id, name: name.trim(), site: site.trim(), budget: +budget||null, color, emoji }
    let saved
    const { data, error } = editing
      ? await supabase.from('projects').update(row).eq('id', editing.id).select().catch(() => ({ data:null, error:true }))
      : await supabase.from('projects').insert([row]).select().catch(() => ({ data:null, error:true }))

    if (error || !data) {
      // localStorage fallback
      const local = JSON.parse(localStorage.getItem(`wb_projects_${activeCompany.id}`) || '[]')
      if (editing) {
        saved = local.map(p => p.id === editing.id ? { ...p, ...row } : p)
      } else {
        saved = [{ ...row, id: Date.now().toString() }, ...local]
      }
      localStorage.setItem(`wb_projects_${activeCompany.id}`, JSON.stringify(saved))
      setProjects(saved)
    } else {
      setProjects(editing ? projects.map(p => p.id === editing.id ? data[0] : p) : [data[0], ...projects])
    }
    setShowForm(false); resetForm(); setSaving(false)
    toast(editing ? '✓ Project updated' : '✓ Project created')
  }

  const del = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return
    await supabase.from('projects').delete().eq('id', p.id).catch(() => {})
    const local = JSON.parse(localStorage.getItem(`wb_projects_${activeCompany.id}`) || '[]')
    const next  = local.filter(x => x.id !== p.id)
    localStorage.setItem(`wb_projects_${activeCompany.id}`, JSON.stringify(next))
    setProjects(projects.filter(x => x.id !== p.id))
    toast('Deleted')
  }

  // Compute spend per project from entries
  const spendMap = entries.reduce((acc, e) => {
    if (e.project_id) acc[e.project_id] = (acc[e.project_id]||0) + (e.amount||0)
    return acc
  }, {})

  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        <h2 className={s.title}>Projects & Sites</h2>
        <button className="btn-prim" onClick={openNew}>+ New Project</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div><p>Loading…</p></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📁</div>
          <p>No projects yet. Create one to tag expenses to a site.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {projects.map(p => {
            const spent  = spendMap[p.id] || 0
            const budget = p.budget || 0
            const pct    = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
            const over   = budget > 0 && spent > budget
            return (
              <div key={p.id} className={s.card} style={{ borderTop: `3px solid ${p.color||'var(--brand)'}` }}>
                <div className={s.cardHead}>
                  <div className={s.cardEmoji} style={{ background: (p.color||'var(--brand)')+'18' }}>{p.emoji||'📁'}</div>
                  <div className={s.cardInfo}>
                    <div className={s.cardName}>{p.name}</div>
                    {p.site && <div className={s.cardSite}>📍 {p.site}</div>}
                  </div>
                  <div className={s.cardActions}>
                    <button className={s.iconBtn} onClick={() => openEdit(p)}>✏️</button>
                    <button className={s.iconBtn} onClick={() => del(p)}>🗑</button>
                  </div>
                </div>

                <div className={s.cardSpend}>
                  <div className={s.spendRow}>
                    <span className={s.spendLabel}>Spent</span>
                    <span className={s.spendAmt + (over ? ' '+s.over : '')}>{fmt(spent, sym)}</span>
                  </div>
                  {budget > 0 && (
                    <>
                      <div className={s.spendRow}>
                        <span className={s.spendLabel}>Budget</span>
                        <span className={s.spendAmt}>{fmt(budget, sym)}</span>
                      </div>
                      <div className={s.budgetBar}>
                        <div className={s.budgetFill + (over ? ' '+s.budgetOver : '')} style={{ width: pct+'%' }} />
                      </div>
                      {over && <div className={s.overMsg}>⚠️ Over budget by {fmt(spent - budget, sym)}</div>}
                    </>
                  )}
                </div>

                <div className={s.cardCount}>
                  {(entries.filter(e => e.project_id === p.id).length)} entries
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <>
          <div className={s.overlay} onClick={() => setShowForm(false)} />
          <div className={s.modal + ' rise'}>
            <div className={s.modalHdr}>
              <h3>{editing ? 'Edit Project' : 'New Project'}</h3>
              <button className={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className={s.emojiRow}>
              {EMOJIS.map(e => (
                <button key={e} className={s.emojiBtn + (emoji===e ? ' '+s.emojiBtnSel : '')} onClick={() => setEmoji(e)}>{e}</button>
              ))}
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Project Name</label>
              <input className="inp" placeholder="e.g. Block B Foundation" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.lbl}>Site / Location <span style={{fontWeight:400,color:'var(--txt4)'}}>optional</span></label>
              <input className="inp" placeholder="e.g. Jaggayyapet Ward 5" value={site} onChange={e => setSite(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.lbl}>Budget <span style={{fontWeight:400,color:'var(--txt4)'}}>optional</span></label>
              <input className="inp" type="number" placeholder="Total budget amount" value={budget} onChange={e => setBudget(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.lbl}>Colour</label>
              <div className={s.colorRow}>
                {COLORS.map(c => (
                  <button key={c} className={s.colorDot + (color===c ? ' '+s.colorDotSel : '')} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <button className="btn-prim" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create Project'}</button>
          </div>
        </>
      )}
    </div>
  )
}
