import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase, supabaseConfigured } from './lib/supabase'
import ErrorBoundary    from './components/ErrorBoundary'
import AuthPage         from './pages/Auth'
import Dashboard        from './pages/Dashboard'
import Incidents        from './pages/Incidents'
import SignalerIncident from './pages/SignalerIncident'
import Documents        from './pages/Documents'
import Messages         from './pages/Messages'
import Biens            from './pages/Biens'
import Prestataires     from './pages/Prestataires'
import Admin            from './pages/Admin'
import Catalogue        from './pages/Catalogue'
import PlanBien         from './pages/PlanBien'
import Demo             from './pages/Demo'

function NotConfigured() {
  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'32px', maxWidth:440, width:'100%' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:22, marginBottom:14 }}>
          <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <code style={{ display:'block', background:'#1A1714', color:'#7EB89A', padding:'12px', borderRadius:8, fontSize:12, lineHeight:1.8, marginBottom:10 }}>
          REACT_APP_SUPABASE_URL = ...<br/>REACT_APP_SUPABASE_ANON_KEY = ...
        </code>
        <div style={{ background:'#E8F2EB', padding:'10px 14px', borderRadius:8, fontSize:13, color:'#2D5A3D' }}>
          Vercel → Settings → Environment Variables → Redeploy
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  async function logout() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k)
    })
    sessionStorage.clear()
    try { await supabase.auth.signOut() } catch(e) {}
    window.location.replace('/connexion')
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh',
      flexDirection:'column', gap:20, background:'#F7F5F0', fontFamily:'sans-serif' }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:24 }}>
        <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
      </div>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #E8F2EB',
        borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' }}/>
      <button onClick={logout} style={{ padding:'9px 22px', background:'#fff',
        border:'1px solid rgba(184,50,50,0.3)', borderRadius:8, cursor:'pointer',
        fontFamily:'sans-serif', fontSize:13, color:'#B83232', fontWeight:500 }}>
        🚪 Se déconnecter
      </button>
    </div>
  )
}

function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth()

  // Toujours afficher loading si on attend encore
  if (loading) return <LoadingScreen />

  // Pas de session → login
  if (!session) return <Navigate to="/connexion" replace />

  // Si profil pas encore chargé mais session ok → on attend (ne pas rediriger)
  if (!profile) return <LoadingScreen />

  // Vérification du rôle
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/connexion"      element={session ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/incidents"      element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/incidents/:id"  element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/signaler"       element={<ProtectedRoute><SignalerIncident /></ProtectedRoute>} />
      <Route path="/documents"      element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/messages"       element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/biens"          element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Biens /></ProtectedRoute>} />
      <Route path="/biens/:id/plan" element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><PlanBien /></ProtectedRoute>} />
      <Route path="/prestataires"   element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Prestataires /></ProtectedRoute>} />
      <Route path="/catalogue"      element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Catalogue /></ProtectedRoute>} />
      <Route path="/admin"          element={<ProtectedRoute roles={['gestionnaire','proprietaire']}><Admin /></ProtectedRoute>} />
      <Route path="/demo"           element={<ProtectedRoute><Demo /></ProtectedRoute>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!supabaseConfigured) return <NotConfigured />
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
