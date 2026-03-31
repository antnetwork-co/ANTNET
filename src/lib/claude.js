// All Claude API calls go through Netlify Functions in production.
// In dev, calls go directly (VITE_CLAUDE_API_KEY must be set).
// Note: In production, move these to serverless functions to protect the API key.

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

async function callClaude({ model = 'claude-haiku-4-5', system, messages, max_tokens = 500 }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model, system, messages, max_tokens })
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

// Draft a follow-up or opener message for a contact
export async function draftMessage({ contact, lastMessage, platform, whatIDo, strategyCache, customContext }) {
  const isEmail = platform?.toLowerCase() === 'email'

  const strategyContext = strategyCache
    ? `\n\nOutreach strategy insights from past results (apply only what's relevant to this contact):\n${strategyCache}`
    : ''

  const system = isEmail
    ? `You write professional but personable networking emails.
Format: short subject line on the first line starting with "Subject:", then a blank line, then the email body.
The email should have a natural greeting, 2-3 short paragraphs, and a clear call to action or sign-off.
No em dashes. No "I hope this message finds you well." Sound like a real person, not a template.
The user's background: ${whatIDo || 'entrepreneur'}${strategyContext}`
    : `You write short, casual, human-sounding messages for someone who networks authentically — not like a salesperson.
No em dashes. No formal language. No "I hope this message finds you well."
Match the tone of a real text between two people who know each other. Instagram DMs and iMessages have the same casual tone.
The user's background: ${whatIDo || 'entrepreneur'}
Write one short message (2-4 sentences max) as a follow-up or opener.
Do not explain the message. Just write it.${strategyContext}`

  const userMsg = `Contact: ${contact.name || contact.instagram_handle}
Occupation: ${contact.occupation || 'unknown'}
Platform: ${platform || 'instagram'}
Last message sent: ${lastMessage || 'none yet'}
Follow-up note: ${contact.potential_followup || contact.follow_up_note || 'none'}
Days since last contact: ${contact.days_since || 'unknown'}${customContext ? `\nNew context to work into the message: ${customContext}` : ''}`

  return callClaude({ model: 'claude-haiku-4-5', system, messages: [{ role: 'user', content: userMsg }] })
}

// Analyze outreach patterns and produce a cached strategy summary
export async function analyzeOutreachStrategy({ outreachContacts, whatIDo }) {
  const rows = outreachContacts.map(c =>
    `- ${c.name || c.instagram_handle || 'Unknown'} | ${c.occupation || 'unknown'} | responded: ${c.responded ?? 'unknown'} | connected: ${c.connected ?? 'unknown'} | opportunity: ${c.opportunity ?? 'unknown'} | message: "${(c.message_sent || '').slice(0, 120)}"`
  ).join('\n')

  const system = `You are analyzing someone's outreach history to find what actually works.
Their background: ${whatIDo || 'entrepreneur'}

Your job: find patterns in who responded and who didn't, and why.
Look at: occupation types, message tone/length, whether a mutual was referenced, platform used, any other signals.

Write a concise strategy summary (8-12 bullet points max) in plain English. Each bullet should be a specific, actionable insight.
Examples:
- Fitness/wellness contacts responded at 80% — short casual openers worked best for this group
- Traders had 0% response rate regardless of message style — deprioritize this segment
- Mentioning a mutual connection in any occupation doubled response rates
- Messages under 3 sentences outperformed longer ones across all groups
- Real estate contacts responded better via email than DM

Only include patterns backed by actual data in the contacts below. Do not invent patterns.
If the dataset is too small to draw conclusions for a group, say so briefly.`

  return callClaude({
    model: 'claude-sonnet-4-6',
    system,
    messages: [{ role: 'user', content: `Outreach contacts:\n${rows}` }],
    max_tokens: 800
  })
}

