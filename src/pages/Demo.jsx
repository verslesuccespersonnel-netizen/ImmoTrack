import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'

const ALL_DEMOS = {
  locataire: {
    color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠', label:'Locataire',
    steps:[
      { title:'Mon tableau de bord', icon:'📊', path:'/', desc:'Le tableau de bord affiche votre logement, les incidents en cours et les messages non lus. Tout est centralisé ici.', tip:'Si votre logement n\'apparaît pas, votre propriétaire doit vous associer au bien depuis son espace.' },
      { title:'Signaler un incident', icon:'➕', path:'/signaler', desc:'Allez dans "Signaler" → choisissez votre logement, l\'équipement concerné, décrivez le problème et sa gravité.', tip:'Plus vous êtes précis (depuis quand, fréquence, bruit ou visuel), plus le propriétaire peut agir vite.' },
      { title:'Suivre mes incidents', icon:'⚠️', path:'/incidents', desc:'Consultez l\'état de vos demandes. Le statut change quand le propriétaire prend en charge : Nouveau → En cours → Résolu.', tip:'🔴 Urgent · 🟡 Moyen · 🟢 Faible. Cliquez sur un incident pour voir le détail.' },
      { title:'Messagerie', icon:'💬', path:'/messages', desc:'Échangez directement avec votre propriétaire ou gestionnaire. Tout est archivé et horodaté.', tip:'✓ = envoyé · ✓✓ = lu. Un badge rouge sur le menu indique des messages non lus.' },
      { title:'Mes documents', icon:'📄', path:'/documents', desc:'Accédez à vos documents partagés : bail, quittances, états des lieux, diagnostics.', tip:'Vous pouvez télécharger n\'importe quel document à tout moment.' },
    ]
  },
  proprietaire: {
    color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢', label:'Propriétaire',
    steps:[
      { title:'Tableau de bord', icon:'📊', path:'/', desc:'Le tableau de bord centralise vos biens, les incidents ouverts, et le taux d\'occupation avec graphique sur 6 mois.', tip:'Les incidents urgents (🔴) sont mis en avant pour action immédiate.' },
      { title:'Ajouter un bien', icon:'🏠', path:'/biens', desc:'"Mes biens" → "+ Ajouter un bien". Renseignez adresse, type et surface. Puis cliquez "+ Locataire" pour associer.', tip:'Vous pouvez gérer plusieurs biens. Chaque bien a son propre plan 2D et ses incidents.' },
      { title:'Dessiner le plan', icon:'🗺️', path:'/biens', desc:'"Plan" sur une fiche bien → glissez des pièces depuis la palette gauche, ajoutez équipements. Cliquez une pièce puis ↘ pour redimensionner.', tip:'Double-clic sur une pièce ou équipement pour modifier nom, icône, couleur.' },
      { title:'Gérer les locataires', icon:'👥', path:'/locataires', desc:'"Locataires" → "+ Ajouter" → renseignez nom, bien, loyer et date. Ajoutez occupants et garants depuis la fiche.', tip:'Archivez les locations terminées : elles restent visibles dans les archives.' },
      { title:'Suivre les incidents', icon:'⚠️', path:'/incidents', desc:'Filtrez par urgence, statut ou bien. Changez le statut d\'un incident en cliquant dessus.', tip:'Utilisez les prestataires pour assigner les interventions.' },
      { title:'Prestataires', icon:'🔧', path:'/prestataires', desc:'Ajoutez artisans et entreprises avec spécialité, téléphone et notes. 14 spécialités prédéfinies.', tip:'Vous pouvez ajouter des spécialités personnalisées depuis le formulaire.' },
    ]
  },
  agence: {
    color:'#C8813A', bg:'#FDF3E7', icon:'🏗️', label:'Agence',
    steps:[
      { title:'Tableau de bord agence', icon:'📊', path:'/', desc:'Vue centralisée de tous vos biens gérés, incidents prioritaires et taux d\'occupation global.', tip:'Vous voyez uniquement les biens des propriétaires que vous avez liés.' },
      { title:'Lier des propriétaires', icon:'🔗', path:'/admin', desc:'"Administration" → "+ Lier un propriétaire" → entrez l\'UUID du propriétaire. Vous accédez alors à tous ses biens.', tip:'Le propriétaire trouve son UUID dans son espace Administration → son profil.' },
      { title:'Gérer le portefeuille', icon:'🏢', path:'/biens', desc:'Accédez à tous les biens de vos propriétaires liés, avec plans, locataires et incidents.', tip:'Les biens de propriétaires non liés ne sont pas visibles.' },
      { title:'Incidents & Prestataires', icon:'⚠️', path:'/incidents', desc:'Gérez les incidents de tout le portefeuille. Assignez vos prestataires de confiance.', tip:'Filtrez par bien ou par gravité pour prioriser les interventions.' },
      { title:'Catalogue personnalisé', icon:'📚', path:'/catalogue', desc:'Personnalisez le catalogue zones → pièces → équipements → types de pannes pour votre agence.', tip:'Le catalogue est partagé avec tous les propriétaires liés.' },
    ]
  },
  admin: {
    color:'#B83232', bg:'#FDEAEA', icon:'⚙️', label:'Administrateur',
    steps:[
      { title:'Vue globale', icon:'📊', path:'/', desc:'Accès complet à toutes les données : tous les biens, propriétaires, agences, locataires et incidents de la plateforme.', tip:'Le rôle admin est uniquement pour le développement et la maintenance de la plateforme.' },
      { title:'Gérer tous les comptes', icon:'👥', path:'/admin', desc:'"Administration" → onglet "Comptes" → changez les rôles directement via le sélecteur. Filtrez par rôle.', tip:'Pour passer un compte en admin : sélecteur de rôle → "admin". Effet immédiat.' },
      { title:'Voir tous les biens', icon:'🏢', path:'/biens', desc:'Accès à 100% des biens de la plateforme, tous propriétaires confondus.', tip:'Les biens sont filtrés par propriétaire uniquement pour les rôles propriétaire/agence.' },
      { title:'Outils développement', icon:'🛠️', path:'/admin', desc:'"Administration" → onglet "Outils" → suppression sélective (plans, incidents, locations, tout supprimer).', tip:'⚠️ Irréversible. Exportez d\'abord vos données en JSON.' },
      { title:'Export JSON', icon:'⬇️', path:'/admin', desc:'Bouton "Exporter JSON" → télécharge toutes les données : profils, biens, locations, incidents.', tip:'Pratique pour sauvegardes ou migration vers un autre environnement.' },
    ]
  },
}

