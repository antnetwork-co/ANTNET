export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const handle = (url.searchParams.get('handle') || '').replace('@', '').trim()
  if (!handle) return new Response(JSON.stringify({ error: 'No handle provided' }), { status: 400 })

  const key = process.env.APIFY_API_KEY
  if (!key) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })

  try {
    // Run Instagram Profile Scraper synchronously and get dataset items back immediately
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${key}&timeout=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [handle] })
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('Apify error:', res.status, text)
      return new Response(JSON.stringify({ error: 'Apify request failed' }), { status: 502 })
    }

    const data = await res.json()
    const profile = Array.isArray(data) ? data[0] : null

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404 })
    }

    // Extract occupation: prefer business category, fall back to first line of bio
    let occupation = ''
    if (profile.businessCategoryName && profile.businessCategoryName !== 'Personal Blog') {
      occupation = profile.businessCategoryName
    } else if (profile.biography) {
      const firstLine = profile.biography.split('\n')[0].trim()
      // Use first line if it looks like a title (short, no URLs, no hashtags)
      if (firstLine.length > 0 && firstLine.length < 60 && !firstLine.includes('http') && !firstLine.includes('#')) {
        occupation = firstLine
      }
    }

    return new Response(JSON.stringify({
      name: profile.fullName || '',
      occupation,
      followers: profile.followersCount ?? null,
      following: profile.followsCount ?? null,
      is_verified: profile.verified ?? false,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Instagram lookup error:', err.message)
    return new Response(JSON.stringify({ error: 'Lookup failed' }), { status: 500 })
  }
}
