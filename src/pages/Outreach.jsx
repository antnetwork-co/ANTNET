import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ContactPanel from '../components/ContactPanel'
import ComposeModal from '../components/ComposeModal'

const COLORS = ['#F5C842', '#E8472A', '#4a9eff', '#3ecf6e', '#c084fc', '#f97316']
function getColor(str) {
  let hash = 0
  for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}
function initials(name, handle) {
  return (name || handle || '??').replace('@', '').slice(0, 2).toUpperCase()
}

export default function Outreach() {
  const { profile, userId, openAI } = useOutletContext()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [panelContact, setPanelContact] = useState(null)
  const [composeContact, setComposeContact] = useState(null)
  const [form, setForm] = useState(defaultForm())
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [networkForm, setNetworkForm] = useState(defaultNetworkForm())

  function defaultNetworkForm() {
    return {
      name: '', instagram_handle: '', phone: '', email: '', occupation: '',
      skills_services: '', how_met: '', locations: '', last_spoken_to: '',
      potential_followup: '', relationship_score: 5.0, notes: ''
    }
  }

  function openAddToNetwork(c) {
    setNetworkForm({
      name: c.name || '',
      instagram_handle: c.instagram_handle || '',
      phone: '',
      email: '',
      occupation: c.occupation || '',
      skills_services: '',
      how_met: 'Outreach',
      locations: '',
      last_spoken_to: '',
      potential_followup: c.follow_up_note || '',
      relationship_score: 5.0,
      notes: c.message_sent ? `Outreach: ${c.message_sent}` : ''
    })
    setShowNetworkModal(true)
  }

  async function saveToNetwork() {
    if (!userId) { alert('Session error — please refresh and sign in again.'); return }
    const payload = {
      ...networkForm,
      user_id: userId,
      locations: networkForm.locations ? networkForm.locations.split(',').map(l => l.trim()) : [],
      relationship_score: parseFloat(networkForm.relationship_score) || 5.0,
      last_spoken_to: networkForm.last_spoken_to || null
    }
    const { error } = await supabase.from('network_contacts').insert(payload)
    if (error) { alert('Save failed: ' + error.message); return }
    setShowNetworkModal(false)
    setNetworkForm(defaultNetworkForm())
  }

  function defaultForm() {
    return {
      instagram_handle: '', name: '', occupation: '', follower_count: '',
      message_sent: '', response_received: '', responded: null,
      connected: null, opportunity: null, follow_up_note: '', platform: 'instagram'
    }
  }

  useEffect(() => { fetchContacts() }, [])

  async function fetchContacts() {
    setLoading(true)
    setError(false)
    try {
      const { data, error } = await supabase.from('outreach_contacts').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setContacts(data || [])
    } catch {
      setContacts([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function saveContact() {
    if (!userId) { alert('Session error — please refresh and sign in again.'); return }
    const payload = { ...form, user_id: userId, follower_count: form.follower_count ? parseInt(form.follower_count) : null }
    const { error } = selected
      ? await supabase.from('outreach_contacts').update(payload).eq('id', selected.id)
      : await supabase.from('outreach_contacts').insert(payload)
    if (error) { alert('Save failed: ' + error.message); return }
    setShowModal(false); setSelected(null); setForm(defaultForm()); fetchContacts()
  }

  async function deleteContact(id) {
    await supabase.from('outreach_contacts').delete().eq('id', id)
    fetchContacts()
  }

  function openEdit(c) {
    setSelected(c)
    setForm({
      instagram_handle: c.instagram_handle || '', name: c.name || '',
      occupation: c.occupation || '', follower_count: c.follower_count || '',
      message_sent: c.message_sent || '', response_received: c.response_received || '',
      responded: c.responded, connected: c.connected, opportunity: c.opportunity,
      follow_up_note: c.follow_up_note || '', platform: c.platform || 'instagram'
    })
    setShowModal(true)
    setPanelContact(null)
  }

  const filtered = contacts.filter(c => {
    const s = search.toLowerCase()
    const match = (c.name || '').toLowerCase().includes(s) ||
      (c.instagram_handle || '').toLowerCase().includes(s) ||
      (c.occupation || '').toLowerCase().includes(s)
    if (filter === 'responded') return match && c.responded === true
    if (filter === 'connected') return match && c.connected === true
    if (filter === 'opportunity') return match && c.opportunity === true
    return match
  })

  const total = contacts.length
  const responded = contacts.filter(c => c.responded).length
  const connected = contacts.filter(c => c.connected).length
  const opps = contacts.filter(c => c.opportunity).length
  const responseRate = total ? Math.round((responded / total) * 100) : 0
  const connectRate = total ? Math.round((connected / total) * 100) : 0
  const oppRate = total ? Math.round((opps / total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">OUTREACH <span>DATABASE</span></div>
        <div className="topbar-actions">
          <button className="btn btn-ai" onClick={openAI}>◆ AI Assistant</button>
          <button className="btn btn-ghost">↑ Import</button>
          <button className="btn btn-gold" onClick={() => { setSelected(null); setForm(defaultForm()); setShowModal(true) }}>+ Add Contact</button>
        </div>
      </div>

      <div className="content">
        <div className="stats-row">
          {[
            { label: 'Total Outreach', value: total, sub: `${responded} responded`, color: 'gold' },
            { label: 'Response Rate', value: `${responseRate}%`, sub: `${responded} of ${total}`, color: 'green' },
            { label: 'Connected', value: `${connectRate}%`, sub: `${connected} real connections`, color: 'blue' },
            { label: 'Opportunities', value: `${oppRate}%`, sub: `${opps} active opps`, color: 'red' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.color}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="ai-bar" onClick={openAI}>
          <div className="ai-dot" />
          <div className="ai-text">
            <strong>AI Insight:</strong> Ask your AI assistant about response patterns, who to follow up with, or find similar contacts to reach out to.
          </div>
          <div className="ai-action">Ask AI →</div>
        </div>

        <div className="table-header">
          <div className="tab-group">
            {['all', 'responded', 'connected', 'opportunity'].map(f => (
              <div key={f} className={`tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</div>
            ))}
          </div>
          <div className="search-box">
            <span style={{ color: '#666' }}>🔍</span>
            <input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div style={{ color: '#666', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px' }}>Loading...</div></div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚡</div>
              <div className="empty-state-title">Connection timed out</div>
              <div className="empty-state-sub">Supabase took too long to respond</div>
              <button className="btn btn-gold" onClick={fetchContacts}>↺ Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-title">No outreach contacts yet</div>
              <div className="empty-state-sub">Start tracking your cold outreach</div>
              <button className="btn btn-gold" onClick={() => { setSelected(null); setForm(defaultForm()); setShowModal(true) }}>+ Add First Contact</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Contact</th><th>Occupation</th><th>Date</th><th>Responded</th><th>Connected</th><th>Opportunity</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setPanelContact(c)}>
                    <td>
                      <div className="contact-cell">
                        <div className="contact-avatar" style={{ background: getColor(c.name || c.instagram_handle) }}>
                          {initials(c.name, c.instagram_handle)}
                        </div>
                        <div>
                          <div className="contact-name">{c.name || '—'}</div>
                          <div className="contact-handle">{c.instagram_handle ? `@${c.instagram_handle}` : '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#666', fontSize: '12.5px' }}>{c.occupation || '—'}</td>
                    <td style={{ color: '#666', fontSize: '12px', fontFamily: "'JetBrains Mono',monospace" }}>
                      {c.date_added ? new Date(c.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td><StatusPill value={c.responded} /></td>
                    <td><StatusPill value={c.connected} /></td>
                    <td><StatusPill value={c.opportunity} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="action-cell" style={{ opacity: 1 }}>
                        <div className="action-btn ai-btn" title="Compose with AI" onClick={() => setComposeContact(c)}>◆</div>
                        <div className="action-btn" title="Edit" onClick={() => openEdit(c)}>✎</div>
                        <div className="action-btn" title="Add to My Network" style={{ color: '#3ecf6e', fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }} onClick={() => openAddToNetwork(c)}>→N</div>
                        <div className="action-btn" style={{ color: '#E8472A' }} title="Delete" onClick={() => deleteContact(c.id)}>✕</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selected ? 'EDIT CONTACT' : 'ADD CONTACT'}</div>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Instagram Handle</label>
                  <input className="input" value={form.instagram_handle} onChange={e => setForm({ ...form, instagram_handle: e.target.value })} placeholder="@handle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Occupation</label>
                  <input className="input" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} placeholder="What do they do?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Follower Count</label>
                  <input className="input" type="number" value={form.follower_count} onChange={e => setForm({ ...form, follower_count: e.target.value })} placeholder="e.g. 12000" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Message Sent</label>
                  <textarea className="input" value={form.message_sent} onChange={e => setForm({ ...form, message_sent: e.target.value })} placeholder="What did you send?" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Their Response</label>
                  <textarea className="input" value={form.response_received} onChange={e => setForm({ ...form, response_received: e.target.value })} placeholder="What did they say?" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '8px' }}>
                {[{ key: 'responded', label: 'Responded?' }, { key: 'connected', label: 'Connected?' }, { key: 'opportunity', label: 'Opportunity?' }].map(({ key, label }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <select className="input" value={form[key] === null ? '' : form[key].toString()} onChange={e => setForm({ ...form, [key]: e.target.value === '' ? null : e.target.value === 'true' })}>
                      <option value="">Pending</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Follow-Up Note</label>
                <input className="input" value={form.follow_up_note} onChange={e => setForm({ ...form, follow_up_note: e.target.value })} placeholder="Next action with this person?" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={saveContact}>{selected ? 'Save Changes' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}

      {panelContact && (
        <ContactPanel
          contact={panelContact}
          type="outreach"
          profile={profile}
          onClose={() => setPanelContact(null)}
          onEdit={() => openEdit(panelContact)}
        />
      )}

      {composeContact && (
        <ComposeModal
          contact={composeContact}
          profile={profile}
          onClose={() => setComposeContact(null)}
        />
      )}

      {showNetworkModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">ADD TO MY NETWORK</div>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowNetworkModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '11px', color: '#3ecf6e', fontFamily: "'JetBrains Mono',monospace", marginBottom: '12px' }}>
                Pre-filled from outreach data — fill in any additional details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="input" value={networkForm.name} onChange={e => setNetworkForm({ ...networkForm, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Instagram Handle</label>
                  <input className="input" value={networkForm.instagram_handle} onChange={e => setNetworkForm({ ...networkForm, instagram_handle: e.target.value })} placeholder="@handle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" value={networkForm.phone} onChange={e => setNetworkForm({ ...networkForm, phone: e.target.value })} placeholder="Phone number" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" value={networkForm.email} onChange={e => setNetworkForm({ ...networkForm, email: e.target.value })} placeholder="Email address" />
                </div>
                <div className="form-group">
                  <label className="form-label">Occupation</label>
                  <input className="input" value={networkForm.occupation} onChange={e => setNetworkForm({ ...networkForm, occupation: e.target.value })} placeholder="What do they do?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Skills / Services</label>
                  <input className="input" value={networkForm.skills_services} onChange={e => setNetworkForm({ ...networkForm, skills_services: e.target.value })} placeholder="e.g. design, dev, sales" />
                </div>
                <div className="form-group">
                  <label className="form-label">How You Met</label>
                  <input className="input" value={networkForm.how_met} onChange={e => setNetworkForm({ ...networkForm, how_met: e.target.value })} placeholder="How you connected" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location(s)</label>
                  <input className="input" value={networkForm.locations} onChange={e => setNetworkForm({ ...networkForm, locations: e.target.value })} placeholder="Tampa, FL" />
                </div>
                <div className="form-group">
                  <label className="form-label">Relationship Score (1–10)</label>
                  <input className="input" type="number" min="1" max="10" step="0.5" value={networkForm.relationship_score} onChange={e => setNetworkForm({ ...networkForm, relationship_score: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Follow-Up Note</label>
                  <input className="input" value={networkForm.potential_followup} onChange={e => setNetworkForm({ ...networkForm, potential_followup: e.target.value })} placeholder="Next action?" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="input" value={networkForm.notes} onChange={e => setNetworkForm({ ...networkForm, notes: e.target.value })} placeholder="Any extra context" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowNetworkModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={saveToNetwork}>Add to Network</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ value }) {
  if (value === true) return <span className="status-pill status-yes">Yes</span>
  if (value === false) return <span className="status-pill status-no">No</span>
  return <span className="status-pill status-pending">Pending</span>
}
