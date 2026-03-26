import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { draftMessage } from '../lib/claude'
import ComposeModal from '../components/ComposeModal'

const COLORS = ['#F5C842', '#E8472A', '#4a9eff', '#3ecf6e', '#c084fc']
function getColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}
function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

export default function FollowUps() {
  const { profile, openAI } = useOutletContext()
  const [networkFading, setNetworkFading] = useState([])
  const [outreachPending, setOutreachPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})
  const [drafting, setDrafting] = useState({})
  const [composeContact, setComposeContact] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [{ data: network }, { data: outreach }] = await Promise.all([
        supabase.from('network_contacts').select('*').not('last_spoken_to', 'is', null).order('last_spoken_to', { ascending: true }),
        supabase.from('outreach_contacts').select('*').eq('responded', true).is('connected', null).order('created_at', { ascending: true })
      ])
      setNetworkFading((network || []).filter(c => daysSince(c.last_spoken_to) >= 30))
      setOutreachPending(outreach || [])
    } catch {
      setNetworkFading([])
      setOutreachPending([])
    } finally {
      setLoading(false)
    }
  }

  async function markContacted(id) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('network_contacts').update({ last_spoken_to: today }).eq('id', id)
    fetchData()
  }

  async function generateDraft(contact) {
    setDrafting(d => ({ ...d, [contact.id]: true }))
    try {
      const text = await draftMessage({
        contact,
        lastMessage: contact.notes,
        whatIDo: profile?.what_i_do
      })
      setDrafts(d => ({ ...d, [contact.id]: text }))
    } catch {
      setDrafts(d => ({ ...d, [contact.id]: 'Could not generate draft.' }))
    }
    setDrafting(d => ({ ...d, [contact.id]: false }))
  }

  const urgent = networkFading.filter(c => daysSince(c.last_spoken_to) >= 90)
  const soon = networkFading.filter(c => { const d = daysSince(c.last_spoken_to); return d >= 30 && d < 90 })
  const totalUrgent = urgent.length + outreachPending.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">FOLLOW-UP <span>QUEUE</span></div>
        <div className="topbar-actions">
          <button className="btn btn-ai" onClick={openAI}>◆ Batch Draft Messages</button>
          {totalUrgent > 0 && (
            <div style={{ background: '#E8472A', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
              {totalUrgent} urgent
            </div>
          )}
        </div>
      </div>

      <div className="content">
        <div className="ai-bar" onClick={openAI}>
          <div className="ai-dot" />
          <div className="ai-text">
            <strong>{totalUrgent > 0 ? `${totalUrgent} follow-ups flagged.` : 'All caught up!'}</strong>
            {' '}{urgent.length > 0 ? `${urgent.length} are urgent (90+ days).` : ''} Click to batch draft with AI.
          </div>
          <div className="ai-action">Review Drafts →</div>
        </div>

        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '40px', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px' }}>Loading...</div>
        ) : (
          <>
            {urgent.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#E8472A', fontFamily: "'JetBrains Mono',monospace", marginBottom: '12px' }}>
                  🔴 Urgent — 90+ days no contact
                </div>
                {urgent.map(c => (
                  <FollowUpCard
                    key={c.id}
                    contact={c}
                    urgency="urgent"
                    draft={drafts[c.id]}
                    drafting={drafting[c.id]}
                    onDraft={() => generateDraft(c)}
                    onContacted={() => markContacted(c.id)}
                    onCompose={() => setComposeContact(c)}
                  />
                ))}
              </div>
            )}

            {soon.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#F5C842', fontFamily: "'JetBrains Mono',monospace", marginBottom: '12px' }}>
                  🟡 Follow Up Soon — 30-90 days
                </div>
                {soon.map(c => (
                  <FollowUpCard
                    key={c.id}
                    contact={c}
                    urgency="soon"
                    draft={drafts[c.id]}
                    drafting={drafting[c.id]}
                    onDraft={() => generateDraft(c)}
                    onContacted={() => markContacted(c.id)}
                    onCompose={() => setComposeContact(c)}
                  />
                ))}
              </div>
            )}

            {outreachPending.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#4a9eff', fontFamily: "'JetBrains Mono',monospace", marginBottom: '12px' }}>
                  💬 Responded — Follow up to connect
                </div>
                {outreachPending.map(c => (
                  <div key={c.id} style={{ background: '#111', border: '1px solid rgba(74,158,255,.2)', borderLeft: '3px solid #4a9eff', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: getColor(c.name || c.instagram_handle), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', color: '#0a0a0a', flexShrink: 0 }}>
                      {(c.name || c.instagram_handle || '??').replace('@', '').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.name || c.instagram_handle}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{c.occupation || ''}</div>
                      {c.response_received && <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic', marginTop: '4px' }}>"{c.response_received.slice(0, 80)}..."</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(62,207,110,.12)', color: '#3ecf6e', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>Responded</span>
                      <button className="btn btn-ai" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setComposeContact(c)}>◆ Reply</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {urgent.length === 0 && soon.length === 0 && outreachPending.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">You're all caught up</div>
                <div className="empty-state-sub">No follow-ups needed right now.</div>
              </div>
            )}
          </>
        )}
      </div>

      {composeContact && (
        <ComposeModal
          contact={composeContact}
          profile={profile}
          onClose={() => setComposeContact(null)}
        />
      )}
    </div>
  )
}

function FollowUpCard({ contact, urgency, draft, drafting, onDraft, onContacted, onCompose }) {
  const days = daysSince(contact.last_spoken_to)
  const color = urgency === 'urgent' ? '#E8472A' : '#F5C842'
  const COLORS = ['#F5C842', '#E8472A', '#4a9eff', '#3ecf6e', '#c084fc']
  function getColor(str) { let h = 0; for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length] }
  function daysSince(d) { if (!d) return null; return Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24)) }

  return (
    <div style={{ background: '#111', border: `1px solid ${urgency === 'urgent' ? 'rgba(232,71,42,.2)' : 'rgba(245,200,66,.2)'}`, borderLeft: `3px solid ${color}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: getColor(contact.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', color: '#0a0a0a', flexShrink: 0 }}>
          {(contact.name || '??').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{contact.name}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{contact.occupation || contact.skills_services || ''}</div>
          {contact.potential_followup && <div style={{ fontSize: '12px', color: '#4a9eff', marginTop: '4px' }}>→ {contact.potential_followup}</div>}

          {draft && (
            <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', fontSize: '12px', color: '#a0c4ff' }}>
              ◆ "{draft}"
            </div>
          )}
          {!draft && (
            <button className="btn btn-ai" style={{ marginTop: '8px', padding: '5px 12px', fontSize: '11px' }} onClick={onDraft} disabled={drafting}>
              {drafting ? '◆ Drafting...' : '◆ Draft Message'}
            </button>
          )}
        </div>
        <div style={{ textAlign: 'right', marginLeft: '8px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '28px', color, lineHeight: 1 }}>{days}</div>
          <div style={{ fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono',monospace" }}>DAYS AGO</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
        {draft && <button className="btn btn-ai" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={onCompose}>◆ Open Compose</button>}
        <button className="btn btn-gold" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onContacted}>✓ Contacted</button>
      </div>
    </div>
  )
}
