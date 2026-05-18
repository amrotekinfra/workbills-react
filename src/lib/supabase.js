import { createClient } from '@supabase/supabase-js'

export const SUPA_URL      = 'https://htblfoprejqjkbuumtxn.supabase.co'
export const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0Ymxmb3ByZWpxamtidXVtdHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NDMwODcsImV4cCI6MjA5MjMxOTA4N30.JsWqnYlU84KJKBUXAelzRIwi9RW8Q_pAEfXjwsDyu-0'
export const SUPER_ADMIN   = 'amrotekinfra@gmail.com'

export const supabase = createClient(SUPA_URL, SUPA_ANON_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    storageKey:         'wb-auth',
    flowType:           'implicit',
  }
})

// ── Categories ─────────────────────────────────────────────
export const SYS_CATS = [
  { n: 'Advance / Hand Loan',    e: '💸', c: '#10b981' },
  { n: 'Aggregates & Materials', e: '🪨', c: '#0369a1' },
  { n: 'Cement',                 e: '🧱', c: '#8a4a00' },
  { n: 'Steel & Iron',           e: '🔩', c: '#374151' },
  { n: 'Labour & Wages',         e: '👷', c: '#065f46' },
  { n: 'Equipment / Machinery',  e: '🚜', c: '#7c2d12' },
  { n: 'Food & Meals',           e: '🍽️', c: '#86198f' },
  { n: 'Water Supply',           e: '💧', c: '#0c4a6e' },
  { n: 'Fuel',                   e: '⛽', c: '#9a3412' },
  { n: 'Electrical & Plumbing',  e: '⚡', c: '#713f12' },
  { n: 'Construction Supplies',  e: '🔧', c: '#1e3a5f' },
  { n: 'Civil / Admin',          e: '🏛️', c: '#312e81' },
  { n: 'Other',                  e: '📦', c: '#374151' },
]

// ── Partner helpers ─────────────────────────────────────────
export const P_CODES  = ['S', 'R', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']
export const P_COLORS = ['#3a6652', '#ea580c', '#7c3aed', '#0891b2', '#dc2626', '#16a34a', '#e8920a', '#9333ea']
export const P_BGS    = ['#edf5f1', '#fff7ed', '#ede9fe', '#cffafe', '#fee2e2', '#dcfce7', '#ffedd5', '#f3e8ff']

export const pCode  = i          => P_CODES[i] || `P${i + 1}`
export const pColor = code       => P_COLORS[P_CODES.indexOf(code)] || '#888'
export const pBg    = code       => P_BGS[P_CODES.indexOf(code)]    || '#f5f5f5'
export const pName  = (code, co) => {
  if (!code) return ''
  const idx = P_CODES.indexOf(code)
  if (idx === -1) return code
  const p = co?.partners?.[idx]
  return typeof p === 'object' ? (p.name || p.email?.split('@')[0] || code) : (p || code)
}

// ── Utils ────────────────────────────────────────────────────
export const fmt = (n, sym = '₹') =>
  sym + Math.round(n || 0).toLocaleString('en-IN')

export const fmtDate = d => {
  const dt = d instanceof Date ? d : new Date(d + 'T00:00:00')
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export const parseDate = s => {
  if (!s) return new Date(0)
  const p = s.split('/')
  return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : new Date(s)
}

export const todayISO = () => new Date().toISOString().split('T')[0]

export const getCatInfo = (name, customCats = []) => {
  const c = [...customCats, ...SYS_CATS].find(c => c.n === name)
  return c ? { e: c.e, c: c.c } : { e: '📦', c: '#374151' }
}

/** Decode pipe-encoded metadata from description */
export const decodeEntry = row => {
  let desc = row.description || '', notes = null, payMode = 'UPI', photoUrl = null
  if (desc.includes(' | 📎 ')) { const p = desc.split(' | 📎 '); photoUrl = p[1]; desc = p[0] }
  if (desc.includes(' | 💳 ')) { const p = desc.split(' | 💳 '); payMode  = p[1]; desc = p[0] }
  if (desc.includes(' | 📝 ')) { const p = desc.split(' | 📝 '); notes    = p[1]; desc = p[0] }

  // Normalise date to DD/MM/YYYY regardless of how it was stored
  // Handles: "2026-05-18" (ISO), "2026-05-18T..." (ISO+time), "18/05/2026" (already correct)
  let date = row.date || ''
  if (date && !date.includes('/')) {
    // ISO format YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    const iso = date.split('T')[0]          // "2026-05-18"
    const [y, m, d] = iso.split('-')
    if (y && m && d) date = `${d}/${m}/${y}` // "18/05/2026"
  }

  return { ...row, date, description: desc, notes, payMode, photoUrl }
}

/** Encode metadata back into description */
export const encodeDesc = (desc, { notes, payMode, photoUrl } = {}) => {
  let s = desc
  if (notes)    s += ' | 📝 ' + notes
  s += ' | 💳 ' + (payMode || 'UPI')
  if (photoUrl) s += ' | 📎 ' + photoUrl
  return s
}
