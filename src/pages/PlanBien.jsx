import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const CELL=48, GW=28, GH=20
const NIVEAUX=[{v:-1,l:'Sous-sol'},{v:0,l:'RDC'},{v:1,l:'Etage 1'},{v:2,l:'Etage 2'},{v:10,l:'Jardin'},{v:11,l:'Cour'},{v:12,l:'Garage'},{v:13,l:'Terrasse'}]
const PTPL=[
  {n:'Entree',i:'🚪',c:'#F0EDE6',w:2,h:2},{n:'Salon',i:'🛋️',c:'#E8F2EB',w:5,h:4},
  {n:'Cuisine',i:'🍳',c:'#FDF3E7',w:3,h:3},{n:'Chambre',i:'🛏️',c:'#EBF2FC',w:4,h:3},
  {n:'Salle de bain',i:'🛁',c:'#F3ECFC',w:3,h:3},{n:'WC',i:'🚽',c:'#F7F5F0',w:1,h:2},
  {n:'Couloir',i:'↔️',c:'#F7F5F0',w:5,h:1},{n:'Bureau',i:'💼',c:'#EBF2FC',w:3,h:3},
  {n:'Escalier',i:'🪜',c:'#F0EDE6',w:2,h:3},{n:'Debarras',i:'📦',c:'#F0EDE6',w:2,h:2},
  {n:'Dressing',i:'👔',c:'#F3ECFC',w:2,h:2},{n:'Garage',i:'🚗',c:'#F0EDE6',w:5,h:4},
  {n:'Jardin',i:'🌿',c:'#E8F2EB',w:7,h:5},{n:'Terrasse',i:'☀️',c:'#FDF3E7',w:4,h:3},
  {n:'Balcon',i:'🌅',c:'#FDF3E7',w:3,h:1},{n:'Perso',i:'✏️',c:'#F7F5F0',w:3,h:3,custom:true},
]
const ECAT={
  'Ouvertures':[{n:'Porte',i:'🚪'},{n:'Fenetre',i:'🪟'},{n:'Volet elec.',i:'🪟'},{n:'Portail',i:'🚧'},{n:'Serrure',i:'🔐'},{n:'Velux',i:'🪟'}],
  'Electricite':[{n:'Prise',i:'🔌'},{n:'Tableau',i:'⚡'},{n:'Lumiere',i:'💡'},{n:'VMC',i:'💨'},{n:'Clim',i:'❄️'},{n:'Detect. fumee',i:'🔴'}],
  'Plomberie':[{n:'Robinet',i:'🚰'},{n:'Evier',i:'🪣'},{n:'Baignoire',i:'🛁'},{n:'Douche',i:'🚿'},{n:'WC',i:'🚽'},{n:'Chauffe-eau',i:'💧'}],
  'Chauffage':[{n:'Radiateur',i:'🌡️'},{n:'Chaudiere',i:'🔥'},{n:'Thermostat',i:'🌡️'}],
  'Structure':[{n:'Mur',i:'🧱'},{n:'Plafond',i:'⬆️'},{n:'Sol',i:'🟫'},{n:'Toiture',i:'🏠'},{n:'Facade',i:'🏠'}],
  'Appareils':[{n:'Four',i:'🔥'},{n:'Hotte',i:'💨'},{n:'Refrigerateur',i:'🧊'},{n:'Lave-linge',i:'🫧'}],
}
const CCOL={Ouvertures:'#F3ECFC',Electricite:'#EBF2FC',Plomberie:'#E8F8F5',Chauffage:'#FDF3E7',Structure:'#F7F5F0',Appareils:'#F0EDE6'}
const COLS=['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5']
const MGR_ROLES = ['proprietaire','gestionnaire','agence','admin']

// Pannes par catégorie équipement
const PANNES = {
  'Ouvertures':   ['Ne ferme plus','Ne s\'ouvre plus','Grincement','Serrure bloquee','Vitre cassee','Joint defectueux','Autre'],
  'Electricite':  ['Ne fonctionne plus','Court-circuit','Disjoncteur declenche','Etincelles','Ampoule grilee','Mauvais contact','Autre'],
  'Plomberie':    ['Fuite','Robinet qui goutte','Bouchon','Mauvaise pression','Pas d\'eau chaude','Odeur','Autre'],
  'Chauffage':    ['Ne chauffe plus','Chauffe insuffisamment','Bruit anormal','Fuite de chaleur','Thermostat defaillant','Autre'],
  'Structure':    ['Fissure','Humidite','Infiltration','Moisissure','Peinture degradee','Degat des eaux','Autre'],
  'Appareils':    ['Ne fonctionne plus','Bruit anormal','Fuite','Mauvaise odeur','Porte defaillante','Autre'],
  'piece':        ['Humidite au plafond','Infiltration eau','Fissure mur','Moisissure','Peinture degradee','Mauvaise odeur','Fenetre condensation','Autre'],
}

