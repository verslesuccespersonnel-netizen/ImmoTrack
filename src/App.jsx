import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import ErrorBoundary      from './components/ErrorBoundary'
import AuthPage           from './pages/Auth'
import Dashboard          from './pages/Dashboard'
import Incidents          from './pages/Incidents'
import SignalerIncident   from './pages/SignalerIncident'
import Documents          from './pages/Documents'
import Messages           from './pages/Messages'
import Biens              from './pages/Biens'
import Prestataires       from './pages/Prestataires'
import Admin              from './pages/Admin'
import Catalogue          from './pages/Catalogue'
import PlanBien           from './pages/PlanBien'

function NotConfigured() {
  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', padding:'36px 32px', maxWidth:520, width:'100%' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:24, marginBottom:16 }}>
          <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, marginBottom:10 }}>🔑 Variables manquantes</h2>
        <div style={{ background:'#1A1714', borderRadius:8, padding:'14px 16px', marginBottom:12, fontFamily:'monospace', fontSize:12, color:'#E8F2EB', lineHeight:2 }}>
          <div style={{ color:'#5F7A67' }}># Vercel → Settings → Environment Variables</div>
          <div><span style={{ color:'#C8813A' }}>REACT_APP_SUPABASE_URL</span> = https://xxxx.supabase.co</div>
          <div><span style={{ color:'#C8813A' }}>REACT_APP_SUPABASE_ANON_KEY</span> = eyJhbG...</div>
        </div>
        <div style={{ background:'#E8F2EB', borderRadius:8, padding:'12px 14px', fontSize:13, color:'#2D5A3D' }}>
          Après ajout : Vercel → Deployments → ⋯ → Redeploy
        </div>
      </div>
    </div>
  )
}

// Écran de chargement avec bouton déconnexion de secours
function LoadingScreen() {
  const { supabase: sb } = require('./lib/supabase')
  async function forceLogout() {
    try { await sb.auth.signOut() } catch(e) {}
    window.location.href = '/connexion'
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:16, background:'#F7F5F0', fontFamily:'sans-serif' }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22 }}>
        <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
      </div>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' }}/>
      <button
        onClick={forceLogout}
        style={{ marginTop:8, padding:'8px 16px', background:'transparent', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, cursor:'pointer', fontFamily:'sans-serif', fontSize:12, color:'#6B6560' }}>
        Se déconnecter
      </button>
    </div>
  )
}

function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <LoadingFallback />
  if (!session) return <Navigate to="/connexion" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function LoadingFallback() {
  async function logout() {
    const { supabase } = await import('./lib/supabase')
    try { await supabase.auth.signOut() } catch(e) {}
    window.location.href = '/connexion'
  }
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:16, background:'#F7F5F0', fontFamily:'sans-serif' }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22 }}>
        <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
      </div>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' }}/>
      <button onClick={logout}
        style={{ marginTop:8, padding:'8px 16px', background:'transparent', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, cursor:'pointer', fontFamily:'sans-serif', fontSize:12, color:'#6B6560' }}>
        Se déconnecter
      </button>
    </div>
  )
}

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/connexion"      element={session ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/incidents"      element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/incidents/:id"  element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/signaler"       element={<ProtectedRoute roles={['locataire']}><SignalerIncident /></ProtectedRoute>} />
      <Route path="/documents"      element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/messages"       element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/biens"          element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Biens /></ProtectedRoute>} />
      <Route path="/biens/:id/plan" element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><PlanBien /></ProtectedRoute>} />
      <Route path="/prestataires"   element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Prestataires /></ProtectedRoute>} />
      <Route path="/catalogue"      element={<ProtectedRoute roles={['proprietaire','gestionnaire']}><Catalogue /></ProtectedRoute>} />
      <Route path="/admin"          element={<ProtectedRoute roles={['gestionnaire','proprietaire']}><Admin /></ProtectedRoute>} />
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
