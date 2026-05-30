import { useState, useMemo } from 'react'
import { useStore, usePersistedStore } from '../store'
import { useToast } from '../components/Toast'
import s from './Invoice.module.css'

// ── Constants ───────────────────────────────────────────────

const BILL_TYPES = [
  { v: 'ra',        l: 'RA Bill',     icon: '🏗️' },
  { v: 'invoice',   l: 'Tax Invoice', icon: '📄' },
  { v: 'proforma',  l: 'Proforma',    icon: '📋' },
]

const GST_RATES = [
  { v: 0,  l: 'No GST' },
  { v: 5,  l: 'GST 5%' },
  { v: 12, l: 'GST 12%' },
  { v: 18, l: 'GST 18%' },
  { v: 28, l: 'GST 28%' },
]

const UNITS = ['Sqm', 'Sqft', 'Rmt', 'Cum', 'MT', 'Nos', 'Bags', 'Loads', 'Days', 'LS']

// ── Helpers ─────────────────────────────────────────────────

const storageKey = id => `wb_invoices_${id}`
const loadMeta = id => { try { return JSON.parse(localStorage.getItem(storageKey(id)) || '{}') } catch { return {} } }
const saveMeta = (id, data) => localStorage.setItem(storageKey(id), JSON.stringify(data))

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const fmtDate = iso => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const emptyRow = () => ({
  id:   crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
  desc: '',
  unit: 'Sqm',
  qty:  '',
  rate: '',
  amt:  0,
})

const toWords = n => {
  if (!n || n === 0) return 'Zero'
  const ones  = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
                  'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const c = num => {
    if (num < 20)    return ones[num]
    if (num < 100)   return tens[Math.floor(num/10)] + (num%10 ? ' '+ones[num%10] : '')
    if (num < 1000)  return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' '+c(num%100) : '')
    if (num < 1e5)   return c(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' '+c(num%1000) : '')
    if (num < 1e7)   return c(Math.floor(num/1e5))  + ' Lakh'     + (num%1e5  ? ' '+c(num%1e5)  : '')
    return             c(Math.floor(num/1e7))        + ' Crore'    + (num%1e7  ? ' '+c(num%1e7)  : '')
  }
  const int  = Math.floor(n)
  const paise = Math.round((n - int) * 100)
  return 'Rupees ' + c(int) + (paise > 0 ? ` and ${c(paise)} Paise` : '') + ' Only'
}

// ── Component ───────────────────────────────────────────────

