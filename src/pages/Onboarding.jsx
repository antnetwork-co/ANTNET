import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EXAMPLES = ['Entrepreneur', 'Content Creator', 'Sales / Biz Dev', 'Real Estate', 'Student', 'Freelancer']

export default function Onboarding({ userId }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!value.trim() || !userId) return
    setLoading(true)
    setError('')

    try {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        what_i_do: value.trim(),
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      })
      if (upsertError) { setError('Save error: ' + upsertError.message); setLoading(false); return }
      window.location.replace('/outreach')
    } catch (err) {
      setError('Unexpected error: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: '20px',
        width: '460px', maxWidth: '92vw', padding: '40px', textAlign: 'center'
      }}>
        <div style={{
          width: '52px', height: '52px', background: '#F5C842', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: '#0a0a0a',
          margin: '0 auto 16px'
        }}>A</div>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '3px', marginBottom: '8px' }}>
          WELCOME TO ANTNET
        </div>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
          One question to calibrate your AI.
        </div>

        <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>What do you do?</div>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '18px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.5px' }}>
          be specific, this shapes everything
        </div>

        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
          placeholder="e.g. Entrepreneur building a network in Tampa"
          style={{
            width: '100%', background: '#181818', border: '1px solid #2a2a2a',
            borderRadius: '10px', padding: '14px 18px', color: '#f0f0f0',
            fontSize: '15px', fontFamily: "'DM Sans', sans-serif", outline: 'none',
            marginBottom: '12px', boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
          {EXAMPLES.map(ex => (
            <div
              key={ex}
              onClick={() => setValue(ex)}
              style={{
                padding: '5px 12px', borderRadius: '20px', border: '1px solid #2a2a2a',
                fontSize: '11px', color: '#666', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace"
              }}
            >
              {ex}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(232,71,42,0.1)', border: '1px solid rgba(232,71,42,0.3)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
            color: '#E8472A', marginBottom: '16px', textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          style={{
            width: '100%',
            background: loading ? '#555' : value.trim() ? '#F5C842' : '#333',
            color: value.trim() && !loading ? '#0a0a0a' : '#999',
            border: 'none', borderRadius: '10px', padding: '14px',
            fontSize: '15px', fontWeight: 700,
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          {loading ? 'Saving...' : "Let's Build"}
        </button>

      </div>
    </div>
  )
}
