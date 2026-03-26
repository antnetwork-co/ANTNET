import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GAPS = [
  { key:'legal', label:'Legal / Attorney', icon:'⚖️', skills:['legal','attorney','lawyer','law'], desc:'Critical for contracts, IP, or incorporation.' },
  { key:'design', label:'Designer / Creative', icon:'🎨', skills:['design','designer','creative','brand','ux','ui'], desc:'Needed for branding, product, and visual work.' },
  { key:'investor', label:'Investor / Capital', icon:'💰', skills:['investor','investing','capital','vc','angel','fund'], desc:'Access to funding and financial advice.' },
  { key:'developer', label:'Developer / Engineer', icon:'💻', skills:['developer','engineer','coding','software','tech','programmer'], desc:'Technical execution and product building.' },
  { key:'marketing', label:'Marketing / Growth', icon:'📣', skills:['marketing','growth','seo','ads','paid media','content'], desc:'Customer acquisition and brand building.' },
  { key:'sales', label:'Sales / Lead Gen', icon:'📈', skills:['sales','lead gen','business development','outreach'], desc:'Revenue generation and client acquisition.' },
  { key:'pr', label:'PR / Media', icon:'📰', skills:['pr','media','press','journalist','publicist'], desc:'Press coverage and public visibility.' },
  { key:'photo', label:'Photo / Video', icon:'📸', skills:['photo','photographer','video','videographer'], desc:'Visual content production.' },
  { key:'finance', label:'Finance / Accounting', icon:'🧾', skills:['finance','accounting','cpa','bookkeeping','taxes'], desc:'Financial management and tax strategy.' },
]

export default function GapAnalysis() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('network_contacts').select('skills_services, occupation')
      .then(({ data }) => setContacts(data || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false))
  }, [])

  function getCount(keywords) {
    return contacts.filter(c => {
      const text = `${c.skills_services||''} ${c.occupation||''}`.toLowerCase()
      return keywords.some(k => text.includes(k))
    }).length
  }

  function getStatus(count) {
    if (count === 0) return { label:'MISSING', color:'#E8472A', bg:'rgba(232,71,42,0.08)', border:'rgba(232,71,42,0.25)' }
    if (count === 1) return { label:'WEAK', color:'#F5C842', bg:'rgba(245,200,66,0.06)', border:'rgba(245,200,66,0.2)' }
    if (count <= 3) return { label:'GROWING', color:'#4a9eff', bg:'rgba(74,158,255,0.06)', border:'rgba(74,158,255,0.2)' }
    return { label:'STRONG', color:'#3ecf6e', bg:'rgba(62,207,110,0.06)', border:'rgba(62,207,110,0.2)' }
  }

  const gaps = GAPS.map(g => ({ ...g, count:getCount(g.skills), status:getStatus(getCount(g.skills)) }))

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', padding:'16px 28px', borderBottom:'1px solid #2a2a2a', background:'#0a0a0a', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'2px' }}>GAP <span style={{color:'#F5C842'}}>ANALYSIS</span></div>
      </div>

      <div style={{ padding:'24px 28px', flex:1 }}>
        {loading ? (
          <div style={{color:'#666',textAlign:'center',padding:'40px',fontFamily:"'JetBrains Mono',monospace",fontSize:'12px'}}>Analyzing your network...</div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
              {[
                { label:'Missing', value:gaps.filter(g=>g.status.label==='MISSING').length, color:'#E8472A' },
                { label:'Weak', value:gaps.filter(g=>g.status.label==='WEAK').length, color:'#F5C842' },
                { label:'Growing', value:gaps.filter(g=>g.status.label==='GROWING').length, color:'#4a9eff' },
                { label:'Strong', value:gaps.filter(g=>g.status.label==='STRONG').length, color:'#3ecf6e' },
              ].map(s => (
                <div key={s.label} style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'16px 20px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'2px', background:s.color }} />
                  <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#666', fontFamily:"'JetBrains Mono',monospace", marginBottom:'8px' }}>{s.label}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', color:s.color, lineHeight:1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
              {gaps.map(g => (
                <div key={g.key} style={{ background:g.status.bg, border:`1px solid ${g.status.border}`, borderRadius:'10px', padding:'16px', transition:'all 0.15s' }}>
                  <div style={{fontSize:'22px',marginBottom:'8px'}}>{g.icon}</div>
                  <div style={{fontSize:'13px',fontWeight:700,marginBottom:'4px'}}>{g.label}</div>
                  <div style={{fontSize:'11px',color:'#666',lineHeight:1.4,marginBottom:'10px'}}>{g.desc}</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{background:g.status.bg,border:`1px solid ${g.status.border}`,color:g.status.color,padding:'3px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                      {g.status.label}
                    </span>
                    <span style={{fontSize:'11px',color:'#666',fontFamily:"'JetBrains Mono',monospace"}}>
                      {g.count} contact{g.count!==1?'s':''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}