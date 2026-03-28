import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { scoreEvents } from '../lib/claude'
import CityInput from '../components/CityInput'

const SOURCE_COLORS = {
  ticketmaster: '#4a9eff',
  eventbrite: '#E8472A',
  posh: '#F5C842',
  manual: '#3ecf6e',
}

function parseCityState(input) {
  const parts = input.split(',').map(s => s.trim())
  return { city: parts[0] || 'Tampa', state: parts[1] || 'FL' }
}

function formatEventDate(dateStr) {
  if (!dateStr) return { day: '?', month: '?', time: '?', full: 'TBD' }
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

function googleCalendarUrl(event) {
  const start = new Date(event.event_date)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(event.location || '')}&details=${encodeURIComponent(event.notes || '')}`
}

function openIcs(event) {
  const start = new Date(event.event_date)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || ''}`,
    `DESCRIPTION:${event.notes || ''}`,
    `URL:${event.event_url || ''}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  // On macOS Safari: opens Calendar directly. On Chrome: triggers download, double-click opens Calendar.
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function Events() {
  const { userId, openAI, profile } = useOutletContext()
  const [events, setEvents] = useState([])
  const [eventLabels, setEventLabels] = useState({}) // id -> label string
  const [savedEvents, setSavedEvents] = useState([])
  const [contacts, setContacts] = useState([])
  const [gaps, setGaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [cityInput, setCityInput] = useState(profile?.city || 'Tampa, FL')
  const [selectedCity, setSelectedCity] = useState(parseCityState(profile?.city || 'Tampa, FL'))
  const [calendarYear] = useState(new Date().getFullYear())
  const [calendarMonth] = useState(new Date().getMonth())

  // Sync city with profile city (only if they actually set one)
  useEffect(() => {
    if (profile?.city) {
      setCityInput(profile.city)
      setSelectedCity(parseCityState(profile.city))
    }
  }, [profile?.city])

  function applyCity(input) {
    const parsed = parseCityState(input)
    setSelectedCity(parsed)
  }

  useEffect(() => {
    supabase.from('saved_events').select('*').order('event_date').then(({ data }) => setSavedEvents(data || []))
    supabase.from('network_contacts').select('id, name, locations').then(({ data }) => setContacts(data || []))
    // Try to load cached gaps for event scoring context
    supabase.from('gap_cache').select('gaps').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (data?.gaps) setGaps(data.gaps)
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchEvents() }, [selectedCity])

  async function fetchEvents() {
    setLoading(true)
    setError(false)
    setEventLabels({})
    try {
      const res = await fetch(`/.netlify/functions/get-events?city=${encodeURIComponent(selectedCity.city)}&state=${encodeURIComponent(selectedCity.state)}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setEvents(data)
      // Score events with AI — check localStorage cache first (24h expiry)
      if (profile?.what_i_do && data.length > 0) {
        const cacheKey = `event_scores:${selectedCity.city}:${profile.what_i_do}`
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          try {
            const { labels, ts } = JSON.parse(cached)
            if (Date.now() - ts < 24 * 60 * 60 * 1000) {
              setEventLabels(labels)
              return
            }
          } catch {}
        }
        scoreEvents({ events: data, whatIDo: profile.what_i_do, gaps }).then(scored => {
          const labelMap = {}
          scored.forEach(s => { if (data[s.index]) labelMap[data[s.index].id] = s.label })
          setEventLabels(labelMap)
          localStorage.setItem(cacheKey, JSON.stringify({ labels: labelMap, ts: Date.now() }))
        }).catch(() => {})
      }
    } catch {
      setError(true)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  async function saveEvent(event) {
    const already = savedEvents.some(s => s.title === event.title)
    if (already) return
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
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <CityInput
              value={cityInput}
              onChange={v => { setCityInput(v); if (v.includes(',')) applyCity(v) }}
              placeholder="City, ST"
              style={{ padding: '6px 12px', fontSize: '12px', width: '160px' }}
            />
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => applyCity(cityInput)}
            >Search</button>
          </div>
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
              <div style={{ color: '#666', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', padding: '40px 0', textAlign: 'center' }}>
                Loading events in {selectedCity.label}...
              </div>
            ) : error ? (
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <div className="empty-state-title">Could not load events</div>
                <div className="empty-state-sub">Check your connection and try again</div>
                <button className="btn btn-gold" onClick={fetchEvents}>↺ Retry</button>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🗓️</div>
                <div className="empty-state-title">No events found</div>
                <div className="empty-state-sub">Try a different city or check back later</div>
              </div>
            ) : (
              events.map(event => {
                const dt = formatEventDate(event.event_date)
                const color = SOURCE_COLORS[event.source] || '#666'
                const isSaved = savedEvents.some(s => s.title === event.title)
                const aiLabel = eventLabels[event.id]
                const matchedContacts = contacts.filter(c =>
                  (c.locations || []).some(loc =>
                    event.location?.toLowerCase().includes(loc.split(',')[0].toLowerCase())
                  )
                ).slice(0, 4)

                return (
                  <div key={event.id} className="event-card">
                    <div className="event-source">
                      <div className="source-dot" style={{ background: color }} />
                      <span style={{ color, textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: "'JetBrains Mono',monospace", fontSize: '9px' }}>{event.source}</span>
                      {aiLabel && (
                        <span style={{
                          marginLeft: '8px', background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)',
                          borderRadius: '20px', padding: '2px 8px', fontSize: '9px', color: '#F5C842',
                          fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.5px'
                        }}>◆ {aiLabel}</span>
                      )}
                      <span style={{ color: '#666', marginLeft: 'auto', fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }}>{dt.full}</span>
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{event.title}</div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>📍 {event.location}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>🕗 {dt.time}</span>
                      {event.price && <span style={{ fontSize: '12px', color: '#3ecf6e' }}>{event.price}</span>}
                    </div>

                    {event.notes && (
                      <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5, marginBottom: '12px' }}>
                        {event.notes.slice(0, 120)}{event.notes.length > 120 ? '...' : ''}
                      </div>
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

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {event.event_url && event.event_url !== '#' && (
                        <a href={event.event_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>View →</a>
                      )}
                      {!isSaved ? (
                        <button className="btn btn-gold" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => saveEvent(event)}>+ Save</button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#3ecf6e', padding: '6px 0' }}>✓ Saved</span>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => window.open(googleCalendarUrl(event), '_blank')}>Google</button>
                      <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => openIcs(event)}>Apple</button>
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
