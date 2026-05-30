import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { P_CODES } from '../lib/supabase'

// ── Role permissions ────────────────────────────────────────
export const ROLE = {
  canSeeSummary:  r => ['owner', 'partner'].includes(r),
  canSeeDash:     r => ['owner', 'partner'].includes(r),
  canEdit:        r => ['owner', 'partner'].includes(r),
  canDelete:      r => ['owner', 'partner'].includes(r),
  canApprove:     r => ['owner', 'partner'].includes(r),
  canManageTeam:  r => r === 'owner',
}

// ── Partner config helper ────────────────────────────────────
export const partnerConfig = co => {
  if (!co) return { partners: [], count: 0, isSolo: true, isMulti: false }
  let raw = co.partners || []
  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { raw = [] } }
  const names = raw.map(p => (typeof p === 'object' ? p.name : p)).filter(Boolean)
  return { partners: names, count: names.length, isSolo: names.length <= 1, isMulti: names.length >= 2 }
}

// ── Persisted slice (survives reload) ───────────────────────
export const usePersistedStore = create(
  persist(
    set => ({
      activeCompany: null,
      offlineQueue:  [],
      setActiveCompany:    co  => set({ activeCompany: co }),
      clearActiveCompany:  ()  => set({ activeCompany: null }),
      addToOfflineQueue:   row => set(s => ({ offlineQueue: [...s.offlineQueue, row] })),
      clearOfflineQueue:   ()  => set({ offlineQueue: [] }),
    }),
    { name: 'wb-store' }
  )
)

// ── Session slice (in-memory only) ──────────────────────────
export const useStore = create((set, get) => ({

  // Auth
  user:     null,
  role:     'owner',
  isDemo:   false,
  setUser:  u => set({ user: u }),
  setRole:  r => set({ role: r }),
  setIsDemo: v => set({ isDemo: v }),

  // Entries
  entries:     [],
  customCats:  [],
  setEntries:  e  => set({ entries: e }),
  addEntry:    e  => set(s => ({ entries: [e, ...s.entries] })),
  patchEntry:  (id, patch) => set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, ...patch } : e) })),
  dropEntry:   id => set(s => ({ entries: s.entries.filter(e => e.id !== id) })),
  setCustomCats: c => set({ customCats: c }),
  
  incomes:     [],
  setIncomes:  inc  => set({ incomes: inc }),
  addIncome:   inc  => set(s => ({ incomes: [inc, ...s.incomes] })),
  patchIncome: (id, patch) => set(s => ({ incomes: s.incomes.map(i => i.id === id ? { ...i, ...patch } : i) })),
  dropIncome:  id   => set(s => ({ incomes: s.incomes.filter(i => i.id !== id) })),

  // UI
  panel:       'entries',
  syncStatus:  'live',
  isOnline:    navigator.onLine,
  editingId:   null,
  setPanel:    p  => set({ panel: p }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setIsOnline: v  => set({ isOnline: v }),
  setEditingId: id => set({ editingId: id }),

  // Add-entry form state
  selPartner:  'S',
  selPayMode:  'UPI',
  setSelPartner: p => set({ selPartner: p }),
  setSelPayMode: m => set({ selPayMode: m }),

  // Entries filters
  filterPartner: 'all',
  filterMonth:   null,
  searchQ:       '',
  setFilterPartner: p => set({ filterPartner: p }),
  setFilterMonth:   m => set({ filterMonth: m }),
  setSearchQ:       q => set({ searchQ: q }),
}))
