// src/components/IncidentRow.jsx
import React from 'react'
import { graviteLabel, statutLabel, graviteColor, statutColor, formatDate } from '../lib/utils'

const CAT_ICONS = {
  plomberie: '💧', electricite: '⚡', chauffage: '🔥',
  menuiserie: '🪟', structure: '🧱', autre: '🔧',
}

export default function IncidentRow({ incident, onClick, showBien }) {
  const gc = graviteColor(incident.gravite)
  const sc = statutColor(incident.statut)
  const icon = CAT_ICONS[incident.categorie] || '⚠️'

  return (
    <div style={css.row} onClick={onClick}>
      <div style={css.thumb}>{icon}</div>
      <div style={css.info}>
        <div style={css.title}>{incident.titre}</div>
        <div style={css.meta}>
          {incident.piece?.nom && <span>{incident.piece.nom}</span>}
          {showBien && incident.bien?.adresse && (
            <span> · {incident.bien.adresse}</span>
          )}
          <span> · {formatDate(incident.created_at)}</span>
          {incident.medias?.length > 0 && (
            <span> · 📷 {incident.medias.length}</span>
          )}
        </div>
      </div>
      <div style={css.badges}>
        <span style={{ ...css.badge, background: gc + '18', color: gc }}>
          {graviteLabel(incident.gravite)}
        </span>
        <span style={{ ...css.badge, background: sc + '18', color: sc }}>
          {statutLabel(incident.statut)}
        </span>
      </div>
    </div>
  )
}

const css = {
  row:    { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', transition: '0.13s' },
  thumb:  { width: 42, height: 42, borderRadius: 8, background: '#F7F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  info:   { flex: 1, minWidth: 0 },
  title:  { fontWeight: 500, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta:   { fontSize: 12, color: '#6B6560', marginTop: 2 },
  badges: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge:  { display: 'inline-flex', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
}
