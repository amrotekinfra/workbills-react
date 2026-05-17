import { useState } from 'react'
import { useStore } from '../store'
import s from './DemoWelcome.module.css'

const FEATURES = [
  { icon:'📱', label:'Mobile-first PWA'     },
  { icon:'💬', label:'WhatsApp bot entry'   },
  { icon:'🤝', label:'Partner settlement'   },
  { icon:'📊', label:'Live dashboard'       },
]

const TOUR = [
  { icon:'📋', label:'See the Entries panel — your expense feed',    panel:'entries' },
  { icon:'📊', label:'Open the Summary — partner split & charts',    panel:'summary' },
  { icon:'➕', label:'Try adding a demo expense',                     panel:'add'     },
  { icon:'📅', label:'Check the daily dashboard',                    panel:'dash'    },
]

export default function DemoWelcome({ onClose }) {
  const { setPanel } = useStore()
  const [step, setStep]       = useState('welcome') // 'welcome' | 'tour'
  const [done, setDone]       = useState(new Set())

  const goPanel = (panel, idx) => {
    setDone(prev => new Set([...prev, idx]))
    setPanel(panel)
    if (done.size + 1 >= TOUR.length) {
      setTimeout(onClose, 300)
    }
  }

  if (step === 'welcome') return (
    <div className={s.overlay}>
      <div className={s.sheet}>
        <div className={s.drag} />
        <div className={s.icon}>👋</div>
        <h2 className={s.title}>Welcome to WorkBills</h2>
        <p className={s.sub}>Track project expenses, split costs with partners, and manage your team — all from your phone.</p>

        <div className={s.demoBadge}>
          <span className={s.demoDot} />
          <div>
            <div className={s.demoTitle}>Demo mode is active</div>
            <div className={s.demoSub}>Real data from a sample construction project. Safe to explore — nothing is saved.</div>
          </div>
        </div>

        <div className={s.featureGrid}>
          {FEATURES.map(f => (
            <div key={f.label} className={s.featCard}>
              <div className={s.featIcon}>{f.icon}</div>
              <div className={s.featLabel}>{f.label}</div>
            </div>
          ))}
        </div>

        <button className={s.primaryBtn} onClick={() => setStep('tour')}>
          Explore the demo →
        </button>
        <button className={s.ghostBtn} onClick={onClose}>
          I already have an account — Sign in
        </button>
        <p className={s.footnote}>No sign-up needed to explore. Real data requires a free account.</p>
      </div>
    </div>
  )

  // Tour step
  const doneCount = done.size
  return (
    <div className={s.overlay}>
      <div className={s.sheet}>
        <div className={s.drag} />
        <div className={s.icon}>🗺️</div>
        <h2 className={s.title}>Here's your tour</h2>
        <p className={s.sub}>Tap each step to see it in action. Takes less than 2 minutes.</p>

        <div className={s.progress}>
          <div className={s.progressBar} style={{ width: (doneCount / TOUR.length * 100) + '%' }} />
        </div>
        <div className={s.progressLbl}>{doneCount} of {TOUR.length} done</div>

        <div className={s.tourList}>
          {TOUR.map((t, i) => (
            <button
              key={i}
              className={s.tourItem + (done.has(i) ? ' ' + s.tourDone : '')}
              onClick={() => goPanel(t.panel, i)}
            >
              <span className={s.tourArrow}>{done.has(i) ? '✓' : '→'}</span>
              <span className={s.tourLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        <button className={s.primaryBtn} onClick={() => { onClose(); /* TODO: go to register */ }}>
          Looks good — let's set it up →
        </button>
        <button className={s.ghostBtn} onClick={onClose}>
          Keep exploring on my own
        </button>
        <p className={s.footnote}>Demo data is sample only — your real data stays private and secure.</p>
      </div>
    </div>
  )
}
