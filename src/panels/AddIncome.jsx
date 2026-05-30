import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { useIncome } from '../hooks/useIncome'
import { useToast } from '../components/Toast'
import { todayISO, fmtDate } from '../lib/supabase'
import s from './AddIncome.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const INCOME_TYPES = [
  { v: 'ra_bill',   l: 'RA Bill',          e: '📋', hint: 'Running account / progress bill' },
  { v: 'milestone', l: 'Milestone Payment', e: '🏁', hint: 'Agreed milestone reached' },
  { v: 'advance',   l: 'Advance Received',  e: '💰', hint: 'Advance / mobilisation payment' },
  { v: 'final_bill',l: 'Final Bill',        e: '✅', hint: 'Final settlement bill' },
  { v: 'retention', l: 'Retention Release', e: '🔓', hint: 'Retention money released' },
]

const PAY_MODES = ['NEFT', 'RTGS', 'Cheque', 'UPI', 'Cash', 'DD']

const STATUSES = [
  { v: 'received', l: '✅ Received',  cls: 'statRcv'  },
  { v: 'pending',  l: '⏳ Pending',   cls: 'statPend' },
  { v: 'partial',  l: '🔶 Partial',   cls: 'statPart' },
]

const loadProjects = cid => {
  try { return JSON.parse(localStorage.getItem(`wb_projects_${cid}`) || '[]') } catch { return [] }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AddIncome() {
  const toast = useToast()
  const { activeCompany } = usePersistedStore()
  const { incomes, editingIncomeId, setEditingIncomeId, setPanel } = useStore()
  const { save, isSaving } = useIncome()
  const sym      = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const cid      = activeCompany?.id || 'demo'
  const projects = useMemo(() => loadProjects(cid), [cid])

  // If editing, prefill from store
  const editing = editingIncomeId
    ? incomes.find(i => i.id === editingIncomeId)
    : null

  const isoFromDMY = dmy => {
    if (!dmy) return todayISO()
    const p = dmy.split('/')
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : todayISO()
  }

  const [incomeType, setIncomeType] = useState(editing?.income_type || 'ra_bill')
  const [date,       setDate]       = useState(editing ? isoFromDMY(editing.date) : todayISO())
  const [client,     setClient]     = useState(editing?.client       || '')
  const [billNo,     setBillNo]     = useState(editing?.bill_no      || '')
  const [description,setDescription]= useState(editing?.description  || '')
  const [amount,     setAmount]     = useState(editing ? String(editing.amount) : '')
  const [projectId,  setProjectId]  = useState(editing?.project_id   || '')
  const [status,     setStatus]     = useState(editing?.status       || 'received')
  const [payMode,    setPayMode]    = useState(editing?.pay_mode      || 'NEFT')
  const [notes,      setNotes]      = useState(editing?.notes        || '')

  const selType = INCOME_TYPES.find(t => t.v === incomeType) || INCOME_TYPES[0]
  const canSave = client.trim() && amount && !isNaN(+amount) && +amount > 0

  const handleSave = async () => {
    if (!canSave) { toast('Enter client name and amount'); return }
    await save({
      date, client, description, amount: +amount,
      income_type: incomeType,
      project_id:  projectId || null,
      status, pay_mode: payMode, notes, bill_no: billNo,
      editingId: editingIncomeId || undefined,
    })
    if (editingIncomeId) {
      setEditingIncomeId(null)
      setPanel('income')
    } else {
      // Reset form
      setClient(''); setBillNo(''); setDescription('')
      setAmount(''); setProjectId(''); setNotes('')
      setDate(todayISO()); setStatus('received')
    }
  }

  return (
    <div className={s.panel}>

      {editing && (
        <div className={s.editBanner}>
          ✏️ Editing income record
          <button className={s.editCancelBtn} onClick={() => {
            setEditingIncomeId(null); setPanel('income')
          }}>Cancel edit</button>
        </div>
      )}

      {/* Income type selector */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Income Type</div>
        <div className={s.typeGrid}>
          {INCOME_TYPES.map(t => (
            <button
              key={t.v}
              className={s.typeCard + (incomeType === t.v ? ' ' + s.typeCardOn : '')}
              onClick={() => setIncomeType(t.v)}
            >
              <span className={s.typeEmoji}>{t.e}</span>
              <span className={s.typeLabel}>{t.l}</span>
              <span className={s.typeHint}>{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active type badge */}
      <div className={s.typeBadge}>
        {selType.e} {selType.l}
        {status === 'pending' && <span className={s.pendingFlag}> · Pending</span>}
        {status === 'partial' && <span className={s.partialFlag}> · Partial</span>}
      </div>

      {/* Core fields */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Client & Amount</div>
        <div className={s.inCard}>
          <div>
            <label className="lbl">Client / Party Name *</label>
            <input
              className="inp"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="e.g. Sri Venkateswara Builders"
              autoFocus={!editing}
            />
          </div>

          <div>
            <label className="lbl">Amount ({sym}) *</label>
            <input
              className={'inp ' + s.amtInp}
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className={s.row2}>
            <div>
              <label className="lbl">Date</label>
              <input
                className="inp"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="lbl">Bill / Ref No.</label>
              <input
                className="inp"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder="RA-007"
              />
            </div>
          </div>

          <div>
            <label className="lbl">Description</label>
            <input
              className="inp"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 3rd running account bill — drain & compound wall"
            />
          </div>
        </div>
      </div>

      {/* Project link */}
      {projects.length > 0 && (
        <div className={s.section}>
          <div className={s.sectionLbl}>Project / Site</div>
          <div className={s.inCard}>
            <select
              className="inp"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.emoji || '📁'} {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Payment details */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Payment Details</div>
        <div className={s.inCard}>
          {/* Status */}
          <div>
            <label className="lbl">Status</label>
            <div className={s.statusRow}>
              {STATUSES.map(st => (
                <button
                  key={st.v}
                  className={s.statusBtn + (status === st.v ? ' ' + s[st.cls] : '')}
                  onClick={() => setStatus(st.v)}
                >{st.l}</button>
              ))}
            </div>
          </div>

          {/* Pay mode — only show when received or partial */}
          {status !== 'pending' && (
            <div>
              <label className="lbl">Payment Mode</label>
              <div className={s.modeRow}>
                {PAY_MODES.map(m => (
                  <button
                    key={m}
                    className={s.modeBtn + (payMode === m ? ' ' + s.modeBtnOn : '')}
                    onClick={() => setPayMode(m)}
                  >{m}</button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="lbl">Notes <span style={{ fontWeight: 400, color: 'var(--txt4)' }}>optional</span></label>
            <textarea
              className={s.ta}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Cheque no., UTR ref, terms, remarks…"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className={s.footer}>
        {amount && !isNaN(+amount) && +amount > 0 && (
          <div className={s.amtPreview}>
            {selType.e} {sym}{(+amount).toLocaleString('en-IN')}
            {status === 'pending' ? ' (pending)' : status === 'partial' ? ' (partial)' : ''}
          </div>
        )}
        <button
          className="btn-amber"
          onClick={handleSave}
          disabled={!canSave || isSaving}
        >
          {isSaving
            ? 'Saving…'
            : editing
            ? '✓ Update Income Record'
            : `💰 Record ${selType.l}`}
        </button>
        <button
          className="btn-ghost"
          onClick={() => setPanel('income')}
          style={{ marginTop: 8 }}
        >View Income Ledger</button>
      </div>
    </div>
  )
}
