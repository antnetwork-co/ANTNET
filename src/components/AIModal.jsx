import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { askNetwork, findSimilar } from '../lib/claude'

const ACTIONS = [
  { key: 'ask', icon: '◆', title: 'Ask My Network', desc: 'Who do I know in X? Who should I reconnect with?' },
  { key: 'gaps', icon: '📊', title: 'Analyze My Network Coverage', desc: 'AI breaks down what your network is missing and why it matters.' },
  { key: 'similar', icon: '🔍', title: 'Find Similar People', desc: 'Describe a contact type — get Instagram search strategies.' },
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

  useEffect(() => {
    supabase.from('network_contacts').select('*').then(({ data }) => setContacts(data || []))
    supabase.from('outreach_contacts').select('*').then(({ data }) => setOutreach(data || []))
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
    setView('result')
    setLoading(true)
    let res
    if (activeAction.key === 'similar') {
      res = await findSimilar(input)
    } else {
      res = await askNetwork({ question: input, contacts, outreachContacts: outreach, whatIDo: profile?.what_i_do })
    }
    setResult(res)
    setLoading(false)
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
                activeAction?.key === 'similar' ? 'e.g. Real estate investor in Austin who does short-term rentals' :
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
              <button className="btn btn-ai" onClick={handleSubmit} disabled={!input.trim()}>◆ Ask Claude</button>
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
              <button className="btn btn-ghost" onClick={() => { setView('menu'); setResult(''); setInput('') }}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
