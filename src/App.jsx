import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { configured } from './lib/supabase'
import Auth         from './pages/Auth'
import Dashboard    from './pages/Dashboard'
import Biens        from './pages/Biens'
import PlanBien     from './pages/PlanBien'
import Locataires   from './pages/Locataires'
import Incidents    from './pages/Incidents'
import Signaler     from './pages/Signaler'
import Documents    from './pages/Documents'
import Messages     from './pages/Messages'
import Prestataires from './pages/Prestataires'
import Catalogue    from './pages/Catalogue'
import Admin        from './pages/Admin'
import Demo         from './pages/Demo'
import Quittances   from './pages/Quittances'
import Tchat        from './pages/Tchat'
import Profil       from './pages/Profil'

const MGR = ['proprietaire','gestionnaire','agence','admin']

function Spinner() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:16,background:'#F7F5F0'}}>
      <div style={{fontFamily:'Georgia,serif',fontSize:22}}>
        <span style={{color:'#2D5A3D'}}>Immo</span><span style={{color:'#C8813A'}}>Track</span>
      </div>
      <div style={{width:32,height:32,borderRadius:'50%',border:'3px solid #E8F2EB',borderTopColor:'#2D5A3D',animation:'spin .8s linear infinite'}}/>
    </div>
  )
}

// Guard : attend que l'auth soit prête, puis redirige si besoin
function Guard({ children, roles }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner/>
  if (!session) return <Navigate to="/connexion" replace/>
  if (!profile) return <Spinner/>
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace/>
  return children
}

function AppRoutes() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <Spinner/>
  // Mode recovery : forcer le changement de mot de passe
  if (recovery) return <Profil forcePasswordChange/>
  return (
    <Routes>
      <Route path="/connexion" element={session ? <Navigate to="/" replace/> : <Auth/>}/>
      <Route path="/"                element={<Guard><Dashboard/></Guard>}/>
      <Route path="/incidents"       element={<Guard><Incidents/></Guard>}/>
      <Route path="/signaler"        element={<Guard><Signaler/></Guard>}/>
      <Route path="/documents"       element={<Guard><Documents/></Guard>}/>
      <Route path="/messages"        element={<Guard><Messages/></Guard>}/>
      <Route path="/demo"            element={<Guard><Demo/></Guard>}/>
      <Route path="/biens"           element={<Guard roles={MGR}><Biens/></Guard>}/>
      <Route path="/biens/:id/plan"  element={<Guard><PlanBien/></Guard>}/>
      <Route path="/locataires"      element={<Guard roles={MGR}><Locataires/></Guard>}/>
      <Route path="/prestataires"    element={<Guard roles={MGR}><Prestataires/></Guard>}/>
      <Route path="/catalogue"       element={<Guard roles={MGR}><Catalogue/></Guard>}/>
      <Route path="/quittances"      element={<Guard roles={MGR}><Quittances/></Guard>}/>
      <Route path="/tchat"           element={<Guard><Tchat/></Guard>}/>
      <Route path="/admin"           element={<Guard roles={MGR}><Admin/></Guard>}/>
      <Route path="/profil"          element={<Guard><Profil/></Guard>}/>
      <Route path="*"                element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default function App() {
  if (!configured) return (
    <div style={{padding:32,fontFamily:'sans-serif',textAlign:'center'}}>
      <h2>Configuration manquante</h2>
      <p>Variables REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY requises.</p>
    </div>
  )
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes/>
      </BrowserRouter>
    </AuthProvider>
  )
}
