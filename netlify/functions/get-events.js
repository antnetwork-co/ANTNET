export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')

  const results = await Promise.allSettled([
    fetchTicketmaster(city, stateCode, page),
    fetchGoogleEvents(city, stateCode, page),
  ])

  const events = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  return new Response(JSON.stringify(events), {
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

async function fetchGoogleEvents(city, stateCode, page = 0) {
  const key = process.env.SERPAPI_KEY
  const query = `Events in ${city} ${stateCode}`
  const start = page * 10
  const url = `https://serpapi.com/search.json?engine=google_events&q=${encodeURIComponent(query)}&start=${start}&api_key=${key}`

  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data.events_results || []

  return items.map((e, i) => {
    const eventDate = parseGoogleEventDate(e.date?.start_date, e.date?.when)
    return {
      id: `goog-${page}-${i}`,
      title: e.title,
      source: 'google',
      location: Array.isArray(e.address) ? e.address.join(', ') : (e.address || city),
      event_date: eventDate,
      event_url: e.link || (e.ticket_info?.[0]?.link) || null,
      notes: e.description || '',
      price: e.ticket_info?.[0]?.info || null,
      image: e.thumbnail || null,
    }
  })
}

// SerpApi returns dates like "Mar 30, 2026, 7:00 PM" or "Mar 30, 7:00 PM"
function parseGoogleEventDate(startDate, when) {
  if (!startDate && !when) return null
  try {
    const str = when || startDate
    // If year is missing, append current year
    const hasYear = /\d{4}/.test(str)
    const withYear = hasYear ? str : `${str}, ${new Date().getFullYear()}`
    const d = new Date(withYear)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}
