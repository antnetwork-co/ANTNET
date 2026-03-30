import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ContactPanel from '../components/ContactPanel'

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

const GAPS = [
  { key: 'legal', label: 'Legal / Attorney', icon: '⚖️', skills: ['legal', 'attorney', 'lawyer', 'law'], desc: 'Critical for contracts, IP, or incorporation.' },
  { key: 'design', label: 'Designer / Creative', icon: '🎨', skills: ['design', 'designer', 'creative', 'brand', 'ux', 'ui'], desc: 'Needed for branding, product, and visual work.' },
  { key: 'investor', label: 'Investor / Capital', icon: '💰', skills: ['investor', 'investing', 'capital', 'vc', 'angel', 'fund'], desc: 'Access to funding and financial advice.' },
  { key: 'developer', label: 'Developer / Engineer', icon: '💻', skills: ['developer', 'engineer', 'coding', 'software', 'tech', 'programmer'], desc: 'Technical execution and product building.' },
  { key: 'marketing', label: 'Marketing / Growth', icon: '📣', skills: ['marketing', 'growth', 'seo', 'ads', 'paid media', 'content'], desc: 'Customer acquisition and brand building.' },
  { key: 'sales', label: 'Sales / Lead Gen', icon: '📈', skills: ['sales', 'lead gen', 'business development', 'outreach'], desc: 'Revenue generation and client acquisition.' },
]

function getGapStatus(count) {
  if (count === 0) return { label: 'MISSING', colorClass: 'critical', pillClass: 'critical' }
  if (count === 1) return { label: 'WEAK', colorClass: 'warning', pillClass: 'warning' }
  if (count <= 3) return { label: 'GROWING', colorClass: '', pillClass: 'good' }
  return { label: 'STRONG', colorClass: '', pillClass: 'good' }
}

