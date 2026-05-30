import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, usePersistedStore, ROLE } from '../store'
import { useEntries } from '../hooks/useEntries'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import DemoWelcome from '../components/DemoWelcome'
import AddEntry   from '../panels/AddEntry'
import Entries    from '../panels/Entries'
import Summary    from '../panels/Summary'
import DailyDash  from '../panels/DailyDash'
import Approvals  from '../panels/Approvals'
import Budget     from '../panels/Budget'
import Categories from '../panels/Categories'
import Projects   from '../panels/Projects'
import Team       from '../panels/Team'
import Workers    from '../panels/Workers'
import Templates  from '../panels/Templates'
import AI         from '../panels/AI'
import WA         from '../panels/WA'
import SharePanel from '../panels/Share'
import StubPanel  from '../panels/StubPanel'
import s from './AppShell.module.css'
import Invoice    from '../panels/Invoice'
import Inventory from '../panels/Inventory' 
import AddIncome  from '../panels/AddIncome'
import IncomeLedger from '../panels/IncomeLedger'
import PnL        from '../panels/PnL'

const NAV_ITEMS = [
  { id:'add',       icon:'＋', label:'Add Entry',    primary: true },
  { id:'entries',   icon:'📋', label:'Entries',       group:'core' },
  { id:'summary',   icon:'📊', label:'Summary',        group:'core' },
  { id:'dash',      icon:'📅', label:'Daily',          group:'core' },
  { id:'approvals', icon:'✅', label:'Approvals',      group:'manage' },
  { id:'budget',    icon:'🎯', label:'Budget',         group:'manage' },
  { id:'templates', icon:'🔁', label:'Templates',      group:'manage' },
  { id:'projects',  icon:'📁', label:'Projects',       group:'manage' },
  { id:'subs',      icon:'👷', label:'Workers',        group:'manage' },
  { id:'team',      icon:'👥', label:'Team',           group:'manage' },
  { id:'cats',      icon:'🏷️', label:'Categories',    group:'manage' },
  { id:'ai',        icon:'🤖', label:'AI Assistant',   group:'tools' },
  { id:'wa',        icon:'💬', label:'WhatsApp',       group:'tools' },
  { id:'share',     icon:'🔗', label:'Share Report',   group:'tools' },
  { id:'invoice', icon:'📄', label:'Invoice',    group:'tools' },
  { id:'inventory', icon:'📦', label:'Inventory',  group:'manage' },
  { id:'addincome',  icon:'💰', label:'Add Income',     group:'income' },
  { id:'income',     icon:'📒', label:'Income Ledger',  group:'income' },
  { id:'pnl',        icon:'📊', label:'P&L',            group:'income' },
]

const BOTTOM_NAV = [
  { id:'add',     icon:'＋', label:'Add'     },
  { id:'entries', icon:'📋', label:'Entries' },
  { id:'summary', icon:'📊', label:'Summary' },
  { id:'dash',    icon:'📅', label:'Daily'   },
]

