const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')
  const whatIDo = url.searchParams.get('q') || ''

  const category = deriveCategory(whatIDo)

  // Check cache first
  const cached = await getCached(city, stateCode, category, page)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    })
  }

  const results = await Promise.allSettled([
    fetchTicketmaster(city, stateCode, page),
    fetchGoogleEvents(city, stateCode, page, whatIDo),
  ])

  const tmEvents = results[0].status === 'fulfilled' ? results[0].value : []
  const googleEvents = results[1].status === 'fulfilled' ? results[1].value : []
  const events = [...tmEvents, ...googleEvents]
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  // Only cache if both sources returned results — prevents locking in partial data
  if (tmEvents.length > 0 && googleEvents.length > 0) {
    writeCache(city, stateCode, category, page, events).catch(() => {})
  }

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  })
}

function deriveCategory(whatIDo) {
  const lower = (whatIDo || '').toLowerCase()
  if (lower.includes('real estate')) return 'realestate'
  if (lower.includes('tech') || lower.includes('developer') || lower.includes('software')) return 'tech'
  if (lower.includes('creative') || lower.includes('design') || lower.includes('art')) return 'creative'
  if (lower.includes('fitness') || lower.includes('gym') || lower.includes('running')) return 'fitness'
  if (lower.includes('entrepreneur') || lower.includes('startup') || lower.includes('business') || lower.includes('network')) return 'networking'
  return 'networking'
}

async function getCached(city, stateCode, category, page) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/event_cache?city=eq.${encodeURIComponent(city)}&state_code=eq.${encodeURIComponent(stateCode)}&category=eq.${encodeURIComponent(category)}&page=eq.${page}&select=events,fetched_at`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    if (!res.ok) return null
    const rows = await res.json()
    if (!rows.length) return null
    const row = rows[0]
    const age = Date.now() - new Date(row.fetched_at).getTime()
    if (age > CACHE_TTL_MS) return null
    return row.events
  } catch {
    return null
  }
}

async function writeCache(city, stateCode, category, page, events) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/event_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ city, state_code: stateCode, category, page, events, fetched_at: new Date().toISOString() })
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

function buildGoogleQuery(city, stateCode, whatIDo) {
  const lower = (whatIDo || '').toLowerCase()
  let keyword = 'networking'
  if (lower.includes('real estate')) keyword = 'real estate'
  else if (lower.includes('tech') || lower.includes('developer') || lower.includes('software')) keyword = 'tech'
  else if (lower.includes('creative') || lower.includes('design') || lower.includes('art')) keyword = 'creative'
  else if (lower.includes('fitness') || lower.includes('gym') || lower.includes('running')) keyword = 'fitness'
  // entrepreneur/startup/business/network → 'networking' (default)
  return `${keyword} events in ${city} ${stateCode}`
}

async function fetchGoogleEvents(city, stateCode, page = 0, whatIDo = '') {
  const key = process.env.SERPAPI_KEY
  const query = buildGoogleQuery(city, stateCode, whatIDo)
  const start = page * 10
  const url = `https://serpapi.com/search.json?engine=google_events&q=${encodeURIComponent(query)}&start=${start}&api_key=${key}`

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`SerpApi error ${res.status}:`, await res.text().catch(() => ''))
    return []
  }
  const data = await res.json()
  if (data.error) console.error('SerpApi response error:', data.error)
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

// SerpApi returns dates like "Mar 30, 2026, 7:00 – 9:00 PM" or "Mar 30, 7:00 PM"
function parseGoogleEventDate(startDate, when) {
  const year = new Date().getFullYear()
  const candidates = [startDate, when].filter(Boolean)
  for (const raw of candidates) {
    try {
      let cleaned = raw.replace(/(\d{1,2}:\d{2})\s*[–\-]\s*\d{1,2}:\d{2}/g, '$1')
      if (!/\d{4}/.test(cleaned)) cleaned = `${cleaned} ${year}`
      const d = new Date(cleaned)
      if (!isNaN(d.getTime())) return d.toISOString()
    } catch {}
  }
  return null
}