// Summarize and classify sentiment of a received response
export async function summarizeResponse(responseText) {
  const system = `Summarize this response in 1-2 sentences. Be direct and factual.
Then classify sentiment as exactly one of: positive, neutral, negative.
Return JSON only: {"summary": "...", "sentiment": "..."}`

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    system,
    messages: [{ role: 'user', content: responseText }],
    max_tokens: 200
  })
  try {
    return JSON.parse(text.trim())
  } catch {
    return { summary: text, sentiment: 'neutral' }
  }
}

// Analyze network gaps
export async function analyzeGaps({ whatIDo, contacts }) {
  const contactList = contacts.map(c =>
    `- ${c.name || 'Unknown'}: ${c.occupation || ''} | ${c.skills_services || ''}`
  ).join('\n')

  const system = `You are analyzing a person's professional network to find gaps.
Their background: ${whatIDo}

Their current contacts:
${contactList}

For each category below, count how many contacts match and classify coverage:
- 0 contacts = MISSING
- 1 contact = WEAK
- 2-3 contacts = GROWING
- 4+ contacts = STRONG

Categories: Legal/Attorney, Designer/Creative, Investor/Capital, Developer/Engineer, Marketing/Growth, Sales/Lead Gen, PR/Media, Photo/Video, Finance/Accounting

Return JSON array only: [{"category": "...", "count": 0, "status": "MISSING", "reason": "..."}]`

  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    system,
    messages: [{ role: 'user', content: 'Analyze my network gaps.' }],
    max_tokens: 800
  })
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    return []
  }
}

// Answer a free-form question about the user's network
export async function askNetwork({ question, contacts, outreachContacts, whatIDo }) {
  const networkList = contacts.map(c =>
    `- ${c.name}: ${c.occupation || ''}, ${(c.locations || []).join('/')}, score: ${c.relationship_score}, last: ${c.last_spoken_to || 'never'}`
  ).join('\n')

  const outreachList = outreachContacts.map(c =>
    `- ${c.name || c.instagram_handle}: ${c.occupation || ''}, responded: ${c.responded}, connected: ${c.connected}`
  ).join('\n')

  const system = `You are a personal network intelligence assistant. You have access to the user's full contact database.
Answer questions about their network directly and specifically — reference real names from their data.
If asked to find someone, look through the data and name specific matches.
If no match exists, say so and suggest what kind of event or outreach might find that person.
Be concise. No filler. Sound like a smart advisor, not a chatbot.

User background: ${whatIDo || 'entrepreneur'}

Warm network:
${networkList || 'No contacts yet.'}

Outreach contacts:
${outreachList || 'No outreach yet.'}`

  return callClaude({
    model: 'claude-sonnet-4-6',
    system,
    messages: [{ role: 'user', content: question }],
    max_tokens: 600
  })
}

// Score and label events based on user's what_i_do and network gaps
export async function scoreEvents({ events, whatIDo, gaps }) {
  if (!events || events.length === 0) return []

  const gapList = gaps && gaps.length > 0
    ? gaps.filter(g => g.status === 'MISSING' || g.status === 'WEAK').map(g => g.category).join(', ')
    : ''

  const eventList = events.map((e, i) =>
    `${i}: ${e.title} | ${e.location} | ${e.notes?.slice(0, 80) || ''}`
  ).join('\n')

  const system = `You are scoring events for relevance to a user's networking goals.
User background: ${whatIDo || 'entrepreneur'}
Network gaps (categories they're missing): ${gapList || 'unknown'}

Score each event and give a short relevance label (max 6 words) explaining WHY it's relevant.
Examples: "Fills your Designer gap", "Investor networking opportunity", "Matches your fitness goal", "Good for finding clients"

Return JSON array only with index and label for events that are relevant (score >= 6):
[{"index": 0, "label": "...", "score": 8}]

Only include events with score 6 or higher. If no events qualify, return [].`

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    system,
    messages: [{ role: 'user', content: `Events to score:\n${eventList}` }],
    max_tokens: 600
  })
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    return []
  }
}

