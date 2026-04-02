// src/components/Layout.jsx — version responsive mobile
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import VersionBadge from './VersionBadge'

const NAV = {
  locataire: [
    { path:'/',          label:'Accueil',        icon:'🏠' },
    { path:'/incidents', label:'Mes incidents',  icon:'⚠️' },
    { path:'/signaler',  label:'Signaler',       icon:'➕' },
    { path:'/documents', label:'Documents',      icon:'📄' },
    { path:'/messages',  label:'Messages',       icon:'💬', badge:true },
    { path:'/demo',      label:'Démonstration',  icon:'🎯', divider:true },
  ],
  proprietaire: [
    { path:'/',             label:'Tableau de bord', icon:'📊' },
    { path:'/biens',        label:'Mes biens',       icon:'🏢' },
    { path:'/locataires',   label:'Locataires',      icon:'👥' },
    { path:'/incidents',    label:'Incidents',       icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires',    icon:'🔧' },
    { path:'/documents',    label:'Documents',       icon:'📄' },
    { path:'/messages',     label:'Messages',        icon:'💬', badge:true },
    { path:'/catalogue',    label:'Catalogue',       icon:'📚', divider:true },
    { path:'/admin',        label:'Administration',  icon:'⚙️' },
    { path:'/demo',         label:'Démonstration',   icon:'🎯' },
  ],
  gestionnaire: [
    { path:'/',             label:'Tableau de bord', icon:'📊' },
    { path:'/biens',        label:'Portefeuille',    icon:'🏢' },
    { path:'/locataires',   label:'Locataires',      icon:'👥' },
    { path:'/incidents',    label:'Incidents',       icon:'⚠️' },
    { path:'/prestataires', label:'Prestataires',    icon:'🔧' },
    { path:'/documents',    label:'Documents',       icon:'📄' },
    { path:'/messages',     label:'Messages',        icon:'💬', badge:true },
    { path:'/catalogue',    label:'Catalogue',       icon:'📚', divider:true },
    { path:'/admin',        label:'Administration',  icon:'⚙️' },
    { path:'/demo',         label:'Démonstration',   icon:'🎯' },
  ],
}

export default function Layout({ children }) {
  const { profile, session } = useAuth()
  const navigate              = useNavigate()
  const location              = useLocation()
  const [menuOpen, setMenu]   = useState(false)
  const [sideOpen, setSide]   = useState(false) // mobile sidebar
  const [unread, setUnread]   = useState(0)
  const menuRef               = useRef(null)

  const role = profile?.role || 'locataire'
  const nav  = NAV[role] || NAV.locataire
  const initials = profile
    ? `${profile.prenom?.[0]||''}${profile.nom?.[0]||''}`.toUpperCase()
    : '?'

  // Fermer sidebar mobile au changement de page
  useEffect(() => { setSide(false) }, [location.pathname])

  // Fermer dropdown si clic dehors
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Compter messages non lus
  useEffect(() => {
    if (!session?.user) return
    supabase.from('messages')
      .select('id', { count:'exact', head:true })
      .eq('destinataire', session.user.id).eq('lu', false)
      .then(({ count }) => setUnread(count || 0))
  }, [session, location.pathname])

  function signOut() {
    setMenu(false); setSide(false)
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      supabase.auth.signOut().catch(() => {})
    } catch {}
    window.location.replace('/connexion')
  }

  const roleColor = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', gestionnaire:'#C8813A' }
  const roleBg    = { locataire:'#EBF2FC', proprietaire:'#E8F2EB', gestionnaire:'#FDF3E7' }

  const NavItems = () => (
    <>
      {nav.map(item => {
        if (item.divider) return (
          <React.Fragment key={item.path}>
            <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'6px 8px' }}/>
            <NavItem item={item} location={location} navigate={navigate} unread={unread}/>
          </React.Fragment>
        )
        return <NavItem key={item.path} item={item} location={location} navigate={navigate} unread={unread}/>
      })}
    </>
  )

  return (
    <div style={css.shell}>
      {/* ── TOP BAR ── */}
      <header style={css.topbar}>
        {/* Hamburger mobile */}
        <button style={css.hamburger} onClick={() => setSide(s => !s)} aria-label="Menu">
          <span style={css.hamLine}/>
          <span style={css.hamLine}/>
          <span style={css.hamLine}/>
        </button>

        <div style={css.logo} onClick={() => navigate('/')}>
          <span style={{ color:'#2D5A3D' }}>Immo</span>
          <span style={{ color:'#C8813A' }}>Track</span>
        </div>

        <div style={css.topRight} ref={menuRef}>
          <div style={{ display:'none' }} className="desktop-only">
            <VersionBadge />
          </div>
          <div style={{
            ...css.roleChip,
            background: roleBg[role] || '#F7F5F0',
            color: roleColor[role] || '#6B6560',
          }}>
            {role}
          </div>

          <div style={{ position:'relative' }}>
            <div style={css.avatarBtn} onClick={() => setMenu(m => !m)}>
              {initials}
            </div>
            {menuOpen && (
              <div style={css.dropMenu}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{profile?.prenom} {profile?.nom}</div>
                  <div style={{ fontSize:11, color:'#9E9890', marginTop:2 }}>{session?.user?.email}</div>
                </div>
                {(role==='proprietaire'||role==='gestionnaire') && (
                  <div style={css.dropItem} onClick={() => { setMenu(false); navigate('/admin') }}>⚙️ Administration</div>
                )}
                <div style={{ height:1, background:'rgba(0,0,0,0.07)' }}/>
                <div style={{ ...css.dropItem, color:'#B83232' }} onClick={signOut}>🚪 Se déconnecter</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={css.body}>
        {/* ── OVERLAY MOBILE ── */}
        {sideOpen && (
          <div style={css.mobileOverlay} onClick={() => setSide(false)}/>
        )}

        {/* ── SIDEBAR ── */}
        <aside style={{ ...css.sidebar, ...(sideOpen ? css.sidebarOpen : {}) }}>
          {/* Close button mobile */}
          <button style={css.sideClose} onClick={() => setSide(false)}>✕</button>

          <nav style={{ padding:'8px 10px', flex:1, overflowY:'auto' }}>
            <NavItems />
          </nav>

          {/* User card */}
          <div style={css.userCard}>
            <div style={{ ...css.avatarBtn, width:30, height:30, fontSize:11, flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.prenom} {profile?.nom}
              </div>
              <div style={{ fontSize:11, color:'#9E9890', textTransform:'capitalize' }}>{role}</div>
            </div>
            <button onClick={signOut} title="Se déconnecter" style={css.signOutBtn}>🚪</button>
          </div>
        </aside>

        {/* ── CONTENU ── */}
        <main style={css.main}>
          {children}
        </main>
      </div>

      {/* ── NAV BAS MOBILE ── */}
      <nav style={css.mobileNav}>
        {nav.filter(i => !i.divider).slice(0, 5).map(item => {
          const active = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <button key={item.path} style={{ ...css.mobileNavItem, color: active ? '#2D5A3D' : '#9E9890' }}
              onClick={() => navigate(item.path)}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <span style={{ fontSize:9, marginTop:2, fontWeight: active?600:400 }}>
                {item.label.split(' ')[0]}
              </span>
              {item.badge && unread > 0 && (
                <span style={css.mobileNavBadge}>{unread}</span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function NavItem({ item, location, navigate, unread }) {
  const active = location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path))
  return (
    <div style={{ ...css.navItem, ...(active ? css.navActive : {}) }}
      onClick={() => navigate(item.path)}>
      <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
      <span style={{ flex:1 }}>{item.label}</span>
      {item.badge && unread > 0 && (
        <span style={css.badge}>{unread}</span>
      )}
    </div>
  )
}

const css = {
  shell:        { display:'flex', flexDirection:'column', minHeight:'100vh', background:'#F7F5F0', fontFamily:"'DM Sans',sans-serif" },
  topbar:       { height:54, background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'0 16px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, zIndex:100 },
  hamburger:    { display:'none', flexDirection:'column', gap:4, background:'none', border:'none', cursor:'pointer', padding:6, borderRadius:6,
                  '@media (max-width: 768px)': { display:'flex' } },
  hamLine:      { width:20, height:2, background:'#6B6560', borderRadius:2, display:'block' },
  logo:         { fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, cursor:'pointer', userSelect:'none', flexShrink:0 },
  topRight:     { marginLeft:'auto', display:'flex', alignItems:'center', gap:8 },
  roleChip:     { padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600, textTransform:'capitalize', display:'none' },
  avatarBtn:    { width:32, height:32, borderRadius:'50%', background:'#2D5A3D', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, cursor:'pointer', userSelect:'none', flexShrink:0 },
  dropMenu:     { position:'absolute', top:40, right:0, background:'#fff', border:'1px solid rgba(0,0,0,0.10)', borderRadius:12, width:220, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:300, overflow:'hidden' },
  dropItem:     { padding:'11px 16px', cursor:'pointer', fontSize:13, transition:'.12s' },
  body:         { display:'flex', flex:1, minHeight:0, position:'relative' },
  // Overlay sombre derrière la sidebar mobile
  mobileOverlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:90 },
  sidebar:      {
    width:210, background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)',
    display:'flex', flexDirection:'column', flexShrink:0,
    // Mobile : sidebar cachée par défaut
    position:'fixed', top:54, bottom:0, left:-220, zIndex:95,
    transition:'transform 0.25s ease, left 0.25s ease',
    boxShadow:'none',
  },
  sidebarOpen:  { left:0, boxShadow:'4px 0 20px rgba(0,0,0,0.15)' },
  sideClose:    { display:'flex', alignSelf:'flex-end', margin:'8px 10px 0', background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9E9890', padding:4 },
  navItem:      { display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, cursor:'pointer', fontSize:13.5, color:'#6B6560', marginBottom:2, transition:'.14s', border:'1px solid transparent', userSelect:'none' },
  navActive:    { background:'#E8F2EB', color:'#2D5A3D', fontWeight:500, borderColor:'rgba(45,90,61,.10)' },
  badge:        { background:'#B83232', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px', minWidth:18, textAlign:'center' },
  userCard:     { padding:'12px', borderTop:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', gap:8 },
  signOutBtn:   { background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4, color:'#9E9890', flexShrink:0 },
  main:         { flex:1, overflow:'auto', padding:'20px 16px 80px', minWidth:0 },
  // Barre de navigation mobile en bas
  mobileNav:    { display:'flex', background:'#fff', borderTop:'1px solid rgba(0,0,0,0.08)', position:'sticky', bottom:0, zIndex:100 },
  mobileNavItem:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 4px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', position:'relative', gap:2, minHeight:52 },
  mobileNavBadge:{ position:'absolute', top:4, right:'calc(50% - 18px)', background:'#B83232', color:'#fff', borderRadius:10, fontSize:9, fontWeight:700, padding:'1px 4px', minWidth:14, textAlign:'center' },
}
