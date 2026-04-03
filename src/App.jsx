import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabase, configured } from './lib/supabase'
import Auth        from './pages/Auth'
import Dashboard   from './pages/Dashboard'
import Biens       from './pages/Biens'
import PlanBien    from './pages/PlanBien'
import Locataires  from './pages/Locataires'
import Incidents   from './pages/Incidents'
import Signaler    from './pages/Signaler'
import Documents   from './pages/Documents'
import Messages    from './pages/Messages'
import Prestataires from './pages/Prestataires'
import Catalogue   from './pages/Catalogue'
import Admin       from './pages/Admin'
import Demo        from './pages/Demo'

function NotConfigured() {
  return (
    <div style={{ minHeight:'100vh', background:'#F7F5F0', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:440, width:'100%', border:'1px solid rgba(0,0,0,.08)' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:22, marginBottom:16 }}>
          <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
        </div>
        <div className="alert alert-warn" style={{ marginBottom:12 }}>Variables d'environnement manquantes</div>
        <code style={{ display:'block', background:'#1A1714', color:'#7EB89A', padding:12, borderRadius:8, fontSize:12, lineHeight:1.8 }}>
          REACT_APP_SUPABASE_URL = ...<br/>REACT_APP_SUPABASE_ANON_KEY = ...
        </code>
        <div className="alert alert-success" style={{ marginTop:12 }}>
          Vercel → Settings → Environment Variables → Redeploy
        </div>
      </div>
    </div>
  )
}

function Loader() {
  const [show, setShow] = React.useState(false)
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 2500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:20, background:'#F7F5F0', fontFamily:'sans-serif' }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:24 }}>
        <span style={{ color:'#2D5A3D' }}>Immo</span><span style={{ color:'#C8813A' }}>Track</span>
      </div>
      <div className="it-spinner"/>
      {show && (
        <a href="/connexion"
          onClick={e => { e.preventDefault(); try { Object.keys(localStorage).filter(k=>k.startsWith('sb-')||k.includes('supabase')).forEach(k=>localStorage.removeItem(k)); supabase.auth.signOut().catch(()=>{}) } catch {} window.location.replace('/connexion') }}
          style={{ padding:'10px 24px', background:'#B83232', color:'#fff', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>
          🚪 Se déconnecter
        </a>
      )}
    </div>
  )
}

function Guard({ children, roles }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!session) return <Navigate to="/connexion" replace />
  if (!profile) return <Loader />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/connexion" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/"           element={<Guard><Dashboard /></Guard>} />
      <Route path="/biens"      element={<Guard roles={['proprietaire','gestionnaire']}><Biens /></Guard>} />
      <Route path="/biens/:id/plan" element={<Guard roles={['proprietaire','gestionnaire']}><PlanBien /></Guard>} />
      <Route path="/locataires" element={<Guard roles={['proprietaire','gestionnaire']}><Locataires /></Guard>} />
      <Route path="/incidents"  element={<Guard><Incidents /></Guard>} />
      <Route path="/signaler"   element={<Guard><Signaler /></Guard>} />
      <Route path="/documents"  element={<Guard><Documents /></Guard>} />
      <Route path="/messages"   element={<Guard><Messages /></Guard>} />
      <Route path="/prestataires" element={<Guard roles={['proprietaire','gestionnaire']}><Prestataires /></Guard>} />
      <Route path="/catalogue"  element={<Guard roles={['proprietaire','gestionnaire']}><Catalogue /></Guard>} />
      <Route path="/admin"      element={<Guard roles={['proprietaire','gestionnaire']}><Admin /></Guard>} />
      <Route path="/demo"       element={<Guard><Demo /></Guard>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
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
