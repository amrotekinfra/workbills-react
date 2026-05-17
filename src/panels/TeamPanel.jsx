import { useState, useEffect } from 'react'
import { useStore, usePersistedStore, ROLE } from '../store'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import s from './TeamPanel.module.css'

const ROLES = ['owner','partner','employee']
const ROLE_INFO = {
  owner:    { label:'Owner',    color:'#e8920a', bg:'#fff7ed', note:'Full access — manage team, approve entries, see all financials' },
  partner:  { label:'Partner',  color:'#3a6652', bg:'#edf5f1', note:'Full dashboard access — entries require no approval' },
  employee: { label:'Employee', color:'#7c3aed', bg:'#ede9fe', note:'Can add entries — finances hidden — needs approval' },
}

export default function TeamPanel() {
  const toast = useToast()
  const { role, user } = useStore()
  const { activeCompany } = usePersistedStore()
  const cid = activeCompany?.id
  const canManage = ROLE.canManageTeam(role)

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [invEmail, setInvEmail] = useState('')
  const [invRole,  setInvRole]  = useState('employee')
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').eq('company_id', cid).order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { if (cid) load() }, [cid])

  const invite = async () => {
    if (!invEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invEmail)) { toast('Enter a valid email'); return }
    setSaving(true)
    const { error } = await supabase.from('users').insert([{ company_id: cid, email: invEmail.toLowerCase().trim(), role: invRole }])
    if (error) {
      if (error.code === '23505') toast('This email is already in the team')
      else toast('Error: ' + error.message)
    } else {
      toast(`✓ ${invEmail} added as ${invRole}`)
      setInvEmail('')
      await load()
    }
    setSaving(false)
  }

  const changeRole = async (id, newRole) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', id)
    if (error) toast('Error: ' + error.message)
    else { toast('Role updated'); load() }
  }

  const remove = async (m) => {
    if (m.email === user?.email) { toast('You can\'t remove yourself'); return }
    if (!confirm(`Remove ${m.email} from the team?`)) return
    const { error } = await supabase.from('users').delete().eq('id', m.id)
    if (error) toast('Error: ' + error.message)
    else { toast('Member removed'); load() }
  }

  return (
    <div className={s.panel}>

      {/* Role legend */}
      <div className={s.legend}>
        {ROLES.map(r => (
          <div key={r} className={s.legendItem}>
            <div className={s.legendDot} style={{background:ROLE_INFO[r].color}} />
            <div>
              <div className={s.legendRole} style={{color:ROLE_INFO[r].color}}>{ROLE_INFO[r].label}</div>
              <div className={s.legendNote}>{ROLE_INFO[r].note}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Invite */}
      {canManage && (
        <div className={s.inviteCard}>
          <div className="card-hdr">Invite Member</div>
          <div className={s.invBody}>
            <input className="inp" type="email" placeholder="email@example.com" value={invEmail} onChange={e=>setInvEmail(e.target.value)} style={{marginBottom:10}} />
            <div className={s.roleRow}>
              {ROLES.map(r => (
                <button key={r} className={s.roleBtn+(invRole===r?' '+s.roleBtnSel:'')}
                  style={invRole===r?{background:ROLE_INFO[r].bg,color:ROLE_INFO[r].color,borderColor:ROLE_INFO[r].color}:{}}
                  onClick={()=>setInvRole(r)}>{ROLE_INFO[r].label}</button>
              ))}
            </div>
            <button className="btn-prim" style={{marginTop:10}} onClick={invite} disabled={saving}>
              {saving ? 'Adding…' : '+ Add Member'}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className={s.memberSection}>
        <div className={s.sectionHdr}>Team Members ({loading ? '…' : members.length})</div>
        {loading
          ? <div className={s.loading}>Loading…</div>
          : members.map(m => {
            const ri = ROLE_INFO[m.role] || ROLE_INFO.employee
            const isYou = m.email === user?.email
            return (
              <div key={m.id} className={s.member}>
                <div className={s.memberAv} style={{background:ri.bg,color:ri.color}}>
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div className={s.memberInfo}>
                  <div className={s.memberEmail}>{m.email} {isYou && <span className={s.you}>you</span>}</div>
                  <div className={s.memberRole} style={{color:ri.color}}>{ri.label}</div>
                </div>
                {canManage && !isYou && (
                  <div className={s.memberActions}>
                    <select
                      className={s.roleSelect}
                      value={m.role}
                      onChange={e=>changeRole(m.id, e.target.value)}
                      style={{borderColor:ri.color,color:ri.color}}
                    >
                      {ROLES.map(r=><option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                    </select>
                    <button className={s.removeBtn} onClick={()=>remove(m)}>×</button>
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
