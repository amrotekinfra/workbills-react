import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, SUPER_ADMIN } from '../lib/supabase'
import { useStore, usePersistedStore } from '../store'

export function useAuth() {
  const navigate = useNavigate()
  const { setUser, setRole, setIsDemo, setEntries, setCustomCats } = useStore()
  const { setActiveCompany, clearActiveCompany } = usePersistedStore()

  // ── Find company for this user ─────────────────────────────
  const findCompany = useCallback(async (user) => {
    try {
      // 1. Look up users table — company_id is a UUID FK
      const { data: rows, error: ue } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('email', user.email.toLowerCase())

      console.log('[findCompany] users rows:', rows, ue)

      if (rows?.length) {
        const { company_id, role } = rows[0]
        setRole(role || 'owner')

        // Fetch company by UUID
        const { data: co, error: ce } = await supabase
          .from('companies').select('*').eq('id', company_id).maybeSingle()

        console.log('[findCompany] company by UUID:', co, ce)

        if (co) return normalizeCompany(co)
      }

      // 2. Fallback: find by slug (in case user registered from old code)
      const { data: coBySlug } = await supabase
        .from('companies').select('*').eq('slug', user.email.toLowerCase()).maybeSingle()
      // (That won't match, but try owner_email if column exists later)

      // 3. Fallback: localStorage
      const local = JSON.parse(localStorage.getItem('wb_companies') || '[]')
      const match = local.find(c =>
        c.ownerEmail?.toLowerCase() === user.email.toLowerCase()
      )
      if (match) {
        console.log('[findCompany] found in localStorage:', match)
        const cid = match.id
        if (cid) {
          const { data: co } = await supabase
            .from('companies').select('*').eq('id', cid).maybeSingle()
          if (co) { setRole('owner'); return normalizeCompany(co) }
        }
        setRole('owner')
        return match
      }

      return null
    } catch (e) {
      console.error('[findCompany] error:', e)
      return null
    }
  }, [setRole])

  const normalizeCompany = (co) => {
    let partners = []
    try {
      partners = typeof co.partners === 'string'
        ? JSON.parse(co.partners || '[]')
        : (co.partners || [])
    } catch { partners = [] }
    return { ...co, partners }
  }

  // ── Show app after login ───────────────────────────────────
  const showApp = useCallback(async (user) => {
    setUser(user)
    setIsDemo(false)

    if (user.email.trim().toLowerCase() === SUPER_ADMIN.toLowerCase()) {
      navigate('/admin', { replace: true })
      return
    }

    const co = await findCompany(user)
    console.log('[showApp] company found:', co)
    if (!co) { navigate('/register', { replace: true }); return }

    setActiveCompany(co)
    navigate('/app', { replace: true })
  }, [setUser, setIsDemo, findCompany, setActiveCompany, navigate])

  // ── Init on mount ──────────────────────────────────────────
  const initAuth = useCallback(async () => {
    // Do NOT strip hash here — Supabase needs it to establish session
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { await showApp(session.user); return }
    } catch (e) {
      console.error('[initAuth] error:', e)
    }
  }, [showApp])

  // ── Google OAuth ───────────────────────────────────────────
  const loginGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' }
      }
    })
    if (error) throw error
  }, [])

  // ── Logout ─────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setUser(null); setRole('owner')
    setEntries([]); setCustomCats([])
    clearActiveCompany()
    navigate('/', { replace: true })
  }, [setUser, setRole, setEntries, setCustomCats, clearActiveCompany, navigate])

  // ── Demo mode ──────────────────────────────────────────────
  const loadDemo = useCallback(() => {
    const demoCompany = {
      id: 'demo', slug: 'demo', name: 'JP Construction', emoji: '🏗️',
      currency: 'INR', color: '#3a6652',
      partners: [
        { name: 'Subba Rao', email: '', role: 'owner'   },
        { name: 'Ramesh',    email: '', role: 'partner' },
      ]
    }
    const today = new Date()
    const d = (n) => {
      const dt = new Date(today); dt.setDate(today.getDate() - n)
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
    }
    const demoEntries = [
      { id:'d1',  date:d(0),  person:'Guravaiah',        description:'53mm pipe cement 50 bags',    category:'Cement & Sand',       amount:28400, partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d2',  date:d(0),  person:'Pullaiah',          description:'Diesel for JCB excavator',   category:'Fuel & Transport',    amount:4800,  partner:'R', payMode:'UPI',    status:'approved' },
      { id:'d3',  date:d(1),  person:'Sai Mestri',        description:'Drain wall labour 4 days',   category:'Labour',              amount:12000, partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d4',  date:d(1),  person:'Raju Lorry',        description:'Sand 3 loads delivery',      category:'Cement & Sand',       amount:9600,  partner:'R', payMode:'UPI',    status:'approved' },
      { id:'d5',  date:d(2),  person:'Electrician Rao',   description:'Wiring first floor',         category:'Electrical',          amount:18500, partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d6',  date:d(2),  person:'Mahesh Kumar',      description:'Advance for brickwork',      category:'Advance / Hand Loan', amount:10000, partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d7',  date:d(3),  person:'Steel Mart',        description:'TMT bars 10mm 2 bundles',    category:'Steel & Iron',        amount:31200, partner:'S', payMode:'Cheque', status:'approved' },
      { id:'d8',  date:d(3),  person:'Venkatesh Pump',    description:'Water pump rental 1 week',   category:'Equipment Hire',      amount:3500,  partner:'R', payMode:'UPI',    status:'approved' },
      { id:'d9',  date:d(5),  person:'Ramana Plumber',    description:'Drain pipeline laying',      category:'Plumbing',            amount:8200,  partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d10', date:d(5),  person:'Pullaiah',          description:'Diesel for generator',       category:'Fuel & Transport',    amount:2400,  partner:'R', payMode:'UPI',    status:'approved' },
      { id:'d11', date:d(7),  person:'Nagesh Tiles',      description:'Ceramic tiles 200 sqft',     category:'Tiles & Flooring',    amount:22000, partner:'S', payMode:'UPI',    status:'approved' },
      { id:'d12', date:d(7),  person:'Sai Mestri',        description:'Wall plastering labour',     category:'Labour',              amount:9000,  partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d13', date:d(8),  person:'Krishna Hardware',  description:'Nuts bolts angles misc',     category:'Hardware & Tools',    amount:4600,  partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d14', date:d(9),  person:'Suresh Driver',     description:'Material transport 3 trips', category:'Fuel & Transport',    amount:3600,  partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d15', date:d(10), person:'RK Paints',         description:'Primer + exterior paint',    category:'Painting',            amount:16800, partner:'S', payMode:'Cheque', status:'approved' },
      { id:'d16', date:d(11), person:'Basha Mestri',      description:'Roof slab shuttering',       category:'Labour',              amount:14000, partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d17', date:d(12), person:'Cement Depot',      description:'53 grade cement 100 bags',   category:'Cement & Sand',       amount:42000, partner:'S', payMode:'UPI',    status:'approved' },
      { id:'d18', date:d(13), person:'Ramana Plumber',    description:'Bathroom fittings',          category:'Plumbing',            amount:11200, partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d19', date:d(14), person:'Nageswara Rao',     description:'Security deposit advance',   category:'Advance / Hand Loan', amount:15000, partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d20', date:d(15), person:'Kiran Electrician', description:'Light points 12 nos',        category:'Electrical',          amount:7200,  partner:'R', payMode:'UPI',    status:'approved' },
      { id:'d21', date:d(16), person:'Reddy Tiles',       description:'Vitrified floor tiles',      category:'Tiles & Flooring',    amount:34000, partner:'S', payMode:'Cheque', status:'approved' },
      { id:'d22', date:d(17), person:'Sai Mestri',        description:'Column shuttering labour',   category:'Labour',              amount:11000, partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d23', date:d(18), person:'Pullaiah',          description:'Diesel 40 litres',           category:'Fuel & Transport',    amount:3920,  partner:'S', payMode:'UPI',    status:'approved' },
      { id:'d24', date:d(20), person:'Anand Scaffolding', description:'Scaffolding rent 2 weeks',   category:'Equipment Hire',      amount:8000,  partner:'R', payMode:'Cash',   status:'approved' },
      { id:'d25', date:d(22), person:'Ravi Painter',      description:'Interior emulsion 3 rooms',  category:'Painting',            amount:12600, partner:'S', payMode:'Cash',   status:'approved' },
      { id:'d26', date:d(3),  person:'Suresh Mestri',     description:'Overtime — pending approval',category:'Labour',              amount:4500,  partner:'R', payMode:'Cash',   status:'pending'  },
    ]
    setIsDemo(true)
    setUser({ id:'demo', email:'demo@workbills.app', user_metadata:{ full_name:'Demo User', avatar_url:'' } })
    setRole('owner')
    setActiveCompany(demoCompany)
    setEntries(demoEntries)
    navigate('/app', { replace: true })
  }, [setIsDemo, setUser, setRole, setActiveCompany, setEntries, navigate])

  // ── Auth state listener ────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Clean hash AFTER Supabase has processed the token
        if (window.location.hash?.includes('access_token')) {
          history.replaceState(null, '', window.location.pathname)
        }
        await showApp(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null); clearActiveCompany()
        navigate('/', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [showApp, setUser, clearActiveCompany, navigate])

  return { initAuth, loginGoogle, logout, loadDemo }
}
