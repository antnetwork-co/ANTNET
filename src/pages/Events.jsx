import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SAMPLE_EVENTS = [
  {
    id: 'sample-1',
    title: 'Tampa Bay Entrepreneurs Mixer',
    source: 'posh',
    location: 'The Hub, Ybor City',
    event_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    event_url: '#',
    notes: 'Monthly gathering of Tampa founders, investors, and creative professionals.',
    price: 'Free',
  },
  {
    id: 'sample-2',
    title: 'Creative Industries Networking Night',
    source: 'eventbrite',
    location: 'Armature Works, Tampa',
    event_date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    event_url: '#',
    notes: 'Design, media, and creative professionals. Great for filling Designer gap.',
    price: '$10',
  },
  {
    id: 'sample-3',
    title: 'Angel Investor Summit 2025',
    source: 'ticketmaster',
    location: 'Marriott Waterside, Tampa',
    event_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    event_url: '#',
    notes: 'Early-stage investors, VCs, and funded founders.',
    price: '$75',
  },
]

const SOURCE_COLORS = {
  posh: '#F5C842',
  eventbrite: '#E8472A',
  ticketmaster: '#4a9eff',
  manual: '#3ecf6e',
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr)
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    full: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export default function Events() {
  const { userId, openAI } = useOutletContext()
  const [events, setEvents] = useState(SAMPLE_EVENTS)
  const [savedEvents, setSavedEvents] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading] = useState(false)
  const [calendarYear] = useState(new Date().getFullYear())
  const [calendarMonth] = useState(new Date().getMonth())

  useEffect(() => {
    supabase.from('saved_events').select('*').order('event_date').then(({ data }) => setSavedEvents(data || []))
    supabase.from('network_contacts').select('id, name, locations').then(({ data }) => setContacts(data || []))
  }, [])

  async function saveEvent(event) {
    const { data } = await supabase.from('saved_events').insert({
      user_id: userId,
      title: event.title,
      source: event.source,
      event_url: event.event_url || '',
      location: event.location,
      event_date: event.event_date,
      notes: event.notes || '',
      added_to_calendar: false,
    }).select().single()
    if (data) setSavedEvents(s => [...s, data])
  }

  const today = new Date()
  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth)
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay()

  const eventDays = new Set([
    ...events.map(e => new Date(e.event_date).getDate()),
    ...savedEvents.map(e => new Date(e.event_date).getDate()),
  ])

  const upcomingAll = [...events, ...savedEvents]
    .filter(e => new Date(e.event_date) >= today)
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">EVENTS <span>& CALENDAR</span></div>
        <div className="topbar-actions">
          <button className="btn btn-ghost">📍 Tampa, FL</button>
          <button className="btn btn-ai" onClick={openAI}>◆ Find Events For Me</button>
        </div>
      </div>

      <div className="content">
        <div className="ai-bar" onClick={openAI}>
          <div className="ai-dot" />
          <div className="ai-text">
            <strong>AI Insight:</strong> Events can fill your network gaps. Ask AI to find Designers, Investors, or other missing contacts at local events.
          </div>
          <div className="ai-action">See All →</div>
        </div>

        <div className="events-grid">
          {/* Event List */}
          <div>
            {loading ? (
              <div style={{ color: '#666', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', padding: '20px 0' }}>Loading events...</div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🗓️</div>
                <div className="empty-state-title">No events yet</div>
                <div className="empty-state-sub">Events from Eventbrite and Ticketmaster will appear here</div>
              </div>
            ) : (
              events.map(event => {
                const dt = formatEventDate(event.event_date)
                const color = SOURCE_COLORS[event.source] || '#666'
                const isSaved = savedEvents.some(s => s.title === event.title)

                // Match contacts by location
                const matchedContacts = contacts.filter(c =>
                  (c.locations || []).some(loc =>
                    event.location.toLowerCase().includes(loc.split(',')[0].toLowerCase())
                  )
                ).slice(0, 4)

                return (
                  <div key={event.id} className="event-card">
                    <div className="event-source">
                      <div className="source-dot" style={{ background: color }} />
                      <span style={{ color, textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: "'JetBrains Mono',monospace", fontSize: '9px' }}>{event.source}</span>
                      <span style={{ color: '#666', marginLeft: 'auto', fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }}>{dt.full}</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{event.title}</div>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>📍 {event.location}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>🕗 {dt.time}</span>
                      {event.price && <span style={{ fontSize: '12px', color: '#3ecf6e' }}>{event.price}</span>}
                    </div>
                    {event.notes && (
                      <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5, marginBottom: '12px' }}>{event.notes}</div>
                    )}

                    {matchedContacts.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderTop: '1px solid #2a2a2a', marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono',monospace" }}>NETWORK MATCH</div>
                        <div style={{ display: 'flex' }}>
                          {matchedContacts.map((c, i) => (
                            <div key={c.id} style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: ['#4a9eff', '#F5C842', '#3ecf6e', '#E8472A'][i % 4],
                              border: '2px solid #111', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '9px', fontWeight: 700,
                              color: '#0a0a0a', fontFamily: "'Bebas Neue',sans-serif",
                              marginLeft: i > 0 ? '-6px' : 0
                            }}>
                              {(c.name || '??').slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '11px', color: '#666' }}>{matchedContacts.map(c => c.name.split(' ')[0]).join(', ')}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {event.event_url && event.event_url !== '#' && (
                        <a href={event.event_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>View →</a>
                      )}
                      {!isSaved ? (
                        <button className="btn btn-gold" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => saveEvent(event)}>
                          + Save Event
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#3ecf6e', padding: '6px 0' }}>✓ Saved</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Calendar Panel */}
          <div>
            <div className="cal-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '2px' }}>
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
              </div>

              <div className="cal-month">
                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
                  <div key={d} className="cal-day-label">{d}</div>
                ))}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === today.getDate() && calendarMonth === today.getMonth()
                  const hasEvent = eventDays.has(day)
                  return (
                    <div key={day} className={`cal-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}`}>
                      {day}
                    </div>
                  )
                })}
              </div>

              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '16px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#666', fontFamily: "'JetBrains Mono',monospace", marginBottom: '12px' }}>
                  Upcoming
                </div>
                {upcomingAll.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#444' }}>No upcoming events saved.</div>
                ) : (
                  upcomingAll.slice(0, 5).map((event, i) => {
                    const dt = formatEventDate(event.event_date)
                    return (
                      <div key={i} className="cal-event-item">
                        <div style={{ textAlign: 'center', minWidth: '28px' }}>
                          <div className="cal-event-date">{dt.day}</div>
                          <div className="cal-event-month">{dt.month}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.3 }}>{event.title}</div>
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>📍 {event.location}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
