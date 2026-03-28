import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeGaps } from '../lib/claude'

const STATUS_STYLES = {
  MISSING: { color:'#E8472A', bg:'rgba(232,71,42,0.08)', border:'rgba(232,71,42,0.25)' },
  WEAK:    { color:'#F5C842', bg:'rgba(245,200,66,0.06)', border:'rgba(245,200,66,0.2)' },
  GROWING: { color:'#4a9eff', bg:'rgba(74,158,255,0.06)', border:'rgba(74,158,255,0.2)' },
  STRONG:  { color:'#3ecf6e', bg:'rgba(62,207,110,0.06)', border:'rgba(62,207,110,0.2)' },
}

const ICONS = {
  'Legal':     '⚖️', 'Attorney': '⚖️',
  'Designer':  '🎨', 'Creative': '🎨',
  'Investor':  '💰', 'Capital':  '💰',
  'Developer': '💻', 'Engineer': '💻',
  'Marketing': '📣', 'Growth':   '📣',
  'Sales':     '📈', 'Lead Gen': '📈',
  'PR':        '📰', 'Media':    '📰',
  'Photo':     '📸', 'Video':    '📸',
  'Finance':   '🧾', 'Accounting':'🧾',
}

function getIcon(category) {
  const key = Object.keys(ICONS).find(k => category.toLowerCase().includes(k.toLowerCase()))
  return key ? ICONS[key] : '🔗'
}

