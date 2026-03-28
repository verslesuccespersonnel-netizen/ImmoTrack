// src/components/StatCard.jsx
import React from 'react'

export default function StatCard({ icon, label, value, sub, danger }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${danger ? 'rgba(184,50,50,0.25)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 12, color: '#6B6560', fontWeight: 500 }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px',
        color: danger ? '#B83232' : '#1A1714',
        lineHeight: 1.1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9E9890' }}>{sub}</div>}
    </div>
  )
}
