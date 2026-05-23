import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLog'
import { useToast } from '../components/Toast'
import s from './Register.module.css'

const CURRENCIES = [
  { v:'INR', l:'₹ INR — Indian Rupee' },
  { v:'USD', l:'$ USD — US Dollar'    },
  { v:'EUR', l:'€ EUR — Euro'         },
  { v:'AED', l:'د.إ AED — UAE Dirham'  },
]
const EMOJIS = ['🏗️','🏢','🏠','🏭','🌿','⚡','🚀','💼','🔑','📐','🛠️','🌊']

export default function RegisterPage() {
  const toast = useToast()
  const nav   = useNavigate()

  const [name,     setName]     = useState('')
  const [slug,     setSlug]     = useState('')
  const [email,    setEmail]    = useState('')
  const [currency, setCurrency] = useState('INR')
  const [emoji,    setEmoji]    = useState('🏗️')
  const [slugMsg,  setSlugMsg]  = useState({ ok:false, msg:'' })
  const [partners, setPartners] = useState([{ name:'', email:'' }])
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(null)

  const handleName = val => {
    setName(val)
    const sl = val.toLowerCase()
      .replace(/[^a-z0-9\s-]/g,'')
      .replace(/\s+/g,'-')
      .replace(/-+/g,'-')
      .slice(0,40)
    setSlug(sl)
    if (sl.length >= 3) checkSlug(sl)
  }

  const checkSlug = async val => {
    if (!val || val.length < 3) { setSlugMsg({ ok:false, msg:'Min 3 characters' }); return false }
    if (!/^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(val)) {
      setSlugMsg({ ok:false, msg:'Lowercase letters, numbers and hyphens only' }); return false
    }
    const { data } = await supabase.from('companies').select('id').eq('slug', val).maybeSingle()
    if (data) { setSlugMsg({ ok:false, msg:'Already taken — try another name' }); return false }
    setSlugMsg({ ok:true, msg:`✓  workbills.app/${val}` })
    return true
  }

  const submit = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) { toast('Enter a valid owner email'); return }
    if (!name.trim()) { toast('Enter a company name'); return }
    const slugOk = await checkSlug(slug)
    if (!slugOk) { toast('Fix the URL before continuing'); return }

    setLoading(true)
    try {
      const pList = partners
        .filter(p => p.name.trim())
        .map(p => ({ name: p.name.trim(), email: p.email.trim().toLowerCase() || null, role: 'partner' }))

      // Schema: companies(id uuid, name, subtitle, emoji, color, currency, partners jsonb, slug)
      // NO owner_email column — don't include it
      const { data: co, error: ce } = await supabase
        .from('companies')
        .insert([{
          name:     name.trim(),
          slug:     slug,
          emoji:    emoji,
          color:    '#3a6652',
          currency: currency,
          partners: pList,       // stored as JSONB
        }])
        .select('id, slug, name, emoji, currency, partners')
        .single()

      if (ce) {
        devLog.error('[RegisterPage] company insert failed')
        toast('Registration failed: ' + (ce.message || ce.details || 'Database error'))
        return
      }

      devLog.info('[RegisterPage] company created')

      // Schema: users(id uuid, company_id uuid FK, email, role)
      // company_id MUST be the UUID, not the slug string
      const { error: ue } = await supabase.from('users').insert([{
        company_id: co.id,                    // ← real UUID
        email:      email.toLowerCase(),
        role:       'owner',
      }])
      if (ue && !ue.message?.includes('duplicate')) {
        devLog.warn('[RegisterPage] users insert warning')
      }

      // Insert partners into users table
      await Promise.all(
        pList.filter(p => p.email).map(p =>
          supabase.from('users').insert([{
            company_id: co.id,                // ← real UUID
            email:      p.email,
            role:       'partner',
          }]).then(r => r.error && devLog.warn('[RegisterPage] partner user insert'))
        )
      )

      // Save to localStorage so findCompany fallback works
      const local = JSON.parse(localStorage.getItem('wb_companies') || '[]')
      local.push({
        id:         co.id,   // UUID
        slug:       slug,
        emoji,
        name:       name.trim(),
        partners:   pList,
        currency,
        ownerEmail: email.toLowerCase(),
      })
      localStorage.setItem('wb_companies', JSON.stringify(local))

      devLog.info('[RegisterPage] registration complete')
      setDone({ url: `workbills.app/${slug}` })

    } catch (e) {
      devLog.error('[RegisterPage] fatal error')
      toast('Registration failed: ' + (e?.message || JSON.stringify(e)))
    } finally {
      setLoading(false)
    }
  }

  const filledPartners = partners.filter(p => p.name.trim())

  if (done) return (
    <div className={s.overlay}>
      <div className={s.success}>
        <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
        <h2>Your workspace is ready!</h2>
        <p>Sign in with Google to get started. Share your URL with your team.</p>
        <div className={s.urlBox}>
          <span>{done.url}</span>
          <button onClick={() => { navigator.clipboard?.writeText('https://'+done.url); toast('Copied!') }}>Copy</button>
        </div>
        <button className={s.submitBtn} onClick={() => nav('/login')}>Sign in now →</button>
      </div>
    </div>
  )

  return (
    <div className={s.page}>
      <nav className={s.nav}>
        <div className={s.logo} onClick={() => nav('/')}>
          <span className={s.badge}>💼</span> WorkBills
        </div>
        <Link to="/login" className={s.link}>Sign in →</Link>
      </nav>

      <div className={s.body}>
        <div className={s.form}>
          <h1>Register your company</h1>
          <p className={s.sub}>Free forever. Your own private URL. Works on mobile.</p>

          {/* Emoji */}
          <div className={s.field}>
            <label className={s.lbl}>Company emoji</label>
            <div className={s.emojiRow}>
              {EMOJIS.map(e => (
                <button key={e} className={s.eBtn + (emoji===e?' '+s.eBtnSel:'')} onClick={() => setEmoji(e)}>{e}</button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className={s.field}>
            <label className={s.lbl}>Company name</label>
            <input className="inp" placeholder="e.g. Amrotek Infra" value={name}
              onChange={e => handleName(e.target.value)} />
          </div>

          {/* Slug */}
          <div className={s.field}>
            <label className={s.lbl}>Your custom URL</label>
            <div className={s.slugRow}>
              <span className={s.pre}>workbills.app/</span>
              <input className={s.slugIn} value={slug}
                onChange={e => { setSlug(e.target.value); checkSlug(e.target.value) }} />
            </div>
            {slugMsg.msg && (
              <div className={s.slugMsg + ' ' + (slugMsg.ok ? s.ok : s.bad)}>{slugMsg.msg}</div>
            )}
          </div>

          {/* Email */}
          <div className={s.field}>
            <label className={s.lbl}>Your email (owner)</label>
            <input className="inp" type="email" placeholder="you@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Currency */}
          <div className={s.field}>
            <label className={s.lbl}>Currency</label>
            <select className="inp" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>

          {/* Partners */}
          <div className={s.field}>
            <label className={s.lbl}>Partners <span className={s.opt}>optional</span></label>
            {partners.map((p, i) => (
              <div key={i} className={s.pRow}>
                <span className={s.pEmoji}>👤</span>
                <div className={s.pInputs}>
                  <input className="inp" placeholder="Partner name" value={p.name}
                    onChange={e => setPartners(prev => prev.map((r,j) => j===i ? {...r, name:e.target.value} : r))} />
                  <input className="inp" type="email" placeholder="Email (optional)" value={p.email}
                    onChange={e => setPartners(prev => prev.map((r,j) => j===i ? {...r, email:e.target.value} : r))} />
                </div>
                {partners.length > 1 && (
                  <button className={s.rm} onClick={() => setPartners(prev => prev.filter((_,j) => j!==i))}>×</button>
                )}
              </div>
            ))}
            <button className={s.addP} onClick={() => setPartners(prev => [...prev, { name:'', email:'' }])}>
              + Add another partner
            </button>
          </div>

          <button className={s.submitBtn} onClick={submit} disabled={loading}>
            {loading ? 'Creating…' : 'Create Company Workspace →'}
          </button>
          <p className={s.terms}>By registering you agree to our terms. Free forever — no credit card.</p>
        </div>

        {/* Preview */}
        <div className={s.preview}>
          <div className={s.previewLbl}>Preview</div>
          <div className={s.previewCard}>
            <div className={s.previewEmoji}>{emoji}</div>
            <div className={s.previewName}>{name || 'Your Company'}</div>
            <div className={s.previewUrl}>workbills.app/{slug || 'your-company'}</div>
            <div className={s.previewCurr}>{currency}</div>
            {filledPartners.length > 0 && (
              <div className={s.previewPartners}>
                {filledPartners.map((p,i) => (
                  <div key={i} className={s.previewPartner}><span>👤</span> {p.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
