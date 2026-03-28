import { useState } from 'react'
import ComposeModal from './ComposeModal'

const COLORS = ['#F5C842', '#E8472A', '#4a9eff', '#3ecf6e', '#c084fc', '#f97316']
function getColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}
function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

export default function ContactPanel({ contact, type, profile, onClose, onEdit }) {
  const [showCompose, setShowCompose] = useState(false)

  if (!contact) return null

  const name = contact.name || contact.instagram_handle || '??'
  const initials = name.replace('@', '').slice(0, 2).toUpperCase()
  const color = getColor(name)

  const isNetwork = type === 'network'
  const days = isNetwork ? daysSince(contact.last_spoken_to) : null

  return (
    <>
      <div className="overlay active" onClick={onClose} />
      <div className="detail-panel open">
        <div className="panel-header">
          <div className="panel-avatar" style={{ background: color }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{name}</div>
            {contact.instagram_handle && (
              <a href={`https://instagram.com/${contact.instagram_handle.replace('@','')}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#666', fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none' }}>@{contact.instagram_handle.replace('@','')}</a>
            )}
            {contact.occupation && (
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{contact.occupation}</div>
            )}
          </div>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="panel-body">
          {isNetwork && (
            <>
              <div className="panel-section">
                <div className="panel-section-title">Contact Info</div>
                <div className="info-grid">
                  {contact.phone && (
                    <div className="info-item">
                      <div className="info-key">Phone</div>
                      <div className="info-val">{contact.phone}</div>
                    </div>
                  )}
                  {contact.email && (
                    <div className="info-item">
                      <div className="info-key">Email</div>
                      <div className="info-val" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{contact.email}</div>
                    </div>
                  )}
                  {(contact.locations || []).length > 0 && (
                    <div className="info-item">
                      <div className="info-key">Location</div>
                      <div className="info-val">{(contact.locations || []).join(', ')}</div>
                    </div>
                  )}
                  {contact.how_met && (
                    <div className="info-item">
                      <div className="info-key">How Met</div>
                      <div className="info-val">{contact.how_met}</div>
                    </div>
                  )}
                  <div className="info-item">
                    <div className="info-key">Rel. Score</div>
                    <div className="info-val" style={{ color: (contact.relationship_score || 5) >= 7 ? '#3ecf6e' : (contact.relationship_score || 5) >= 4 ? '#F5C842' : '#E8472A' }}>
                      {contact.relationship_score || 5}/10
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-key">Last Contact</div>
                    <div className="info-val" style={{ color: days === null ? '#666' : days >= 90 ? '#E8472A' : days >= 30 ? '#F5C842' : '#3ecf6e' }}>
                      {days === null ? 'Never' : `${days}d ago`}
                    </div>
                  </div>
                </div>
              </div>

              {contact.skills_services && (
                <div className="panel-section">
                  <div className="panel-section-title">Skills & Services</div>
                  <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.5 }}>{contact.skills_services}</div>
                </div>
              )}

              {contact.potential_followup && (
                <div className="panel-section">
                  <div className="panel-section-title">Open Thread</div>
                  <div className="ai-suggestion">
                    <div className="ai-suggestion-label">Follow-Up Note</div>
                    <div className="ai-suggestion-text">{contact.potential_followup}</div>
                  </div>
                </div>
              )}

              {contact.notes && (
                <div className="panel-section">
                  <div className="panel-section-title">Notes</div>
                  <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.5 }}>{contact.notes}</div>
                </div>
              )}
            </>
          )}

          {!isNetwork && (
            <>
              <div className="panel-section">
                <div className="panel-section-title">Outreach Status</div>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-key">Responded</div>
                    <div className="info-val" style={{ color: contact.responded === true ? '#3ecf6e' : contact.responded === false ? '#E8472A' : '#666' }}>
                      {contact.responded === true ? 'Yes' : contact.responded === false ? 'No' : 'Pending'}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-key">Connected</div>
                    <div className="info-val" style={{ color: contact.connected === true ? '#3ecf6e' : contact.connected === false ? '#E8472A' : '#666' }}>
                      {contact.connected === true ? 'Yes' : contact.connected === false ? 'No' : 'Pending'}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-key">Opportunity</div>
                    <div className="info-val" style={{ color: contact.opportunity === true ? '#F5C842' : '#666' }}>
                      {contact.opportunity === true ? 'Yes' : '—'}
                    </div>
                  </div>
                  {contact.follower_count && (
                    <div className="info-item">
                      <div className="info-key">Followers</div>
                      <div className="info-val">{contact.follower_count.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {contact.message_sent && (
                <div className="panel-section">
                  <div className="panel-section-title">Message Sent</div>
                  <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.5, fontStyle: 'italic' }}>"{contact.message_sent}"</div>
                </div>
              )}

              {contact.response_received && (
                <div className="panel-section">
                  <div className="panel-section-title">Their Response</div>
                  <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.5, fontStyle: 'italic' }}>"{contact.response_received}"</div>
                  {contact.response_summary && (
                    <div className="ai-suggestion" style={{ marginTop: '8px' }}>
                      <div className="ai-suggestion-label">AI Summary</div>
                      <div className="ai-suggestion-text">{contact.response_summary}</div>
                    </div>
                  )}
                </div>
              )}

              {contact.follow_up_note && (
                <div className="panel-section">
                  <div className="panel-section-title">Follow-Up Note</div>
                  <div style={{ fontSize: '13px', color: '#4a9eff' }}>→ {contact.follow_up_note}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="panel-footer">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onEdit}>✎ Edit</button>
          <button className="btn btn-ai" style={{ flex: 1 }} onClick={() => setShowCompose(true)}>◆ Compose</button>
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          contact={contact}
          profile={profile}
          onClose={() => setShowCompose(false)}
        />
      )}
    </>
  )
}
