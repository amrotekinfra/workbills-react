import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, SUPER_ADMIN } from '../lib/supabase'
import { useStore } from '../store'
import { useAuth } from '../hooks/useAuth'
import s from './AdminPage.module.css'

export default function AdminPage() {
  const { user } = useStore()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!user) { navigate('/', { replace: true }); return }
    if (user.email.trim().toLowerCase() !== SUPER_ADMIN.toLowerCase()) {
      navigate('/', { replace: true }); return
    }
    load()
  }, [user])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    const list = (data || []).map(c => {
      let partners = []
      try { partners = typeof c.partners === 'string' ? JSON.parse(c.partners || '[]') : (c.partners || []) } catch {}
      return {
        ...c, partners,
        date: c.created_at
          ? new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—'
      }
    })
    setCompanies(list)
    setLoading(false)
  }

  const del = async (id) => {
    if (!confirm('Delete this company permanently?')) return
    await supabase.from('companies').delete().eq('id', id)
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className={s.page}>
      <header className={s.hdr}>
        <div className={s.logo}><span className={s.badge}>💼</span> WorkBills Admin</div>
        <div className={s.right}>
          <span className={s.email}>{user?.email}</span>
          <button className={s.logout} onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className={s.body}>
        <h1>Company Registry</h1>

        <div className={s.kpis}>
          {[
            { icon: '🏢', label: 'Companies',  val: companies.length },
            { icon: '✅', label: 'Active',      val: companies.filter(c => c.status !== 'inactive').length },
          ].map(k => (
            <div key={k.label} className={s.kpi}>
              <div className={s.kpiIcon}>{k.icon}</div>
              <div className={s.kpiVal}>{loading ? '…' : k.val}</div>
              <div className={s.kpiLbl}>{k.label}</div>
            </div>
          ))}
        </div>

        <div className={s.wrap}>
          {loading
            ? <div className={s.loading}>Loading…</div>
            : (
              <table className={s.tbl}>
                <thead>
                  <tr><th>Company</th><th>URL</th><th>Partners</th><th>Currency</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className={s.co}>
                          <span>{c.emoji || '🏢'}</span>
                          <div>
                            <div style={{ fontWeight: 700 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.owner_email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className={s.url}>{c.slug || c.id}</td>
                      <td style={{ fontSize: 12, color: 'var(--txt3)' }}>{c.partners.map(p => p.name || p).join(', ') || '—'}</td>
                      <td>{c.currency || 'INR'}</td>
                      <td style={{ fontSize: 12, color: 'var(--txt3)' }}>{c.date}</td>
                      <td><button className={s.del} onClick={() => del(c.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  )
}
