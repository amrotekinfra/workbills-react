import { useMemo, useState } from 'react'
import { useStore, usePersistedStore, partnerConfig } from '../store'
import { pCode, pColor, pBg, fmt, parseDate } from '../lib/supabase'
import s from './Summary.module.css'

const PERIODS = [
  { v:'all',   l:'All Time'   },
  { v:'month', l:'This Month' },
  { v:'week',  l:'Last 7 Days'},
]
const PIE_CLR = ['#3a6652','#ea580c','#7c3aed','#0891b2','#dc2626','#16a34a','#e8920a','#9333ea','#2563eb','#ca8a04','#0f766e','#be185d','#92400e','#1d4ed8']

export default function SummaryPanel() {
  const { entries } = useStore()
  const { activeCompany } = usePersistedStore()
  const config = partnerConfig(activeCompany)
  const sym    = activeCompany?.currency==='USD'?'$':activeCompany?.currency==='EUR'?'€':'₹'

  const [period,    setPeriod]    = useState('all')
  const [expandCat, setExpandCat] = useState(null)
  const [expandDay, setExpandDay] = useState(null)

  const src = useMemo(() => {
    const now = new Date()
    const ok  = entries.filter(e => e.status !== 'rejected')
    if (period==='month') return ok.filter(e => { const d=parseDate(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() })
    if (period==='week')  { const w=new Date(now); w.setDate(now.getDate()-7); return ok.filter(e=>parseDate(e.date)>=w) }
    return ok
  }, [entries, period])

  const real    = src.filter(e => e.category !== 'Advance / Hand Loan')
  const advTotal= src.filter(e => e.category === 'Advance / Hand Loan').reduce((t,e)=>t+(e.amount||0),0)
  const total   = real.reduce((t,e) => t+(e.amount||0), 0)

  const byCat = useMemo(() => {
    const m={}; real.forEach(e=>{ m[e.category]=(m[e.category]||0)+(e.amount||0) })
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
  }, [real])

  const partnerTotals = useMemo(() => {
    if (!config.isMulti) return []
    return config.partners.map((nm,i)=>{
      const c=pCode(i), t=real.filter(e=>e.partner===c).reduce((s,e)=>s+(e.amount||0),0)
      return { nm, c, t, pct: total>0?Math.round(t/total*100):0 }
    })
  }, [real, config, total])

  const settle = useMemo(()=>{
    if (config.count!==2) return null
    const [a,b]=partnerTotals; if(!a||!b) return null
    const d=a.t-b.t; if(Math.abs(d)<1) return {even:true}
    return {even:false,payer:d>0?a.nm:b.nm,receiver:d>0?b.nm:a.nm,amt:Math.abs(d)}
  }, [partnerTotals, config])

  const runningBalance = useMemo(()=>{
    if (config.count!==2) return []
    const [c0,c1]=[pCode(0),pCode(1)], bd={}
    real.forEach(e=>{
      if(!bd[e.date]) bd[e.date]={t0:0,t1:0}
      if(e.partner===c0) bd[e.date].t0+=e.amount||0
      if(e.partner===c1) bd[e.date].t1+=e.amount||0
    })
    let cum0=0,cum1=0
    return Object.entries(bd).sort((a,b)=>parseDate(a[0])-parseDate(b[0])).map(([date,{t0,t1}])=>{
      cum0+=t0; cum1+=t1; return {date,t0:cum0,t1:cum1,diff:cum0-cum1}
    })
  }, [real, config])

  const byDay = useMemo(()=>{
    const m={}; src.forEach(e=>{ if(!m[e.date]) m[e.date]=[]; m[e.date].push(e) })
    return Object.entries(m).sort((a,b)=>parseDate(b[0])-parseDate(a[0]))
  }, [src])

  const pieData = byCat.slice(0,14).map(([n,a],i)=>({ n,a, pct:total>0?a/total:0, color:PIE_CLR[i%PIE_CLR.length] }))

  const fmtDt = (str, short = false) => {
    if (!str) return ''
    const p = str?.split('/')
    if (!p || p.length !== 3) return str
    const dt = new Date(+p[2], +p[1]-1, +p[0])
    if (isNaN(dt.getTime())) return ''
    if (short) return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short' })
    return dt.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
  }

  if (entries.length===0) return (
    <div className="empty-state"><div className="icon">📊</div><p>Add expenses to see summary</p></div>
  )

  return (
    <div className={s.panel}>

      {/* Tabs */}
      <div className={s.tabs}>
        {PERIODS.map(p=>(
          <button key={p.v} className={s.tab+(period===p.v?' '+s.tabA:'')} onClick={()=>setPeriod(p.v)}>{p.l}</button>
        ))}
      </div>

      {/* Total KPI */}
      <div className={s.totalCard}>
        <div className={s.totalLeft}>
          <div className={s.tLabel}>Total Spend</div>
          <div className={s.tVal}>{fmt(total,sym)}</div>
          <div className={s.tSub}>{real.length} entries · {period==='month'?'this month':period==='week'?'last 7 days':'all time'}</div>
        </div>
        <div className={s.totalMeta}>
          <div className={s.metaPill}>
            <span className={s.metaVal}>{byCat.length}</span>
            <span className={s.metaLabel}>Categories</span>
          </div>
          {advTotal>0&&<div className={s.metaPill}>
            <span className={s.metaVal+' '+s.metaAccent}>{fmt(advTotal,sym)}</span>
            <span className={s.metaLabel}>Advances</span>
          </div>}
          <div className={s.metaPill}>
            <span className={s.metaVal}>{new Set(real.map(e=>e.date)).size}</span>
            <span className={s.metaLabel}>Active Days</span>
          </div>
        </div>
      </div>

      {/* Partner Split */}
      {config.isMulti&&partnerTotals.length>0&&(
        <section className={s.section}>
          <div className={s.secHdr}>Partner Split</div>
          <div className={s.partnerGrid}>
            {partnerTotals.map(({nm,c,t,pct})=>(
              <div key={c} className={s.partnerCard} style={{borderTop:`3px solid ${pColor(c)}`}}>
                <div className={s.pAv} style={{background:pBg(c),color:pColor(c)}}>{nm.charAt(0)}</div>
                <div className={s.pName}>{nm}</div>
                <div className={s.pAmt} style={{color:pColor(c)}}>{fmt(t,sym)}</div>
                <div className={s.pPct}>{pct}%</div>
                <div className={s.pBar}><div className={s.pFill} style={{width:pct+'%',background:pColor(c)}}/></div>
              </div>
            ))}
          </div>
          {settle&&(
            <div className={s.settle}>
              {settle.even
                ? <div className={s.sEven}>✅ All settled — both spent equally</div>
                : <div className={s.sResult}>
                    <span>💸</span>
                    <span className={s.sMsg}>{settle.receiver} owes {settle.payer}</span>
                    <span className={s.sAmt}>{fmt(settle.amt,sym)}</span>
                  </div>
              }
            </div>
          )}
        </section>
      )}

      {/* Spend by Category */}
      {byCat.length>0&&(
        <section className={s.section}>
          <div className={s.secHdr}>
            <span>Spend by Category</span>
            <span className={s.secHint}>tap to view entries</span>
          </div>

          {/* Donut pie */}
          <div className={s.pieWrap}>
            <div className={s.pieContainer}>
              <svg viewBox="0 0 200 200" className={s.pieSvg}>
                <PieSlices data={pieData} total={total}/>
              </svg>
              <div className={s.pieCenter}>
                <div className={s.pieTotal}>{fmt(total,sym)}</div>
                <div className={s.pieLbl}>TOTAL SPEND</div>
              </div>
            </div>
          </div>

          {/* Expandable category rows */}
          <div className={s.catList}>
            {byCat.map(([cat,amt],i)=>{
              const pct=total>0?Math.round(amt/total*100):0
              const color=PIE_CLR[i%PIE_CLR.length]
              const isOpen=expandCat===cat
              const catEntries=real.filter(e=>e.category===cat).sort((a,b)=>parseDate(b.date)-parseDate(a.date))
              return (
                <div key={cat}>
                  <button className={s.catRow+(isOpen?' '+s.catRowOpen:'')} onClick={()=>setExpandCat(isOpen?null:cat)}>
                    <div className={s.catBar} style={{background:color+'22'}}><span style={{fontSize:16}}>{'💰'}</span></div>
                    <span className={s.catName}>{cat}</span>
                    <span className={s.catPct}>{pct}%</span>
                    <span className={s.catAmt}>{fmt(amt,sym)}</span>
                    <span className={s.chev+(isOpen?' '+s.chevUp:'')}>›</span>
                  </button>
                  {isOpen&&(
                    <div className={s.catEntries}>
                      {catEntries.map(e=>(
                        <div key={e.id} className={s.catEntry}>
                          <div>
                            <div className={s.cePerson}>{e.person}</div>
                            <div className={s.ceDesc}>{fmtDt(e.date, true)}{e.description?' · '+e.description:''}</div>
                          </div>
                          <div className={s.ceAmt}>{fmt(e.amount,sym)}</div>
                        </div>
                      ))}
                      <div className={s.catTotal}>
                        <span>Total</span><span>{fmt(amt,sym)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Insights */}
      <section className={s.section}>
        <div className={s.secHdr}>Insights</div>
        <div className={s.insightGrid}>
          {[
            {icon:'📦',label:'Top Category',val:byCat[0]?byCat[0][0]:'—',sub:byCat[0]?fmt(byCat[0][1],sym):'',color:'#e8920a'},
            {icon:'📅',label:'Avg / Day',   val:fmt(total/Math.max(new Set(real.map(e=>e.date)).size,1),sym),sub:`${new Set(real.map(e=>e.date)).size} days`,color:'#3a6652'},
            {icon:'📋',label:'Entries',     val:real.length,sub:'approved',color:'#7c3aed'},
            {icon:'💸',label:'Advances',    val:fmt(advTotal,sym),sub:'hand loans',color:'#dc2626'},
          ].map(c=>(
            <div key={c.label} className={s.iCard}>
              <div className={s.iStripe} style={{background:c.color}}/>
              <div className={s.iIcon}>{c.icon}</div>
              <div className={s.iLabel}>{c.label}</div>
              <div className={s.iVal}>{c.val}</div>
              {c.sub&&<div className={s.iSub}>{c.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Running Balance */}
      {runningBalance.length>0&&(
        <section className={s.section}>
          <div className={s.secHdr}>
            <span>Running Balance</span>
            <span className={s.secHint}>cumulative by day</span>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{color:pColor(pCode(0))}}>{config.partners[0]}</th>
                  <th style={{color:pColor(pCode(1))}}>{config.partners[1]}</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {runningBalance.slice(-10).map(({date,t0,t1,diff})=>(
                  <tr key={date}>
                    <td className={s.tdDate}>{date}</td>
                    <td style={{color:pColor(pCode(0)),fontWeight:700}}>{fmt(t0,sym)}</td>
                    <td style={{color:pColor(pCode(1)),fontWeight:700}}>{fmt(t1,sym)}</td>
                    <td className={s.tdBal+(diff>0?' '+s.balPos:diff<0?' '+s.balNeg:'')}>
                      {diff===0?'✅':`${diff>0?config.partners[0]:config.partners[1]} + ${fmt(Math.abs(diff),sym)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {runningBalance.length>10&&<div className={s.tableNote}>Showing last 10 active days</div>}
          </div>
        </section>
      )}

      {/* By Day */}
      {byDay.length>0&&(
        <section className={s.section}>
          <div className={s.secHdr}>
            <span>By Day</span>
            <span className={s.secHint}>tap to open dashboard</span>
          </div>
          <div className={s.dayList}>
            {byDay.map(([date,dayEntries])=>{
              const dayTotal=dayEntries.reduce((t,e)=>t+(e.amount||0),0)
              const isOpen=expandDay===date
              return (
                <div key={date}>
                  <button className={s.dayRow+(isOpen?' '+s.dayRowOpen:'')} onClick={()=>setExpandDay(isOpen?null:date)}>
                    <div className={s.dayLeft}>
                      <div className={s.dayDate}>{fmtDt(date)}</div>
                      <div className={s.dayCount}>{dayEntries.length} entries</div>
                    </div>
                    <div className={s.dayAmt}>{fmt(dayTotal,sym)}</div>
                    <span className={s.chev+(isOpen?' '+s.chevUp:'')}>›</span>
                  </button>
                  {isOpen&&(
                    <div className={s.dayEntries}>
                      {dayEntries.sort((a,b)=>(b.amount||0)-(a.amount||0)).map(e=>(
                        <div key={e.id} className={s.dayEntry}>
                          <div>
                            <div className={s.dePerson}>{e.person}</div>
                            <div className={s.deDesc}>{e.category}{e.description?' · '+e.description:''}</div>
                          </div>
                          {config.isMulti&&<div className={s.dePart} style={{background:pBg(e.partner),color:pColor(e.partner)}}>{e.partner}</div>}
                          <div className={s.deAmt}>{fmt(e.amount,sym)}</div>
                        </div>
                      ))}
                      <div className={s.dayTotal}><span>Day total</span><span>{fmt(dayTotal,sym)}</span></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

function PieSlices({ data, total }) {
  const R=88, CX=100, CY=100, SW=24
  let ang=0
  const arc=(s,e,r,cx,cy)=>{
    if(e-s>=2*Math.PI) e=s+2*Math.PI-.001
    const x1=cx+r*Math.cos(s-Math.PI/2),y1=cy+r*Math.sin(s-Math.PI/2)
    const x2=cx+r*Math.cos(e-Math.PI/2),y2=cy+r*Math.sin(e-Math.PI/2)
    return `M${x1} ${y1} A${r} ${r} 0 ${e-s>Math.PI?1:0} 1 ${x2} ${y2}`
  }
  return data.map(d=>{
    const a=d.pct*2*Math.PI, s2=ang; ang+=a
    return <path key={d.n} d={arc(s2,ang,R,CX,CY)} fill="none" stroke={d.color} strokeWidth={SW}/>
  })
}