export default function PlanBien() {
  const {id}      = useParams()
  const {session, profile} = useAuth()
  const navigate  = useNavigate()
  const isMgr     = MGR_ROLES.includes(profile?.role)
  const isLoc     = profile?.role === 'locataire'

  const [niveau,   setNiveau]   = useState(0)
  const [niveaux,  setNiveaux]  = useState(NIVEAUX)
  const [plan,     setPlan]     = useState([])
  const [equips,   setEquips]   = useState([])
  const [prestataires, setPrestataires] = useState([]) // prestataires du bien
  const [selP,     setSelP]     = useState(null)
  const [selE,     setSelE]     = useState(null)
  const [tab,      setTab]      = useState('pieces')
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState({})
  const [customNom,setCustomNom]= useState('')
  const [adding,   setAdding]   = useState(false)
  const [search,   setSearch]   = useState('')
  // Déclaration incident (mode locataire)
  const [incModal,  setIncModal]  = useState(null)  // { piece, equip, mode:'piece'|'equip' }
  const [incForm,   setIncForm]   = useState({ panne:'', libre:'', gravite:'moyen' })
  const [incList,   setIncList]   = useState([])    // incidents déclarés dans cette session
  const [incStep,   setIncStep]   = useState('form') // 'form' | 'suite' | 'rapport'
  const [incSaving, setIncSaving] = useState(false)

  const svgRef    = useRef(null)
  const planRef   = useRef([])
  const equipsRef = useRef([])
  const interRef  = useRef({ mode:null, id:null, ox:0, oy:0, sx:0, sy:0, sw:0, sh:0 })
  const draggedRef = useRef(false)  // true si un drag/resize vient de se terminer
  planRef.current   = plan
  equipsRef.current = equips

  const {data, loading, error} = useLoad(async () => {
    if (!session?.user || !id) return null
    const [bR,pR,eR,prR] = await Promise.all([
      supabase.from('biens').select('*').eq('id',id).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id',id).eq('etage',niveau),
      supabase.from('plan_equipements').select('*').eq('bien_id',id).eq('etage',niveau),
      supabase.from('prestataire_biens').select('prestataires(*)').eq('bien_id',id),
    ])
    return {
      bien:  bR.data,
      plan:  pR.data||[],
      equips:eR.data||[],
      prestataires: (prR.data||[]).map(x=>x.prestataires).filter(Boolean),
    }
  }, [session?.user?.id, id, niveau])

  useEffect(() => {
    if (data) {
      setPlan(data.plan); setEquips(data.equips)
      setPrestataires(data.prestataires||[])
      setSelP(null); setSelE(null)
    }
  }, [data])

  // ─── window listeners pour drag/resize ────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      const it = interRef.current
      if (!it.mode) return
      const r = svgRef.current?.getBoundingClientRect()
      if (!r) return

      if (it.mode === 'drag') {
        const col = Math.max(0, Math.floor((e.clientX - r.left) / CELL))
        const row = Math.max(0, Math.floor((e.clientY - r.top)  / CELL))
        const p   = planRef.current.find(x => x.id === it.id)
        if (!p) return
        setPlan(prev => prev.map(x => x.id === it.id
          ? {...x, x:Math.max(0,Math.min(GW-p.w,col-it.ox)), y:Math.max(0,Math.min(GH-p.h,row-it.oy))} : x))
      }
      if (it.mode === 'drag_e') {
        const dx = e.clientX-it.sx, dy = e.clientY-it.sy
        setEquips(prev => prev.map(x => x.id === it.id
          ? {...x, grid_x:Math.max(0,Math.min(GW*CELL-24,it.ox+dx)), grid_y:Math.max(0,Math.min(GH*CELL-24,it.oy+dy))} : x))
      }
      if (it.mode === 'resize') {
        const dw = Math.round((e.clientX-it.sx)/CELL)
        const dh = Math.round((e.clientY-it.sy)/CELL)
        const p  = planRef.current.find(x => x.id === it.id)
        if (!p) return
        setPlan(prev => prev.map(x => x.id === it.id
          ? {...x, w:Math.max(1,Math.min(GW-p.x,it.sw+dw)), h:Math.max(1,Math.min(GH-p.y,it.sh+dh))} : x))
      }
    }

    async function onUp() {
      const it = interRef.current
      if (!it.mode) return
      draggedRef.current = true  // ← signal: le prochain click SVG doit être ignoré
      if (it.mode === 'drag') {
        const p = planRef.current.find(x => x.id === it.id)
        if (p) await supabase.from('plan_pieces').update({x:p.x, y:p.y}).eq('id', p.id)
      }
      if (it.mode === 'drag_e') {
        const eq = equipsRef.current.find(x => x.id === it.id)
        if (eq) await supabase.from('plan_equipements').update({grid_x:eq.grid_x, grid_y:eq.grid_y}).eq('id', eq.id)
      }
      if (it.mode === 'resize') {
        const p = planRef.current.find(x => x.id === it.id)
        if (p) await supabase.from('plan_pieces').update({w:p.w, h:p.h}).eq('id', p.id)
      }
      interRef.current = { mode:null, id:null, ox:0, oy:0, sx:0, sy:0, sw:0, sh:0 }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  function startDrag(e, p) {
    e.stopPropagation()
    setSelP(p.id); setSelE(null)
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    interRef.current = {
      mode:'drag', id:p.id,
      ox:Math.floor((e.clientX-r.left)/CELL)-p.x,
      oy:Math.floor((e.clientY-r.top)/CELL)-p.y,
      sw:p.w, sh:p.h, sx:0, sy:0,
    }
  }

  function startDragEquip(e, eq) {
    e.stopPropagation()
    setSelE(eq.id); setSelP(null)
    interRef.current = {
      mode:'drag_e', id:eq.id,
      sx:e.clientX, sy:e.clientY,
      ox:eq.grid_x||0, oy:eq.grid_y||0,
      sw:0, sh:0,
    }
  }

  function startResize(e, p) {
    e.stopPropagation()
    e.preventDefault()
    interRef.current = {
      mode:'resize', id:p.id,
      sx:e.clientX, sy:e.clientY,
      sw:p.w, sh:p.h, ox:0, oy:0,
    }
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  // ─── Mode locataire : clic sur pièce ou équipement ────────────────────────
  function ouvrirIncident(piece, equip) {
    setIncForm({ panne:'', libre:'', gravite:'moyen' })
    setIncStep('form')
    setIncModal({ piece, equip })
  }

  // Prestataire correspondant à un équipement (par spécialité ou notes)
  function getPrestataire(equip) {
    if (!equip || !prestataires.length) return null
    const catMap = {
      'Plomberie':'Plomberie', 'Electricite':'Electricite',
      'Chauffage':'Chauffage / Climatisation', 'Ouvertures':'Serrurerie',
      'Structure':'Maconnerie / Carrelage', 'Appareils':'Electromenager',
    }
    const spe = catMap[equip.categorie]
    return prestataires.find(p => p.specialite === spe) || prestataires[0] || null
  }

  async function soumettreIncident() {
    if (!incForm.panne && !incForm.libre) return
    setIncSaving(true)
    try {
      const titre = incForm.panne === 'Autre' || !incForm.panne
        ? incForm.libre || 'Incident signale depuis le plan'
        : incModal.equip
          ? `${incModal.piece?.nom||''} – ${incModal.equip.nom} : ${incForm.panne}`
          : `${incModal.piece?.nom||''} : ${incForm.panne}`

      const { data: inc, error: e } = await supabase.from('incidents').insert({
        bien_id:       id,
        signale_par:   session.user.id,
        titre,
        description:   incForm.libre || null,
        gravite:       incForm.gravite,
        statut:        'nouveau',
        equipement_id: incModal.equip?.id || null,
      }).select().single()

      if (e) throw e
      setIncList(prev => [...prev, { ...inc, piece: incModal.piece, equip: incModal.equip }])
      setIncStep('suite')
    } catch(err) {
      alert('Erreur : ' + err.message)
    } finally {
      setIncSaving(false)
    }
  }

  async function addPiece(tpl) {
    if (tpl.custom) { setAdding(true); return }
    let x=0,y=0
    outer:for(let r=0;r<GH;r++) for(let c=0;c<GW;c++) {
      if(c+tpl.w>GW||r+tpl.h>GH) continue
      if(!plan.some(p=>c<p.x+p.w&&c+tpl.w>p.x&&r<p.y+p.h&&r+tpl.h>p.y)){x=c;y=r;break outer}
    }
    const{data:d}=await supabase.from('plan_pieces').insert({bien_id:id,etage:niveau,nom:tpl.n,icone:tpl.i,couleur:tpl.c,x,y,w:tpl.w,h:tpl.h}).select().single()
    if(d) setPlan(p=>[...p,d])
  }
  async function addCustom() {
    if(!customNom.trim()) return
    const{data:d}=await supabase.from('plan_pieces').insert({bien_id:id,etage:niveau,nom:customNom.trim(),icone:'✏️',couleur:'#F7F5F0',x:0,y:0,w:3,h:3}).select().single()
    if(d) setPlan(p=>[...p,d])
    setCustomNom(''); setAdding(false)
  }
  async function addEquip(cat,eq,pid) {
    const piece=plan.find(p=>p.id===pid)
    const{data:d}=await supabase.from('plan_equipements').insert({
      bien_id:id,plan_piece_id:pid||null,etage:niveau,nom:eq.n,icone:eq.i,
      categorie:cat,couleur:CCOL[cat]||'#F7F5F0',
      grid_x:piece?piece.x*CELL+Math.floor(piece.w*CELL/2)-12:20,
      grid_y:piece?piece.y*CELL+Math.floor(piece.h*CELL/2)-12:20,
    }).select().single()
    if(d){setEquips(e=>[...e,d]);setSelE(d.id)}
  }
  async function delPiece(pid) {
    if(!window.confirm('Supprimer cette piece ?')) return
    await supabase.from('plan_pieces').delete().eq('id',pid)
    setPlan(p=>p.filter(x=>x.id!==pid)); setSelP(null)
  }
  async function delEquip(eid) {
    await supabase.from('plan_equipements').delete().eq('id',eid)
    setEquips(e=>e.filter(x=>x.id!==eid)); setSelE(null)
  }

  const selPiece = plan.find(p=>p.id===selP)
  const selEquip = equips.find(e=>e.id===selE)
  const nlLabel  = niveaux.find(n=>n.v===niveau)?.l||'Niveau'
  const filtCats = Object.entries(ECAT).reduce((acc,[cat,items])=>{
    const f=items.filter(i=>!search||i.n.toLowerCase().includes(search.toLowerCase()))
    if(f.length)acc[cat]=f; return acc
  },{})

  if(loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="page-header" style={{marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate(isMgr?'/biens':'/')}>← Retour</button>
          <div>
            <h1 className="page-title" style={{fontSize:18}}>{data?.bien?.adresse}</h1>
            <p className="page-sub">
              {plan.length} piece(s) · {equips.length} equipement(s)
              {isLoc && ' · Cliquez sur une pièce ou un équipement pour signaler un problème'}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {isLoc && incList.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={()=>setIncStep('rapport')&&setIncModal({})}>
              📋 {incList.length} incident(s) declares
            </button>
          )}
          <select className="btn btn-secondary btn-sm" value={niveau}
            onChange={e=>{setNiveau(Number(e.target.value));setSelP(null);setSelE(null)}}
            style={{cursor:'pointer'}}>
            {niveaux.map(n=><option key={n.v} value={n.v}>{n.l}</option>)}
          </select>
          {isMgr && (
            <button className="btn btn-secondary btn-sm" onClick={()=>{
              const l=prompt('Nom du niveau')
              if(l){const v=100+niveaux.length;setNiveaux(ns=>[...ns,{v,l}]);setNiveau(v)}
            }}>+ Niveau</button>
          )}
        </div>
      </div>

      {/* Bandeau locataire */}
      {isLoc && (
        <div style={{background:'#EBF2FC',borderRadius:10,padding:'10px 16px',marginBottom:10,fontSize:13,color:'#2B5EA7',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>ℹ️</span>
          <span>Cliquez sur une <strong>pièce</strong> ou un <strong>équipement</strong> pour signaler un problème directement.</span>
        </div>
      )}

      {/* Ajout pièce personnalisée */}
      {adding && isMgr && (
        <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',padding:'9px 13px',background:'#E8F2EB',borderRadius:8}}>
          <input style={{flex:1,padding:'7px 11px',border:'1px solid rgba(0,0,0,.15)',borderRadius:7,fontFamily:'inherit',fontSize:13,outline:'none'}}
            value={customNom} autoFocus placeholder="Nom de la piece…"
            onChange={e=>setCustomNom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()}/>
          <button className="btn btn-primary btn-sm" onClick={addCustom}>Ajouter</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setAdding(false)}>✕</button>
        </div>
      )}

      <div style={{display:'flex',gap:10,height:'calc(100vh - 195px)',minHeight:450}}>

        {/* Palette (MGR uniquement) */}
        {isMgr && (
          <div style={{width:155,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:'8px',overflowY:'auto',flexShrink:0}}>
            <div style={{display:'flex',gap:4,marginBottom:8}}>
              {[['pieces','🏠 Pieces'],['equips','🔧 Equip.']].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'5px 3px',border:`1px solid ${tab===t?'#2D5A3D':'rgba(0,0,0,.1)'}`,borderRadius:7,background:tab===t?'#E8F2EB':'#F7F5F0',cursor:'pointer',fontSize:11,fontWeight:tab===t?600:400,color:tab===t?'#2D5A3D':'#6B6560'}}>{l}</button>
              ))}
            </div>
            {tab==='pieces' && PTPL.map(t=>(
              <div key={t.n} onClick={()=>addPiece(t)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'5px 7px',borderRadius:7,cursor:'pointer',border:'1px solid rgba(0,0,0,.06)',background:'#FAFAF8',marginBottom:3,fontSize:12}}>
                <span style={{fontSize:15}}>{t.i}</span>{t.n}
              </div>
            ))}
            {tab==='equips' && <>
              <div style={{fontSize:9,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginBottom:4}}>
                {selPiece ? <span>→ <span style={{color:'#2D5A3D'}}>{selPiece.nom}</span></span> : 'Selectionnez une piece'}
              </div>
              <input style={{width:'100%',padding:'5px 8px',border:'1px solid rgba(0,0,0,.14)',borderRadius:6,fontFamily:'inherit',fontSize:11,outline:'none',marginBottom:6,boxSizing:'border-box'}}
                placeholder="Chercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
              {Object.entries(filtCats).map(([cat,items])=>(
                <div key={cat}>
                  <div style={{fontSize:9,fontWeight:700,color:'#C8813A',textTransform:'uppercase',marginTop:6,marginBottom:2}}>{cat}</div>
                  {items.map(eq=>(
                    <div key={eq.n} onClick={()=>addEquip(cat,eq,selP)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'4px 6px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(0,0,0,.05)',background:'#FAFAF8',marginBottom:2}}>
                      <span style={{fontSize:13}}>{eq.i}</span><span style={{fontSize:11}}>{eq.n}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>}
          </div>
        )}

        {/* SVG Plan */}
        <div style={{flex:1,overflow:'auto',background:'#F0EDE6',borderRadius:12,border:'1px solid rgba(0,0,0,.08)'}}>
          <svg ref={svgRef} width={GW*CELL} height={GH*CELL}
            style={{display:'block',userSelect:'none',minWidth:GW*CELL,cursor:isLoc?'pointer':'default'}}
            onClick={()=>{
              if(draggedRef.current){draggedRef.current=false;return}
              setSelP(null);setSelE(null)
            }}>
            <defs>
              <pattern id="pg" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#FAFAF8"/>
            <rect width="100%" height="100%" fill="url(#pg)"/>
            <text x={8} y={18} fontSize="11" fill="rgba(0,0,0,.2)" fontFamily="sans-serif">{nlLabel}</text>

            {plan.map(p=>{
              const px=p.x*CELL, py=p.y*CELL, pw=p.w*CELL, ph=p.h*CELL
              const isSel = selP===p.id
              // Incident déclaré sur cette pièce dans la session
              const hasInc = incList.some(i=>i.piece?.id===p.id && !i.equip)
              return (
                <g key={p.id}>
                  <rect
                    x={px+1} y={py+1} width={pw-2} height={ph-2} rx="6"
                    fill={p.couleur||'#E8F2EB'}
                    stroke={hasInc?'#B83232':isSel?'#2D5A3D':'rgba(0,0,0,.18)'}
                    strokeWidth={hasInc||isSel?2.5:1}
                    style={{cursor:isMgr?'grab':isLoc?'pointer':'default'}}
                    onMouseDown={e=>{if(isMgr)startDrag(e,p)}}
                    onClick={e=>{
                      e.stopPropagation()
                      if(interRef.current.mode||draggedRef.current) return
                      if(isLoc){ ouvrirIncident(p, null); return }
                      setSelP(p.id); setSelE(null)
                    }}
                    onDoubleClick={e=>{
                      e.stopPropagation()
                      if(!isMgr||interRef.current.mode) return
                      setForm({nom:p.nom,icone:p.icone,couleur:p.couleur,w:p.w,h:p.h})
                      setModal({type:'piece',id:p.id})
                    }}
                  />
                  <text x={px+pw/2} y={py+ph/2-(ph>80?14:4)} textAnchor="middle" dominantBaseline="middle"
                    fontSize={ph>80?20:13} style={{pointerEvents:'none'}}>{p.icone}</text>
                  {ph>52 && <text x={px+pw/2} y={py+ph/2+(ph>80?12:8)} textAnchor="middle"
                    fontSize="11" fontWeight="500" fill="#1A1714" fontFamily="sans-serif"
                    style={{pointerEvents:'none'}}>{p.nom}</text>}
                  {hasInc && (
                    <circle cx={px+12} cy={py+12} r="8" fill="#B83232" opacity=".9" style={{pointerEvents:'none'}}/>
                  )}
                  {isMgr && isSel && <>
                    <g onClick={e=>{e.stopPropagation();if(!interRef.current.mode)delPiece(p.id)}} style={{cursor:'pointer'}}>
                      <circle cx={px+pw-10} cy={py+10} r="10" fill="#B83232" opacity=".9"/>
                      <text x={px+pw-10} y={py+10} textAnchor="middle" dominantBaseline="middle"
                        fontSize="13" fill="white" style={{pointerEvents:'none'}}>✕</text>
                    </g>
                    <g style={{cursor:'se-resize'}} onMouseDown={e=>startResize(e,p)} onClick={e=>e.stopPropagation()}>
                      <rect x={px+pw-20} y={py+ph-20} width="18" height="18" rx="4" fill="#2D5A3D" opacity=".9"/>
                      <text x={px+pw-11} y={py+ph-11} textAnchor="middle" dominantBaseline="middle"
                        fontSize="11" fill="white" style={{pointerEvents:'none'}}>↘</text>
                    </g>
                  </>}
                  {isMgr && !isSel && (
                    <rect x={px+pw-7} y={py+ph-7} width="5" height="5" rx="1"
                      fill="rgba(0,0,0,.2)" style={{pointerEvents:'none'}}/>
                  )}
                </g>
              )
            })}

            {equips.map(eq=>{
              const ex=eq.grid_x||20, ey=eq.grid_y||20, isSel=selE===eq.id
              const hasInc = incList.some(i=>i.equip?.id===eq.id)
              return (
                <g key={eq.id}
                  style={{cursor:isMgr?'grab':isLoc?'pointer':'default'}}
                  onMouseDown={e=>{if(isMgr)startDragEquip(e,eq)}}
                  onClick={e=>{
                    e.stopPropagation()
                    if(interRef.current.mode||draggedRef.current) return
                    if(isLoc){
                      const piece = plan.find(p=>p.id===eq.plan_piece_id)
                      ouvrirIncident(piece||null, eq)
                      return
                    }
                    setSelE(eq.id); setSelP(null)
                  }}
                  onDoubleClick={e=>{
                    e.stopPropagation()
                    if(!isMgr||interRef.current.mode) return
                    setForm({nom:eq.nom,icone:eq.icone,notes:eq.notes||'',piece_id:eq.plan_piece_id||''})
                    setModal({type:'equip',id:eq.id})
                  }}>
                  <circle cx={ex+12} cy={ey+12} r="14"
                    fill={hasInc?'#FDEAEA':CCOL[eq.categorie]||'#F7F5F0'}
                    stroke={hasInc?'#B83232':isSel?'#2D5A3D':'rgba(0,0,0,.2)'}
                    strokeWidth={hasInc||isSel?2.5:1.5} opacity=".95"/>
                  <text x={ex+12} y={ey+12} textAnchor="middle" dominantBaseline="middle"
                    fontSize="13" style={{pointerEvents:'none'}}>{eq.icone}</text>
                  {hasInc && <circle cx={ex+21} cy={ey+3} r="6" fill="#B83232" style={{pointerEvents:'none'}}/>}
                  {(isSel||isLoc) && (
                    <text x={ex+12} y={ey+32} textAnchor="middle" fontSize="9" fill="#1A1714"
                      fontFamily="sans-serif" style={{pointerEvents:'none'}}>
                      {(eq.nom||'').length>14?(eq.nom||'').slice(0,14)+'…':eq.nom}
                    </text>
                  )}
                  {isMgr && isSel && (
                    <g onClick={e=>{e.stopPropagation();if(!interRef.current.mode)delEquip(eq.id)}} style={{cursor:'pointer'}}>
                      <circle cx={ex+22} cy={ey+2} r="8" fill="#B83232" opacity=".9"/>
                      <text x={ex+22} y={ey+2} textAnchor="middle" dominantBaseline="middle"
                        fontSize="10" fill="white" style={{pointerEvents:'none'}}>✕</text>
                    </g>
                  )}
                </g>
              )
            })}

            {plan.length===0 && equips.length===0 && (
              <text x={GW*CELL/2} y={GH*CELL/2} textAnchor="middle"
                fontSize="14" fill="rgba(0,0,0,.2)" fontFamily="sans-serif">
                {isMgr ? '← Cliquez sur une piece pour commencer' : 'Aucun plan disponible pour ce logement'}
              </text>
            )}
          </svg>
        </div>

        {/* Panneau droit */}
        <div style={{width:160,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:12,overflowY:'auto',flexShrink:0}}>
          {isLoc && (
            <>
              <div style={{fontSize:11,fontWeight:700,color:'#2B5EA7',marginBottom:8}}>MODE SIGNALEMENT</div>
              <div style={{fontSize:11,color:'#6B6560',lineHeight:1.8,marginBottom:10}}>
                Cliquez sur une <strong>pièce</strong> ou un <strong>équipement</strong> en rouge pour déclarer un problème.
              </div>
              {incList.length > 0 && (
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'#B83232',marginBottom:6}}>
                    {incList.length} incident(s) declares
                  </div>
                  {incList.map((inc,i)=>(
                    <div key={i} style={{fontSize:11,color:'#6B6560',padding:'3px 0',borderBottom:'1px solid rgba(0,0,0,.05)'}}>
                      {inc.equip?.icone||inc.piece?.icone||'⚠️'} {inc.equip?.nom||inc.piece?.nom||'Piece'}
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{width:'100%',marginTop:8}}
                    onClick={()=>{setIncModal({});setIncStep('rapport')}}>
                    Voir le rapport
                  </button>
                </>
              )}
            </>
          )}
          {isMgr && selPiece && <>
            <div style={{fontSize:26,margin:'4px 0'}}>{selPiece.icone}</div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selPiece.nom}</div>
            <div style={{fontSize:11,color:'#6B6560',marginBottom:8}}>{selPiece.w}×{selPiece.h}</div>
            <button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%',marginBottom:6}}
              onClick={()=>{setForm({nom:selPiece.nom,icone:selPiece.icone,couleur:selPiece.couleur,w:selPiece.w,h:selPiece.h});setModal({type:'piece',id:selPiece.id})}}>
              ✏️ Modifier
            </button>
            <div style={{background:'#F7F5F0',borderRadius:8,padding:'7px 9px',fontSize:10,color:'#9E9890',lineHeight:2}}>
              🖱️ Glisser = deplacer<br/>
              <strong style={{color:'#2D5A3D'}}>↘ = redimensionner</strong><br/>
              Double-clic = editer
            </div>
          </>}
          {isMgr && selEquip && <>
            <div style={{fontSize:26,margin:'4px 0'}}>{selEquip.icone}</div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selEquip.nom}</div>
            <div style={{fontSize:11,color:'#6B6560',marginBottom:6}}>{selEquip.categorie}</div>
            {selEquip.notes && <div style={{fontSize:11,color:'#6B6560',marginBottom:6,fontStyle:'italic'}}>{selEquip.notes}</div>}
            <button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%'}}
              onClick={()=>{setForm({nom:selEquip.nom,icone:selEquip.icone,notes:selEquip.notes||'',piece_id:selEquip.plan_piece_id||''});setModal({type:'equip',id:selEquip.id})}}>
              ✏️ Modifier
            </button>
          </>}
          {isMgr && !selPiece && !selEquip && <>
            <div style={{fontSize:10,color:'#9E9890',lineHeight:2,marginBottom:8}}>
              🏠 = pieces<br/>🔧 = equipements<br/>
              Clic = selectionner<br/>
              Glisser = deplacer<br/>
              ↘ vert = redimensionner<br/>
              Double-clic = editer<br/>
              ✕ = supprimer
            </div>
            {plan.map(p=>(
              <div key={p.id} onClick={()=>setSelP(p.id)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'3px 4px',borderRadius:5,cursor:'pointer',background:selP===p.id?'#E8F2EB':'transparent',marginBottom:2}}>
                <div style={{width:10,height:10,borderRadius:2,background:p.couleur,border:'1px solid rgba(0,0,0,.1)',flexShrink:0}}/>
                <span style={{fontSize:10.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.icone} {p.nom}</span>
              </div>
            ))}
          </>}
        </div>
      </div>

      {/* ─── Modal édition MGR ─── */}
      {modal && isMgr && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-header">
              <span className="modal-title">{modal.type==='piece'?'Modifier la piece':'Modifier l\'equipement'}</span>
              <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid2">
                <div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
                <div className="fld"><label>Icone</label><input value={form.icone||''} onChange={e=>set('icone',e.target.value)}/></div>
              </div>
              {modal.type==='piece' && <>
                <div className="grid2">
                  <div className="fld"><label>Largeur</label><input type="number" min="1" max={GW} value={form.w||''} onChange={e=>set('w',e.target.value)}/></div>
                  <div className="fld"><label>Hauteur</label><input type="number" min="1" max={GH} value={form.h||''} onChange={e=>set('h',e.target.value)}/></div>
                </div>
                <div className="fld"><label>Couleur</label>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
                    {COLS.map(c=>(
                      <div key={c} onClick={()=>set('couleur',c)}
                        style={{width:24,height:24,borderRadius:5,background:c,cursor:'pointer',border:`2.5px solid ${form.couleur===c?'#2D5A3D':'rgba(0,0,0,.12)'}`}}/>
                    ))}
                  </div>
                </div>
              </>}
              {modal.type==='equip' && <>
                <div className="fld"><label>Piece</label>
                  <select value={form.piece_id||''} onChange={e=>set('piece_id',e.target.value)}>
                    <option value="">— Libre —</option>
                    {plan.map(p=><option key={p.id} value={p.id}>{p.icone} {p.nom}</option>)}
                  </select>
                </div>
                <div className="fld"><label>Notes / Instructions locataire</label>
                  <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}
                    placeholder="Ex: contacter le prestataire, ou actions a effectuer avant appel..."/>
                </div>
              </>}
              <button className="btn btn-primary" onClick={async()=>{
                if(modal.type==='piece'){
                  const u={nom:form.nom,icone:form.icone,couleur:form.couleur,w:Number(form.w)||2,h:Number(form.h)||2}
                  setPlan(p=>p.map(x=>x.id===modal.id?{...x,...u}:x))
                  await supabase.from('plan_pieces').update(u).eq('id',modal.id)
                } else {
                  const u={nom:form.nom,icone:form.icone,notes:form.notes||null,plan_piece_id:form.piece_id||null}
                  setEquips(e=>e.map(x=>x.id===modal.id?{...x,...u}:x))
                  await supabase.from('plan_equipements').update(u).eq('id',modal.id)
                }
                setModal(null)
              }}>💾 Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal déclaration incident (locataire) ─── */}
      {incModal && incStep === 'form' && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header" style={{background:'#FDEAEA',borderBottom:'1px solid rgba(184,50,50,.15)'}}>
              <div>
                <span className="modal-title" style={{color:'#B83232'}}>
                  ⚠️ Signaler un problème
                </span>
                <div style={{fontSize:12,color:'#6B6560',marginTop:2}}>
                  {incModal.equip
                    ? `${incModal.equip.icone} ${incModal.equip.nom}${incModal.piece?' — '+incModal.piece.nom:''}`
                    : `🏠 ${incModal.piece?.nom||'Piece'}`}
                </div>
              </div>
              <button className="modal-close" onClick={()=>setIncModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Pannes suggérées */}
              <div className="fld">
                <label>Quel est le problème ?</label>
                <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:6}}>
                  {(PANNES[incModal.equip?.categorie||'piece']||PANNES.piece).map(p=>(
                    <label key={p} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 10px',borderRadius:8,cursor:'pointer',border:`1.5px solid ${incForm.panne===p?'#2D5A3D':'rgba(0,0,0,.1)'}`,background:incForm.panne===p?'#E8F2EB':'#FAFAF8',fontSize:13}}>
                      <input type="radio" name="panne" value={p} checked={incForm.panne===p}
                        onChange={()=>setIncForm(f=>({...f,panne:p,libre:p==='Autre'?f.libre:''}))}
                        style={{accentColor:'#2D5A3D'}}/>
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              {/* Texte libre si Autre ou complément */}
              {(incForm.panne === 'Autre' || incForm.panne) && (
                <div className="fld">
                  <label>{incForm.panne === 'Autre' ? 'Décrivez le problème *' : 'Précisions (optionnel)'}</label>
                  <textarea value={incForm.libre||''} rows={2}
                    onChange={e=>setIncForm(f=>({...f,libre:e.target.value}))}
                    placeholder="Depuis quand ? Fréquence ? Détails…"/>
                </div>
              )}

              <div className="fld">
                <label>Urgence</label>
                <div style={{display:'flex',gap:6}}>
                  {[['faible','Faible','#2D5A3D','#E8F2EB'],['moyen','Moyen','#C8813A','#FDF3E7'],['urgent','Urgent','#B83232','#FDEAEA']].map(([v,l,col,bg])=>(
                    <button key={v} type="button"
                      onClick={()=>setIncForm(f=>({...f,gravite:v}))}
                      style={{flex:1,padding:'8px 4px',border:`2px solid ${incForm.gravite===v?col:'rgba(0,0,0,.1)'}`,borderRadius:8,background:incForm.gravite===v?bg:'#fff',color:incForm.gravite===v?col:'#6B6560',fontWeight:incForm.gravite===v?700:400,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>
                      {v==='faible'?'🟢':v==='moyen'?'🟡':'🔴'} {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes propriétaire sur cet équipement */}
              {incModal.equip?.notes && (
                <div style={{background:'#EBF2FC',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#2B5EA7'}}>
                  <strong>Instructions du propriétaire :</strong><br/>
                  {incModal.equip.notes}
                </div>
              )}

              {/* Prestataire recommandé */}
              {(() => {
                const p = getPrestataire(incModal.equip)
                if (!p) return null
                return (
                  <div style={{background:'#F7F5F0',borderRadius:8,padding:'10px 12px',fontSize:12}}>
                    <div style={{fontWeight:600,marginBottom:4}}>
                      Prestataire recommandé : {p.prenom||''} {p.nom} {p.societe?'('+p.societe+')':''}
                    </div>
                    {p.telephone && <div>📞 <a href={`tel:${p.telephone}`} style={{color:'#2B5EA7'}}>{p.telephone}</a></div>}
                    {p.email     && <div>✉️ <a href={`mailto:${p.email}`} style={{color:'#2B5EA7'}}>{p.email}</a></div>}
                    {p.disponibilite && <div style={{color:'#6B6560',marginTop:2}}>⏰ {p.disponibilite}</div>}
                  </div>
                )
              })()}

              <button className="btn btn-primary" style={{width:'100%'}}
                onClick={soumettreIncident} disabled={incSaving||(!incForm.panne&&!incForm.libre)}>
                {incSaving ? 'Envoi...' : '✅ Confirmer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Etape suite : declarer d'autres ? ─── */}
      {incModal && incStep === 'suite' && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <span className="modal-title">✅ Incident enregistré</span>
            </div>
            <div className="modal-body">
              <div style={{textAlign:'center',padding:'12px 0',fontSize:14}}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div>
                Votre incident a été signalé avec succès.
                <div style={{color:'#9E9890',fontSize:12,marginTop:6}}>
                  Le propriétaire / gestionnaire sera notifié.
                </div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button className="btn btn-secondary" style={{flex:1}}
                  onClick={()=>{setIncModal(null);setIncStep('rapport')}}>
                  Non, voir le rapport
                </button>
                <button className="btn btn-primary" style={{flex:1}}
                  onClick={()=>{setIncModal(null);setIncStep('form')}}>
                  Oui, signaler un autre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rapport incidents session ─── */}
      {incStep === 'rapport' && incList.length > 0 && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setIncStep('')}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">📋 Rapport de signalement</span>
              <button className="modal-close" onClick={()=>setIncStep('')}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-success" style={{marginBottom:12}}>
                {incList.length} incident(s) enregistré(s) et transmis au propriétaire / gestionnaire.
              </div>
              {incList.map((inc,i)=>(
                <div key={i} style={{background:'#F7F5F0',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                  <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                    <div style={{fontSize:22}}>{inc.equip?.icone||inc.piece?.icone||'⚠️'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{inc.titre}</div>
                      <div style={{fontSize:12,color:'#6B6560'}}>
                        {inc.piece?.nom && `Pièce : ${inc.piece.nom}`}
                        {inc.equip?.nom && ` — ${inc.equip.nom}`}
                      </div>
                      <div style={{marginTop:4}}>
                        <span className={`status ${inc.gravite==='urgent'?'status-red':inc.gravite==='moyen'?'status-yellow':'status-green'}`}>
                          {inc.gravite}
                        </span>
                      </div>
                    </div>
                    {/* Prestataire */}
                    {(() => {
                      const p = getPrestataire(inc.equip)
                      if (!p) return null
                      return (
                        <div style={{fontSize:11,textAlign:'right',color:'#6B6560'}}>
                          {p.nom}<br/>
                          {p.telephone && <a href={`tel:${p.telephone}`} style={{color:'#2B5EA7'}}>{p.telephone}</a>}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}
              <div style={{borderTop:'1px solid rgba(0,0,0,.08)',paddingTop:12,display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={()=>setIncStep('')}>
                  Retour au plan
                </button>
                <button className="btn btn-primary" style={{flex:1}} onClick={()=>navigate('/incidents')}>
                  Voir mes incidents
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