export default function Demo() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Déterminer les rôles disponibles selon le profil
  const role = profile?.role || 'locataire'
  const isAdmin = role === 'admin'
  const isAgence = role === 'agence'
  const isMgr = ['proprietaire','gestionnaire','agence','admin'].includes(role)

  // Admin voit tout, les autres voient seulement leur rôle + locataire (si MGR)
  const availableRoles = isAdmin
    ? ['proprietaire','agence','locataire','admin']
    : isMgr
      ? [role === 'gestionnaire' ? 'proprietaire' : role, 'locataire']
      : ['locataire']

  const [selRole, setSelRole] = useState(
    availableRoles.includes(role) ? role : availableRoles[0]
  )
  const [step, setStep] = useState(0)

  const demo = ALL_DEMOS[selRole] || ALL_DEMOS.locataire
  const cur  = demo.steps[step]

  function changeRole(r) { setSelRole(r); setStep(0) }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Démonstration</h1>
          <p className="page-sub">Guide interactif — {demo.label}</p>
        </div>
      </div>

      {/* Sélecteur de rôle — visible uniquement si plusieurs rôles disponibles */}
      {availableRoles.length > 1 && (
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          {availableRoles.map(r => {
            const d = ALL_DEMOS[r]
            return (
              <div key={r} onClick={() => changeRole(r)}
                style={{ flex:1, minWidth:120, padding:12, borderRadius:12, cursor:'pointer', textAlign:'center',
                  border:`2px solid ${selRole===r ? d.color : 'rgba(0,0,0,.08)'}`,
                  background: selRole===r ? d.bg : '#fff' }}>
                <div style={{ fontSize:26 }}>{d.icon}</div>
                <div style={{ fontWeight:600, fontSize:12, color:selRole===r?d.color:'#1A1714', marginTop:3 }}>{d.label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Étape courante */}
      <div className="card" style={{ marginBottom:16, borderTop:`4px solid ${demo.color}` }}>
        <div className="card-body" style={{ padding:'20px 24px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
            Étape {step+1} / {demo.steps.length} · {demo.label}
          </div>
          <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:16 }}>
            <div style={{ width:52, height:52, borderRadius:12, background:demo.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
              {cur.icon}
            </div>
            <div>
              <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:'0 0 6px' }}>{cur.title}</h2>
              <p style={{ fontSize:14, color:'#6B6560', lineHeight:1.6, margin:0 }}>{cur.desc}</p>
            </div>
          </div>
          <div style={{ background:demo.bg, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:demo.color, textTransform:'uppercase', marginBottom:4 }}>💡 Conseil</div>
            <div style={{ fontSize:13, color:'#1A1714', lineHeight:1.6 }}>{cur.tip}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setStep(s => Math.max(0,s-1))} disabled={step===0}>← Précédent</button>
            <button className="btn btn-primary" style={{ background:demo.color }} onClick={() => navigate(cur.path)}>Essayer maintenant →</button>
            {step < demo.steps.length-1
              ? <button className="btn btn-primary" style={{ background:demo.color }} onClick={() => setStep(s => s+1)}>Étape suivante →</button>
              : <button className="btn btn-primary" style={{ background:'#1A1714' }} onClick={() => navigate('/')}>🎉 Terminer la démo</button>
            }
          </div>
        </div>
      </div>

      {/* Navigation étapes */}
      <div className="grid3" style={{ gap:8 }}>
        {demo.steps.map((s, i) => (
          <div key={i} onClick={() => setStep(i)}
            style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer',
              border:`1px solid ${i===step ? demo.color : 'rgba(0,0,0,.08)'}`,
              background: i===step ? demo.bg : '#fff' }}>
            <div style={{ fontSize:18, marginBottom:3 }}>{s.icon}</div>
            <div style={{ fontSize:12, fontWeight:i===step?600:400, color:i===step?demo.color:'#1A1714' }}>{s.title}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
