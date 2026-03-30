// src/components/VersionBadge.jsx
import React, { useState } from 'react'
import { APP_VERSION, APP_DATE, CHANGELOG } from '../lib/version'
import { useAuth } from '../lib/AuthContext'

const TYPE_STYLE = {
  new:  { bg:'#E8F2EB', color:'#2D5A3D', label:'Nouveau' },
  fix:  { bg:'#EBF2FC', color:'#2B5EA7', label:'Corrigé'  },
  impr: { bg:'#FDF3E7', color:'#C8813A', label:'Amélioré' },
  sec:  { bg:'#FDEAEA', color:'#B83232', label:'Sécurité'  },
}

export default function VersionBadge() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  // Visible pour tous, changelog complet seulement pour admin
  const isAdmin = profile?.role === 'gestionnaire' || profile?.role === 'proprietaire'

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="Version et changelog"
        style={{
          padding:'3px 8px', borderRadius:20,
          background:'rgba(0,0,0,0.06)', color:'#9E9890',
          fontSize:10, fontFamily:'monospace', cursor:'pointer',
          border:'1px solid rgba(0,0,0,0.08)', userSelect:'none',
          transition:'.15s',
        }}
        onMouseEnter={e => { e.target.style.background='rgba(0,0,0,0.10)'; e.target.style.color='#6B6560' }}
        onMouseLeave={e => { e.target.style.background='rgba(0,0,0,0.06)'; e.target.style.color='#9E9890' }}
      >
        v{APP_VERSION}
      </div>

      {open && (
        <div style={css.overlay} onClick={e => e.target===e.currentTarget && setOpen(false)}>
          <div style={css.modal}>
            <div style={css.header}>
              <div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:18 }}>
                  <span style={{ color:'#2D5A3D' }}>Immo</span>
                  <span style={{ color:'#C8813A' }}>Track</span>
                  <span style={{ fontSize:13, color:'#9E9890', marginLeft:8, fontFamily:'monospace' }}>
                    v{APP_VERSION}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'#9E9890', marginTop:2 }}>Mis à jour le {APP_DATE}</div>
              </div>
              <button style={css.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>

            <div style={{ overflowY:'auto', maxHeight:'60vh', padding:'0 24px 20px' }}>
              {(isAdmin ? CHANGELOG : CHANGELOG.slice(0,1)).map((release, ri) => (
                <div key={release.version} style={{ marginBottom:20 }}>
                  <div style={css.releaseHeader}>
                    <span style={css.versionBadge}>v{release.version}</span>
                    <span style={{ fontWeight:600, fontSize:14 }}>{release.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'#9E9890' }}>{release.date}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {release.changes.map((c, ci) => {
                      const s = TYPE_STYLE[c.type] || TYPE_STYLE.new
                      return (
                        <div key={ci} style={css.changeRow}>
                          <span style={{ ...css.typeTag, background:s.bg, color:s.color }}>{s.label}</span>
                          <span style={{ fontSize:13, color:'#1A1714', lineHeight:1.4 }}>{c.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {!isAdmin && (
                <div style={{ fontSize:12, color:'#9E9890', textAlign:'center', paddingTop:8 }}>
                  Connectez-vous en tant que propriétaire pour voir l'historique complet.
                </div>
              )}
            </div>

            <div style={css.footer}>
              <span style={{ fontSize:12, color:'#9E9890' }}>
                ImmoTrack · Gestion locative simplifiée
              </span>
              <button style={css.btnClose} onClick={() => setOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const css = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:        { background:'#fff', borderRadius:16, width:'100%', maxWidth:520, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden' },
  header:       { padding:'20px 24px 14px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  closeBtn:     { width:28, height:28, border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, background:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  releaseHeader:{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingTop:16, borderTop:'1px solid rgba(0,0,0,0.07)' },
  versionBadge: { padding:'2px 8px', borderRadius:10, background:'#1A1714', color:'white', fontSize:11, fontFamily:'monospace', fontWeight:600 },
  changeRow:    { display:'flex', alignItems:'flex-start', gap:8, padding:'5px 0' },
  typeTag:      { padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:600, flexShrink:0, marginTop:1 },
  footer:       { padding:'12px 24px', borderTop:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  btnClose:     { padding:'6px 16px', background:'#F7F5F0', border:'1px solid rgba(0,0,0,0.12)', borderRadius:7, fontFamily:'inherit', fontSize:13, cursor:'pointer' },
}
