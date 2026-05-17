import { useState, useEffect } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import s from './Team.module.css'

const ROLE_META = {
  owner:   { label: 'Owner',   desc: 'Full access — add, edit, delete, approve', color: 'var(--brand)' },
  partner: { label: 'Partner', desc: 'Full add/edit, can approve pending entries', color: '#7c3aed' },
  employee:{ label: 'Employee',desc: 'Add only — entries need approval, no financial view', color: '#ea580c' },
}

export default function Team() {
  const toast = useToast()
  const { user, role } = useStore()
  const { activeCompany } = usePersistedStore()

  const [members,   setMembers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [email,     setEmail]     = useState('')
  const [invRole,   setInvRole]   = useState('employee')
  const [invName,   setInvName]   = useState('')
  const [saving,    setSaving]    = useState(false)

  const isOwner = role === 'owner'

  useEffect(() => { load() }, [activeCompany?.id])

  const load = async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('users').select('*').eq('company_id', activeCompany.id)
      .catch(() => ({ data: null, error: true }))
    if (!error && data) {
      setMembers(data)
    } else {
      // Reconstruct from company.partners
      const partners = activeCompany?.partners || []
      const list = partners.map((p, i) => ({
        id: `p_${i}`,
        email: p.email || '',
        role: p.role || 'partner',
        name: p.name || '',
        local: true,
      }))
      setMembers(list)
    }
    setLoading(false)
  }

  const invite = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email'); return }
    setSaving(true)
    const { error } = await supabase.from('users').insert([{
      company_id: activeCompany.id,
      email: email.trim().toLowerCase(),
      role: invRole,
    }]).catch(() => ({ error: true }))

    if (!error) {
      toast(`✓ ${email} invited as ${invRole}`)
      setMembers(prev => [...prev, { id: Date.now(), email: email.trim().toLowerCase(), role: invRole }])
    } else {
      toast('Could not invite — they may already be a member')
    }
    setEmail(''); setInvName(''); setInvRole('employee')
    setShowInvite(false); setSaving(false)
  }

  const changeRole = async (id, newRole) => {
    if (!isOwner) { toast('Only the owner can change roles'); return }
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', id)
    if (!error) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role: newRole } : m))
      toast('✓ Role updated')
    } else {
      toast('Failed to update role')
    }
  }

  const remove = async (id, email) => {
    if (!isOwner) { toast('Only the owner can remove members'); return }
    if (email === user?.email) { toast("You can't remove yourself"); return }
    if (!confirm(`Remove ${email}?`)) return
    await supabase.from('users').delete().eq('id', id).catch(() => {})
    setMembers(prev => prev.filter(m => m.id !== id))
    toast('Member removed')
  }

  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        <h2 className={s.title}>Team</h2>
        {isOwner && (
          <button className="btn-prim" onClick={() => setShowInvite(true)}>+ Invite</button>
        )}
      </div>

      {/* Role legend */}
      <div className={s.legend}>
        {Object.entries(ROLE_META).map(([k, m]) => (
          <div key={k} className={s.legendItem}>
            <span className={s.roleDot} style={{ background: m.color }} />
            <div>
              <div style={{ fontSize:12, fontWeight:700 }}>{m.label}</div>
              <div style={{ fontSize:11, color:'var(--txt3)' }}>{m.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Member list */}
      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div><p>Loading…</p></div>
      ) : (
        <div className={s.list}>
          {members.map(m => {
            const rm = ROLE_META[m.role] || ROLE_META.employee
            const isMe = m.email === user?.email
            return (
              <div key={m.id} className={s.memberRow}>
                <div className={s.memberAv} style={{ background: rm.color + '22', color: rm.color }}>
                  {(m.email||'?')[0].toUpperCase()}
                </div>
                <div className={s.memberInfo}>
                  <div className={s.memberEmail}>{m.email} {isMe && <span className={s.youTag}>you</span>}</div>
                  {m.name && <div className={s.memberName}>{m.name}</div>}
                  <span className={s.roleBadge} style={{ background: rm.color + '18', color: rm.color }}>
                    {rm.label}
                  </span>
                </div>
                {isOwner && !isMe && (
                  <div className={s.memberActions}>
                    <select
                      className={s.roleSelect}
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                    >
                      <option value="owner">Owner</option>
                      <option value="partner">Partner</option>
                      <option value="employee">Employee</option>
                    </select>
                    <button className={s.removeBtn} onClick={() => remove(m.id, m.email)}>✕</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Share link */}
      <div className="card" style={{ margin:'12px 14px' }}>
        <div className="card-hdr">Invite Link</div>
        <div style={{ padding:'12px 14px' }}>
          <p style={{ fontSize:13, color:'var(--txt3)', marginBottom:10, lineHeight:1.6 }}>
            Share your company URL so team members can sign in with Google:
          </p>
          <div className={s.urlBox}>
            <span className={s.urlText}>workbills.app/{activeCompany?.slug || activeCompany?.id}</span>
            <button className={s.copyBtn} onClick={() => {
              const url = `https://workbills.app/${activeCompany?.slug || activeCompany?.id}`
              navigator.clipboard?.writeText(url).catch(() => {})
              toast('Copied!')
            }}>Copy</button>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <>
          <div className={s.overlay} onClick={() => setShowInvite(false)} />
          <div className={s.modal + ' rise'}>
            <div className={s.modalHdr}>
              <h3>Invite Team Member</h3>
              <button className={s.closeBtn} onClick={() => setShowInvite(false)}>✕</button>
            </div>

            <div className={s.field}>
              <label className={s.lbl}>Email</label>
              <input className="inp" type="email" placeholder="member@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.lbl}>Name <span style={{fontWeight:400,color:'var(--txt4)'}}>optional</span></label>
              <input className="inp" placeholder="Their name" value={invName} onChange={e => setInvName(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.lbl}>Role</label>
              <div className={s.rolePicker}>
                {Object.entries(ROLE_META).map(([k, m]) => (
                  <button
                    key={k}
                    className={s.rolePick + (invRole === k ? ' ' + s.rolePickSel : '')}
                    style={invRole === k ? { borderColor: m.color, background: m.color + '14', color: m.color } : {}}
                    onClick={() => setInvRole(k)}
                  >
                    <div style={{ fontWeight:800, fontSize:13 }}>{m.label}</div>
                    <div style={{ fontSize:11, color:'inherit', opacity:.75 }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-prim" onClick={invite} disabled={saving}>{saving ? 'Inviting…' : 'Send Invite'}</button>
            <p style={{ fontSize:11, color:'var(--txt4)', marginTop:10, textAlign:'center' }}>
              They'll see this company when they sign in with this email via Google.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
