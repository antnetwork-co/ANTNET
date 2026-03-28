export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'

  const results = await Promise.allSettled([
    fetchTicketmaster(city, stateCode),
    fetchEventbrite(city, stateCode),
  ])

  const events = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function fetchTicketmaster(city, stateCode) {
  const key = process.env.TICKETMASTER_API_KEY
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&city=${encodeURIComponent(city)}&stateCode=${stateCode}&classificationName=networking,business,conference,seminar&size=10&sort=date,asc`

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
    price: e.priceRanges ? `$${e.priceRanges[0].min}` : null,
    image: e.images?.[0]?.url || null,
  }))
}

async function fetchEventbrite(city, stateCode) {
  const key = process.env.EVENTBRITE_API_KEY
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(city + ', ' + stateCode)}&location.within=25mi&expand=venue,ticket_availability&sort_by=date&token=${key}`

  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data.events || []

  return items.slice(0, 10).map(e => ({
    id: `eb-${e.id}`,
    title: e.name?.text || 'Untitled Event',
    source: 'eventbrite',
    location: e.venue?.name || e.venue?.address?.city || city,
    event_date: e.start?.utc,
    event_url: e.url,
    notes: e.description?.text?.slice(0, 120) || '',
    price: e.ticket_availability?.minimum_ticket_price
      ? `$${(e.ticket_availability.minimum_ticket_price.major_value)}`
      : 'Free',
    image: e.logo?.url || null,
  }))
}
