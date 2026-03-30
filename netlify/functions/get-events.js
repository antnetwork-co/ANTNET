const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

const CATEGORY_KEYWORDS = {
  networking: 'networking',
  fitness: 'fitness',
  realestate: 'real estate',
  tech: 'tech',
  creative: 'creative',
}

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')
  const whatIDo = url.searchParams.get('q') || ''

  const categories = deriveCategories(whatIDo) // up to 2

  // Check cache for all categories, collect misses
  const cacheResults = await Promise.all(categories.map(cat => getCached(city, stateCode, cat, page)))
  const allCached = cacheResults.every(r => r !== null)

  if (allCached) {
    const events = dedup(cacheResults.flat())
    events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    })
  }

  // Fetch: Ticketmaster once + one Google query per category miss
  const missingCategories = categories.filter((cat, i) => cacheResults[i] === null)
  const [tmEvents, ...googleResults] = await Promise.all([
    fetchTicketmaster(city, stateCode, page),
    ...missingCategories.map(cat => fetchGoogleEvents(city, stateCode, page, CATEGORY_KEYWORDS[cat]))
  ])

  // Cache each Google result separately (only if it returned results)
  missingCategories.forEach((cat, i) => {
    const googleEvents = googleResults[i] || []
    if (googleEvents.length > 0) {
      writeCache(city, stateCode, cat, page, googleEvents).catch(() => {})
    }
  })

  // Merge: fresh Google results + any cached Google results + Ticketmaster
  const freshGoogle = googleResults.flat()
  const cachedGoogle = cacheResults.filter(r => r !== null).flat()
  const events = dedup([...tmEvents, ...freshGoogle, ...cachedGoogle])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  })
}

// Returns up to 2 category keys derived from what_i_do
function deriveCategories(whatIDo) {
  const lower = (whatIDo || '').toLowerCase()
  const cats = []

  // Networking/entrepreneur always first for ANTNET's core use case
  if (lower.includes('entrepreneur') || lower.includes('startup') || lower.includes('business') ||
      lower.includes('network') || lower.includes('connect') || lower.includes('sales')) {
    cats.push('networking')
  }
  if (lower.includes('fitness') || lower.includes('gym') || lower.includes('running') || lower.includes('run')) cats.push('fitness')
  if (lower.includes('real estate')) cats.push('realestate')
  if (lower.includes('tech') || lower.includes('developer') || lower.includes('software')) cats.push('tech')
  if (lower.includes('creative') || lower.includes('design') || lower.includes('art')) cats.push('creative')

  if (cats.length === 0) cats.push('networking')
  return cats.slice(0, 2) // max 2 Google queries
}

function dedup(events) {
  const seen = new Set()
  return events.filter(e => {
    const key = e.title?.toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
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
    const age = Date.now() - new Date(rows[0].fetched_at).getTime()
    if (age > CACHE_TTL_MS) return null
    return rows[0].events
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

async function fetchGoogleEvents(city, stateCode, page = 0, keyword = 'networking') {
  const key = process.env.SERPAPI_KEY
  const query = `${keyword} events in ${city} ${stateCode}`
  const start = page * 10
  const url = `https://serpapi.com/search.json?engine=google_events&q=${encodeURIComponent(query)}&start=${start}&api_key=${key}`

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`SerpApi error ${res.status} for "${query}":`, await res.text().catch(() => ''))
    return []
  }
  const data = await res.json()
  if (data.error) {
    console.error(`SerpApi error for "${query}":`, data.error)
    return []
  }
  const items = data.events_results || []

  return items.map((e, i) => {
    const eventDate = parseGoogleEventDate(e.date?.start_date, e.date?.when)
    return {
      id: `goog-${keyword}-${page}-${i}`,
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
