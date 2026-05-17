import { useMemo, useState } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { SYS_CATS, pCode, pColor, pBg, pName, fmt, parseDate } from '../lib/supabase'
import s from './Summary.module.css'

const PERIODS = [{ v:'all', l:'All Time' }, { v:'month', l:'This Month' }, { v:'week', l:'This Week' }]
const PIE_CLR = ['#3a6652','#ea580c','#7c3aed','#0891b2','#dc2626','#16a34a','#e8920a','#9333ea','#2563eb','#ca8a04']

export default function SummaryPanel() {
  const { entries, customCats } = useStore()
  const { activeCompany } = usePersistedStore()
  const config = partnerConfig(activeCompany)
  const sym = activeCompany?.currency === 'USD' ? '$' : activeCompany?.currency === 'EUR' ? '€' : '₹'
  const [period, setPeriod] = useState('month')
  const [hlCat, setHlCat] = useState(null)

  const src = useMemo(() => {
    const now = new Date()
    const ok = entries.filter(e => e.status !== 'rejected')
    if (period === 'month') return ok.filter(e => { const d=parseDate(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() })
    if (period === 'week') { const w=new Date(now); w.setDate(now.getDate()-7); return ok.filter(e=>parseDate(e.date)>=w) }
    return ok
  }, [entries, period])

  const real  = src.filter(e => e.category !== 'Advance / Hand Loan')
  const total = real.reduce((s, e) => s + (e.amount || 0), 0)

  const byCat = useMemo(() => {
    const m = {}
    real.forEach(e => { m[e.category] = (m[e.category]||0) + (e.amount||0) })
    return Object.entries(m).sort((a,b) => b[1]-a[1])
  }, [real])

  const pieData = byCat.slice(0,10).map(([n,a],i) => ({ n, a, pct: total>0?a/total:0, color: PIE_CLR[i%PIE_CLR.length] }))

  const partnerTotals = useMemo(() => {
    if (!config.isMulti) return []
    return config.partners.map((nm,i) => {
      const c = pCode(i)
      const t = real.filter(e=>e.partner===c).reduce((s,e)=>s+(e.amount||0),0)
      return { nm, c, t, pct: total>0?Math.round(t/total*100):0 }
    })
  }, [real, config, total])

  const settle = useMemo(() => {
    if (config.count !== 2) return null
    const [a,b] = partnerTotals
    if (!a||!b) return null
    const d = a.t-b.t
    if (Math.abs(d)<1) return { even:true }
    return { even:false, payer:d>0?a.nm:b.nm, receiver:d>0?b.nm:a.nm, amt:Math.abs(d) }
  }, [partnerTotals, config])

  if (entries.length === 0) return (
    <div className="empty-state"><div className="icon">📊</div><p>Add expenses to see summary</p></div>
  )

  return (
    <div className={s.panel}>
      <div className={s.tabs}>
        {PERIODS.map(p => <button key={p.v} className={s.tab+(period===p.v?' '+s.tabA:'')} onClick={()=>setPeriod(p.v)}>{p.l}</button>)}
      </div>

      <div className={s.totalCard}>
        <div className={s.tl}>Total Spend</div>
        <div className={s.tv}>{fmt(total, sym)}</div>
        <div className={s.ts}>{real.length} entries · {period==='month'?'this month':period==='week'?'this week':'all time'}</div>
      </div>

      {config.isMulti && partnerTotals.length > 0 && (
        <div className="card" style={{margin:'0 14px 12px'}}>
          <div className="card-hdr">Partner Split</div>
          {partnerTotals.map(({nm,c,t,pct}) => (
            <div key={c} className={s.pRow}>
              <div className={s.pAv} style={{background:pBg(c),color:pColor(c)}}>{nm.charAt(0)}</div>
              <div className={s.pInfo}>
                <div className={s.pName}>{nm}</div>
                <div className={s.pBar}><div className={s.pFill} style={{width:pct+'%',background:pColor(c)}}/></div>
              </div>
              <div className={s.pAmt}><div style={{fontWeight:800,color:pColor(c)}}>{fmt(t,sym)}</div><div style={{fontSize:11,color:'var(--txt3)'}}>{pct}%</div></div>
            </div>
          ))}
          {settle && (
            <div className={s.settle}>
              {settle.even ? <div className={s.sEven}>✅ All settled equally</div> : (
                <div className={s.sResult}>
                  <div style={{fontSize:22}}>💸</div>
                  <div className={s.sMsg}>{settle.receiver} owes {settle.payer}</div>
                  <div className={s.sAmt}>{fmt(settle.amt,sym)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pieData.length > 0 && (
        <div className="card" style={{margin:'0 14px 12px'}}>
          <div className="card-hdr">By Category</div>
          <Pie data={pieData} total={total} sym={sym} hl={hlCat}/>
          <div className={s.legend}>
            {pieData.map(d => (
              <div key={d.n} className={s.li+(hlCat===d.n?' '+s.liA:'')} onClick={()=>setHlCat(hlCat===d.n?null:d.n)}>
                <div className={s.dot} style={{background:d.color}}/>
                <span className={s.ln}>{d.n}</span>
                <span className={s.lp}>{Math.round(d.pct*100)}%</span>
                <span className={s.la}>{fmt(d.a,sym)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{margin:'0 14px 12px'}}>
        <div className="card-hdr">Insights</div>
        <div className={s.grid}>
          <ICard icon="📦" label="Top Category"  val={byCat[0]?byCat[0][0]:'—'} sub={byCat[0]?fmt(byCat[0][1],sym):''} clr="#e8920a"/>
          <ICard icon="📅" label="Avg / Day"     val={fmt(total/Math.max(new Set(real.map(e=>e.date)).size,1),sym)} sub={`${new Set(real.map(e=>e.date)).size} days`} clr="#3a6652"/>
          <ICard icon="📋" label="Entries"        val={real.length} sub="approved" clr="#7c3aed"/>
          <ICard icon="💸" label="Advances"       val={fmt(src.filter(e=>e.category==='Advance / Hand Loan').reduce((t,e)=>t+e.amount,0),sym)} sub="hand loans" clr="#dc2626"/>
        </div>
      </div>
    </div>
  )
}

function Pie({ data, total, sym, hl }) {
  const R=80, CX=100, CY=100, SW=32
  let ang=0
  const slices = data.map(d => { const a=d.pct*2*Math.PI; const sl={...d,s:ang,e:ang+a}; ang+=a; return sl })
  const arc=(s,e,r,cx,cy)=>{
    if(e-s>=2*Math.PI)e=s+2*Math.PI-.001
    const x1=cx+r*Math.cos(s-Math.PI/2),y1=cy+r*Math.sin(s-Math.PI/2)
    const x2=cx+r*Math.cos(e-Math.PI/2),y2=cy+r*Math.sin(e-Math.PI/2)
    return `M${x1} ${y1} A${r} ${r} 0 ${e-s>Math.PI?1:0} 1 ${x2} ${y2}`
  }
  const hd = hl ? data.find(d=>d.n===hl) : null
  return (
    <div style={{display:'flex',justifyContent:'center',padding:'16px 0 8px',position:'relative'}}>
      <div style={{position:'relative',width:180,height:180}}>
        <svg viewBox="0 0 200 200" style={{width:180,height:180,transform:'rotate(-90deg)'}}>
          {slices.map(sl=><path key={sl.n} d={arc(sl.s,sl.e,R,CX,CY)} fill="none" stroke={sl.color} strokeWidth={SW} opacity={hl&&hl!==sl.n?.3:1} style={{transition:'opacity .2s'}}/>)}
        </svg>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:800,letterSpacing:-.5}}>{hd?Math.round(hd.pct*100)+'%':fmt(total,sym)}</div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:.5}}>{hd?hd.n.split(' ')[0]:'Total'}</div>
        </div>
      </div>
    </div>
  )
}

function ICard({ icon, label, val, sub, clr }) {
  return (
    <div style={{background:'var(--bg)',borderRadius:'var(--rs)',padding:'14px 13px',border:'1px solid var(--border)',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:clr,borderRadius:'var(--rs) var(--rs) 0 0'}}/>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--txt3)'}}>{label}</div>
      <div style={{fontSize:15,fontWeight:800,letterSpacing:-.3,marginTop:2}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:'var(--txt3)',marginTop:3}}>{sub}</div>}
    </div>
  )
}
