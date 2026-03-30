import { useState, useEffect } from 'react'
import { draftMessage } from '../lib/claude'
import { supabase } from '../lib/supabase'

const PLATFORMS = ['DM / Text', 'Email']

export default function ComposeModal({ contact, profile, onClose, onSent }) {
  const [platform, setPlatform] = useState('DM / Text')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasEmDash, setHasEmDash] = useState(false)
  const [drafted, setDrafted] = useState(false)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    generateDraft()
  }, [platform])

  async function generateDraft() {
    setLoading(true)
    try {
      const text = await draftMessage({
        contact,
        lastMessage: contact.message_sent || contact.notes,
        platform,
        whatIDo: profile?.what_i_do
      })
      setMessage(text)
      setDrafted(true)
      checkEmDash(text)
    } catch {
      setMessage('')
    }
    setLoading(false)
  }

  function checkEmDash(text) {
    setHasEmDash(/—| - /.test(text))
  }

  function fixEmDash() {
    setMessage(m => m.replace(/—/g, ',').replace(/ - /g, ', '))
    setHasEmDash(false)
  }

  function handleChange(e) {
    setMessage(e.target.value)
    checkEmDash(e.target.value)
  }

  async function handleCopySend() {
    await navigator.clipboard.writeText(message)
    setShowToast(true)
  }

  async function confirmSent(wasSent) {
    if (wasSent) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('message_history').insert({
        user_id: user.id,
        network_contact_id: contact.how_met !== undefined ? contact.id : null,
        outreach_contact_id: contact.how_met === undefined ? contact.id : null,
        direction: 'sent',
        content: message,
        platform: platform.toLowerCase(),
        sent_at: new Date().toISOString(),
        is_ai_drafted: drafted,
        was_edited: message !== message
      })
      if (onSent) onSent()
    }
    onClose()
  }

  const avatarColor = getColor(contact.name || contact.instagram_handle)
  const avatarInitials = (contact.name || contact.instagram_handle || '??').replace('@', '').slice(0, 2).toUpperCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compose-modal" onClick={e => e.stopPropagation()}>
        <div className="compose-top">
          <div className="compose-avatar" style={{ background: avatarColor }}>{avatarInitials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{contact.name || contact.instagram_handle}</div>
            <div style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>
              {contact.occupation || contact.instagram_handle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {PLATFORMS.map(p => (
              <button
                key={p}
                className={`platform-btn${platform === p ? ' sel' : ''}`}
                onClick={() => setPlatform(p)}
              >{p}</button>
            ))}
          </div>
          <button
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '18px', padding: '4px 8px' }}
            onClick={onClose}
          >✕</button>
        </div>

        <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', color: '#607090' }}>
              <div className="ai-dot" />
              <span style={{ fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>Drafting with Claude...</span>
            </div>
          ) : (
            <>
              {drafted && (
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a9eff', fontFamily: "'JetBrains Mono', monospace', display: 'flex', alignItems: 'center', gap: '6px'" }}>
                  ◆ AI Draft — edit freely
                </div>
              )}
              <textarea
                className="message-editor"
                style={{ flex: 1 }}
                value={message}
                onChange={handleChange}
                placeholder="Write a message..."
                autoFocus={!loading}
              />
              <div className={`emdash-warning${hasEmDash ? ' visible' : ''}`}>
                ⚠️ Em dash detected — sounds AI-written.
                <span className="fix-btn" onClick={fixEmDash}>Fix it</span>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #2a2a2a', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={generateDraft} disabled={loading}>↺ Regenerate</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleCopySend} disabled={loading || !message.trim()}>
            Copy & Send →
          </button>
        </div>
      </div>

      {showToast && (
        <div className="log-toast visible" onClick={e => e.stopPropagation()}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Copied! Did you send it?</div>
            <div style={{ fontSize: '11px', color: '#666' }}>We'll log it to message history if you did.</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => confirmSent(false)}>No</button>
          <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => confirmSent(true)}>Yes, Sent</button>
        </div>
      )}
    </div>
  )
}

const COLORS = ['#F5C842', '#E8472A', '#4a9eff', '#3ecf6e', '#c084fc', '#f97316']
function getColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}
