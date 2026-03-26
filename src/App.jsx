import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Outreach from './pages/Outreach'
import Network from './pages/Network'
import FollowUps from './pages/FollowUps'
import GapAnalysis from './pages/GapAnalysis'
import Events from './pages/Events'
import Upgrade from './pages/Upgrade'
import Layout from './components/Layout'
import './styles/global.css'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      if (session) await loadProfile(session.user.id)
      setLoading(false)
    }).catch(() => { clearTimeout(timeout); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
    } catch {
      setProfile(null)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: '#F5C842',
        fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '4px'
      }}>
        ANTNET
      </div>
    )
  }

  const needsOnboarding = session && profile && !profile.onboarding_complete
  const isNewUser = session && !profile

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/outreach" replace />} />
        <Route path="/onboarding" element={
          session ? <Onboarding userId={session.user.id} /> : <Navigate to="/login" replace />
        } />
        <Route path="/" element={
          !session
            ? <Navigate to="/login" replace />
            : (needsOnboarding || isNewUser)
              ? <Navigate to="/onboarding" replace />
              : <Layout session={session} profile={profile} />
        }>
          <Route index element={<Navigate to="/outreach" replace />} />
          <Route path="outreach" element={<Outreach />} />
          <Route path="network" element={<Network />} />
          <Route path="followups" element={<FollowUps />} />
          <Route path="gaps" element={<GapAnalysis />} />
          <Route path="events" element={<Events />} />
          <Route path="upgrade" element={<Upgrade session={session} profile={profile} onPlanChange={() => loadProfile(session.user.id)} />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/outreach' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
