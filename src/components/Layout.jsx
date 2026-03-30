import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AIModal from './AIModal'

export default function Layout({ session, profile }) {
  const navigate = useNavigate()
  const [showAI, setShowAI] = useState(false)
  const [aiInitialAction, setAIInitialAction] = useState(null)
  const [followUpCount, setFollowUpCount] = useState(0)

  useEffect(() => {
    fetchFollowUpCount()
    // Refresh session every 4 minutes to prevent mid-query token expiry stalls
    const keepalive = setInterval(() => {
      supabase.auth.getSession()
    }, 4 * 60 * 1000)
    return () => clearInterval(keepalive)
  }, [])

  async function fetchFollowUpCount() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { count } = await supabase
      .from('network_contacts')
      .select('*', { count: 'exact', head: true })
      .not('last_spoken_to', 'is', null)
      .lte('last_spoken_to', thirtyDaysAgo)
    setFollowUpCount(count || 0)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const name = profile?.full_name || session?.user?.email?.split('@')[0] || 'AN'
  const initials = name.slice(0, 2).toUpperCase()
  const plan = profile?.plan || 'free'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
        background: '#111111', borderRight: '1px solid #2a2a2a',
        display: 'flex', flexDirection: 'column', zIndex: 100
      }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: '#F5C842', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue', sans-serif", color: '#0a0a0a', fontSize: '16px', flexShrink: 0
            }}>A</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '2px' }}>ANTNET</div>
              <div style={{ fontSize: '9px', color: '#666', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>NETWORK INTELLIGENCE</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={sectionLabelStyle}>Overview</div>
            <NavLink to="/outreach" style={({ isActive }) => navStyle(isActive)}>
              <span>📡</span> Outreach
            </NavLink>
            <NavLink to="/network" style={({ isActive }) => navStyle(isActive)}>
              <span>🕸️</span> My Network
            </NavLink>
            <NavLink to="/followups" style={({ isActive }) => navStyle(isActive)}>
              <span>🔔</span> Follow-Ups
              {followUpCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#E8472A', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {followUpCount}
                </span>
              )}
            </NavLink>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={sectionLabelStyle}>Intelligence</div>
            <div
              onClick={() => setShowAI(true)}
              style={{ ...navStyle(false), cursor: 'pointer' }}
            >
              <span>◆</span> AI Assistant
              <span style={{ marginLeft: 'auto', background: '#F5C842', color: '#0a0a0a', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>NEW</span>
            </div>
            <NavLink to="/events" style={({ isActive }) => navStyle(isActive)}>
              <span>🗓️</span> Events
            </NavLink>
            <NavLink to="/gaps" style={({ isActive }) => navStyle(isActive)}>
              <span>📊</span> Gap Analysis
            </NavLink>
          </div>

          <div>
            <div style={sectionLabelStyle}>Account</div>
            <NavLink to="/upgrade" style={({ isActive }) => navStyle(isActive)}>
              <span>⚡</span> {plan === 'pro' || plan === 'trialing' ? 'Manage Plan' : 'Upgrade to Pro'}
              {plan === 'free' && (
                <span style={{ marginLeft: 'auto', background: '#F5C842', color: '#0a0a0a', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>FREE</span>
              )}
            </NavLink>
            <NavLink to="/settings" style={({ isActive }) => navStyle(isActive)}>
              <span>⚙️</span> Settings
            </NavLink>
          </div>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid #2a2a2a' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '8px', background: '#181818', cursor: 'pointer'
            }}
            onClick={handleSignOut}
            title="Sign out"
          >
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, #F5C842, #E8472A)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#0a0a0a', flexShrink: 0
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{ fontSize: '10px', color: '#F5C842', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
                {plan === 'pro' ? 'PRO' : plan === 'beta' ? 'BETA' : plan === 'lifetime' ? 'LIFETIME' : 'FREE'} · Sign out
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh' }}>
        <Outlet context={{ profile, userId: session?.user?.id, openAI: (action) => { setAIInitialAction(action || null); setShowAI(true) } }} />
      </main>

      {showAI && <AIModal profile={profile} initialAction={aiInitialAction} onClose={() => { setShowAI(false); setAIInitialAction(null) }} />}
    </div>
  )
}

const sectionLabelStyle = {
  fontSize: '9px', letterSpacing: '2px', color: '#666', textTransform: 'uppercase',
  padding: '0 8px', marginBottom: '6px', fontFamily: "'JetBrains Mono', monospace"
}

function navStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 10px', borderRadius: '8px',
    fontSize: '13.5px', color: isActive ? '#f0f0f0' : '#666',
    fontWeight: 500,
    background: isActive ? '#222222' : 'transparent',
    border: isActive ? '1px solid #2a2a2a' : '1px solid transparent',
    textDecoration: 'none', marginBottom: '2px', transition: 'all 0.15s'
  }
}
