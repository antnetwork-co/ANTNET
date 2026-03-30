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

  const searchTerms = deriveSearchTerms(whatIDo) // e.g. ['entrepreneur startup', 'fitness run club']
  const tmKeyword = searchTerms[0] // Ticketmaster keyword filter

  // Check cache for each search term
  const cacheResults = await Promise.all(searchTerms.map(term => getCached(city, stateCode, term, page)))
  const allCached = cacheResults.every(r => r !== null)

  if (allCached) {
    const events = dedup(cacheResults.flat())
    events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    })
  }

  // Fetch Ticketmaster (with role keyword) + Google per missing term
  const missingTerms = searchTerms.filter((term, i) => cacheResults[i] === null)
  const [tmEvents, ...googleResults] = await Promise.all([
    fetchTicketmaster(city, stateCode, page, tmKeyword),
    ...missingTerms.map(term => fetchGoogleEvents(city, stateCode, page, term))
  ])

  // Cache each Google result by term (only if it returned something)
  missingTerms.forEach((term, i) => {
    const googleEvents = googleResults[i] || []
    if (googleEvents.length > 0) {
      writeCache(city, stateCode, term, page, googleEvents).catch(() => {})
    }
  })

  const cachedGoogle = cacheResults.filter(r => r !== null).flat()
  const events = dedup([...tmEvents, ...googleResults.flat(), ...cachedGoogle])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  })
}

/**
 * Derives up to 2 specific search terms from what_i_do.
 * Primary term = role/occupation. Secondary = side interest if different.
 * These are used as both Google queries and Ticketmaster keyword filters.
 */
function deriveSearchTerms(whatIDo) {
  const lower = (whatIDo || '').toLowerCase()
  const terms = []

  // Primary: role/occupation — ordered by specificity
  if (lower.includes('real estate') || lower.includes('realtor') || lower.includes('realty')) {
    terms.push('real estate investor meetup')
  } else if (lower.includes('developer') || lower.includes('software') || lower.includes('coder') || lower.includes('engineer') || lower.includes('programmer')) {
    terms.push('hackathon tech meetup')
  } else if (lower.includes('market') || lower.includes('content creator') || lower.includes('brand') || lower.includes('advertis')) {
    terms.push('marketing meetup')
  } else if (lower.includes('investor') || lower.includes('venture') || lower.includes('vc') || lower.includes('angel')) {
    terms.push('investor venture capital event')
  } else if (lower.includes('creative') || lower.includes('design') || lower.includes('artist') || lower.includes('photographer')) {
    terms.push('creative design meetup')
  } else if (lower.includes('sales') || lower.includes('biz dev') || lower.includes('business development')) {
    terms.push('sales business networking event')
  } else if (lower.includes('entrepreneur') || lower.includes('founder') || lower.includes('startup') || lower.includes('business owner')) {
    terms.push('entrepreneur startup meetup')
  } else if (lower.includes('network') || lower.includes('connect')) {
    terms.push('professional networking event')
  } else {
    terms.push('professional networking event')
  }

  // Secondary: side interest — only add if different from primary
  if (terms.length < 2) {
    if ((lower.includes('fitness') || lower.includes('gym') || lower.includes('running') || lower.includes('run')) && !terms[0].includes('fitness')) {
      terms.push('fitness run club')
    } else if (lower.includes('travel') && !terms[0].includes('travel')) {
      terms.push('travel social event')
    } else if (lower.includes('sport') || lower.includes('outdoor')) {
      terms.push('outdoor sports event')
    }
  }

  return terms.slice(0, 2)
}

function dedup(events) {
  const seen = new Set()
  return events.filter(e => {
    const key = (e.title || '').toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function getCached(city, stateCode, term, page) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/event_cache?city=eq.${encodeURIComponent(city)}&state_code=eq.${encodeURIComponent(stateCode)}&category=eq.${encodeURIComponent(term)}&page=eq.${page}&select=events,fetched_at`,
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

async function writeCache(city, stateCode, term, page, events) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/event_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ city, state_code: stateCode, category: term, page, events, fetched_at: new Date().toISOString() })
  })
}

async function fetchTicketmaster(city, stateCode, page = 0, keyword = '') {
  const key = process.env.TICKETMASTER_API_KEY
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  // classificationName=Miscellaneous targets non-entertainment events (conferences, expos, meetups)
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&city=${encodeURIComponent(city)}&stateCode=${stateCode}&size=10&sort=date,asc&startDateTime=${startDateTime}&page=${page}&classificationName=Miscellaneous&keyword=${encodeURIComponent(keyword)}`

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

async function fetchGoogleEvents(city, stateCode, page = 0, searchTerm = 'professional networking event') {
  const key = process.env.SERPAPI_KEY
  const query = `${searchTerm} in ${city} ${stateCode}`
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

  return (data.events_results || []).map((e, i) => ({
    id: `goog-${searchTerm.replace(/\s+/g, '-')}-${page}-${i}`,
    title: e.title,
    source: 'google',
    location: Array.isArray(e.address) ? e.address.join(', ') : (e.address || city),
    event_date: parseGoogleEventDate(e.date?.start_date, e.date?.when),
    event_url: e.link || (e.ticket_info?.[0]?.link) || null,
    notes: e.description || '',
    price: e.ticket_info?.[0]?.info || null,
    image: e.thumbnail || null,
  }))
}

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
