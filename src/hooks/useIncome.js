import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, fmtDate, normDate } from '../lib/supabase'
import { useStore, usePersistedStore } from '../store'

let toastFn = null
export const registerIncomeToast = fn => { toastFn = fn }
const toast = msg => toastFn?.(msg)

// ── Decode a raw income row from Supabase ────────────────────────────────────
export const decodeIncome = row => ({
  ...row,
  date: normDate(row.date),
  amount: Number(row.amount) || 0,
})

// ──────────────────────────────────────────────────────────────────────────────

export function useIncome() {
  const qc = useQueryClient()
  const {
    user, role,
    setIncomes, addIncome, patchIncome, dropIncome,
    setSyncStatus,
  } = useStore()
  const { activeCompany } = usePersistedStore()
  const companyId = activeCompany?.id

  // ── Load ────────────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey:  ['income', companyId],
    enabled:   !!companyId && !!user,
    staleTime: 30_000,
    queryFn:   async () => {
      setSyncStatus('sync')
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      const rows = (data || []).map(decodeIncome)
      setIncomes(rows)
      setSyncStatus('live')
      return rows
    },
    onError: () => setSyncStatus('err'),
  })

  // ── Save (insert or update) ─────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async ({
      date, client, description, amount,
      income_type, project_id, status, pay_mode,
      notes, bill_no, editingId,
    }) => {
      const dbRow = {
        company_id:  companyId,
        date:        fmtDate(date),
        client:      client?.trim()       || null,
        description: description?.trim()  || null,
        amount:      Number(amount)        || 0,
        income_type: income_type           || 'ra_bill',
        project_id:  project_id ? String(project_id) : null,
        status:      status                || 'received',
        pay_mode:    pay_mode              || 'NEFT',
        notes:       notes?.trim()         || null,
        bill_no:     bill_no?.trim()       || null,
        created_by:  user?.id              || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('income')
          .update(dbRow)
          .eq('id', editingId)
        if (error) throw error
        patchIncome(editingId, { ...dbRow, date: dbRow.date })
        toast('✓ Income updated')
        return 'updated'
      } else {
        const { data, error } = await supabase
          .from('income')
          .insert([dbRow])
          .select()
        if (error) throw error
        addIncome(decodeIncome(data[0]))
        toast('💰 Income recorded')
        return 'inserted'
      }
    },
    onError: err => {
      setSyncStatus('err')
      toast('Save failed: ' + err.message)
    },
  })

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async id => {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id)
      if (error) throw error
      dropIncome(id)
      toast('Deleted')
    },
    onError: err => toast('Delete failed: ' + err.message),
  })

  // ── Realtime subscription ───────────────────────────────────────────────────
  const startRealtime = () => {
    return supabase
      .channel('income-' + companyId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'income', filter: `company_id=eq.${companyId}` },
        payload => {
          if (payload.eventType === 'INSERT') addIncome(decodeIncome(payload.new))
          if (payload.eventType === 'DELETE') dropIncome(payload.old.id)
          if (payload.eventType === 'UPDATE') patchIncome(payload.new.id, decodeIncome(payload.new))
        }
      )
      .subscribe()
  }

  return {
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    refetch:    query.refetch,
    save:       saveMut.mutateAsync,
    isSaving:   saveMut.isPending,
    remove:     deleteMut.mutateAsync,
    startRealtime,
  }
}
