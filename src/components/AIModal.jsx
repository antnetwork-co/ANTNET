import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { askNetwork } from '../lib/claude'
import { getColor } from '../lib/utils'

const ACTIONS = [
  { key: 'ask', icon: '◆', title: 'Ask My Network', desc: 'Who do I know in X? Who should I reconnect with?' },
  { key: 'gaps', icon: '📊', title: 'Analyze My Network Coverage', desc: 'AI breaks down what your network is missing and why it matters.' },
  { key: 'similar', icon: '🔍', title: 'Find Similar People', desc: 'Describe who you want to meet — AI finds real Instagram profiles.' },
  { key: 'strategy', icon: '📈', title: 'Outreach Strategy', desc: 'Analyze what messages and contact types are getting the best results.' },
  { key: 'events', icon: '🗓️', title: 'Find Events', desc: 'Get AI recommendations on what events to attend based on your gaps and goals.' },
]

export default function AIModal({ profile, initialAction, onClose }) {
  const startAction = initialAction ? ACTIONS.find(a => a.key === initialAction) : null
  const [view, setView] = useState(startAction ? 'ask' : 'menu')
  const [activeAction, setActiveAction] = useState(startAction)
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState([])
  const [outreach, setOutreach] = useState([])
  // Find Similar People state
  const [profiles, setProfiles] = useState([])
  const [hashtags, setHashtags] = useState([])
  const [addedHandles, setAddedHandles] = useState(new Set())
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.from('network_contacts').select('*').then(({ data }) => setContacts(data || []))
    supabase.from('outreach_contacts').select('*').then(({ data }) => setOutreach(data || []))
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id))
  }, [])

  async function handleAction(action) {
    setActiveAction(action)
    if (action.key === 'gaps') {
      setView('result')
      setLoading(true)
      const res = await askNetwork({
        question: 'What are the most critical gaps in my network? Be specific about what categories are missing and why they matter for my goals.',
        contacts,
        outreachContacts: outreach,
        whatIDo: profile?.what_i_do
      })
      setResult(res)
      setLoading(false)
    } else if (action.key === 'strategy') {
      setView('result')
      setLoading(true)
      const res = await askNetwork({
        question: 'Analyze my outreach history. What contact types respond best? What patterns lead to connections vs. dead ends? Give me 3 specific actionable improvements.',
        contacts,
        outreachContacts: outreach,
        whatIDo: profile?.what_i_do
      })
      setResult(res)
      setLoading(false)
    } else {
      setView('ask')
    }
  }

  async function handleSubmit() {
    if (!input.trim()) return
    if (activeAction?.key === 'similar') {
      setView('profiles')
      setLoading(true)
      setProfiles([])
      setHashtags([])
      try {
        const res = await fetch(`/.netlify/functions/find-instagram-profiles?q=${encodeURIComponent(input)}`)
        const data = await res.json()
        setProfiles(data.profiles || [])
        setHashtags(data.hashtags || [])
      } catch {
        setProfiles([])
      }
      setLoading(false)
    } else {
      setView('result')
      setLoading(true)
      const res = await askNetwork({ question: input, contacts, outreachContacts: outreach, whatIDo: profile?.what_i_do })
      setResult(res)
      setLoading(false)
    }
  }

  async function addToOutreach(p) {
    if (!userId) return
    const handle = p.handle.replace('@', '')
    await supabase.from('outreach_contacts').insert({
      user_id: userId,
      instagram_handle: handle,
      name: p.name !== handle ? p.name : '',
      occupation: '',
      follower_count: p.followers || null,
      notes: p.bio ? p.bio.slice(0, 200) : '',
      status: 'not_contacted',
      priority: 'medium',
    })
    setAddedHandles(prev => new Set([...prev, handle]))
  }

  function goBack() {
    setView('menu')
    setResult('')
    setInput('')
    setProfiles([])
    setHashtags([])
    setAddedHandles(new Set())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-modal-top">
          <div>
            <div className="ai-modal-title">◆ AI ASSISTANT</div>
            <div className="ai-modal-sub">Powered by Claude · Your network as context</div>
          </div>
          <button
            style={{ background: 'none', border: 'none', color: '#607090', cursor: 'pointer', fontSize: '18px', padding: '4px 8px' }}
            onClick={onClose}
          >✕</button>
        </div>

        {view === 'menu' && (
          <div className="action-grid">
            {ACTIONS.map(a => (
              <div key={a.key} className="action-card" onClick={() => handleAction(a)}>
                <div className="action-card-icon">{a.icon}</div>
                <div className="action-card-title">{a.title}</div>
                <div className="action-card-desc">{a.desc}</div>
              </div>
            ))}
          </div>
        )}

        {view === 'ask' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>{activeAction?.title}</div>
            <textarea
              className="input"
              style={{ minHeight: '100px', resize: 'none', width: '100%' }}
              placeholder={
                activeAction?.key === 'similar' ? 'e.g. Someone who does social media marketing for small businesses' :
                activeAction?.key === 'events' ? 'e.g. What networking events in Tampa should I be going to?' :
                'e.g. Who in my network does marketing in Tampa?'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              autoFocus
            />
            <div className="ai-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
              <button className="btn btn-ghost" onClick={() => setView('menu')}>Back</button>
              <button className="btn btn-ai" onClick={handleSubmit} disabled={!input.trim()}>◆ Search</button>
            </div>
          </div>
        )}

        {view === 'profiles' && (
          <div style={{ padding: '20px 24px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
                <div className="ai-dot" />
                <span style={{ color: '#607090', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                  Searching Instagram profiles...
                </span>
              </div>
            ) : profiles.length === 0 ? (
              <div style={{ padding: '20px 0', color: '#666', fontSize: '13px' }}>
                No profiles found. Try a more specific description.
              </div>
            ) : (
              <>
                {hashtags.length > 0 && (
                  <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {hashtags.map(h => (
                      <span key={h} style={{
                        background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)',
                        borderRadius: '20px', padding: '3px 10px', fontSize: '11px',
                        color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace"
                      }}>#{h}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                  {profiles.map(p => {
                    const handle = p.handle.replace('@', '')
                    const added = addedHandles.has(handle)
                    const avatarColor = getColor(handle)
                    const initials = (p.name || handle).slice(0, 2).toUpperCase()
                    return (
                      <div key={handle} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '12px 14px'
                      }}>
                        {p.profile_pic ? (
                          <img src={p.profile_pic} alt={handle}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                          />
                        ) : null}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', background: avatarColor,
                          display: p.profile_pic ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 700, color: '#000', flexShrink: 0
                        }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                            {p.name && p.name !== handle ? p.name : `@${handle}`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace" }}>@{handle}</div>
                          {p.followers && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {p.followers.toLocaleString()} followers
                            </div>
                          )}
                          {p.bio && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', lineHeight: 1.4 }}>
                              {p.bio.slice(0, 80)}{p.bio.length > 80 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <a href={p.profile_url} target="_blank" rel="noreferrer"
                            className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 10px', textAlign: 'center' }}>
                            View →
                          </a>
                          <button
                            className={`btn ${added ? 'btn-ghost' : 'btn-gold'}`}
                            style={{ fontSize: '11px', padding: '5px 10px' }}
                            onClick={() => !added && addToOutreach(p)}
                            disabled={added}
                          >{added ? '✓ Added' : '+ Outreach'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            <div className="ai-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
              <button className="btn btn-ghost" onClick={goBack}>← Back</button>
              {!loading && (
                <button className="btn btn-ghost" onClick={handleSubmit}>↺ Search Again</button>
              )}
            </div>
          </div>
        )}

        {view === 'result' && (
          <div style={{ padding: '20px 24px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
                <div className="ai-dot" />
                <span style={{ color: '#607090', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>Claude is thinking...</span>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, #0a1628, #0d1f3c)',
                border: '1px solid #1e3a5f', borderRadius: '10px', padding: '16px 18px',
                fontSize: '13.5px', color: '#c8deff', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto'
              }}>
                {result}
              </div>
            )}
            <div className="ai-modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
              <button className="btn btn-ghost" onClick={goBack}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
