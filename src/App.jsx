import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'
import AuthPage         from './pages/Auth'
import Dashboard        from './pages/Dashboard'
import Incidents        from './pages/Incidents'
import SignalerIncident from './pages/SignalerIncident'
import Documents        from './pages/Documents'
import Messages         from './pages/Messages'

// ── Écran de configuration manquante ────────────────────
function NotConfigured() {
  return (
    <div style={{
      minHeight: '100vh', background: '#F7F5F0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '36px 32px', maxWidth: 520, width: '100%',
      }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, marginBottom: 20 }}>
          <span style={{ color: '#2D5A3D' }}>Immo</span>
          <span style={{ color: '#C8813A' }}>Track</span>
        </div>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, marginBottom: 10 }}>
          🔑 Configuration requise
        </h2>
        <p style={{ color: '#6B6560', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Les variables d'environnement Supabase ne sont pas détectées.
          Ajoutez-les dans <strong>Vercel → Settings → Environment Variables</strong> :
        </p>
        <div style={{ background: '#1A1714', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#E8F2EB', lineHeight: 2 }}>
            <div style={{ color: '#5F7A67' }}># Supabase Dashboard → Settings → API</div>
            <div>
              <span style={{ color: '#C8813A' }}>REACT_APP_SUPABASE_URL</span>
              <span style={{ color: '#9E9890' }}> = </span>
              <span style={{ color: '#7EB89A' }}>https://xxxx.supabase.co</span>
            </div>
            <div>
              <span style={{ color: '#C8813A' }}>REACT_APP_SUPABASE_ANON_KEY</span>
              <span style={{ color: '#9E9890' }}> = </span>
              <span style={{ color: '#7EB89A' }}>eyJhbGciOiJIUzI1NiIs...</span>
            </div>
          </div>
        </div>
        <div style={{ background: '#E8F2EB', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#2D5A3D', lineHeight: 1.6 }}>
          Après les avoir ajoutées :<br />
          <strong>Vercel → votre projet → Deployments → ⋯ → Redeploy</strong>
        </div>
      </div>
    </div>
  )
}

// ── Route protégée ───────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth()

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', color: '#6B6560', fontSize: 14,
      fontFamily: 'sans-serif', background: '#F7F5F0',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, marginBottom: 16 }}>
          <span style={{ color: '#2D5A3D' }}>Immo</span>
          <span style={{ color: '#C8813A' }}>Track</span>
        </div>
        Chargement…
      </div>
    </div>
  )

  if (!session) return <Navigate to="/connexion" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

// ── Routes ───────────────────────────────────────────────
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

// ── App root ─────────────────────────────────────────────
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
