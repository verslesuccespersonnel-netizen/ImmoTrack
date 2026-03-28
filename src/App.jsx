// src/App.jsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AuthPage          from './pages/Auth'
import Dashboard         from './pages/Dashboard'
import Incidents         from './pages/Incidents'
import SignalerIncident  from './pages/SignalerIncident'
import Documents         from './pages/Documents'
import Messages          from './pages/Messages'

function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',
                  minHeight:'100vh',color:'#6B6560',fontSize:14,fontFamily:'sans-serif' }}>
      Chargement…
    </div>
  )
  if (!session) return <Navigate to="/connexion" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/connexion" element={session ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/incidents/:id" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/signaler" element={<ProtectedRoute roles={['locataire']}><SignalerIncident /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