export default function AppShell() {
  const nav   = useNavigate()
  const toast = useToast()
  const { logout } = useAuth()
  const { user, role, isDemo, panel, setPanel, entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const { refetch, startRealtime } = useEntries()
  const [showWelcome, setShowWelcome] = useState(false)
  const [showCod,     setShowCod]     = useState(false)
  const [moreOpen,    setMoreOpen]    = useState(false)
  const chRef = useRef(null)
  const mainRef = useRef(null)

  useEffect(() => { if (!user && !isDemo) nav('/', { replace: true }) }, [user, isDemo])

  useEffect(() => {
    if (isDemo) {
      const seen = sessionStorage.getItem('wb_demo_welcomed')
      if (!seen) { setShowWelcome(true); sessionStorage.setItem('wb_demo_welcomed','1') }
    }
  }, [isDemo])

  // Scroll main to top on every panel switch
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [panel])

  useEffect(() => {
    if (!activeCompany?.id || isDemo) return
    refetch()
    if (chRef.current) supabase.removeChannel(chRef.current)
    chRef.current = startRealtime()
    return () => { if (chRef.current) supabase.removeChannel(chRef.current) }
  }, [activeCompany?.id])

  const go = id => {
    if (id === 'summary' && !ROLE.canSeeSummary(role)) { toast('Not available for your role'); return }
    if (id === 'dash'    && !ROLE.canSeeDash(role))    { toast('Not available for your role'); return }
    setPanel(id); setMoreOpen(false)
  }

  const renderPanel = () => {
    switch (panel) {
      case 'add':       return <AddEntry />
      case 'entries':   return <Entries />
      case 'summary':   return <Summary />
      case 'dash':      return <DailyDash />
      case 'approvals': return <Approvals />
      case 'budget':    return <Budget />
      case 'cats':      return <Categories />
      case 'projects':  return <Projects />
      case 'team':      return <Team />
      case 'subs':      return <Workers />
      case 'templates': return <Templates />
      case 'ai':        return <AI />
      case 'wa':        return <WA />
      case 'share':     return <SharePanel />
      case 'invoice': return <Invoice />   
      case 'inventory': return <Inventory /> 
      case 'addincome': return <AddIncome />
      case 'income':    return <IncomeLedger />
      case 'pnl':       return <PnL />
      default:          return <StubPanel id={panel} />
    }
  }

  if (!activeCompany && !isDemo) return null

  const partnerLine = (activeCompany?.partners || []).map(p => p.name || p).join(' & ')
    + ' · ' + (activeCompany?.currency || 'INR')

  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'

  const todayStr = (() => {
    const d = new Date()
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  })()
  const todayTotal = entries.filter(e => e.date === todayStr && e.status !== 'rejected')
                            .reduce((s, e) => s + (e.amount||0), 0)

  const groups = [
    { label:'', ids: ['add'] },
    { label:'Track', ids: ['entries','summary','dash'] },
    { label:'Manage', ids: ['approvals','budget','templates','projects','subs','vendors','inventory','team','cats'] },    { label:'Tools', ids: ['ai','wa','share'] },
    { label:'Tools', ids: ['ai','wa','share','invoice'] },
    { label:'Income', ids: ['addincome','income','pnl']        },
  ]

  return (
    <div className={s.shell}>
      {showWelcome && <DemoWelcome onClose={() => setShowWelcome(false)} />}

      {/* ── Header ── */}
      <header className={s.hdr}>
        <div className={s.hdrLeft}>
          <div className={s.coIcon}>{activeCompany?.emoji || '🏢'}</div>
          <div>
            <div className={s.coName}>{activeCompany?.name || 'WorkBills'}</div>
            <div className={s.coSub}>{partnerLine}</div>
            {isDemo && <span className={s.demoBadge}>DEMO</span>}
          </div>
        </div>
        <div className={s.hdrActions}>
          {isDemo && (
            <button className={s.demoBtn} onClick={() => setShowWelcome(true)}>
              <span className={s.liveDot}/>Demo
            </button>
          )}
          {!isDemo && <button className={s.switchBtn} onClick={() => nav('/login')}>⇄ Switch</button>}
          <button className={s.helpBtn} onClick={() => setMoreOpen(v=>!v)}>?</button>
          <button className={s.signOutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* ── Body (sidebar + main on desktop) ── */}
      <div className={s.body}>

        {/* Desktop sidebar */}
        <aside className={s.sidebar}>
          <nav className={s.sideNav}>
            {groups.map(g => (
              <div key={g.label} className={s.navGroup}>
                {g.label && <div className={s.navGroupLbl}>{g.label}</div>}
                {g.ids.map(id => {
                  const item = NAV_ITEMS.find(n => n.id === id)
                  if (!item) return null
                  if (id === 'summary' && !ROLE.canSeeSummary(role)) return null
                  if (id === 'dash'    && !ROLE.canSeeDash(role))    return null
                  return (
                    <button
                      key={id}
                      className={s.sideItem + (panel===id ? ' '+s.sideItemActive : '') + (item.primary ? ' '+s.sideItemPrimary : '')}
                      onClick={() => go(id)}
                    >
                      <span className={s.sideIcon}>{item.icon}</span>
                      <span className={s.sideLbl}>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <button className={s.sideSignOut} onClick={logout}>Sign out</button>
        </aside>

        {/* Main content */}
        <main ref={mainRef} className={s.main}>
          {role && role !== 'owner' && (
            <div className={s.roleBanner}>
              <span className={s.rolePill}>{role.toUpperCase()}</span>
              {role==='employee' ? 'View-only — entries need approval.' : 'Partner access — full dashboard.'}
            </div>
          )}
          {renderPanel()}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className={s.bnav}>
        {BOTTOM_NAV.map(item => {
          if (item.id==='summary' && !ROLE.canSeeSummary(role)) return null
          if (item.id==='dash'    && !ROLE.canSeeDash(role))    return null
          return (
            <button key={item.id} className={s.nBtn+(panel===item.id?' '+s.nActive:'')} onClick={()=>go(item.id)}>
              {item.id==='add' ? <span className={s.addCircle}>＋</span> : <span className={s.nIcon}>{item.icon}</span>}
              <span className={s.nLbl}>{item.label}</span>
            </button>
          )
        })}
        <button className={s.nBtn+(moreOpen?' '+s.nActive:'')} onClick={()=>setMoreOpen(v=>!v)}>
          <span className={s.nIcon}>⋯</span>
          <span className={s.nLbl}>More</span>
        </button>
      </nav>

      {/* Mobile more-menu */}
      {moreOpen && (
        <>
          <div className={s.overlay} onClick={()=>setMoreOpen(false)} />
          <div className={s.moreMenu}>
            <div className={s.moreGrid}>
              {NAV_ITEMS.filter(n=>!['add','entries','summary','dash'].includes(n.id)).map(item=>(
                <button key={item.id} className={s.moreItem} onClick={()=>go(item.id)}>
                  <span className={s.moreIcon}>{item.icon}</span>
                  <span className={s.moreLbl}>{item.label}</span>
                </button>
              ))}
            </div>
            <div className={s.moreDivider}/>
            <button className={s.signOutMenu} onClick={logout}>Sign out</button>
          </div>
        </>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div className={s.demoBanner}>
          <div className={s.demoBannerLeft}>
            <div className={s.demoBannerTitle}>Demo Mode</div>
            <div className={s.demoBannerSub}>Exploring sample data from {activeCompany?.name}</div>
          </div>
          <button className={s.getStartedBtn} onClick={()=>nav('/register')}>Get started →</button>
          <button className={s.demoBannerX} onClick={()=>{}}>✕</button>
        </div>
      )}

      {/* Close of Day FAB */}
      {todayTotal > 0 && !isDemo && panel !== 'add' && (
        <button className={s.codFab} onClick={()=>setShowCod(true)}>📋 Close of Day</button>
      )}

      {showCod && (
        <div className={s.codOverlay} onClick={()=>setShowCod(false)}>
          <div className={s.codSheet} onClick={e=>e.stopPropagation()}>
            <div className={s.codDrag}/>
            <div className={s.codIcon}>📋</div>
            <h3 className={s.codTitle}>Today's Summary</h3>
            <div className={s.codTotal}>
              <span className={s.codLbl}>Total today</span>
              <span className={s.codVal}>{sym}{todayTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className={s.codEntries}>
              {entries.filter(e=>e.date===todayStr&&e.status!=='rejected').map(e=>(
                <div key={e.id} className={s.codRow}>
                  <span className={s.codPerson}>{e.person}</span>
                  <span className={s.codCat}>{e.category}</span>
                  <span className={s.codAmt}>{sym}{(e.amount||0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <button className={s.codClose} onClick={()=>setShowCod(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
