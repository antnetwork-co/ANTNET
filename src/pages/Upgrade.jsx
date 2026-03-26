import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Upgrade({ session, profile, onPlanChange }) {
  const [loading, setLoading] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [searchParams] = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  const isPro = profile?.plan === 'pro'
  const isTrialing = profile?.plan === 'trialing'
  const hasAccess = isPro || isTrialing

  useEffect(() => {
    if (success) {
      // Refresh profile after successful checkout
      setTimeout(() => onPlanChange?.(), 2000)
    }
  }, [success])

  async function startCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user?.email,
          userId: session?.user?.id,
          promoCode: promoCode.trim() || null
        })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Checkout error: ' + data.error)
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setLoading(false)
  }

  async function openPortal() {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: profile?.stripe_customer_id })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Portal error: ' + data.error)
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="page-title">ANTNET <span>PRO</span></div>
      </div>

      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        {success && (
          <div style={{
            position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
            background: '#3ecf6e', color: '#0a0a0a', padding: '12px 24px',
            borderRadius: '8px', fontWeight: 700, fontSize: '14px', zIndex: 9999
          }}>
            You're in! Your 30-day trial has started.
          </div>
        )}
        {canceled && (
          <div style={{
            position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
            background: '#2a2a2a', color: '#f0f0f0', padding: '12px 24px',
            borderRadius: '8px', fontWeight: 700, fontSize: '14px', zIndex: 9999
          }}>
            No worries — you can upgrade anytime.
          </div>
        )}

        <div style={{
          background: '#111', border: '1px solid #2a2a2a', borderRadius: '20px',
          width: '480px', maxWidth: '92vw', padding: '40px', textAlign: 'center'
        }}>
          <div style={{
            width: '52px', height: '52px', background: '#F5C842', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: '#0a0a0a',
            margin: '0 auto 20px'
          }}>A</div>

          {hasAccess ? (
            <>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '3px', marginBottom: '8px' }}>
                {isTrialing ? 'TRIAL ACTIVE' : 'YOU\'RE PRO'}
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
                {isTrialing
                  ? 'Your 30-day free trial is active. You\'ll be charged $25/month after it ends.'
                  : 'Full access to all AI features, outreach tracking, and gap analysis.'}
              </div>
              <div style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px 20px', marginBottom: '24px', textAlign: 'left'
              }}>
                <div style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono',monospace", marginBottom: '8px' }}>CURRENT PLAN</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#F5C842' }}>
                  AntNet Pro — $25/month
                </div>
                <div style={{ fontSize: '12px', color: '#3ecf6e', marginTop: '4px' }}>
                  {isTrialing ? '● Trial active' : '● Active'}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%', padding: '14px' }} onClick={openPortal} disabled={loading}>
                {loading ? 'Loading...' : 'Manage Subscription →'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '3px', marginBottom: '8px' }}>
                UPGRADE TO PRO
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px', lineHeight: 1.6 }}>
                30 days free, then $25/month. Cancel anytime.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', textAlign: 'left' }}>
                {[
                  '◆ AI drafts for every outreach message',
                  '◆ Ask your network anything with AI',
                  '◆ Full gap analysis with AI insights',
                  '◆ Unlimited contacts & follow-ups',
                  '◆ Event intelligence & recommendations',
                ].map(f => (
                  <div key={f} style={{ fontSize: '13px', color: '#c0c0c0', display: 'flex', gap: '8px' }}>{f}</div>
                ))}
              </div>

              <div style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>$25<span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>/month</span></div>
                  <div style={{ fontSize: '11px', color: '#3ecf6e', marginTop: '2px' }}>First 30 days free</div>
                </div>
                <div style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>
                  Card required<br />Cancel anytime
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                {!showPromo ? (
                  <div
                    style={{ fontSize: '12px', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setShowPromo(true)}
                  >
                    Have a promo or beta code?
                  </div>
                ) : (
                  <input
                    className="input"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. BETAACCESS)"
                    style={{ textAlign: 'center', letterSpacing: '2px', fontFamily: "'JetBrains Mono',monospace" }}
                    autoFocus
                  />
                )}
              </div>

              <button
                className="btn btn-gold"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                onClick={startCheckout}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Start Free Trial →'}
              </button>
              <div style={{ fontSize: '11px', color: '#444', marginTop: '12px' }}>
                Powered by Stripe. Secure checkout.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
