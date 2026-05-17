import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import s from './Login.module.css'

const SIDE_FEATS = [
  { icon:'📶', text:'Works offline — log on-site without signal' },
  { icon:'👥', text:'Partner split & settlement calculator' },
  { icon:'✅', text:'Approval workflow for your team' },
  { icon:'🤖', text:'AI assistant knows your expenses' },
]

export default function LoginPage() {
  const { loginGoogle, loadDemo } = useAuth()
  const toast = useToast()
  const nav   = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    setLoading(true)
    try { await loginGoogle() }
    catch (e) { toast('Login error: ' + e.message); setLoading(false) }
  }

  return (
    <div className={s.page}>

      {/* Nav */}
      <nav className={s.nav}>
        <div className={s.logo} onClick={() => nav('/')}>
          <span className={s.badge}>💼</span> WorkBills
        </div>
        <Link to="/register" className={s.navLink}>Register your company →</Link>
      </nav>

      {/* Body */}
      <div className={s.body}>

        {/* Side info — desktop only */}
        <div className={s.sideInfo}>
          <div className={s.sideTitle}>
            Your business.<br />
            <span>Your own URL.</span><br />
            Zero friction.
          </div>
          <div className={s.sideFeats}>
            {SIDE_FEATS.map(f => (
              <div key={f.text} className={s.sideFeat}>
                <span className={s.sideFeatIcon}>{f.icon}</span>
                <span className={s.sideFeatText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className={s.card}>
          <div className={s.lockIcon}>🔐</div>
          <h2>Sign in to WorkBills</h2>
          <p>Use your Google account — no password needed</p>

          {loading ? (
            <div className={s.spinner}>
              <div className={s.dot} />
              <span>Redirecting to Google…</span>
            </div>
          ) : (
            <button className={s.googleBtn} onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          )}

          <div className={s.divider}><span>or</span></div>

          <button className={s.googleBtn} style={{ marginBottom:0, borderColor:'#d1fae5', color:'#2b4f3e' }} onClick={loadDemo}>
            <span style={{ fontSize:18 }}>🎮</span>
            Try Demo — no sign-up
          </button>

          <p className={s.register} style={{ marginTop:24 }}>
            No workspace yet? <Link to="/register">Register your company →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
