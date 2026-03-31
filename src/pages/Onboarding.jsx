import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CityInput from '../components/CityInput'

const EXAMPLES = ['Entrepreneur', 'Content Creator', 'Sales / Biz Dev', 'Real Estate', 'Student', 'Freelancer']

export default function Onboarding({ userId }) {
  const [step, setStep] = useState(1)
  const [whatIDo, setWhatIDo] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStep1() {
    if (!whatIDo.trim() || !userId) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('profiles').upsert({
        id: userId,
        what_i_do: whatIDo.trim(),
        plan: 'free',
        updated_at: new Date().toISOString()
      })
      if (err) { setError('Save error: ' + err.message); setLoading(false); return }
      setStep(2)
    } catch (e) {
      setError('Unexpected error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2() {
    if (!city.trim() || !userId) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('profiles').update({
        city: city.trim(),
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      }).eq('id', userId)
      if (err) { setError('Save error: ' + err.message); setLoading(false); return }
      window.location.replace('/outreach')
    } catch (e) {
      setError('Unexpected error: ' + e.message)
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
        {/* Logo */}
        <div style={{
          width: '52px', height: '52px', background: '#F5C842', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: '#0a0a0a',
          margin: '0 auto 16px'
        }}>A</div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '28px' }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              width: s === step ? '24px' : '8px', height: '8px', borderRadius: '4px',
              background: s === step ? '#F5C842' : s < step ? '#3ecf6e' : '#2a2a2a',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>

        {step === 1 ? (
          <>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '3px', marginBottom: '8px' }}>
              WELCOME TO ANTNET
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
              Two questions to calibrate your AI.
            </div>

            <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>What do you do?</div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '18px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.5px' }}>
              be specific, this shapes everything
            </div>

            <input
              value={whatIDo}
              onChange={e => setWhatIDo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleStep1()}
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
                  onClick={() => setWhatIDo(ex)}
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

            {error && <div style={{ background: 'rgba(232,71,42,0.1)', border: '1px solid rgba(232,71,42,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#E8472A', marginBottom: '16px', textAlign: 'left' }}>{error}</div>}

            <button
              onClick={handleStep1}
              disabled={loading || !whatIDo.trim()}
              style={{
                width: '100%',
                background: loading ? '#555' : whatIDo.trim() ? '#F5C842' : '#333',
                color: whatIDo.trim() && !loading ? '#0a0a0a' : '#999',
                border: 'none', borderRadius: '10px', padding: '14px',
                fontSize: '15px', fontWeight: 700,
                cursor: loading || !whatIDo.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              {loading ? 'Saving...' : 'Next →'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '3px', marginBottom: '8px' }}>
              WHERE ARE YOU BASED?
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
              Used to surface local events and networking opportunities.
            </div>

            <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Your city</div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '18px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.5px' }}>
              type to search
            </div>

            <CityInput
              value={city}
              onChange={setCity}
              placeholder="e.g. Tampa, FL"
              style={{
                width: '100%', background: '#181818', border: '1px solid #2a2a2a',
                borderRadius: '10px', padding: '14px 18px', color: '#f0f0f0',
                fontSize: '15px', fontFamily: "'DM Sans', sans-serif", outline: 'none',
                marginBottom: '24px', boxSizing: 'border-box'
              }}
            />

            {error && <div style={{ background: 'rgba(232,71,42,0.1)', border: '1px solid rgba(232,71,42,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#E8472A', marginBottom: '16px', textAlign: 'left' }}>{error}</div>}

            <button
              onClick={handleStep2}
              disabled={loading || !city.trim()}
              style={{
                width: '100%',
                background: loading ? '#555' : city.trim() ? '#F5C842' : '#333',
                color: city.trim() && !loading ? '#0a0a0a' : '#999',
                border: 'none', borderRadius: '10px', padding: '14px',
                fontSize: '15px', fontWeight: 700,
                cursor: loading || !city.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              {loading ? 'Saving...' : "Let's Build"}
            </button>

            <div
              onClick={() => setStep(1)}
              style={{ marginTop: '14px', fontSize: '12px', color: '#444', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}
            >
              ← Back
            </div>
          </>
        )}
      </div>
    </div>
  )
}
