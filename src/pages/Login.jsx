import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#F5C842', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: '#0a0a0a',
            margin: '0 auto 16px'
          }}>A</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '4px' }}>ANTNET</div>
          <div style={{ fontSize: '12px', color: '#666', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', marginTop: '4px' }}>NETWORK INTELLIGENCE</div>
        </div>

        <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '32px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '2px', marginBottom: '24px' }}>
            {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            {error && (
              <div style={{ background: 'rgba(232,71,42,0.1)', border: '1px solid rgba(232,71,42,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#E8472A', marginBottom: '16px' }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: 'rgba(62,207,110,0.1)', border: '1px solid rgba(62,207,110,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#3ecf6e', marginBottom: '16px' }}>
                {message}
              </div>
            )}

            <button type="submit" className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#666' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              style={{ color: '#F5C842', cursor: 'pointer', fontWeight: 600 }}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>
          WHO YOU KNOW MATTERS MORE THAN WHAT YOU KNOW
        </div>
      </div>
    </div>
  )
}