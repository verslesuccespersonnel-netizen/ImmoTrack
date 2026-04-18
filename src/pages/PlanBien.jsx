import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const CELL=48, GW=28, GH=20
const NIVEAUX=[{v:-1,l:'Sous-sol'},{v:0,l:'RDC'},{v:1,l:'Étage 1'},{v:2,l:'Étage 2'},{v:10,l:'Jardin'},{v:11,l:'Cour'},{v:12,l:'Garage'},{v:13,l:'Terrasse'}]
const PTPL=[
  {n:'Entrée',i:'🚪',c:'#F0EDE6',w:2,h:2},{n:'Salon',i:'🛋️',c:'#E8F2EB',w:5,h:4},
  {n:'Cuisine',i:'🍳',c:'#FDF3E7',w:3,h:3},{n:'Chambre',i:'🛏️',c:'#EBF2FC',w:4,h:3},
  {n:'Salle de bain',i:'🛁',c:'#F3ECFC',w:3,h:3},{n:'WC',i:'🚽',c:'#F7F5F0',w:1,h:2},
  {n:'Couloir',i:'↔️',c:'#F7F5F0',w:5,h:1},{n:'Bureau',i:'💼',c:'#EBF2FC',w:3,h:3},
  {n:'Escalier',i:'🪜',c:'#F0EDE6',w:2,h:3},{n:'Débarras',i:'📦',c:'#F0EDE6',w:2,h:2},
  {n:'Dressing',i:'👔',c:'#F3ECFC',w:2,h:2},{n:'Garage',i:'🚗',c:'#F0EDE6',w:5,h:4},
  {n:'Jardin',i:'🌿',c:'#E8F2EB',w:7,h:5},{n:'Terrasse',i:'☀️',c:'#FDF3E7',w:4,h:3},
  {n:'Balcon',i:'🌅',c:'#FDF3E7',w:3,h:1},{n:'Perso…',i:'✏️',c:'#F7F5F0',w:3,h:3,custom:true},
]
const ECAT={
  'Ouvertures':[{n:'Porte',i:'🚪'},{n:'Fenêtre',i:'🪟'},{n:'Volet élec.',i:'🪟'},{n:'Portail',i:'🚧'},{n:'Porte garage',i:'🚗'},{n:'Serrure',i:'🔐'},{n:'Digicode',i:'🔢'},{n:'Velux',i:'🪟'}],
  'Électricité':[{n:'Prise',i:'🔌'},{n:'Interrupteur',i:'🔘'},{n:'Tableau',i:'⚡'},{n:'Lumière',i:'💡'},{n:'VMC',i:'💨'},{n:'Sonnette',i:'🔔'},{n:'Clim',i:'❄️'},{n:'Détect. fumée',i:'🔴'}],
  'Plomberie':[{n:'Robinet',i:'🚰'},{n:'Évier',i:'🪣'},{n:'Lavabo',i:'🪣'},{n:'Baignoire',i:'🛁'},{n:'Douche',i:'🚿'},{n:'WC',i:'🚽'},{n:'Chasse eau',i:'💧'},{n:'Lave-linge',i:'🫧'},{n:'Chauffe-eau',i:'💧'}],
  'Chauffage':[{n:'Radiateur',i:'🌡️'},{n:'Sèche-serv.',i:'🌡️'},{n:'Chaudière',i:'🔥'},{n:'Thermostat',i:'🌡️'},{n:'Cheminée',i:'🔥'}],
  'Structure':[{n:'Mur',i:'🧱'},{n:'Plafond',i:'⬆️'},{n:'Sol',i:'🟫'},{n:'Toiture',i:'🏠'},{n:'Façade',i:'🏠'},{n:'Boîte lettres',i:'📬'}],
  'Équipements':[{n:'Four',i:'🔥'},{n:'Hotte',i:'💨'},{n:'Réfrigérateur',i:'🧊'},{n:'Placard',i:'🗄️'},{n:'Miroir',i:'🪞'}],
}
const CCOL={Ouvertures:'#F3ECFC',Électricité:'#EBF2FC',Plomberie:'#E8F8F5',Chauffage:'#FDF3E7',Structure:'#F7F5F0',Équipements:'#F0EDE6'}
const COLS=['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5']