export default function Network() {
  const { profile, userId, openAI } = useOutletContext()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [panelContact, setPanelContact] = useState(null)
  const [form, setForm] = useState(defaultForm())
  const [sortAsc, setSortAsc] = useState(true)
  const [igLoading, setIgLoading] = useState(false)
  const [igError, setIgError] = useState('')

  async function lookupInstagram() {
    const handle = (form.instagram_handle || '').replace('@', '').trim()
    if (!handle) return
    setIgLoading(true)
    setIgError('')
    try {
      const res = await fetch(`/.netlify/functions/instagram-lookup?handle=${encodeURIComponent(handle)}`)
      const data = await res.json()
      if (!res.ok) { setIgError(data.error || 'Lookup failed'); return }
      const updates = {}
      if (data.name && !form.name) updates.name = data.name
      if (data.occupation && !form.occupation) updates.occupation = data.occupation
      if (data.followers != null) {
        const count = data.followers >= 1000
          ? `${(data.followers / 1000).toFixed(1)}K`
          : String(data.followers)
        if (!form.notes) updates.notes = `IG: ${count} followers`
      }
      setForm(f => ({ ...f, ...updates }))
    } catch {
      setIgError('Lookup failed')
    } finally {
      setIgLoading(false)
    }
  }

  function defaultForm() {
    return {
      name: '', instagram_handle: '', phone: '', email: '', occupation: '',
      skills_services: '', how_met: '', locations: '', last_spoken_to: '',
      potential_followup: '', relationship_score: 5.0, notes: ''
    }
  }

  useEffect(() => { fetchContacts() }, [])

  async function fetchContacts() {
    setLoading(true)
    setError(false)
    try {
      const { data, error } = await supabase.from('network_contacts').select('*').order('created_at', { ascending: false })
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
    const payload = {
      ...form, user_id: userId,
      locations: form.locations ? form.locations.split(',').map(l => l.trim()) : [],
      relationship_score: parseFloat(form.relationship_score) || 5.0
    }
    const { error } = selected
      ? await supabase.from('network_contacts').update(payload).eq('id', selected.id)
      : await supabase.from('network_contacts').insert(payload)
    if (error) { alert('Save failed: ' + error.message); return }
    setShowModal(false); setSelected(null); setForm(defaultForm()); fetchContacts()
  }

  async function deleteContact(id) {
    await supabase.from('network_contacts').delete().eq('id', id)
    fetchContacts()
  }

  function openEdit(c) {
    setSelected(c)
    setForm({
      name: c.name || '', instagram_handle: c.instagram_handle || '',
      phone: c.phone || '', email: c.email || '',
      occupation: c.occupation || '', skills_services: c.skills_services || '',
      how_met: c.how_met || '', locations: (c.locations || []).join(', '),
      last_spoken_to: c.last_spoken_to || '', potential_followup: c.potential_followup || '',
      relationship_score: c.relationship_score || 5.0, notes: c.notes || ''
    })
    setShowModal(true)
    setPanelContact(null)
  }

  let filtered = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.occupation || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.skills_services || '').toLowerCase().includes(search.toLowerCase())
  )

  if (sortAsc !== null) {
    filtered = [...filtered].sort((a, b) => {
      const da = daysSince(a.last_spoken_to) ?? 9999
      const db = daysSince(b.last_spoken_to) ?? 9999
      return sortAsc ? db - da : da - db
    })
  }

  const fading = contacts.filter(c => daysSince(c.last_spoken_to) >= 90).length
  const avgScore = contacts.length
    ? (contacts.reduce((a, c) => a + (c.relationship_score || 5), 0) / contacts.length).toFixed(1)
    : '—'
  const addedThisMonth = contacts.filter(c => new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length

  function getGapCount(keywords, list) {
    return list.filter(c => {
      const text = `${c.skills_services || ''} ${c.occupation || ''}`.toLowerCase()
      return keywords.some(k => text.includes(k))
    }).length
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">MY <span>NETWORK</span></div>
        <div className="topbar-actions">
          <button className="btn btn-ai" onClick={openAI}>◆ AI Assistant</button>
          <button className="btn btn-gold" onClick={() => { setSelected(null); setForm(defaultForm()); setShowModal(true) }}>+ Add Contact</button>
        </div>
      </div>

      <div className="content">
        {loading && <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#666', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px' }}>Loading...</div></div>}
        <div className="stats-row" style={{ visibility: loading ? 'hidden' : 'visible' }}>
          {[
            { label: 'Warm Contacts', value: contacts.length, sub: 'Direct reach today', color: 'gold' },
            { label: 'Fading', value: fading, sub: '90+ days no contact', color: 'red' },
            { label: 'Avg Rel. Score', value: avgScore, sub: 'Out of 10', color: 'green' },
            { label: 'Added This Month', value: addedThisMonth, sub: 'New connections', color: 'blue' },
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
            <strong>AI Insight:</strong> Ask who to reconnect with, find contacts by skill or location, or get a full network health report.
          </div>
          <div className="ai-action">Ask AI →</div>
        </div>

        <div className="table-header">
          <div className="search-box">
            <span style={{ color: '#666' }}>🔍</span>
            <input placeholder="Search by name, skill, city..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div
            className="filter-tag"
            onClick={() => setSortAsc(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ↑↓ Last Contacted
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
              <div className="empty-state-icon">🕸️</div>
              <div className="empty-state-title">Your network is empty</div>
              <div className="empty-state-sub">Add the people you actually know</div>
              <button className="btn btn-gold" onClick={() => { setSelected(null); setForm(defaultForm()); setShowModal(true) }}>+ Add First Contact</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contact</th><th>Location</th><th>Occupation</th>
                  <th>Skills & Services</th><th>How Met</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => setSortAsc(s => !s)}>Last Contact ↕</th>
                  <th>Rel. Score</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const days = daysSince(c.last_spoken_to)
                  const isFading = days !== null && days >= 90
                  const isSoon = days !== null && days >= 45 && days < 90
                  return (
                    <tr key={c.id} onClick={() => setPanelContact(c)}>
                      <td>
                        <div className="contact-cell">
                          <div className="contact-avatar" style={{ background: getColor(c.name) }}>
                            {(c.name || '??').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="contact-name">{c.name}</div>
                            {c.instagram_handle && <a className="contact-handle" href={`https://instagram.com/${c.instagram_handle.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>@{c.instagram_handle.replace('@','')}</a>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: '#666' }}>{(c.locations || []).join(' / ') || '—'}</td>
                      <td style={{ fontSize: '12.5px', color: '#666' }}>{c.occupation || '—'}</td>
                      <td style={{ fontSize: '12px', color: '#666' }}>{c.skills_services || '—'}</td>
                      <td style={{ fontSize: '12px', color: '#666' }}>{c.how_met || '—'}</td>
                      <td>
                        {days === null ? (
                          <span style={{ color: '#444', fontSize: '12px' }}>Never</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: isFading ? '#E8472A' : isSoon ? '#F5C842' : '#3ecf6e' }}>
                            {isFading ? '🔴' : isSoon ? '🟡' : '🟢'} {days}d ago
                            {isFading && <span style={{ fontSize: '10px', background: 'rgba(232,71,42,.12)', color: '#E8472A', padding: '2px 6px', borderRadius: '4px', fontFamily: "'JetBrains Mono',monospace", marginLeft: '6px' }}>FADING</span>}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(c.relationship_score || 5) * 10}%`, background: (c.relationship_score || 5) >= 7 ? '#3ecf6e' : (c.relationship_score || 5) >= 4 ? '#F5C842' : '#E8472A', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono',monospace" }}>{c.relationship_score || 5}</span>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-cell" style={{ opacity: 1 }}>
                          <div className="action-btn ai-btn" onClick={() => setPanelContact(c)}>◆</div>
                          <div className="action-btn" onClick={() => openEdit(c)}>✎</div>
                          <div className="action-btn" style={{ color: '#E8472A' }} onClick={() => deleteContact(c.id)}>✕</div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Gap Analysis Section */}
        <div className="gap-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '18px', letterSpacing: '2px' }}>
              NETWORK <span style={{ color: '#F5C842' }}>GAP ANALYSIS</span>
            </div>
            <button className="btn btn-ai" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={openAI}>◆ Find Missing Contacts</button>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>Based on your current contacts — add more to improve coverage</div>
          <div className="gap-grid-v1">
            {GAPS.map(g => {
              const count = getGapCount(g.skills, contacts)
              const status = getGapStatus(count)
              return (
                <div key={g.key} className={`gap-card ${status.colorClass}`}>
                  <div className="gap-icon">{g.icon}</div>
                  <div className="gap-name">{g.label}</div>
                  <div className="gap-desc">{g.desc}</div>
                  <div className={`gap-pill ${status.pillClass}`}>{status.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selected ? 'EDIT CONTACT' : 'ADD CONTACT'}</div>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Instagram Handle</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    value={form.instagram_handle}
                    onChange={e => { setForm({ ...form, instagram_handle: e.target.value }); setIgError('') }}
                    placeholder="@handle"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    onClick={lookupInstagram}
                    disabled={igLoading || !form.instagram_handle.trim()}
                  >{igLoading ? 'Looking up...' : '◆ Auto-fill'}</button>
                </div>
                {igError && <div style={{ fontSize: '11px', color: '#E8472A', marginTop: '4px' }}>{igError}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { key: 'name', label: 'Name', placeholder: 'Full name' },
                  { key: 'phone', label: 'Phone', placeholder: '(555) 000-0000' },
                  { key: 'email', label: 'Email', placeholder: 'email@example.com' },
                  { key: 'occupation', label: 'Occupation', placeholder: 'What do they do?' },
                  { key: 'skills_services', label: 'Skills & Services', placeholder: 'What can they help with?' },
                  { key: 'how_met', label: 'How You Met', placeholder: 'Where did you meet?' },
                  { key: 'locations', label: 'Locations (comma separated)', placeholder: 'Tampa FL, New York NY' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Last Spoken To</label>
                  <input className="input" type="date" value={form.last_spoken_to} onChange={e => setForm({ ...form, last_spoken_to: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Relationship Score (0-10)</label>
                  <input className="input" type="number" step="0.1" min="0" max="10" value={form.relationship_score} onChange={e => setForm({ ...form, relationship_score: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Potential Follow-Up</label>
                  <textarea className="input" value={form.potential_followup} onChange={e => setForm({ ...form, potential_followup: e.target.value })} placeholder="Next action with this person..." />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything else to remember..." />
                </div>
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
          type="network"
          profile={profile}
          onClose={() => setPanelContact(null)}
          onEdit={() => openEdit(panelContact)}
        />
      )}
    </div>
  )
}
