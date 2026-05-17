import { useState } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { fmt, getCatInfo } from '../lib/supabase'
import s from './ApprovalsPanel.module.css'

export default function ApprovalsPanel() {
  const toast = useToast()
  const { entries, role, patchEntry } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [rejectId,  setRejectId]  = useState(null)
  const [reason,    setReason]    = useState('')
  const [loading,   setLoading]   = useState({})

  const canApprove = ROLE.canApprove(role)
  const pending  = entries.filter(e => e.status === 'pending')
  const rejected = entries.filter(e => e.status === 'rejected')

  const approve = async (id) => {
    setLoading(l=>({...l,[id]:true}))
    const { error } = await supabase.from('expenses').update({ status:'approved' }).eq('id',id)
    if (error) { toast('Error: ' + error.message) }
    else { patchEntry(id, { status:'approved' }); toast('✓ Approved') }
    setLoading(l=>({...l,[id]:false}))
  }

  const reject = async () => {
    if (!reason.trim()) { toast('Enter a reason'); return }
    setLoading(l=>({...l,[rejectId]:true}))
    const { error } = await supabase.from('expenses').update({ status:'rejected', rejection_reason: reason }).eq('id',rejectId)
    if (error) { toast('Error: ' + error.message) }
    else { patchEntry(rejectId, { status:'rejected', rejection_reason: reason }); toast('Entry rejected'); setRejectId(null); setReason('') }
    setLoading(l=>({...l,[rejectId]:false}))
  }

  if (!canApprove) return (
    <div className="empty-state"><div className="icon">🔒</div><p>Approvals are only available to owners and partners</p></div>
  )

  return (
    <div className={s.panel}>

      {/* Pending */}
      <div className={s.section}>
        <div className={s.sectionHdr}>
          <span>Pending Approval</span>
          <span className={s.badge} style={{background:'#eff6ff',color:'#1d4ed8'}}>{pending.length}</span>
        </div>
        {pending.length === 0
          ? <div className={s.empty}>✅ Nothing pending — all caught up!</div>
          : pending.map(e => <EntryCard key={e.id} e={e} sym={sym} loading={loading[e.id]} onApprove={()=>approve(e.id)} onReject={()=>{setRejectId(e.id);setReason('')}} />)
        }
      </div>

      {/* Rejected */}
      {rejected.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionHdr}>
            <span>Rejected</span>
            <span className={s.badge} style={{background:'#fef2f2',color:'var(--red)'}}>{rejected.length}</span>
          </div>
          {rejected.map(e => <EntryCard key={e.id} e={e} sym={sym} readOnly />)}
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className={s.overlay} onClick={e=>e.target===e.currentTarget&&setRejectId(null)}>
          <div className={s.modal}>
            <div className={s.mHdr}><span>Reject Entry</span><button className={s.mClose} onClick={()=>setRejectId(null)}>✕</button></div>
            <div className={s.mBody}>
              <p className={s.mInfo}>The employee will see this reason.</p>
              <textarea
                className={s.textarea}
                placeholder="Reason for rejection (e.g. duplicate entry, wrong amount…)"
                value={reason}
                onChange={e=>setReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className={s.mFoot}>
              <button className="btn-ghost" onClick={()=>setRejectId(null)}>Cancel</button>
              <button className={s.rejectBtn} onClick={reject}>Reject Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryCard({ e, sym, loading, onApprove, onReject, readOnly }) {
  const info = getCatInfo(e.category)
  return (
    <div className={s.card}>
      <div className={s.cardTop}>
        <div className={s.catEmoji} style={{background:info.c+'18'}}>{info.e}</div>
        <div className={s.info}>
          <div className={s.person}>{e.person}</div>
          <div className={s.desc}>{e.description}</div>
          <div className={s.meta}>
            <span className={s.catBadge} style={{background:info.c+'18',color:info.c}}>{info.e} {e.category}</span>
            <span className={s.dateBadge}>{e.date}</span>
            {e.payMode && e.payMode !== 'UPI' && <span className={s.payBadge}>{e.payMode}</span>}
          </div>
          {e.status === 'rejected' && e.rejection_reason && (
            <div className={s.rejectReason}>✕ {e.rejection_reason}</div>
          )}
        </div>
        <div className={s.cardRight}>
          <div className={s.amt}>{fmt(e.amount, sym)}</div>
        </div>
      </div>
      {!readOnly && (
        <div className={s.cardActions}>
          <button className={s.rejectBtn2} onClick={onReject} disabled={loading}>✕ Reject</button>
          <button className={s.approveBtn} onClick={onApprove} disabled={loading}>
            {loading ? '…' : '✓ Approve'}
          </button>
        </div>
      )}
    </div>
  )
}
