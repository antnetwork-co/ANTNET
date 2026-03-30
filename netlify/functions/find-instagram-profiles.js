const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY
const APIFY_TOKEN = process.env.APIFY_TOKEN

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const query = url.searchParams.get('q') || ''
  if (!query.trim()) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })

  // Step 1: Ask Claude to generate relevant hashtags from the query
  const hashtags = await generateHashtags(query)
  if (!hashtags.length) return new Response(JSON.stringify({ error: 'Could not generate hashtags' }), { status: 500 })

  // Step 2: Scrape Instagram posts from those hashtags via Apify
  const profiles = await scrapeProfiles(hashtags)

  return new Response(JSON.stringify({ hashtags, profiles }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function generateHashtags(query) {
  if (!CLAUDE_API_KEY) return []

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Generate 3 Instagram hashtags to find people who "${query}". These should be hashtags that professionals in this field actively use in their posts — not generic ones like #business or #entrepreneur.

Return ONLY a JSON array of hashtag strings without the # symbol. Example: ["socialmediamarketing","contentcreator","socialmediamanager"]`
        }]
      })
    })

    if (!res.ok) return []
    const data = await res.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) return []
    const tags = JSON.parse(match[0])
    return tags.filter(t => typeof t === 'string' && t.length > 0).slice(0, 3)
  } catch {
    return []
  }
}

async function scrapeProfiles(hashtags) {
  if (!APIFY_TOKEN) return []

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=25`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags,
          resultsLimit: 20,
        })
      }
    )

    if (!res.ok) {
      console.error('Apify error:', res.status, await res.text().catch(() => ''))
      return []
    }

    const posts = await res.json()

    // Extract unique profiles from post owners
    const seen = new Set()
    const profiles = []

    for (const post of (posts || [])) {
      const handle = post.ownerUsername || post.ownerId
      if (!handle || seen.has(handle)) continue
      seen.add(handle)

      profiles.push({
        handle: handle,
        name: post.ownerFullName || post.ownerUsername || handle,
        profile_pic: post.ownerProfilePicUrl || null,
        followers: post.ownerFollowersCount || null,
        bio: post.ownerBiography || null,
        profile_url: `https://instagram.com/${handle}`,
      })
    }

    return profiles.slice(0, 12)
  } catch (err) {
    console.error('Apify scrape error:', err.message)
    return []
  }
}
