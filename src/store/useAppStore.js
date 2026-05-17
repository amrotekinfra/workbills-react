/**
 * Bridge file — maps the names used in the newer panels
 * back to the canonical store (./index.js) and lib/supabase.
 */
export { usePersistedStore } from './index'
export { ROLE, partnerConfig as getPartnerConfig } from './index'
export { pCode as getPCode, pName as getPName, pColor as getPColor, pBg as getPBg } from '../lib/supabase'

import { useStore } from './index'

/**
 * Thin wrapper that aliases every field the new panels expect
 * to the canonical store field names.
 */
export function useAppStore() {
  const s = useStore()
  return {
    // Auth
    currentUser:        s.user,
    currentUserRole:    s.role,
    isDemoMode:         s.isDemo,

    // Entries
    entries:            s.entries,
    customCats:         s.customCats,

    // UI
    activePanel:        s.panel,
    setActivePanel:     s.setPanel,
    syncStatus:         s.syncStatus,
    setSyncStatus:      s.setSyncStatus,
    isOnline:           s.isOnline,
    setIsOnline:        s.setIsOnline,

    // Editing
    editingEntryId:     s.editingId,
    setEditingEntryId:  s.setEditingId,

    // Partner / pay mode selection
    selectedPartnerCode: s.selPartner,
    setSelectedPartnerCode: s.setSelPartner,
    selectedPayMode:    s.selPayMode,
    setSelectedPayMode: s.setSelPayMode,

    // Filters
    filterPartner:      s.filterPartner,
    setFilterPartner:   s.setFilterPartner,
    activeMonthFilter:  s.filterMonth,
    setActiveMonthFilter: s.setFilterMonth,
    searchQuery:        s.searchQ,
    setSearchQuery:     s.setSearchQ,
    activeProjectId:    null,   // Phase 2

    // Pass through the raw setters too
    setUser:     s.setUser,
    setRole:     s.setRole,
    setEntries:  s.setEntries,
  }
}
