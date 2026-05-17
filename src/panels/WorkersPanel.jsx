import { useState, useEffect } from 'react'
import { usePersistedStore, useStore, ROLE } from '../store'
import { useToast } from '../components/Toast'
import { fmt, todayISO } from '../lib/supabase'
import { getWorkers, getWageLogs, saveWorker, deleteWorker, addWageLog, deleteWageLog } from '../lib/localData'
import s from './WorkersPanel.module.css'

const blankWorker = () => ({ id:null, name:'', role:'Mason', dailyWage:'', phone:'' })
const WORKER_ROLES = ['Mason','Helper','Carpenter','Plumber','Electrician','Painter','Welder','Driver','Engineer','Supervisor','Other']

export default function WorkersPanel() {
  const toast = useToast()
  const { role } = useStore()
  const { activeCompany } = usePersistedStore()
  const cid = activeCompany?.id
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const canEdit = ROLE.canEdit(role)

  const [workers,  setWorkers]  = useState([])
  const [logs,     setLogs]     = useState([])
  const [workerForm, setWorkerForm] = useState(null)
  const [logForm,    setLogForm]    = useState(null)  // { workerId, date, days, amount, type:'wage'|'advance'|'payment', note }
  const [expanded,   setExpanded]   = useState(null)

  const load = () => { setWorkers(getWorkers(cid)); setLogs(getWageLogs(cid)) }
  useEffect(() => { if (cid) load() }, [cid])

  // Per-worker balances
  const balance = (wid) => {
    const wLogs = logs.filter(l => l.workerId === wid)
    const owed  = wLogs.filter(l => l.type==='wage'||l.type==='advance').reduce((s,l)=>s+l.amount,0)
    const paid  = wLogs.filter(l => l.type==='payment').reduce((s,l)=>s+l.amount,0)
    return { owed, paid, due: owed - paid }
  }

  const saveW = () => {
    if (!workerForm.name.trim()) { toast('Enter a name'); return }
    const updated = saveWorker(cid, { ...workerForm, name: workerForm.name.trim(), dailyWage: parseFloat(workerForm.dailyWage)||0 })
    setWorkers(updated)
    setWorkerForm(null)
    toast(workerForm.id ? '✓ Worker updated' : '✓ Worker added')
  }

  const delW = (w) => {
    if (!confirm(`Remove ${w.name}? All logs will be deleted.`)) return
    deleteWorker(cid, w.id)
    load()
    toast('Worker removed')
  }

  const saveLog = () => {
    if (!logForm.amount || logForm.amount <= 0) { toast('Enter a valid amount'); return }
    const updated = addWageLog(cid, { ...logForm, amount: parseFloat(logForm.amount), date: logForm.date || todayISO() })
    setLogs(updated)
    setLogForm(null)
    toast('✓ Log added')
  }

  return (
    <div className={s.panel}>
      <div className={s.topBar}>
        <span className={s.topCount}>{workers.length} worker{workers.length!==1?'s':''}</span>
        {canEdit && <button className="btn-prim" style={{padding:'8px 16px',fontSize:13}} onClick={()=>setWorkerForm(blankWorker())}>+ Add Worker</button>}
      </div>

      {workers.length === 0
        ? <div className="empty-state"><div className="icon">👷</div><p>Add workers to track wages and payments</p></div>
        : workers.map(w => {
          const b = balance(w.id)
          const wLogs = logs.filter(l=>l.workerId===w.id).sort((a,b_)=>b_.date.localeCompare(a.date))
          const open = expanded === w.id

          return (
            <div key={w.id} className={s.wCard}>
              <div className={s.wTop} onClick={()=>setExpanded(open?null:w.id)}>
                <div className={s.wAvatar}>{w.name.charAt(0)}</div>
                <div className={s.wInfo}>
                  <div className={s.wName}>{w.name}</div>
                  <div className={s.wRole}>{w.role}{w.dailyWage>0?` · ₹${w.dailyWage}/day`:''}</div>
                </div>
                <div className={s.wRight}>
                  <div className={s.wDue} style={{color:b.due>0?'var(--red)':b.due<0?'var(--green)':'var(--txt3)'}}>
                    {b.due===0?'Settled':b.due>0?fmt(b.due,sym)+' due':fmt(-b.due,sym)+' adv'}
                  </div>
                  <div className={s.wChevron}>{open?'▲':'▼'}</div>
                </div>
              </div>

              {open && (
                <div className={s.wBody}>
                  {/* Balance row */}
                  <div className={s.balRow}>
                    <div className={s.balItem}><div className={s.balV} style={{color:'var(--red)'}}>{fmt(b.owed,sym)}</div><div className={s.balL}>Total Owed</div></div>
                    <div className={s.balItem}><div className={s.balV} style={{color:'var(--green)'}}>{fmt(b.paid,sym)}</div><div className={s.balL}>Total Paid</div></div>
                    <div className={s.balItem}><div className={s.balV} style={{color:b.due>0?'var(--accent)':'var(--green)'}}>{fmt(Math.abs(b.due),sym)}</div><div className={s.balL}>{b.due>0?'Balance Due':'Advance'}</div></div>
                  </div>

                  {/* Log actions */}
                  {canEdit && (
                    <div className={s.logBtns}>
                      <button className={s.logBtn+' '+s.logWage}     onClick={()=>setLogForm({workerId:w.id,type:'wage',    date:todayISO(),days:'',amount:'',note:''})}>+ Wages</button>
                      <button className={s.logBtn+' '+s.logAdvance}  onClick={()=>setLogForm({workerId:w.id,type:'advance', date:todayISO(),days:'',amount:'',note:''})}>+ Advance</button>
                      <button className={s.logBtn+' '+s.logPayment}  onClick={()=>setLogForm({workerId:w.id,type:'payment', date:todayISO(),days:'',amount:'',note:''})}>✓ Payment</button>
                    </div>
                  )}

                  {/* Log history */}
                  {wLogs.length > 0 && (
                    <div className={s.logList}>
                      {wLogs.slice(0,10).map(l => (
                        <div key={l.id} className={s.logRow}>
                          <div className={s.logIcon}>{l.type==='payment'?'💰':l.type==='advance'?'💸':'👷'}</div>
                          <div className={s.logInfo}>
                            <div className={s.logType}>{l.type==='wage'?`Wages${l.days?` (${l.days}d)`:''}`:'Advance'===l.type?'Advance':'Payment'}</div>
                            {l.note && <div className={s.logNote}>{l.note}</div>}
                            <div className={s.logDate}>{l.date}</div>
                          </div>
                          <div className={s.logAmt} style={{color:l.type==='payment'?'var(--green)':'var(--red)'}}>
                            {l.type==='payment'?'- ':'+ '}{fmt(l.amount,sym)}
                          </div>
                          {canEdit && <button className={s.logDel} onClick={()=>{deleteWageLog(cid,l.id);load()}}>×</button>}
                        </div>
                      ))}
                    </div>
                  )}

                  {canEdit && (
                    <div className={s.wEditRow}>
                      <button className={s.editBtn} onClick={()=>setWorkerForm({...w})}>✏️ Edit</button>
                      <button className={s.delBtn}  onClick={()=>delW(w)}>🗑 Remove</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      }

      {/* Worker form */}
      {workerForm && (
        <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&setWorkerForm(null)}>
          <div className={s.modal}>
            <div className={s.mHdr}><span>{workerForm.id?'Edit Worker':'Add Worker'}</span><button className={s.mClose} onClick={()=>setWorkerForm(null)}>✕</button></div>
            <div className={s.mBody}>
              <label className={s.lbl}>Name</label>
              <input className="inp" placeholder="Worker name" value={workerForm.name} onChange={e=>setWorkerForm(f=>({...f,name:e.target.value}))} style={{marginBottom:12}} />
              <label className={s.lbl}>Trade / Role</label>
              <select className="inp" value={workerForm.role} onChange={e=>setWorkerForm(f=>({...f,role:e.target.value}))} style={{marginBottom:12}}>
                {WORKER_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <label className={s.lbl}>Daily Wage ({sym})</label>
              <input className="inp" type="number" placeholder="0" value={workerForm.dailyWage} onChange={e=>setWorkerForm(f=>({...f,dailyWage:e.target.value}))} style={{marginBottom:12}} />
              <label className={s.lbl}>Phone (optional)</label>
              <input className="inp" type="tel" placeholder="9876543210" value={workerForm.phone} onChange={e=>setWorkerForm(f=>({...f,phone:e.target.value}))} />
            </div>
            <div className={s.mFoot}>
              <button className="btn-ghost" onClick={()=>setWorkerForm(null)}>Cancel</button>
              <button className="btn-prim"  onClick={saveW}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Log form */}
      {logForm && (
        <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&setLogForm(null)}>
          <div className={s.modal}>
            <div className={s.mHdr}>
              <span>{logForm.type==='wage'?'Add Wages':logForm.type==='advance'?'Add Advance':'Record Payment'}</span>
              <button className={s.mClose} onClick={()=>setLogForm(null)}>✕</button>
            </div>
            <div className={s.mBody}>
              <label className={s.lbl}>Date</label>
              <input className="inp" type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))} style={{marginBottom:12}} />
              {logForm.type==='wage' && <>
                <label className={s.lbl}>Days worked</label>
                <input className="inp" type="number" step="0.5" placeholder="1" value={logForm.days} onChange={e=>setLogForm(f=>({...f,days:e.target.value}))} style={{marginBottom:12}} />
              </>}
              <label className={s.lbl}>Amount ({sym})</label>
              <input className="inp" type="number" placeholder="0" value={logForm.amount} onChange={e=>setLogForm(f=>({...f,amount:e.target.value}))} style={{marginBottom:12}} />
              <label className={s.lbl}>Note (optional)</label>
              <input className="inp" placeholder="e.g. foundation work" value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} />
            </div>
            <div className={s.mFoot}>
              <button className="btn-ghost" onClick={()=>setLogForm(null)}>Cancel</button>
              <button className="btn-prim"  onClick={saveLog}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
