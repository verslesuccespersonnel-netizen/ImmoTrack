// src/pages/Demo.jsx — Mode démonstration guidé
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

const ROLES_DEMO = [
  {
    role: 'proprietaire',
    label: 'Propriétaire',
    icon: '🏢',
    color: '#2D5A3D',
    bg: '#E8F2EB',
    desc: 'Gérez vos biens, suivez les incidents et communiquez avec vos locataires.',
    steps: [
      {
        title: 'Ajouter un bien',
        icon: '🏠',
        path: '/biens',
        desc: 'Créez votre premier bien immobilier avec adresse, type et surface.',
        detail: 'Menu "Mes biens" → bouton "+ Ajouter un bien" → remplissez le formulaire.',
        tip: 'Vous pouvez créer plusieurs biens. Chaque bien aura ses pièces, équipements et locataires indépendants.',
      },
      {
        title: 'Dessiner le plan',
        icon: '🗺️',
        path: '/biens',
        desc: 'Construisez le plan interactif de votre bien pièce par pièce.',
        detail: 'Depuis la fiche du bien → bouton "🗺️ Plan" → glissez les pièces sur la grille.',
        tip: 'Vous pouvez dessiner plusieurs niveaux (sous-sol, RDC, étages). Chaque pièce est redimensionnable.',
      },
      {
        title: 'Associer un locataire',
        icon: '👤',
        path: '/biens',
        desc: 'Liez un locataire à son logement avec loyer et dates de bail.',
        detail: 'Fiche bien → section "Locataire" → "+ Associer" → entrez l\'UUID du locataire.',
        tip: 'Le locataire doit d\'abord créer son compte. Son UUID se trouve dans Supabase → Authentication → Users.',
      },
      {
        title: 'Suivre les incidents',
        icon: '⚠️',
        path: '/incidents',
        desc: 'Visualisez, filtrez et traitez tous les incidents de vos biens.',
        detail: 'Menu "Incidents" → filtrez par statut ou urgence → cliquez sur un incident.',
        tip: 'Dans la fiche incident : onglet "Actions" pour changer le statut, assigner un prestataire et envoyer un message au locataire.',
      },
      {
        title: 'Gérer les prestataires',
        icon: '🔧',
        path: '/prestataires',
        desc: 'Constituez votre annuaire d\'artisans et intervenants de confiance.',
        detail: 'Menu "Prestataires" → "+ Ajouter" → renseignez nom, spécialité, contact et note.',
        tip: 'Les prestataires sont disponibles directement depuis la fiche incident pour une assignation rapide.',
      },
      {
        title: 'Administrer les comptes',
        icon: '⚙️',
        path: '/admin',
        desc: 'Gérez tous les comptes utilisateurs et leurs rôles.',
        detail: 'Menu "Administration" → onglet Comptes → modifiez les rôles directement en ligne.',
        tip: 'Seuls les propriétaires et gestionnaires ont accès à l\'administration.',
      },
    ]
  },
  {
    role: 'gestionnaire',
    label: 'Gestionnaire / Agence',
    icon: '🏗️',
    color: '#C8813A',
    bg: '#FDF3E7',
    desc: 'Pilotez l\'ensemble du portefeuille, coordonnez propriétaires, locataires et prestataires.',
    steps: [
      {
        title: 'Vue portefeuille',
        icon: '📊',
        path: '/',
        desc: 'Dashboard global avec tous les biens, incidents ouverts et loyers.',
        detail: 'La page d\'accueil centralise toutes les métriques : biens, incidents urgents, total des loyers.',
        tip: 'Le badge rouge sur "Incidents" indique le nombre d\'incidents non résolus nécessitant une action.',
      },
      {
        title: 'Gérer le catalogue',
        icon: '📚',
        path: '/catalogue',
        desc: 'Personnalisez les zones, pièces, équipements et types de pannes.',
        detail: 'Menu "Catalogue" → naviguez dans les 4 colonnes → ajoutez ou modifiez les éléments.',
        tip: 'Le catalogue est pré-rempli avec 200+ types de pannes couvrant maisons, appartements et locaux commerciaux.',
      },
      {
        title: 'Gérer les incidents',
        icon: '⚠️',
        path: '/incidents',
        desc: 'Traitez les incidents de tout le portefeuille depuis une vue centralisée.',
        detail: 'Filtrez par urgence, bien ou statut. Assignez prestataires et envoyez des messages templates.',
        tip: 'Les incidents urgents apparaissent en rouge en haut du dashboard pour une action immédiate.',
      },
      {
        title: 'Administration complète',
        icon: '⚙️',
        path: '/admin',
        desc: 'Accès total : comptes, biens, incidents. Changez les rôles en un clic.',
        detail: 'Menu "Administration" → 3 onglets : Comptes / Biens / Incidents.',
        tip: 'Le sélecteur de rôle est directement dans la liste — pas besoin d\'ouvrir une fiche pour changer un rôle.',
      },
    ]
  },
  {
    role: 'locataire',
    label: 'Locataire',
    icon: '🏠',
    color: '#2B5EA7',
    bg: '#EBF2FC',
    desc: 'Signalez vos problèmes, suivez leur résolution et accédez à vos documents.',
    steps: [
      {
        title: 'Signaler un incident',
        icon: '➕',
        path: '/signaler',
        desc: 'Signalez un problème en moins de 2 minutes avec photos.',
        detail: 'Menu "Signaler" → choisissez la pièce et l\'équipement → décrivez → ajoutez des photos → envoyez.',
        tip: 'Soyez précis dans la description : "depuis quand", "fréquence", "bruit ou visuel". Ça accélère la résolution.',
      },
      {
        title: 'Suivre mes incidents',
        icon: '⚠️',
        path: '/incidents',
        desc: 'Consultez l\'état de chaque incident et les actions du propriétaire.',
        detail: 'Menu "Mes incidents" → cliquez sur un incident → onglets Détails / Médias / Historique.',
        tip: 'L\'onglet "Historique" montre toutes les actions : qui a fait quoi et quand. Tout est tracé.',
      },
      {
        title: 'Mes documents',
        icon: '📄',
        path: '/documents',
        desc: 'Accédez à vos documents contractuels : bail, quittances, états des lieux.',
        detail: 'Menu "Documents" → recherchez, filtrez par catégorie, téléchargez ou ajoutez aux favoris.',
        tip: 'Vous pouvez générer un lien de partage temporaire pour envoyer un document à un tiers (assureur, etc.).',
      },
      {
        title: 'Messagerie',
        icon: '💬',
        path: '/messages',
        desc: 'Échangez directement avec votre propriétaire, tout est archivé.',
        detail: 'Menu "Messages" → sélectionnez la conversation → rédigez → Entrée pour envoyer.',
        tip: 'Chaque message est associé à un incident pour garder le contexte. Les messages non lus s\'affichent en badge.',
      },
    ]
  },
]

