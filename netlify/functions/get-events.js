export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')

  const events = await fetchTicketmaster(city, stateCode, page)
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

