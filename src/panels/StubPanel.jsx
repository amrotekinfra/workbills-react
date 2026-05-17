const META = {
  dash:      { icon:'📅', label:'Daily Dashboard',   note:'Daily spending chart and closing summary — coming in Phase 2' },
  budget:    { icon:'🎯', label:'Budget Limits',      note:'Set monthly limits per category — coming in Phase 2' },
  templates: { icon:'🔁', label:'Quick Templates',    note:'Save and reuse common expense entries — coming in Phase 2' },
  subs:      { icon:'👷', label:'Workers & Subs',     note:'Subcontractor ledger and wage tracking — coming in Phase 2' },
  vendors:   { icon:'🏭', label:'Vendor Ledger',      note:'Supplier accounts with purchase/payment tracking — coming in Phase 2' },
  projects:  { icon:'📁', label:'Projects & Sites',   note:'Tag entries to project sites, track budgets — coming in Phase 2' },
  approvals: { icon:'✅', label:'Approvals',           note:'Review and approve/reject pending entries — coming in Phase 2' },
  team:      { icon:'👥', label:'Team Management',    note:'Invite members and manage roles — coming in Phase 2' },
  cats:      { icon:'🏷️', label:'Categories',         note:'Add custom expense categories — coming in Phase 2' },
  wa:        { icon:'💬', label:'WhatsApp Bot',       note:'Log expenses via WhatsApp message — coming in Phase 3' },
  ai:        { icon:'🤖', label:'AI Assistant',       note:'Ask questions about your expenses — coming in Phase 3' },
  share:     { icon:'🔗', label:'Share Report',       note:'Generate read-only link for clients — coming in Phase 3' },
}

export default function StubPanel({ id }) {
  const m = META[id] || { icon: '🔧', label: id, note: 'Coming soon.' }
  return (
    <div style={{ padding:'56px 28px', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:18 }}>{m.icon}</div>
      <div style={{ fontSize:19, fontWeight:800, marginBottom:10 }}>{m.label}</div>
      <div style={{ fontSize:14, color:'var(--txt3)', maxWidth:280, margin:'0 auto 28px', lineHeight:1.6 }}>{m.note}</div>
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 16px', borderRadius:100, background:'var(--accent-lt)', color:'var(--accent-d)', fontSize:12, fontWeight:700 }}>
        🚧 In development
      </div>
    </div>
  )
}