export default function Invoice() {
  const toast = useToast()
  const { activeCompany } = usePersistedStore()

  const meta    = useMemo(() => loadMeta(activeCompany?.id), [activeCompany?.id])
  const lastNum = meta.lastBillNo || 0
  const nextNum = String(lastNum + 1).padStart(3, '0')
  const sym     = '₹'

  const coName  = activeCompany?.name  || 'Your Company'
  const coEmoji = activeCompany?.emoji || '🏗️'

  // ─ form state ─
  const [billType,   setBillType]   = useState('ra')
  const [billNo,     setBillNo]     = useState(`RA-${nextNum}`)
  const [billDate,   setBillDate]   = useState(todayISO())

  const [clientName, setClientName] = useState('')
  const [clientAddr, setClientAddr] = useState('')
  const [clientGST,  setClientGST]  = useState('')
  const [clientMob,  setClientMob]  = useState('')

  const [projName,   setProjName]   = useState('')
  const [projAddr,   setProjAddr]   = useState('')
  const [workOrder,  setWorkOrder]  = useState('')

  const [rows,       setRows]       = useState([emptyRow(), emptyRow(), emptyRow()])

  const [gstRate,    setGstRate]    = useState(18)
  const [gstType,    setGstType]    = useState('cgst')   // 'cgst' or 'igst'

  const [showBank,   setShowBank]   = useState(false)
  const [bankName,   setBankName]   = useState('')
  const [accNo,      setAccNo]      = useState('')
  const [ifsc,       setIfsc]       = useState('')
  const [branch,     setBranch]     = useState('')

  const [notes,      setNotes]      = useState('Payment due within 15 days of receipt of bill.')
  const [generating, setGenerating] = useState(false)

  // ─ row helpers ─
  const updateRow = (id, field, val) =>
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r
      const u = { ...r, [field]: val }
      u.amt = (parseFloat(u.qty) || 0) * (parseFloat(u.rate) || 0)
      return u
    }))

  const addRow = () => setRows(rs => [...rs, emptyRow()])
  const delRow = id => setRows(rs => rs.filter(r => r.id !== id))

  // ─ totals ─
  const subtotal = rows.reduce((s, r) => s + r.amt, 0)
  const gstAmt   = gstRate > 0 ? +(subtotal * gstRate / 100).toFixed(2) : 0
  const total    = +(subtotal + gstAmt).toFixed(2)

  const gstLines = gstRate > 0
    ? gstType === 'cgst'
      ? [{ l: `CGST @ ${gstRate/2}%`, a: gstAmt/2 }, { l: `SGST @ ${gstRate/2}%`, a: gstAmt/2 }]
      : [{ l: `IGST @ ${gstRate}%`,   a: gstAmt }]
    : []

  const billLabel = BILL_TYPES.find(t => t.v === billType)?.l || 'Invoice'
  const canGenerate = clientName.trim() && rows.some(r => r.desc.trim() && r.amt > 0)

  // ─ HTML template ─
  const generateHTML = () => {
    setGenerating(true)

    const inr = (n, dec = 2) => sym + n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

    const itemRows = rows.map((r, i) => `
      <tr>
        <td class="ctr">${i + 1}</td>
        <td>${r.desc || '—'}</td>
        <td class="ctr">${r.unit}</td>
        <td class="rgt">${r.qty || '—'}</td>
        <td class="rgt">${r.rate ? inr(+r.rate, 0) : '—'}</td>
        <td class="rgt bold">${r.amt > 0 ? inr(r.amt) : '—'}</td>
      </tr>`).join('')

    const gstRows = gstLines.map(g => `
      <tr class="sub-row">
        <td colspan="5" class="rgt sub-lbl">${g.l}</td>
        <td class="rgt">${inr(g.a)}</td>
      </tr>`).join('')

    const bankBlock = (showBank && bankName) ? `
      <div class="sect">
        <div class="sect-ttl">Bank Details</div>
        <table class="bank-t">
          <tr><td class="bl">Bank Name</td><td>${bankName}</td></tr>
          <tr><td class="bl">Account No.</td><td><strong>${accNo}</strong></td></tr>
          <tr><td class="bl">IFSC Code</td><td><strong>${ifsc}</strong></td></tr>
          ${branch ? `<tr><td class="bl">Branch</td><td>${branch}</td></tr>` : ''}
        </table>
      </div>` : ''

    const notesBlock = notes ? `
      <div class="sect">
        <div class="sect-ttl">Terms &amp; Conditions</div>
        <div class="notes-box">${notes.replace(/\n/g, '<br>')}</div>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${billLabel} ${billNo} · ${coName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',-apple-system,Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:13.5px;line-height:1.55}
.page{max-width:800px;margin:0 auto;padding:36px 44px}

/* ── Header ── */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #3a6652;padding-bottom:20px;margin-bottom:22px}
.co-name{font-size:26px;font-weight:800;color:#2b5b45;letter-spacing:-.5px}
.co-sub{font-size:11.5px;color:#6b7280;margin-top:3px}
.bill-label{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#1a1a1a;text-align:right}
.bill-meta{font-size:12px;color:#555;margin-top:5px;text-align:right;line-height:1.7}
.bill-meta strong{color:#1a1a1a}

/* ── Parties ── */
.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px}
.pty{background:#f8faf9;border:1px solid #e0e7e4;border-radius:8px;padding:14px 16px}
.pty-lbl{font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.9px;color:#3a6652;margin-bottom:7px}
.pty-name{font-size:15px;font-weight:800;color:#1a1a1a}
.pty-addr{font-size:12px;color:#4b5563;margin-top:4px;line-height:1.6}
.pty-gst{font-size:11px;color:#777;margin-top:6px;font-family:monospace}

/* ── Work order ── */
.wo{background:#fffbeb;border:1px solid #f5c842;border-radius:6px;padding:8px 14px;font-size:12px;color:#854f0b;margin-bottom:16px}
.wo strong{font-weight:700}

/* ── Items table ── */
.items-wrap{border:1px solid #e0e7e4;border-radius:10px;overflow:hidden;margin-bottom:0}
table{width:100%;border-collapse:collapse;font-size:13px}
thead tr{background:#3a6652;color:#fff}
th{padding:10px 13px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
td{padding:10px 13px;border-bottom:1px solid #f0f4f2;vertical-align:middle}
tbody tr:nth-child(even){background:#f8faf9}
tbody tr:last-child td{border-bottom:none}
tfoot tr:first-child td{border-top:2px solid #e0e7e4}
.ctr{text-align:center}
.rgt{text-align:right}
.bold{font-weight:700}

/* ── Subtotal / totals ── */
.sub-row td{background:#fafafa;font-size:12.5px;color:#4b5563;padding:7px 13px}
.sub-lbl{color:#4b5563;font-size:12.5px}
.tot-row td{padding:11px 13px;font-size:15px;font-weight:900;background:#2b5b45;color:#fff}
.subtot-row td{padding:9px 13px;font-weight:700;background:#edf5f1;color:#1a1a1a}

/* ── Words box ── */
.words{background:#f0fdf4;border:1px solid #86efac;border-radius:7px;padding:11px 15px;font-size:12.5px;color:#065f46;margin:14px 0}
.words strong{font-weight:800}

/* ── Sections ── */
.sect{margin-bottom:16px}
.sect-ttl{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;color:#3a6652;margin-bottom:8px;border-bottom:1px solid #e0e7e4;padding-bottom:4px}
.bank-t{width:auto;font-size:12.5px}
.bank-t td{padding:4px 10px;border:none}
.bl{font-weight:700;color:#6b7280;width:130px}
.notes-box{background:#fffbeb;border-left:3px solid #f5c842;padding:10px 14px;font-size:12.5px;color:#6b280b;border-radius:0 6px 6px 0;line-height:1.6}

/* ── Signatures ── */
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:36px}
.sig-block{text-align:center}
.sig-space{height:52px}
.sig-line{border-top:1.5px solid #9ca3af;padding-top:7px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:.5px;line-height:1.6}

/* ── Footer ── */
.footer{text-align:center;font-size:10.5px;color:#9ca3af;margin-top:24px;border-top:1px solid #f0f4f2;padding-top:12px}

@media print{
  body{padding:0}
  .page{padding:18px 22px}
  @page{margin:8mm;size:A4}
}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div>
    <div class="co-name">${coEmoji} ${coName}</div>
    <div class="co-sub">Construction Management · Powered by WorkBills</div>
  </div>
  <div>
    <div class="bill-label">${billLabel}</div>
    <div class="bill-meta">
      Bill No: <strong>${billNo}</strong><br>
      Date: <strong>${fmtDate(billDate)}</strong>
    </div>
  </div>
</div>

<div class="parties">
  <div class="pty">
    <div class="pty-lbl">Bill To (Client)</div>
    <div class="pty-name">${clientName || '—'}</div>
    ${clientAddr ? `<div class="pty-addr">${clientAddr.replace(/\n/g, '<br>')}</div>` : ''}
    ${clientGST  ? `<div class="pty-gst">GSTIN: ${clientGST}</div>` : ''}
    ${clientMob  ? `<div class="pty-addr" style="margin-top:5px">📞 ${clientMob}</div>` : ''}
  </div>
  <div class="pty">
    <div class="pty-lbl">Project / Site</div>
    <div class="pty-name">${projName || '—'}</div>
    ${projAddr ? `<div class="pty-addr">${projAddr.replace(/\n/g, '<br>')}</div>` : ''}
  </div>
</div>

${workOrder ? `<div class="wo">Work Order / Contract Ref: <strong>${workOrder}</strong></div>` : ''}

<div class="items-wrap">
<table>
  <thead>
    <tr>
      <th class="ctr" style="width:42px">Sl.</th>
      <th>Description of Work</th>
      <th class="ctr" style="width:62px">Unit</th>
      <th class="rgt" style="width:72px">Qty</th>
      <th class="rgt" style="width:96px">Rate (${sym})</th>
      <th class="rgt" style="width:112px">Amount (${sym})</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr class="subtot-row">
      <td colspan="5" class="rgt">Subtotal</td>
      <td class="rgt">${inr(subtotal)}</td>
    </tr>
    ${gstRows}
    <tr class="tot-row">
      <td colspan="5" class="rgt">GRAND TOTAL</td>
      <td class="rgt">${inr(total)}</td>
    </tr>
  </tfoot>
</table>
</div>

<div class="words"><strong>Amount in Words:</strong> ${toWords(Math.round(total))}</div>

${bankBlock}
${notesBlock}

<div class="sigs">
  <div class="sig-block"><div class="sig-space"></div><div class="sig-line">Authorised Signatory<br>${coName}</div></div>
  <div class="sig-block"><div class="sig-space"></div><div class="sig-line">Client Signature &amp; Stamp<br>${clientName || 'Client'}</div></div>
</div>

<div class="footer">Generated by WorkBills · workbills.netlify.app · ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>
</div>
</body>
</html>`

    // persist bill counter
    const num = parseInt(billNo.replace(/\D/g, '')) || lastNum + 1
    saveMeta(activeCompany?.id, { lastBillNo: num })

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${billNo}-${coName.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast('📄 Invoice downloaded — open in browser, then Print → Save as PDF')
    setGenerating(false)
  }

  // ─ render ─
  return (
    <div className={s.panel}>

      {/* ── Hero ── */}
      <div className={s.hero}>
        <div className={s.heroIcon}>📄</div>
        <div className={s.heroTitle}>Client Invoice</div>
        <div className={s.heroSub}>Generate RA Bills, Tax Invoices &amp; Proforma PDFs</div>
      </div>

      {/* ── Bill type ── */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Bill Type</div>
        <div className={s.pillRow}>
          {BILL_TYPES.map(t => (
            <button
              key={t.v}
              className={s.pill + (billType === t.v ? ' ' + s.pillActive : '')}
              onClick={() => {
                setBillType(t.v)
                const prefix = t.v === 'ra' ? 'RA' : t.v === 'invoice' ? 'INV' : 'PF'
                setBillNo(`${prefix}-${String(lastNum + 1).padStart(3, '0')}`)
              }}
            >
              {t.icon} {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bill no + date ── */}
      <div className={s.section}>
        <div className={s.row2} style={{ padding: '0 14px 12px' }}>
          <div className={s.fieldGroup}>
            <div className={s.fieldLbl}>Bill Number</div>
            <input className="inp" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="RA-001" />
          </div>
          <div className={s.fieldGroup}>
            <div className={s.fieldLbl}>Date</div>
            <input className="inp" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Client details ── */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Client / Party Details</div>
        <div className={s.inCard}>
          <input
            className="inp"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Client or Party Name *"
          />
          <textarea
            className={s.ta}
            value={clientAddr}
            onChange={e => setClientAddr(e.target.value)}
            placeholder="Address"
            rows={2}
          />
          <div className={s.row2}>
            <input className="inp" value={clientGST} onChange={e => setClientGST(e.target.value)} placeholder="GSTIN (optional)" />
            <input className="inp" value={clientMob} onChange={e => setClientMob(e.target.value)} placeholder="Mobile No." />
          </div>
        </div>
      </div>

      {/* ── Project / site ── */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Project / Site</div>
        <div className={s.inCard}>
          <input className="inp" value={projName} onChange={e => setProjName(e.target.value)} placeholder="Project or Site Name" />
          <textarea
            className={s.ta}
            value={projAddr}
            onChange={e => setProjAddr(e.target.value)}
            placeholder="Site Address"
            rows={2}
          />
          <input className="inp" value={workOrder} onChange={e => setWorkOrder(e.target.value)} placeholder="Work Order / Contract Ref (optional)" />
        </div>
      </div>

      {/* ── Line items ── */}
      <div className={s.section}>
        <div className={s.sectionLblRow}>
          <div className={s.sectionLbl} style={{ padding: 0 }}>Line Items</div>
          <button className={s.addRowBtn} onClick={addRow}>＋ Add Row</button>
        </div>

        {/* Desktop column header */}
        <div className={s.tableHdr}>
          <span className={s.colSl}>#</span>
          <span className={s.colDesc}>Description of Work</span>
          <span className={s.colUnit}>Unit</span>
          <span className={s.colNum}>Qty</span>
          <span className={s.colNum}>Rate ₹</span>
          <span className={s.colAmt}>Amount</span>
        </div>

        {rows.map((r, i) => (
          <div key={r.id} className={s.tableRow}>
            <span className={s.colSl}>{i + 1}</span>

            <input
              className={'inp ' + s.descInp}
              value={r.desc}
              onChange={e => updateRow(r.id, 'desc', e.target.value)}
              placeholder="Work description"
            />

            <select
              className={s.unitSel}
              value={r.unit}
              onChange={e => updateRow(r.id, 'unit', e.target.value)}
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>

            <input
              className={'inp ' + s.numInp}
              value={r.qty}
              onChange={e => updateRow(r.id, 'qty', e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              inputMode="decimal"
            />

            <input
              className={'inp ' + s.numInp}
              value={r.rate}
              onChange={e => updateRow(r.id, 'rate', e.target.value)}
              placeholder="0"
              type="number"
              min="0"
              inputMode="decimal"
            />

            <div className={s.amtCell}>
              {r.amt > 0
                ? <span className={s.amtVal}>{sym}{r.amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                : <span className={s.amtDash}>—</span>}
            </div>

            {rows.length > 1 && (
              <button className={s.delBtn} onClick={() => delRow(r.id)} title="Remove row">✕</button>
            )}
          </div>
        ))}

        {/* Subtotal strip */}
        {subtotal > 0 && (
          <div className={s.subtotalStrip}>
            <span className={s.subtotalLbl}>Subtotal</span>
            <span className={s.subtotalAmt}>{sym}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {/* ── GST ── */}
      <div className={s.section}>
        <div className={s.sectionLbl}>GST</div>
        <div className={s.pillRow}>
          {GST_RATES.map(g => (
            <button
              key={g.v}
              className={s.pill + (gstRate === g.v ? ' ' + s.pillActive : '')}
              onClick={() => setGstRate(g.v)}
            >{g.l}</button>
          ))}
        </div>

        {gstRate > 0 && (
          <div className={s.gstTypeRow}>
            <button
              className={s.gstBtn + (gstType === 'cgst' ? ' ' + s.gstBtnOn : '')}
              onClick={() => setGstType('cgst')}
            >CGST + SGST (intra-state)</button>
            <button
              className={s.gstBtn + (gstType === 'igst' ? ' ' + s.gstBtnOn : '')}
              onClick={() => setGstType('igst')}
            >IGST (inter-state)</button>
          </div>
        )}

        {gstRate > 0 && subtotal > 0 && (
          <div className={s.gstBreakdown}>
            {gstLines.map(g => (
              <div key={g.l} className={s.gstRow}>
                <span className={s.gstLbl}>{g.l}</span>
                <span className={s.gstAmt}>{sym}{g.a.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bank details ── */}
      <div className={s.section}>
        <div className={s.toggleRow} onClick={() => setShowBank(v => !v)}>
          <div className={s.toggleLabel}>Include bank details in invoice</div>
          <div className={s.toggle + (showBank ? ' ' + s.toggleOn : '')}>
            <div className={s.toggleThumb} />
          </div>
        </div>
        {showBank && (
          <div className={s.inCard} style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
            <div className={s.row2}>
              <input className="inp" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank Name (e.g. SBI)" />
              <input className="inp" value={accNo}    onChange={e => setAccNo(e.target.value)}    placeholder="Account Number" />
            </div>
            <div className={s.row2}>
              <input className="inp" value={ifsc}   onChange={e => setIfsc(e.target.value)}   placeholder="IFSC Code" />
              <input className="inp" value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch (optional)" />
            </div>
          </div>
        )}
      </div>

      {/* ── Terms / notes ── */}
      <div className={s.section}>
        <div className={s.sectionLbl}>Terms &amp; Notes</div>
        <div style={{ padding: '0 14px 12px' }}>
          <textarea
            className={s.ta}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Payment terms, special instructions…"
          />
        </div>
      </div>

      {/* ── Grand total card ── */}
      {total > 0 && (
        <div className={s.totalCard}>
          <div className={s.totalRow}>
            <span>Subtotal</span>
            <span>{sym}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {gstLines.map(g => (
            <div key={g.l} className={s.totalRow}>
              <span>{g.l}</span>
              <span>{sym}{g.a.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div className={s.totalFinal}>
            <span>Grand Total</span>
            <span>{sym}{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={s.wordsLine}>{toWords(Math.round(total))}</div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className={s.actions}>
        {!canGenerate && (
          <div className={s.hint}>Fill in client name and at least one line item (with qty + rate) to generate.</div>
        )}
        <button
          className="btn-amber"
          onClick={generateHTML}
          disabled={!canGenerate || generating}
        >
          {generating ? 'Generating…' : `📄 Download ${billLabel} (${billNo})`}
        </button>
        <div className={s.hint}>
          Downloads as an HTML file → open in any browser → Print → Save as PDF
        </div>
      </div>

    </div>
  )
}
