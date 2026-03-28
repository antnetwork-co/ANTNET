import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CityInput from '../components/CityInput'

export default function Settings() {
  const { profile, userId } = useOutletContext()

  const [whatIDo, setWhatIDo] = useState(profile?.what_i_do || '')
  const [city, setCity] = useState(profile?.city || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const { error: err } = await supabase.from('profiles').update({
        what_i_do: whatIDo.trim() || profile?.what_i_do,
        city: city.trim() || null,
        updated_at: new Date().toISOString()
      }).eq('id', userId)
      if (err) { setError(err.message); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">SETTINGS</div>
      </div>

      <div className="content" style={{ maxWidth: '560px' }}>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#666', fontFamily: "'JetBrains Mono', monospace", marginBottom: '20px' }}>
            Profile
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              What do you do?
            </label>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", marginBottom: '10px' }}>
              This shapes your AI, gap analysis, and event recommendations
            </div>
            <input
              value={whatIDo}
              onChange={e => setWhatIDo(e.target.value)}
              placeholder="e.g. Entrepreneur building a network in Tampa"
              className="input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Your city
            </label>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", marginBottom: '10px' }}>
              Used to pre-select your city on the Events page
            </div>
            <CityInput
              value={city}
              onChange={setCity}
              placeholder="e.g. Tampa, FL or Austin, TX"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(232,71,42,0.1)', border: '1px solid rgba(232,71,42,0.3)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '12px',
            color: '#E8472A', marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-gold"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: '120px' }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>

        <div style={{ marginTop: '48px', borderTop: '1px solid #2a2a2a', paddingTop: '24px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#666', fontFamily: "'JetBrains Mono', monospace", marginBottom: '16px' }}>
            Account
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
            Email: <span style={{ color: '#f0f0f0' }}>{profile?.email || '—'}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Plan: <span style={{ color: '#F5C842', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{profile?.plan || 'free'}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
