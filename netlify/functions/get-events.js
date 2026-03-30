const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'Tampa'
  const stateCode = url.searchParams.get('state') || 'FL'
  const page = parseInt(url.searchParams.get('page') || '0')
  const whatIDo = url.searchParams.get('q') || ''

  const searchTerms = deriveSearchTerms(whatIDo) // e.g. ['startup networking', 'fitness running']
  const cacheKey = searchTerms.join('+')

  // Check cache
  const cached = await getCached(city, stateCode, cacheKey, page)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
    })
  }

  // Fetch: Claude web search (primary) + Ticketmaster (filler, capped)
  const [claudeEvents, tmEvents] = await Promise.all([
    fetchClaudeEvents(city, stateCode, searchTerms, page),
    fetchTicketmaster(city, stateCode, page),
  ])

  // Only include Ticketmaster results not already covered by Claude search
  const tmFiller = tmEvents.slice(0, 3)
  const events = dedup([...claudeEvents, ...tmFiller])
  events.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  if (claudeEvents.length > 0) {
    writeCache(city, stateCode, cacheKey, page, events).catch(() => {})
  }

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
  })
}

function deriveSearchTerms(whatIDo) {
  const lower = (whatIDo || '').toLowerCase()
  const terms = []

  if (lower.includes('real estate') || lower.includes('realtor')) terms.push('real estate investing networking')
  else if (lower.includes('developer') || lower.includes('software') || lower.includes('coder') || lower.includes('engineer')) terms.push('tech startup hackathon')
  else if (lower.includes('market') || lower.includes('content creator') || lower.includes('brand')) terms.push('marketing business networking')
  else if (lower.includes('entrepreneur') || lower.includes('founder') || lower.includes('startup') || lower.includes('business')) terms.push('entrepreneur startup networking')
  else if (lower.includes('investor') || lower.includes('venture') || lower.includes('vc')) terms.push('startup investor networking')
  else if (lower.includes('creative') || lower.includes('design') || lower.includes('artist')) terms.push('creative design networking')
  else terms.push('professional networking')

  if (lower.includes('fitness') || lower.includes('gym') || lower.includes('running') || lower.includes('run')) terms.push('fitness running clubs')
  else if (lower.includes('travel')) terms.push('social travel meetup')

  return terms.slice(0, 2)
}

/**
 * Uses Claude's web search tool to find real local events.
 * Claude searches Eventbrite, Meetup, Facebook Events, local sites —
 * the same way it finds events when you ask in chat.
 */
async function fetchClaudeEvents(city, stateCode, searchTerms, page = 0) {
  if (!CLAUDE_API_KEY) return []

  const today = new Date().toISOString().split('T')[0]
  const interests = searchTerms.join(' and ')
  const offset = page * 10

  const prompt = `Search for upcoming local events related to ${interests} in ${city}, ${stateCode}.
Today is ${today}. Find events happening in the next 60 days.
Search Eventbrite, Meetup, Facebook Events, and any local event websites.${offset > 0 ? ` Skip the first ${offset} results and return the next batch.` : ''}

Return ONLY a raw JSON array with no other text, markdown, or explanation. Each object:
{"title":"event name","event_date":"ISO 8601 datetime or date string","location":"venue name, address","event_url":"full URL or null","notes":"1-2 sentence description","price":"Free or price range or null"}

Include only events with a known date. Return 8-12 events.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!res.ok) {
      console.error('Claude events API error:', res.status, await res.text().catch(() => ''))
      return []
    }

    const data = await res.json()
    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock?.text) return []

    // Extract JSON array from response
    const match = textBlock.text.match(/\[[\s\S]*\]/)
    if (!match) {
      console.error('Claude events: no JSON array in response:', textBlock.text.slice(0, 200))
      return []
    }

    const raw = JSON.parse(match[0])
    return raw
      .filter(e => e.title && e.event_date)
      .map((e, i) => ({
        id: `claude-${searchTerms[0].replace(/\s+/g, '-')}-p${page}-${i}`,
        title: e.title,
        source: 'google', // display as green (web-sourced)
        location: e.location || city,
        event_date: normalizeDate(e.event_date),
        event_url: e.event_url || null,
        notes: e.notes || '',
        price: e.price || null,
        image: null,
      }))
      .filter(e => e.event_date) // drop events where date couldn't be parsed
  } catch (err) {
    console.error('Claude events fetch error:', err.message)
    return []
  }
}

function normalizeDate(raw) {
  if (!raw) return null
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch {}
  return null
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

async function getCached(city, stateCode, cacheKey, page) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/event_cache?city=eq.${encodeURIComponent(city)}&state_code=eq.${encodeURIComponent(stateCode)}&category=eq.${encodeURIComponent(cacheKey)}&page=eq.${page}&select=events,fetched_at`,
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

async function writeCache(city, stateCode, cacheKey, page, events) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/event_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ city, state_code: stateCode, category: cacheKey, page, events, fetched_at: new Date().toISOString() })
  })
}

async function fetchTicketmaster(city, stateCode, page = 0) {
  const key = process.env.TICKETMASTER_API_KEY
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&city=${encodeURIComponent(city)}&stateCode=${stateCode}&size=5&sort=date,asc&startDateTime=${startDateTime}&page=${page}`

  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data._embedded?.events || []).map(e => ({
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