export default function GapAnalysis() {
  const { profile, userId } = useOutletContext()
  const [gaps, setGaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => { fetchAndAnalyze() }, [])

  async function fetchAndAnalyze(forceRefresh = false) {
    setLoading(true)
    setError(false)
    setFromCache(false)
    try {
      // Fetch contacts — this is the critical query, fail fast if it errors
      const { data: contacts } = await supabase.from('network_contacts').select('name, occupation, skills_services')
      const contactList = contacts || []
      setLoading(false)

      // Check cache separately — best-effort, don't let it block or crash
      if (!forceRefresh) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('ai_gaps, ai_gaps_contacts_count')
            .eq('id', userId)
            .single()
          if (
            profileData?.ai_gaps &&
            profileData.ai_gaps_contacts_count === contactList.length &&
            contactList.length > 0
          ) {
            setGaps(profileData.ai_gaps.map(g => ({ ...g, style: STATUS_STYLES[g.status] || STATUS_STYLES.MISSING })))
            setFromCache(true)
            return
          }
        } catch {}
      }

      if (!profile?.what_i_do || contactList.length === 0) {
        setGaps(basicAnalysis(contactList))
        return
      }

      setAiLoading(true)
      const aiGaps = await analyzeGaps({ whatIDo: profile.what_i_do, contacts: contactList })

      if (aiGaps && aiGaps.length > 0) {
        const shaped = aiGaps.map(g => ({ ...g, style: STATUS_STYLES[g.status] || STATUS_STYLES.MISSING }))
        setGaps(shaped)
        // Save cache in background — don't await
        supabase.from('profiles').update({
          ai_gaps: aiGaps,
          ai_gaps_contacts_count: contactList.length
        }).eq('id', userId).then(() => {}).catch(() => {})
      } else {
        setGaps(basicAnalysis(contactList))
      }
    } catch {
      setGaps([])
      setError(true)
    } finally {
      setLoading(false)
      setAiLoading(false)
    }
  }

  function basicAnalysis(contacts) {
    const BASIC = [
      { category:'Legal / Attorney', skills:['legal','attorney','lawyer'] },
      { category:'Designer / Creative', skills:['design','designer','creative','brand'] },
      { category:'Investor / Capital', skills:['investor','capital','vc','angel'] },
      { category:'Developer / Engineer', skills:['developer','engineer','software','tech'] },
      { category:'Marketing / Growth', skills:['marketing','growth','seo','ads'] },
      { category:'Sales / Lead Gen', skills:['sales','lead gen','business development'] },
      { category:'PR / Media', skills:['pr','media','press','publicist'] },
      { category:'Photo / Video', skills:['photo','photographer','video','videographer'] },
      { category:'Finance / Accounting', skills:['finance','accounting','cpa','taxes'] },
    ]
    return BASIC.map(g => {
      const count = contacts.filter(c => {
        const text = `${c.skills_services||''} ${c.occupation||''}`.toLowerCase()
        return g.skills.some(k => text.includes(k))
      }).length
      const status = count === 0 ? 'MISSING' : count === 1 ? 'WEAK' : count <= 3 ? 'GROWING' : 'STRONG'
      return { category: g.category, count, status, reason: '', style: STATUS_STYLES[status] }
    })
  }

  const summary = {
    MISSING: gaps.filter(g => g.status === 'MISSING').length,
    WEAK: gaps.filter(g => g.status === 'WEAK').length,
    GROWING: gaps.filter(g => g.status === 'GROWING').length,
    STRONG: gaps.filter(g => g.status === 'STRONG').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 28px', borderBottom:'1px solid #2a2a2a', background:'#0a0a0a', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'2px' }}>GAP <span style={{color:'#F5C842'}}>ANALYSIS</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {profile?.what_i_do && (
            <div style={{ fontSize:'11px', color:'#666', fontFamily:"'JetBrains Mono',monospace" }}>
              ◆ Calibrated for: <span style={{ color:'#F5C842' }}>{profile.what_i_do}</span>
              {fromCache && <span style={{ color:'#444', marginLeft:'8px' }}>(cached)</span>}
            </div>
          )}
          {!loading && !aiLoading && (
            <button className="btn btn-ghost" style={{ fontSize:'11px', padding:'4px 10px' }} onClick={() => fetchAndAnalyze(true)}>
              ↺ Refresh
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:'24px 28px', flex:1 }}>
        {loading ? (
          <div style={{color:'#666',textAlign:'center',padding:'40px',fontFamily:"'JetBrains Mono',monospace",fontSize:'12px'}}>Loading your network...</div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">Connection timed out</div>
            <div className="empty-state-sub">Supabase took too long to respond</div>
            <button className="btn btn-gold" onClick={fetchAndAnalyze}>↺ Retry</button>
          </div>
        ) : aiLoading ? (
          <div style={{textAlign:'center',padding:'40px'}}>
            <div style={{color:'#4a9eff',fontFamily:"'JetBrains Mono',monospace",fontSize:'12px',marginBottom:'8px'}}>◆ AI analyzing your network gaps...</div>
            <div style={{color:'#444',fontSize:'11px',fontFamily:"'JetBrains Mono',monospace"}}>Personalizing based on "{profile?.what_i_do}"</div>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
              {[
                { label:'Missing', value: summary.MISSING, color:'#E8472A' },
                { label:'Weak',    value: summary.WEAK,    color:'#F5C842' },
                { label:'Growing', value: summary.GROWING, color:'#4a9eff' },
                { label:'Strong',  value: summary.STRONG,  color:'#3ecf6e' },
              ].map(s => (
                <div key={s.label} style={{ background:'#111', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'16px 20px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'2px', background:s.color }} />
                  <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#666', fontFamily:"'JetBrains Mono',monospace", marginBottom:'8px' }}>{s.label}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'32px', color:s.color, lineHeight:1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {gaps.length === 0 ? (
              <div style={{color:'#444',textAlign:'center',padding:'40px',fontFamily:"'JetBrains Mono',monospace",fontSize:'12px'}}>Add contacts to your network to see gap analysis.</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {gaps.map((g, i) => {
                  const style = g.style || STATUS_STYLES.MISSING
                  return (
                    <div key={i} style={{ background:style.bg, border:`1px solid ${style.border}`, borderRadius:'10px', padding:'16px', transition:'all 0.15s' }}>
                      <div style={{fontSize:'22px',marginBottom:'8px'}}>{getIcon(g.category)}</div>
                      <div style={{fontSize:'13px',fontWeight:700,marginBottom:'4px'}}>{g.category}</div>
                      {g.reason && <div style={{fontSize:'11px',color:'#666',lineHeight:1.4,marginBottom:'10px'}}>{g.reason}</div>}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'8px'}}>
                        <span style={{background:style.bg,border:`1px solid ${style.border}`,color:style.color,padding:'3px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                          {g.status}
                        </span>
                        <span style={{fontSize:'11px',color:'#666',fontFamily:"'JetBrains Mono',monospace"}}>
                          {g.count} contact{g.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
