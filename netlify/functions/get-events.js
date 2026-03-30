export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')

  const results = await Promise.allSettled([
    fetchTicketmaster(city, stateCode, page),
    fetchEventbrite(city, stateCode, page),
  ])

  const events = results.flatMap(r => r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : []) : [])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  const debug = results.map((r, i) => ({
    source: i === 0 ? 'ticketmaster' : 'eventbrite',
    status: r.status,
    count: r.status === 'fulfilled' && Array.isArray(r.value) ? r.value.length : 0,
    error: r.status === 'rejected' ? r.reason?.message : (r.status === 'fulfilled' && !Array.isArray(r.value) ? r.value : undefined)
  }))

  return new Response(JSON.stringify({ events, debug }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function fetchTicketmaster(city, stateCode, page = 0) {
  const key = process.env.TICKETMASTER_API_KEY
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&city=${encodeURIComponent(city)}&stateCode=${stateCode}&size=15&sort=date,asc&startDateTime=${startDateTime}&page=${page}`

  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data._embedded?.events || []

  return items.map(e => ({
    id: `tm-${e.id}`,
    title: e.name,
    source: 'ticketmaster',
    location: e._embedded?.venues?.[0]?.name || city,
    event_date: e.dates?.start?.dateTime || e.dates?.start?.localDate,
    event_url: e.url,
    notes: e.info || e.pleaseNote || '',
    price: e.priceRanges ? `From $${e.priceRanges[0].min}` : null,
    image: e.images?.[0]?.url || null,
  }))
}

async function fetchEventbrite(city, stateCode, page = 0) {
  const key = process.env.EVENTBRITE_API_KEY
  const url = `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(city)}&location.address=${encodeURIComponent(city + ', ' + stateCode)}&location.within=30mi&expand=venue,ticket_availability&sort_by=date&start_date.range_start=${new Date().toISOString()}&page=${page + 1}`

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${key}` }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('Eventbrite error:', res.status, body)
    return { _error: `${res.status}: ${body}` }
  }
  const data = await res.json()
  const items = data.events || []

  return items.slice(0, 15).map(e => ({
    id: `eb-${e.id}`,
    title: e.name?.text || 'Untitled Event',
    source: 'eventbrite',
    location: e.venue?.name || e.venue?.address?.localized_address_display || city,
    event_date: e.start?.utc,
    event_url: e.url,
    notes: e.description?.text?.slice(0, 120) || '',
    price: e.ticket_availability?.minimum_ticket_price
      ? `From $${e.ticket_availability.minimum_ticket_price.major_value}`
      : 'Free',
    image: e.logo?.url || null,
  }))
}
