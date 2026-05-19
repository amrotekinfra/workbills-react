import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, decodeEntry, encodeDesc, fmtDate } from '../lib/supabase'
import { useStore, usePersistedStore } from '../store'

let toastFn = null
export const registerToast = fn => { toastFn = fn }
const toast = msg => toastFn?.(msg)

export function useEntries() {
  const qc = useQueryClient()
  const { user, role, setEntries, setCustomCats, addEntry, patchEntry, dropEntry, setSyncStatus } = useStore()
  const { activeCompany, addToOfflineQueue } = usePersistedStore()
  const companyId = activeCompany?.id

  // ── Load entries + categories ──────────────────────────────
  const query = useQuery({
    queryKey: ['entries', companyId],
    enabled:  !!companyId && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      setSyncStatus('sync')

      const [catsRes, expRes] = await Promise.all([
        supabase.from('categories').select('*').eq('company_id', companyId).order('created_at'),
        role === 'employee'
          ? supabase.from('expenses').select('*').eq('company_id', companyId).eq('created_by', user.id).order('created_at', { ascending: false }).limit(500)
          : supabase.from('expenses').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500)
      ])

      if (catsRes.error) throw catsRes.error
      if (expRes.error)  throw expRes.error

      const cats = (catsRes.data || []).map(r => ({ n: r.name, e: r.emoji, c: r.color }))
      setCustomCats(cats)

      const entries = (expRes.data || []).map(decodeEntry)
      setEntries(entries)
      setSyncStatus('live')
      return entries
    },
    onError: () => setSyncStatus('err')
  })

  // ── Save (insert or update) ────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async ({ date, person, description, amount, category, notes, payMode,
                         photoFile, existingPhotoUrl, partnerCode, editingId }) => {

      let finalPhotoUrl = existingPhotoUrl
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const fn  = `${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('receipts').upload(fn, photoFile)
        if (upErr) throw new Error('Photo upload failed: ' + upErr.message)
        finalPhotoUrl = supabase.storage.from('receipts').getPublicUrl(fn).data.publicUrl
      }

      const finalDesc = encodeDesc(description, { notes, payMode, photoUrl: finalPhotoUrl })
      const isEmp = role === 'employee'
      const dbRow = {
        company_id: companyId,
        date:       fmtDate(date),  // date is YYYY-MM-DD from <input type='date'>
        partner:    isEmp ? null : (partnerCode || null),
        person,
        description: finalDesc,
        amount,
        category,
        created_by:       user?.id || null,
        status:           isEmp ? 'pending' : 'approved',
        approval_required: isEmp,
      }

      if (editingId) {
        const { error } = await supabase.from('expenses').update(dbRow).eq('id', editingId)
        if (error) throw error
        patchEntry(editingId, { date: dbRow.date, person, description, amount, category, notes, payMode, photoUrl: finalPhotoUrl, partner: dbRow.partner, status: dbRow.status })
        toast('✓ Entry updated')
        return 'updated'
      } else {
        const { data, error } = await supabase.from('expenses').insert([dbRow]).select()
        if (error) throw error
        addEntry({ ...data[0], description, notes, payMode, photoUrl: finalPhotoUrl, status: dbRow.status })
        toast(isEmp ? '📤 Submitted for approval' : '✓ Saved')
        return 'inserted'
      }
    },
    onError: err => { setSyncStatus('err'); toast('Save failed: ' + err.message) }
  })

  // ── Delete ─────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async id => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      dropEntry(id)
      toast('Deleted')
    },
    onError: err => toast('Delete failed: ' + err.message)
  })

  // ── Bulk delete ────────────────────────────────────────────
  const bulkDeleteMut = useMutation({
    mutationFn: async ids => {
      await Promise.all(ids.map(id => supabase.from('expenses').delete().eq('id', id)))
      ids.forEach(id => dropEntry(id))
      toast(`🗑 ${ids.length} entries deleted`)
    }
  })

  // ── Realtime subscription ──────────────────────────────────
  const startRealtime = () => {
    const ch = supabase
      .channel('exp-' + companyId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `company_id=eq.${companyId}` },
        payload => {
          if (payload.eventType === 'INSERT')  addEntry(decodeEntry(payload.new))
          if (payload.eventType === 'DELETE')  dropEntry(payload.old.id)
          if (payload.eventType === 'UPDATE')  patchEntry(payload.new.id, decodeEntry(payload.new))
        })
      .subscribe()
    return ch
  }

  return {
    isLoading:   query.isLoading,
    isFetching:  query.isFetching,
    refetch:     query.refetch,
    save:        saveMut.mutateAsync,
    isSaving:    saveMut.isPending,
    remove:      deleteMut.mutateAsync,
    bulkDelete:  bulkDeleteMut.mutateAsync,
    startRealtime,
  }
}
