import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import s from './Landing.module.css'

const STATS = [
  { val: '2,400+', lbl: 'COMPANIES' },
  { val: '₹4.2Cr', lbl: 'TRACKED'   },
  { val: '99.9%',  lbl: 'UPTIME'    },
]
const HOW = [
  { n:'01', t:'Register your company', d:'Pick your unique URL — e.g. workbills.app/amrotek. Takes 60 seconds, free forever.' },
  { n:'02', t:'Log on-site expenses',  d:"Add entries from your phone even without internet. Auto-queues and syncs when you're back online." },
  { n:'03', t:'See who owes who',      d:'Partner split and settlement calculator always up to date. Approve employee entries in one tap.' },
]
const FEATS = [
  { i:'📱', t:'Mobile-first PWA',    d:'Add to home screen. Works like a native app, loads instantly.' },
  { i:'📶', t:'Works offline',        d:'Log expenses on-site with no signal. Auto-syncs when online.' },
  { i:'👥', t:'Multi-partner split',  d:'Track who spent what. Settlement calculator built in.' },
  { i:'✅', t:'Approval workflow',    d:'Employees submit, owners approve. Full audit trail.' },
  { i:'📊', t:'Instant reports',      d:'Monthly CSV, daily close, category pie charts, AI summary.' },
  { i:'🔒', t:'Row-level security',   d:'Supabase RLS — your data is completely private per company.' },
]

export default function LandingPage() {
  const nav = useNavigate()
  const { loadDemo } = useAuth()

  return (
    <div className={s.page}>

      {/* ── Nav ── */}
      <nav className={s.nav}>
        <div className={s.logo}>
          <div className={s.logoIcon}>💼</div>
          <span>WorkBills</span>
        </div>
        <div className={s.navRight}>
          <button className={s.navGhost}  onClick={() => nav('/login')}>Sign In</button>
          <button className={s.navDemo}   onClick={loadDemo}>
            <span className={s.demoDot} />Demo
          </button>
          <button className={s.navSolid}  onClick={() => nav('/register')}>Register Company</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.heroPill}>
            <span className={s.pillDot} />
            Multi-company · Google SSO · PWA
          </div>

          <h1 className={s.h1}>
            Your business.<br />
            <span className={s.amber}>Your own URL.</span><br />
            Zero friction.
          </h1>

          <p className={s.heroDesc}>
            WorkBills gives every company its own private workspace at a unique URL.
            Track expenses, manage categories, log receipts — all synced in real time.
          </p>

          <div className={s.heroCtas}>
            <button className={s.ctaSolid} onClick={() => nav('/register')}>
              Register Your Company →
            </button>
            <button className={s.ctaOutline} onClick={() => nav('/login')}>
              Sign In with Google
            </button>
            <button className={s.ctaDemo} onClick={loadDemo}>
              <span className={s.demoDot} /> Try Demo — no sign-up
            </button>
          </div>

          <div className={s.statsRow}>
            {STATS.map(st => (
              <div key={st.lbl} className={s.stat}>
                <div className={s.statVal}>{st.val}</div>
                <div className={s.statLbl}>{st.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mockup card ── */}
        <div className={s.heroRight}>
          <div className={s.mockCard}>
            <div className={s.mockTop}>
              <span className={s.mockLabel}>MONTHLY SPEND</span>
              <span className={s.mockBadge}>▲ 12%</span>
            </div>
            <div className={s.mockAmount}>₹ 18,42,000</div>
            <div className={s.mockBars}>
              {[38,52,45,100,62,100].map((h,i) => (
                <div key={i} className={s.mockBar + ([3,5].includes(i) ? ' '+s.mockBarHi : '')}
                  style={{ height: Math.round(h * 0.65) + 'px' }} />
              ))}
            </div>
            <div className={s.mockCats}>
              {[
                { e:'🧱', n:'Cement', a:'₹2,84,000' },
                { e:'👷', n:'Labour', a:'₹6,20,000' },
                { e:'⛽', n:'Fuel',   a:'₹1,38,000' },
              ].map(c => (
                <div key={c.n} className={s.mockCatRow}>
                  <span>{c.e}</span>
                  <span className={s.mockCatN}>{c.n}</span>
                  <span className={s.mockCatA}>{c.a}</span>
                </div>
              ))}
            </div>
            <div className={s.mockUrl}>
              <span className={s.greenDot} />
              workbills.app/<strong>jp-project</strong>/dashboard
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <div className={s.sectionLabel}>HOW IT WORKS</div>
      <section className={s.how}>
        {HOW.map(h => (
          <div key={h.n} className={s.howCard}>
            <div className={s.howNum}>{h.n}</div>
            <div className={s.howTitle}>{h.t}</div>
            <div className={s.howDesc}>{h.d}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section className={s.feats}>
        <h2 className={s.secTitle}>Everything your site needs</h2>
        <div className={s.featGrid}>
          {FEATS.map(f => (
            <div key={f.t} className={s.feat}>
              <div className={s.featI}>{f.i}</div>
              <div className={s.featT}>{f.t}</div>
              <div className={s.featD}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={s.ctaBanner}>
        <h2>Free forever. Your own URL. 60 seconds to set up.</h2>
        <div className={s.ctaBannerBtns}>
          <button className={s.ctaSolid} onClick={() => nav('/register')}>Register Your Company →</button>
          <button className={s.ctaDemo} onClick={loadDemo}>
            <span className={s.demoDot} /> Try Demo first
          </button>
        </div>
      </section>

      <footer className={s.footer}>
        WorkBills · Built for Indian construction · Powered by Supabase
      </footer>
    </div>
  )
}
