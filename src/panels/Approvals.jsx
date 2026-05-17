import { useState, useMemo } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { supabase, fmt } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Approvals.module.css'

export default function Approvals() {
  const toast = useToast()
  const { entries, role, patchEntry } = useStore()
  const { activeCompany } = usePersistedStore()
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const [rejectId,  setRejectId]  = useState(null)
  const [reason,    setReason]    = useState('')
  const [loading,   setLoading]   = useState({})

  const canApprove = ROLE.canApprove(role)

  const pending  = useMemo(() => entries.filter(e => e.status === 'pending'),  [entries])
  const rejected = useMemo(() => entries.filter(e => e.status === 'rejected'), [entries])
  const approved = useMemo(() => entries.filter(e => e.status === 'approved').slice(0,20), [entries])

  const setLoad = (id, v) => setLoading(l => ({ ...l, [id]: v }))

  const approve = async (id) => {
    if (!canApprove) { toast('Only owners/partners can approve'); return }
    setLoad(id, true)
    const { error } = await supabase.from('expenses').update({ status: 'approved', rejection_reason: null }).eq('id', id)
    if (error) { toast('Failed: ' + error.message) }
    else { patchEntry(id, { status: 'approved', rejection_reason: null }); toast('✅ Approved') }
    setLoad(id, false)
  }

  const reject = async () => {
    if (!canApprove) { toast('Only owners/partners can reject'); return }
    setLoad(rejectId, true)
    const { error } = await supabase.from('expenses').update({ status: 'rejected', rejection_reason: reason || 'No reason given' }).eq('id', rejectId)
    if (error) { toast('Failed: ' + error.message) }
    else { patchEntry(rejectId, { status: 'rejected', rejection_reason: reason || 'No reason given' }); toast('✕ Rejected') }
    setLoad(rejectId, false)
    setRejectId(null); setReason('')
  }

  const reopen = async (id) => {
    setLoad(id, true)
    const { error } = await supabase.from('expenses').update({ status: 'pending', rejection_reason: null }).eq('id', id)
    if (error) { toast('Failed: ' + error.message) }
    else { patchEntry(id, { status: 'pending', rejection_reason: null }); toast('↩ Moved back to pending') }
    setLoad(id, false)
  }

  const EntryCard = ({ e, actions }) => (
    <div className={s.card}>
      <div className={s.cardTop}>
        <div className={s.cardLeft}>
          <div className={s.person}>{e.person}</div>
          <div className={s.desc}>{e.description || e.category}</div>
          <div className={s.meta}>
            <span className={s.tag}>{e.category}</span>
            <span className={s.tag}>{e.date}</span>
            {e.payMode && <span className={s.tag}>{e.payMode}</span>}
          </div>
          {e.rejection_reason && (
            <div className={s.rejectReason}>Reason: {e.rejection_reason}</div>
          )}
        </div>
        <div className={s.cardRight}>
          <div className={s.amt}>{fmt(e.amount, sym)}</div>
        </div>
      </div>
      {actions && (
        <div className={s.cardActions}>
          {actions}
        </div>
      )}
    </div>
  )

  return (
    <div className={s.panel}>

      {/* Pending */}
      <div className={s.section}>
        <div className={s.sectionHdr}>
          <span className={s.sectionTitle}>⏳ Pending</span>
          <span className={s.badge + ' ' + s.badgePending}>{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className={s.empty}>No pending entries — you're all caught up ✅</div>
        ) : pending.map(e => (
          <EntryCard key={e.id} e={e} actions={canApprove && (
            <>
              <button
                className={s.approveBtn}
                disabled={loading[e.id]}
                onClick={() => approve(e.id)}
              >✅ Approve</button>
              <button
                className={s.rejectBtn}
                disabled={loading[e.id]}
                onClick={() => { setRejectId(e.id); setReason('') }}
              >✕ Reject</button>
            </>
          )} />
        ))}
      </div>

      {/* Rejected */}
      {rejected.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionHdr}>
            <span className={s.sectionTitle}>✕ Rejected</span>
            <span className={s.badge + ' ' + s.badgeRejected}>{rejected.length}</span>
          </div>
          {rejected.map(e => (
            <EntryCard key={e.id} e={e} actions={canApprove && (
              <button className={s.reopenBtn} disabled={loading[e.id]} onClick={() => reopen(e.id)}>
                ↩ Move to Pending
              </button>
            )} />
          ))}
        </div>
      )}

      {/* Recently approved */}
      {approved.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionHdr}>
            <span className={s.sectionTitle}>✅ Recently Approved</span>
            <span className={s.badge + ' ' + s.badgeApproved}>{approved.length}</span>
          </div>
          {approved.slice(0,5).map(e => (
            <EntryCard key={e.id} e={e} actions={null} />
          ))}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <>
          <div className={s.overlay} onClick={() => setRejectId(null)} />
          <div className={s.modal + ' rise'}>
            <div className={s.modalHdr}>
              <h3>Reject Entry</h3>
              <button className={s.closeBtn} onClick={() => setRejectId(null)}>✕</button>
            </div>
            <p style={{ fontSize:13, color:'var(--txt3)', marginBottom:12 }}>Provide a reason (shown to the submitter)</p>
            <textarea
              className="inp"
              placeholder="e.g. Amount doesn't match receipt…"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ resize:'none' }}
            />
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button className="btn-ghost" onClick={() => setRejectId(null)}>Cancel</button>
              <button className={s.rejectBtn} style={{ flex:1 }} onClick={reject}>Confirm Reject</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
