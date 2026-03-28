// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const NAV = {
  locataire: [
    { path: '/',          label: 'Accueil',        icon: '🏠' },
    { path: '/incidents', label: 'Mes incidents',  icon: '⚠️' },
    { path: '/signaler',  label: 'Signaler',       icon: '➕' },
    { path: '/documents', label: 'Documents',      icon: '📄' },
    { path: '/messages',  label: 'Messages',       icon: '💬' },
  ],
  proprietaire: [
    { path: '/',             label: 'Tableau de bord', icon: '📊' },
    { path: '/biens',        label: 'Mes biens',       icon: '🏢' },
    { path: '/incidents',    label: 'Incidents',       icon: '⚠️' },
    { path: '/prestataires', label: 'Prestataires',    icon: '🔧' },
    { path: '/documents',    label: 'Documents',       icon: '📄' },
    { path: '/messages',     label: 'Messages',        icon: '💬' },
  ],
  gestionnaire: [
    { path: '/',             label: 'Tableau de bord', icon: '📊' },
    { path: '/biens',        label: 'Portefeuille',    icon: '🏢' },
    { path: '/incidents',    label: 'Incidents',       icon: '⚠️' },
    { path: '/prestataires', label: 'Prestataires',    icon: '🔧' },
    { path: '/documents',    label: 'Documents',       icon: '📄' },
    { path: '/messages',     label: 'Messages',        icon: '💬' },
  ],
}

export default function Layout({ children }) {
  const { profile, session }  = useAuth()
  const navigate               = useNavigate()
  const location               = useLocation()
  const [menuOpen, setMenu]    = useState(false)
  const [unreadMsg, setUnread] = useState(0)
  const menuRef                = useRef(null)

  const role = profile?.role || 'locataire'
  const nav  = NAV[role] || NAV.locataire
  const initials = profile
    ? `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase()
    : '?'

  // Fermer le menu si clic en dehors
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Compteur messages non lus
  useEffect(() => {
    if (!session?.user) return
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire', session.user.id)
      .eq('lu', false)
      .then(({ count }) => setUnread(count || 0))
  }, [session])

  async function handleSignOut() {
    setMenu(false)
    try {
      await supabase.auth.signOut()
    } catch(e) {
      console.error(e)
    }
    // Forcer redirection même si signOut échoue
    window.location.href = '/connexion'
  }

  return (
    <div style={css.shell}>

      {/* ── TOP BAR ── */}
      <header style={css.topbar}>
        <div style={css.logo} onClick={() => navigate('/')}>
          <span style={{ color: '#2D5A3D' }}>Immo</span>
          <span style={{ color: '#C8813A' }}>Track</span>
        </div>

        <div style={css.topRight} ref={menuRef}>
          <div style={css.roleChip}>{role}</div>

          {/* Avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <div style={css.avatar} onClick={() => setMenu(m => !m)} title="Mon compte">
              {initials}
            </div>

            {menuOpen && (
              <div style={css.dropMenu}>
                {/* Infos utilisateur */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {profile?.prenom} {profile?.nom}
                  </div>
                  <div style={{ fontSize: 11, color: '#9E9890', marginTop: 2 }}>
                    {session?.user?.email}
                  </div>
                  <div style={{
                    display: 'inline-block', marginTop: 6, padding: '2px 8px',
                    borderRadius: 20, background: '#E8F2EB', color: '#2D5A3D',
                    fontSize: 10, fontWeight: 600, textTransform: 'capitalize'
                  }}>
                    {role}
                  </div>
                </div>

                {/* Déconnexion */}
                <div
                  style={{ padding: '12px 16px', cursor: 'pointer', fontSize: 13,
                            color: '#B83232', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={handleSignOut}
                  onMouseEnter={e => e.currentTarget.style.background = '#FDEAEA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🚪 Se déconnecter
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={css.body}>

        {/* ── SIDEBAR ── */}
        <aside style={css.sidebar}>
          <nav style={{ padding: '12px 10px', flex: 1 }}>
            {nav.map(item => {
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              const isMsg = item.path === '/messages'
              return (
                <div
                  key={item.path}
                  style={{ ...css.navItem, ...(active ? css.navActive : {}) }}
                  onClick={() => navigate(item.path)}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isMsg && unreadMsg > 0 && (
                    <span style={css.badge}>{unreadMsg}</span>
                  )}
                </div>
              )
            })}
          </nav>

          {/* User card bas de sidebar */}
          <div style={css.userCard}>
            <div style={{ ...css.avatar, width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize: 11, color: '#9E9890', textTransform: 'capitalize' }}>
                {role}
              </div>
            </div>
            <div
              style={{ fontSize: 16, cursor: 'pointer', color: '#9E9890', padding: 4 }}
              onClick={handleSignOut}
              title="Se déconnecter"
            >
              🚪
            </div>
          </div>
        </aside>

        {/* ── CONTENU ── */}
        <main style={css.main}>
          {children}
        </main>
      </div>
    </div>
  )
}

const css = {
  shell:    { display: 'flex', flexDirection: 'column', minHeight: '100vh',
              background: '#F7F5F0', fontFamily: "'DM Sans', sans-serif" },
  topbar:   { height: 54, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)',
              padding: '0 20px', display: 'flex', alignItems: 'center',
              position: 'sticky', top: 0, zIndex: 100, gap: 12 },
  logo:     { fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 700,
              cursor: 'pointer', userSelect: 'none', flexShrink: 0 },
  topRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 },
  roleChip: { padding: '3px 10px', borderRadius: 20, background: '#E8F2EB',
              color: '#2D5A3D', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  avatar:   { width: 32, height: 32, borderRadius: '50%', background: '#2D5A3D',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, userSelect: 'none' },
  dropMenu: { position: 'absolute', top: 40, right: 0, background: '#fff',
              border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, width: 230,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, overflow: 'hidden' },
  body:     { display: 'flex', flex: 1, minHeight: 0 },
  sidebar:  { width: 210, background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', flexShrink: 0 },
  navItem:  { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              borderRadius: 8, cursor: 'pointer', fontSize: 13.5, color: '#6B6560',
              marginBottom: 2, transition: '0.14s', border: '1px solid transparent',
              userSelect: 'none' },
  navActive:{ background: '#E8F2EB', color: '#2D5A3D', fontWeight: 500,
              borderColor: 'rgba(45,90,61,0.10)' },
  badge:    { background: '#B83232', color: '#fff', borderRadius: 10, fontSize: 10,
              fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' },
  userCard: { padding: '12px', borderTop: '1px solid rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', gap: 8 },
  main:     { flex: 1, overflow: 'auto', padding: '28px 32px', minWidth: 0 },
}
