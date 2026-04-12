import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase, configured } from './lib/supabase'
import Auth          from './pages/Auth'
import Dashboard     from './pages/Dashboard'
import Biens         from './pages/Biens'
import PlanBien      from './pages/PlanBien'
import Locataires    from './pages/Locataires'
import Incidents     from './pages/Incidents'
import Signaler      from './pages/Signaler'
import Documents     from './pages/Documents'
import Messages      from './pages/Messages'
import Prestataires  from './pages/Prestataires'
import Catalogue     from './pages/Catalogue'
import Admin         from './pages/Admin'
import Demo          from './pages/Demo'
import Quittances    from './pages/Quittances'

// Tous les rôles avec accès gestion
const MGR = ['proprietaire','gestionnaire','agence','admin']

function NotConfigured() {
  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:440, width:'100%' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:22, marginBottom:12 }}>
          <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <code style={{ display:'block', background:'#1A1714', color:'#7EB89A', padding:12, borderRadius:8, fontSize:12, lineHeight:1.8 }}>
          REACT_APP_SUPABASE_URL = ...<br/>REACT_APP_SUPABASE_ANON_KEY = ...
        </code>
      </div>
    </div>
  )
}

function Loader() {
  const [show, setShow] = React.useState(false)
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 2500); return () => clearTimeout(t) }, [])
  function logout() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase')).forEach(k => localStorage.removeItem(k))
      supabase.auth.signOut().catch(() => {})
    } catch {}
    window.location.replace('/connexion')
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:20, background:'#F7F5F0' }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:24 }}>
        <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
      </div>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin .8s linear infinite' }}/>
      {show && (
        <a href="/connexion" onClick={e => { e.preventDefault(); logout() }}
          style={{ padding:'10px 24px', background:'#B83232', color:'#fff', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>
          🚪 Se déconnecter
        </a>
      )}
    </div>
  )
}

function Guard({ children, roles }) {
  const { session, profile, loading } = useAuth()
  if (loading)  return <Loader />
  if (!session) return <Navigate to="/connexion" replace />
  if (!profile) return <Loader />
  // Si roles défini et rôle pas dans la liste → accueil
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/connexion" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/"          element={<Guard><Dashboard /></Guard>} />
      <Route path="/incidents" element={<Guard><Incidents /></Guard>} />
      <Route path="/signaler"  element={<Guard><Signaler /></Guard>} />
      <Route path="/documents" element={<Guard><Documents /></Guard>} />
      <Route path="/messages"  element={<Guard><Messages /></Guard>} />
      <Route path="/quittances"       element={<Guard roles={MGR}><Quittances/></Guard>}/>
      <Route path="/demo"      element={<Guard><Demo /></Guard>} />
      {/* Réservé gestionnaires */}
      <Route path="/biens"           element={<Guard roles={MGR}><Biens /></Guard>} />
      <Route path="/biens/:id/plan"  element={<Guard roles={MGR}><PlanBien /></Guard>} />
      <Route path="/locataires"      element={<Guard roles={MGR}><Locataires /></Guard>} />
      <Route path="/prestataires"    element={<Guard roles={MGR}><Prestataires /></Guard>} />
      <Route path="/catalogue"       element={<Guard roles={MGR}><Catalogue /></Guard>} />
      <Route path="/admin"           element={<Guard roles={MGR}><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!configured) return <NotConfigured />
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
