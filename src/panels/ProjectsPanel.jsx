import { useState, useEffect } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { useToast } from '../components/Toast'
import { fmt } from '../lib/supabase'
import { getProjects, saveProject, deleteProject } from '../lib/localData'
import s from './ProjectsPanel.module.css'

const PROJ_EMOJIS = ['📁','🏗️','🏠','🏢','🏭','🌿','⚡','🚧','🛣️','🌊','🔑','📐']
const PROJ_COLORS = ['#3a6652','#ea580c','#7c3aed','#0891b2','#dc2626','#e8920a','#16a34a','#9333ea']

const blank = () => ({ id: null, name: '', emoji: '📁', budget: '', color: '#3a6652' })

export default function ProjectsPanel() {
  const toast = useToast()
  const { entries, role } = useStore()
  const { activeCompany } = usePersistedStore()
  const cid = activeCompany?.id
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const canEdit = ROLE.canEdit(role)

  const [projects, setProjects] = useState([])
  const [form,     setForm]     = useState(null)   // null = closed, object = open

  useEffect(() => { if (cid) setProjects(getProjects(cid)) }, [cid])

  const totalFor = p => entries.filter(e => e.project_id === p.id && e.status !== 'rejected').reduce((s,e)=>s+e.amount,0)
  const countFor = p => entries.filter(e => e.project_id === p.id).length

  const save = () => {
    if (!form.name.trim()) { toast('Enter a project name'); return }
    const updated = saveProject(cid, { ...form, name: form.name.trim(), budget: parseFloat(form.budget)||0 })
    setProjects(updated)
    setForm(null)
    toast(form.id ? '✓ Project updated' : '✓ Project created')
  }

  const del = (p) => {
    if (!confirm(`Delete "${p.name}"? Entries will not be deleted.`)) return
    deleteProject(cid, p.id)
    setProjects(getProjects(cid))
    toast('Project deleted')
  }

  return (
    <div className={s.panel}>

      {/* Header action */}
      {canEdit && (
        <div className={s.topBar}>
          <span className={s.topCount}>{projects.length} project{projects.length!==1?'s':''}</span>
          <button className="btn-prim" style={{padding:'8px 16px',fontSize:13}} onClick={()=>setForm(blank())}>+ New Project</button>
        </div>
      )}

      {/* List */}
      {projects.length === 0
        ? (
          <div className="empty-state">
            <div className="icon">📁</div>
            <p>No projects yet — create one to tag your expenses by site</p>
          </div>
        )
        : projects.map(p => {
          const spent  = totalFor(p)
          const budget = p.budget || 0
          const pct    = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
          const over   = budget > 0 && spent > budget
          const barColor = over ? 'var(--red)' : pct > 80 ? 'var(--accent)' : p.color

          return (
            <div key={p.id} className={s.card}>
              <div className={s.cardTop}>
                <div className={s.cardEmoji} style={{background:p.color+'22'}}>{p.emoji}</div>
                <div className={s.cardInfo}>
                  <div className={s.cardName}>{p.name}</div>
                  <div className={s.cardMeta}>
                    <span>{countFor(p)} entries</span>
                    {budget > 0 && <span>Budget: {fmt(budget,sym)}</span>}
                  </div>
                </div>
                <div className={s.cardRight}>
                  <div className={s.cardSpent} style={{color: over ? 'var(--red)' : p.color}}>{fmt(spent,sym)}</div>
                  {over && <div className={s.overBadge}>Over budget</div>}
                  {canEdit && (
                    <div className={s.cardBtns}>
                      <button className={s.editBtn} onClick={()=>setForm({...p})}>✏️</button>
                      <button className={s.delBtn}  onClick={()=>del(p)}>🗑</button>
                    </div>
                  )}
                </div>
              </div>
              {budget > 0 && (
                <div className={s.budgetBar}>
                  <div className={s.budgetFill} style={{width:pct+'%', background:barColor}} />
                </div>
              )}
              {budget > 0 && (
                <div className={s.budgetMeta}>
                  <span style={{color:over?'var(--red)':barColor}}>
                    {over ? `${fmt(spent-budget,sym)} over` : `${fmt(budget-spent,sym)} remaining`}
                  </span>
                  <span style={{color:'var(--txt3)'}}>{Math.round(pct)}%</span>
                </div>
              )}
            </div>
          )
        })
      }

      {/* Form modal */}
      {form && (
        <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&setForm(null)}>
          <div className={s.modal}>
            <div className={s.modalHdr}>
              <span>{form.id ? 'Edit Project' : 'New Project'}</span>
              <button className={s.close} onClick={()=>setForm(null)}>✕</button>
            </div>

            {/* Emoji picker */}
            <div className={s.field}>
              <label className={s.lbl}>Emoji</label>
              <div className={s.emojiRow}>
                {PROJ_EMOJIS.map(e=>(
                  <button key={e} className={s.eBtn+(form.emoji===e?' '+s.eBtnSel:'')} onClick={()=>setForm(f=>({...f,emoji:e}))}>{e}</button>
                ))}
              </div>
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Project name</label>
              <input className="inp" placeholder="e.g. Sai Drain Work" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Budget (optional)</label>
              <input className="inp" type="number" placeholder="e.g. 500000" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} />
            </div>

            {/* Color picker */}
            <div className={s.field}>
              <label className={s.lbl}>Color</label>
              <div className={s.colorRow}>
                {PROJ_COLORS.map(c=>(
                  <button key={c} className={s.cBtn+(form.color===c?' '+s.cBtnSel:'')} style={{background:c}} onClick={()=>setForm(f=>({...f,color:c}))} />
                ))}
              </div>
            </div>

            <div className={s.modalBtns}>
              <button className="btn-ghost" onClick={()=>setForm(null)}>Cancel</button>
              <button className="btn-prim"  onClick={save}>Save Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
