// src/components/Layout.jsx
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { signOut } from '../lib/supabase'

const NAV = {
  locataire: [
    { path: '/',          label: 'Accueil',       icon: '🏠' },
    { path: '/incidents', label: 'Mes incidents', icon: '⚠️' },
    { path: '/signaler',  label: 'Signaler',      icon: '➕' },
    { path: '/documents', label: 'Documents',     icon: '📄' },
    { path: '/messages',  label: 'Messages',      icon: '💬' },
  ],
  proprietaire: [
    { path: '/',            label: 'Tableau de bord', icon: '📊' },
    { path: '/biens',       label: 'Mes biens',       icon: '🏢' },
    { path: '/incidents',   label: 'Incidents',       icon: '⚠️' },
    { path: '/prestataires',label: 'Prestataires',    icon: '🔧' },
    { path: '/documents',   label: 'Documents',       icon: '📄' },
    { path: '/messages',    label: 'Messages',        icon: '💬' },
  ],
  gestionnaire: [
    { path: '/',            label: 'Tableau de bord', icon: '📊' },
    { path: '/biens',       label: 'Portefeuille',    icon: '🏢' },
    { path: '/incidents',   label: 'Incidents',       icon: '⚠️' },
    { path: '/prestataires',label: 'Prestataires',    icon: '🔧' },
    { path: '/documents',   label: 'Documents',       icon: '📄' },
    { path: '/messages',    label: 'Messages',        icon: '💬' },
  ],
}

export default function Layout({ children }) {
  const { profile, session } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [menuOpen, setMenu] = useState(false)

  const nav = NAV[profile?.role] || NAV.locataire
  const initials = profile
    ? `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/connexion')
  }

  return (
    <div style={css.shell}>
      {/* TOP BAR */}
      <header style={css.topbar}>
        <div style={css.logo} onClick={() => navigate('/')}>
          <span style={{ color: '#2D5A3D' }}>Immo</span>
          <span style={{ color: '#C8813A' }}>Track</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={css.roleChip}>{profile?.role || '—'}</div>
          <div style={css.avatar} onClick={() => setMenu(m => !m)}>
            {initials}
          </div>
          {menuOpen && (
            <div style={css.dropMenu}>
              <div style={css.dropItem}>
                <div style={{ fontWeight: 600 }}>{profile?.prenom} {profile?.nom}</div>
                <div style={{ fontSize: 11, color: '#9E9890' }}>{session?.user?.email}</div>
              </div>
              <div style={css.dropDivider} />
              <div style={css.dropItem} onClick={handleSignOut}>
                🚪 Se déconnecter
              </div>
            </div>
          )}
        </div>
      </header>

      <div style={css.body}>
        {/* SIDEBAR */}
        <aside style={css.sidebar}>
          <div style={{ padding: '8px 10px' }}>
            {nav.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <div key={item.path}
                  style={{ ...css.navItem, ...(active ? css.navActive : {}) }}
                  onClick={() => navigate(item.path)}>
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
          {/* USER CARD */}
          <div style={css.userCard}>
            <div style={css.avatar}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden',
                             textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize: 11, color: '#9E9890', textTransform: 'capitalize' }}>
                {profile?.role}
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={css.main}>
          {children}
        </main>
      </div>
    </div>
  )
}

const css = {
  shell:    { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0', fontFamily: "'DM Sans', sans-serif" },
  topbar:   { height: 54, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '0 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 },
  logo:     { fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700, cursor: 'pointer', userSelect: 'none' },
  roleChip: { padding: '3px 10px', borderRadius: 20, background: '#E8F2EB', color: '#2D5A3D', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  avatar:   { width: 32, height: 32, borderRadius: '50%', background: '#2D5A3D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  dropMenu: { position: 'absolute', top: 54, right: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, width: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 200, overflow: 'hidden' },
  dropItem: { padding: '12px 14px', cursor: 'pointer', fontSize: 13 },
  dropDivider:{ height: 1, background: 'rgba(0,0,0,0.07)' },
  body:     { display: 'flex', flex: 1 },
  sidebar:  { width: 210, background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 },
  navItem:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, color: '#6B6560', marginBottom: 2, transition: '0.14s', border: '1px solid transparent' },
  navActive:{ background: '#E8F2EB', color: '#2D5A3D', fontWeight: 500, borderColor: 'rgba(45,90,61,0.10)' },
  userCard: { padding: '12px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 10 },
  main:     { flex: 1, overflow: 'auto', padding: '28px 32px', minWidth: 0 },
}