export default function Demo() {
  const navigate   = useNavigate()
  const [selRole, setSelRole] = useState('proprietaire')
  const [step, setStep]       = useState(0)

  const roleData = ROLES_DEMO.find(r => r.role === selRole)
  const currentStep = roleData.steps[step]

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Mode démonstration</h1>
          <p style={css.sub}>Découvrez toutes les fonctionnalités selon votre rôle</p>
        </div>
      </div>

      {/* Sélecteur de rôle */}
      <div style={css.roleRow}>
        {ROLES_DEMO.map(r => (
          <div key={r.role}
            style={{ ...css.roleCard, ...(selRole===r.role ? { border:`2px solid ${r.color}`, background:r.bg } : {}) }}
            onClick={() => { setSelRole(r.role); setStep(0) }}>
            <div style={{ fontSize:28 }}>{r.icon}</div>
            <div style={{ fontWeight:600, fontSize:13.5, color: selRole===r.role ? r.color : '#1A1714' }}>{r.label}</div>
            <div style={{ fontSize:11, color:'#6B6560', textAlign:'center', lineHeight:1.4 }}>{r.desc}</div>
            {selRole===r.role && <div style={{ ...css.badge, background:r.color }}>Actif</div>}
          </div>
        ))}
      </div>

      {/* Progression */}
      <div style={css.progressRow}>
        {roleData.steps.map((s,i) => (
          <div key={i} style={{ ...css.progressDot,
            background: i===step ? roleData.color : i<step ? roleData.color+'66' : '#E8F2EB',
            cursor:'pointer', transform: i===step ? 'scale(1.2)' : 'scale(1)',
          }}
            onClick={() => setStep(i)}
            title={s.title}
          />
        ))}
        <div style={{ flex:1, height:2, background:'#E8F2EB', borderRadius:2, margin:'0 4px' }}>
          <div style={{ height:'100%', background:roleData.color, borderRadius:2, width:`${(step/(roleData.steps.length-1))*100}%`, transition:'width .3s' }}/>
        </div>
        <div style={{ fontSize:12, color:'#6B6560', flexShrink:0 }}>{step+1} / {roleData.steps.length}</div>
      </div>

      {/* Carte étape */}
      <div style={{ ...css.stepCard, borderTop:`4px solid ${roleData.color}` }}>
        <div style={css.stepTop}>
          <div style={{ ...css.stepIcon, background:roleData.bg, color:roleData.color }}>
            {currentStep.icon}
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:roleData.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>
              Étape {step+1} — {roleData.label}
            </div>
            <h2 style={css.stepTitle}>{currentStep.title}</h2>
            <p style={css.stepDesc}>{currentStep.desc}</p>
          </div>
        </div>

        <div style={css.divider}/>

        <div style={css.detailBox}>
          <div style={css.detailLabel}>📋 Comment faire</div>
          <div style={css.detailText}>{currentStep.detail}</div>
        </div>

        <div style={{ ...css.detailBox, background:'#FDF3E7', borderColor:'rgba(200,129,58,.2)' }}>
          <div style={{ ...css.detailLabel, color:'#C8813A' }}>💡 Conseil</div>
          <div style={css.detailText}>{currentStep.tip}</div>
        </div>

        {/* Actions */}
        <div style={css.btnRow}>
          <button style={css.btnSec}
            onClick={() => setStep(s => Math.max(0, s-1))}
            disabled={step===0}>
            ← Précédent
          </button>
          <button style={{ ...css.btnPrimary, background: roleData.color }}
            onClick={() => navigate(currentStep.path)}>
            Essayer maintenant →
          </button>
          {step < roleData.steps.length-1
            ? <button style={{ ...css.btnPrimary, background: roleData.color }}
                onClick={() => setStep(s => s+1)}>
                Étape suivante →
              </button>
            : <button style={{ ...css.btnPrimary, background:'#1A1714' }}
                onClick={() => navigate('/')}>
                🎉 Terminer la démo
              </button>
          }
        </div>
      </div>

      {/* Mini-carte de toutes les étapes */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
          Toutes les fonctionnalités — {roleData.label}
        </div>
        <div style={css.allSteps}>
          {roleData.steps.map((s,i) => (
            <div key={i} style={{ ...css.miniStep, ...(i===step?{ border:`1.5px solid ${roleData.color}`, background:roleData.bg }:{}) }}
              onClick={() => setStep(i)}>
              <span style={{ fontSize:18 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color: i===step?roleData.color:'#1A1714' }}>{s.title}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{s.desc.slice(0,50)}…</div>
              </div>
              {i < step && <span style={{ marginLeft:'auto', color:roleData.color, fontSize:14 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

const css = {
  header:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 },
  h1:          { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  roleRow:     { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 },
  roleCard:    { background:'#fff', border:'1.5px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'18px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, cursor:'pointer', transition:'.15s', position:'relative' },
  badge:       { position:'absolute', top:10, right:10, padding:'2px 8px', borderRadius:10, color:'white', fontSize:10, fontWeight:600 },
  progressRow: { display:'flex', alignItems:'center', gap:8, marginBottom:20 },
  progressDot: { width:12, height:12, borderRadius:'50%', transition:'.2s', flexShrink:0 },
  stepCard:    { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden', padding:'24px' },
  stepTop:     { display:'flex', gap:16, alignItems:'flex-start', marginBottom:20 },
  stepIcon:    { width:56, height:56, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 },
  stepTitle:   { fontFamily:'Georgia,serif', fontSize:22, fontWeight:500, color:'#1A1714', margin:'0 0 6px' },
  stepDesc:    { fontSize:14, color:'#6B6560', lineHeight:1.5, margin:0 },
  divider:     { height:1, background:'rgba(0,0,0,0.07)', margin:'0 0 16px' },
  detailBox:   { background:'#E8F2EB', border:'1px solid rgba(45,90,61,.15)', borderRadius:10, padding:'14px 16px', marginBottom:12 },
  detailLabel: { fontSize:11, fontWeight:700, color:'#2D5A3D', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 },
  detailText:  { fontSize:13.5, color:'#1A1714', lineHeight:1.6 },
  btnRow:      { display:'flex', gap:10, marginTop:20, flexWrap:'wrap' },
  btnPrimary:  { padding:'10px 20px', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSec:      { padding:'10px 20px', background:'#fff', color:'#6B6560', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, cursor:'pointer' },
  allSteps:    { display:'flex', flexDirection:'column', gap:8 },
  miniStep:    { display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:10, cursor:'pointer', transition:'.14s' },
}