export default function PlanBien() {
  const {id}    = useParams()
  const {session} = useAuth()
  const navigate  = useNavigate()
  const [niveau,   setNiveau]   = useState(0)
  const [niveaux,  setNiveaux]  = useState(NIVEAUX)
  const [plan,     setPlan]     = useState([])
  const [equips,   setEquips]   = useState([])
  const [selP,     setSelP]     = useState(null)
  const [selE,     setSelE]     = useState(null)
  const [tab,      setTab]      = useState('pieces')
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState({})
  const [customNom,setCustomNom]= useState('')
  const [adding,   setAdding]   = useState(false)
  const [search,   setSearch]   = useState('')
  const svgRef   = useRef(null)
  const planRef  = useRef([])
  const equipsRef = useRef([])
  // Interaction state stocké dans un ref (pas de re-render pendant le drag)
  // mode: null | 'drag' | 'drag_e' | 'resize'
  const interRef = useRef({ mode:null, id:null, ox:0, oy:0, sx:0, sy:0, sw:0, sh:0 })
  planRef.current  = plan
  equipsRef.current = equips

  const {data, loading, error} = useLoad(async () => {
    if (!session?.user || !id) return null
    const [bR,pR,eR] = await Promise.all([
      supabase.from('biens').select('*').eq('id',id).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id',id).eq('etage',niveau),
      supabase.from('plan_equipements').select('*').eq('bien_id',id).eq('etage',niveau),
    ])
    return {bien:bR.data, plan:pR.data||[], equips:eR.data||[]}
  }, [session?.user?.id, id, niveau])

  React.useEffect(() => {
    if (data) { setPlan(data.plan); setEquips(data.equips); setSelP(null); setSelE(null) }
  }, [data])

  // ─── Listeners window mousemove/mouseup ─────────────────────────────
  // Attachés une seule fois. Lisent le state via refs toujours à jour.
  // window capte les events même si souris sort du SVG = resize fonctionnel.
  useEffect(() => {
    function onMove(e) {
      const it = interRef.current
      if (!it.mode) return
      const svg = svgRef.current
      const r   = svg?.getBoundingClientRect()
      if (!r) return

      if (it.mode === 'drag') {
        const col = Math.max(0, Math.floor((e.clientX - r.left) / CELL))
        const row = Math.max(0, Math.floor((e.clientY - r.top)  / CELL))
        const p   = planRef.current.find(x => x.id === it.id)
        if (!p) return
        setPlan(prev => prev.map(x => x.id === it.id
          ? {...x, x:Math.max(0,Math.min(GW-p.w, col-it.ox)), y:Math.max(0,Math.min(GH-p.h, row-it.oy))}
          : x
        ))
      }
      if (it.mode === 'drag_e') {
        const dx = e.clientX - it.sx, dy = e.clientY - it.sy
        setEquips(prev => prev.map(x => x.id === it.id
          ? {...x, grid_x:Math.max(0,Math.min(GW*CELL-24, it.ox+dx)), grid_y:Math.max(0,Math.min(GH*CELL-24, it.oy+dy))}
          : x
        ))
      }
      if (it.mode === 'resize') {
        const dw = Math.round((e.clientX - it.sx) / CELL)
        const dh = Math.round((e.clientY - it.sy) / CELL)
        const p  = planRef.current.find(x => x.id === it.id)
        if (!p) return
        setPlan(prev => prev.map(x => x.id === it.id
          ? {...x, w:Math.max(1,Math.min(GW-p.x, it.sw+dw)), h:Math.max(1,Math.min(GH-p.y, it.sh+dh))}
          : x
        ))
      }
    }

    async function onUp() {
      const it = interRef.current
      if (!it.mode) return
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
    // stopPropagation CRITIQUE : empêche startDrag du parent de se déclencher
    e.stopPropagation()
    e.preventDefault()
    interRef.current = {
      mode:'resize', id:p.id,
      sx:e.clientX, sy:e.clientY,
      sw:p.w, sh:p.h,
      ox:0, oy:0,
    }
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function addPiece(tpl) {
    if (tpl.custom) { setAdding(true); return }
    let x=0,y=0
    outer:for(let r=0;r<GH;r++) for(let c=0;c<GW;c++) {
      if(c+tpl.w>GW||r+tpl.h>GH)continue
      if(!plan.some(p=>c<p.x+p.w&&c+tpl.w>p.x&&r<p.y+p.h&&r+tpl.h>p.y)){x=c;y=r;break outer}
    }
    const{data:d}=await supabase.from('plan_pieces').insert({bien_id:id,etage:niveau,nom:tpl.n,icone:tpl.i,couleur:tpl.c,x,y,w:tpl.w,h:tpl.h}).select().single()
    if(d) setPlan(p=>[...p,d])
  }

  async function addCustom() {
    if(!customNom.trim())return
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
    if(!window.confirm('Supprimer cette pièce ?'))return
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

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  return(
    <Layout>
      <div className="page-header" style={{marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/biens')}>← Retour</button>
          <div>
            <h1 className="page-title" style={{fontSize:18}}>{data?.bien?.adresse}</h1>
            <p className="page-sub">{plan.length} pièce(s) · {equips.length} équipement(s)</p>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <select className="btn btn-secondary btn-sm" value={niveau}
            onChange={e=>{setNiveau(Number(e.target.value));setSelP(null);setSelE(null)}}
            style={{cursor:'pointer'}}>
            {niveaux.map(n=><option key={n.v} value={n.v}>{n.l}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={()=>{
            const l=prompt('Nom du niveau');
            if(l){const v=100+niveaux.length;setNiveaux(ns=>[...ns,{v,l}]);setNiveau(v)}
          }}>+ Niveau</button>
        </div>
      </div>

      {adding&&<div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',padding:'9px 13px',background:'#E8F2EB',borderRadius:8}}>
        <input style={{flex:1,padding:'7px 11px',border:'1px solid rgba(0,0,0,.15)',borderRadius:7,fontFamily:'inherit',fontSize:13,outline:'none'}}
          value={customNom} autoFocus placeholder="Nom de la pièce…"
          onChange={e=>setCustomNom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()}/>
        <button className="btn btn-primary btn-sm" onClick={addCustom}>Ajouter</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setAdding(false)}>✕</button>
      </div>}

      <div style={{display:'flex',gap:10,height:'calc(100vh - 195px)',minHeight:450}}>
        {/* Palette */}
        <div style={{width:155,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:'8px',overflowY:'auto',flexShrink:0}}>
          <div style={{display:'flex',gap:4,marginBottom:8}}>
            {[['pieces','🏠 Pièces'],['equips','🔧 Équip.']].map(([t,l])=>(
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
              {selPiece ? <span>→ <span style={{color:'#2D5A3D'}}>{selPiece.nom}</span></span> : 'Sélect. une pièce'}
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

        {/* SVG Plan */}
        <div style={{flex:1,overflow:'auto',background:'#F0EDE6',borderRadius:12,border:'1px solid rgba(0,0,0,.08)'}}>
          <svg ref={svgRef} width={GW*CELL} height={GH*CELL}
            style={{display:'block',userSelect:'none',minWidth:GW*CELL,cursor:'default'}}
            onClick={e=>{
              if(interRef.current.mode)return
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
              return (
                <g key={p.id}>
                  {/* Zone drag - recouvre toute la pièce */}
                  <rect
                    x={px+1} y={py+1} width={pw-2} height={ph-2} rx="6"
                    fill={p.couleur||'#E8F2EB'}
                    stroke={isSel?'#2D5A3D':'rgba(0,0,0,.18)'}
                    strokeWidth={isSel?2.5:1}
                    style={{cursor:'grab'}}
                    onMouseDown={e=>startDrag(e,p)}
                    onDoubleClick={e=>{
                      e.stopPropagation()
                      if(interRef.current.mode)return
                      setForm({nom:p.nom,icone:p.icone,couleur:p.couleur,w:p.w,h:p.h})
                      setModal({type:'piece',id:p.id})
                    }}
                  />
                  <text x={px+pw/2} y={py+ph/2-(ph>80?14:4)} textAnchor="middle" dominantBaseline="middle"
                    fontSize={ph>80?20:13} style={{pointerEvents:'none'}}>{p.icone}</text>
                  {ph>52 && <text x={px+pw/2} y={py+ph/2+(ph>80?12:8)} textAnchor="middle"
                    fontSize="11" fontWeight="500" fill="#1A1714" fontFamily="sans-serif"
                    style={{pointerEvents:'none'}}>{p.nom}</text>}

                  {isSel && <>
                    {/* Bouton supprimer */}
                    <g onClick={e=>{e.stopPropagation();if(!interRef.current.mode)delPiece(p.id)}} style={{cursor:'pointer'}}>
                      <circle cx={px+pw-10} cy={py+10} r="10" fill="#B83232" opacity=".9"/>
                      <text x={px+pw-10} y={py+10} textAnchor="middle" dominantBaseline="middle"
                        fontSize="13" fill="white" style={{pointerEvents:'none'}}>✕</text>
                    </g>

                    {/* Poignée resize — SÉPARÉE du drag, stopPropagation empêche startDrag */}
                    <g
                      style={{cursor:'se-resize'}}
                      onMouseDown={e=>startResize(e,p)}
                      onClick={e=>e.stopPropagation()}>
                      <rect x={px+pw-20} y={py+ph-20} width="18" height="18" rx="4"
                        fill="#2D5A3D" opacity=".9"/>
                      <text x={px+pw-11} y={py+ph-11} textAnchor="middle" dominantBaseline="middle"
                        fontSize="11" fill="white" style={{pointerEvents:'none'}}>↘</text>
                    </g>
                  </>}
                  {/* Indicateur resize discret sur pièces non sélectionnées */}
                  {!isSel && <rect x={px+pw-7} y={py+ph-7} width="5" height="5" rx="1"
                    fill="rgba(0,0,0,.2)" style={{pointerEvents:'none'}}/>}
                </g>
              )
            })}

            {equips.map(eq=>{
              const ex=eq.grid_x||20, ey=eq.grid_y||20, isSel=selE===eq.id
              return (
                <g key={eq.id} style={{cursor:'grab'}}
                  onMouseDown={e=>startDragEquip(e,eq)}
                  onDoubleClick={e=>{
                    e.stopPropagation()
                    if(interRef.current.mode)return
                    setForm({nom:eq.nom,icone:eq.icone,notes:eq.notes||'',piece_id:eq.plan_piece_id||''})
                    setModal({type:'equip',id:eq.id})
                  }}>
                  <circle cx={ex+12} cy={ey+12} r="13"
                    fill={CCOL[eq.categorie]||'#F7F5F0'}
                    stroke={isSel?'#2D5A3D':'rgba(0,0,0,.2)'}
                    strokeWidth={isSel?2.5:1.5} opacity=".95"/>
                  <text x={ex+12} y={ey+12} textAnchor="middle" dominantBaseline="middle"
                    fontSize="13" style={{pointerEvents:'none'}}>{eq.icone}</text>
                  {isSel && <>
                    <text x={ex+12} y={ey+30} textAnchor="middle" fontSize="9" fill="#1A1714"
                      fontFamily="sans-serif" style={{pointerEvents:'none'}}>
                      {eq.nom.length>16?eq.nom.slice(0,16)+'…':eq.nom}
                    </text>
                    <g onClick={e=>{e.stopPropagation();if(!interRef.current.mode)delEquip(eq.id)}} style={{cursor:'pointer'}}>
                      <circle cx={ex+22} cy={ey+2} r="8" fill="#B83232" opacity=".9"/>
                      <text x={ex+22} y={ey+2} textAnchor="middle" dominantBaseline="middle"
                        fontSize="10" fill="white" style={{pointerEvents:'none'}}>✕</text>
                    </g>
                  </>}
                </g>
              )
            })}

            {plan.length===0&&equips.length===0&&(
              <text x={GW*CELL/2} y={GH*CELL/2} textAnchor="middle"
                fontSize="14" fill="rgba(0,0,0,.2)" fontFamily="sans-serif">
                ← Cliquez sur une pièce pour commencer
              </text>
            )}
          </svg>
        </div>

        {/* Panneau droit */}
        <div style={{width:155,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:12,overflowY:'auto',flexShrink:0}}>
          {selPiece && <>
            <div style={{fontSize:26,margin:'4px 0'}}>{selPiece.icone}</div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selPiece.nom}</div>
            <div style={{fontSize:11,color:'#6B6560',marginBottom:8}}>{selPiece.w}×{selPiece.h} cellules</div>
            <button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%',marginBottom:6}}
              onClick={()=>{setForm({nom:selPiece.nom,icone:selPiece.icone,couleur:selPiece.couleur,w:selPiece.w,h:selPiece.h});setModal({type:'piece',id:selPiece.id})}}>
              ✏️ Modifier
            </button>
            <div style={{background:'#F7F5F0',borderRadius:8,padding:'8px 10px',fontSize:10,color:'#9E9890',lineHeight:2}}>
              🖱️ Glisser = déplacer<br/>
              <strong style={{color:'#2D5A3D'}}>↘ Coin vert = redimensionner</strong><br/>
              Double-clic = éditer<br/>
              ✕ rouge = supprimer
            </div>
          </>}
          {selEquip && <>
            <div style={{fontSize:26,margin:'4px 0'}}>{selEquip.icone}</div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selEquip.nom}</div>
            <div style={{fontSize:11,color:'#6B6560',marginBottom:8}}>{selEquip.categorie}</div>
            <button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%'}}
              onClick={()=>{setForm({nom:selEquip.nom,icone:selEquip.icone,notes:selEquip.notes||'',piece_id:selEquip.plan_piece_id||''});setModal({type:'equip',id:selEquip.id})}}>
              ✏️ Modifier
            </button>
          </>}
          {!selPiece && !selEquip && <>
            <div style={{fontSize:10,color:'#9E9890',lineHeight:2,marginBottom:8}}>
              🏠 = pièces<br/>🔧 = équipements<br/>
              • Clic = sélectionner<br/>
              • Glisser = déplacer<br/>
              • ↘ vert = redimensionner<br/>
              • Double-clic = éditer<br/>
              • ✕ = supprimer
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

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-header">
              <span className="modal-title">{modal.type==='piece'?'Modifier la pièce':'Modifier l\'équipement'}</span>
              <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid2">
                <div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
                <div className="fld"><label>Icône</label><input value={form.icone||''} onChange={e=>set('icone',e.target.value)}/></div>
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
                <div className="fld"><label>Pièce</label>
                  <select value={form.piece_id||''} onChange={e=>set('piece_id',e.target.value)}>
                    <option value="">— Libre —</option>
                    {plan.map(p=><option key={p.id} value={p.id}>{p.icone} {p.nom}</option>)}
                  </select>
                </div>
                <div className="fld"><label>Notes</label>
                  <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
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
    </Layout>
  )
}
