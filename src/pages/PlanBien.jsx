import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const CELL=48,GW=28,GH=20
const NIVEAUX=[{v:-1,l:'Sous-sol'},{v:0,l:'RDC'},{v:1,l:'Étage 1'},{v:2,l:'Étage 2'},{v:10,l:'Jardin'},{v:11,l:'Cour'},{v:12,l:'Garage'},{v:13,l:'Terrasse'}]
const PTPL=[
  {n:'Entrée',i:'🚪',c:'#F0EDE6',w:2,h:2},{n:'Salon',i:'🛋️',c:'#E8F2EB',w:5,h:4},
  {n:'Cuisine',i:'🍳',c:'#FDF3E7',w:3,h:3},{n:'Chambre',i:'🛏️',c:'#EBF2FC',w:4,h:3},
  {n:'Salle de bain',i:'🛁',c:'#F3ECFC',w:3,h:3},{n:'WC',i:'🚽',c:'#F7F5F0',w:1,h:2},
  {n:'Couloir',i:'↔️',c:'#F7F5F0',w:5,h:1},{n:'Bureau',i:'💼',c:'#EBF2FC',w:3,h:3},
  {n:'Escalier',i:'🪜',c:'#F0EDE6',w:2,h:3},{n:'Débarras',i:'📦',c:'#F0EDE6',w:2,h:2},
  {n:'Garage',i:'🚗',c:'#F0EDE6',w:5,h:4},{n:'Jardin',i:'🌿',c:'#E8F2EB',w:7,h:5},
  {n:'Terrasse',i:'☀️',c:'#FDF3E7',w:4,h:3},{n:'Balcon',i:'🌅',c:'#FDF3E7',w:3,h:1},
  {n:'Perso…',i:'✏️',c:'#F7F5F0',w:3,h:3,custom:true},
]
const ECAT={
  'Ouvertures':[{n:'Porte',i:'🚪'},{n:'Fenêtre',i:'🪟'},{n:'Volet élec.',i:'🪟'},{n:'Portail',i:'🚧'},{n:'Garage',i:'🚗'},{n:'Serrure',i:'🔐'},{n:'Digicode',i:'🔢'},{n:'Velux',i:'🪟'}],
  'Électricité':[{n:'Prise',i:'🔌'},{n:'Interrupteur',i:'🔘'},{n:'Tableau',i:'⚡'},{n:'Lumière',i:'💡'},{n:'VMC',i:'💨'},{n:'Sonnette',i:'🔔'},{n:'Interphone',i:'📞'},{n:'Clim',i:'❄️'},{n:'Détect. fumée',i:'🔴'}],
  'Plomberie':[{n:'Robinet',i:'🚰'},{n:'Évier',i:'🪣'},{n:'Lavabo',i:'🪣'},{n:'Baignoire',i:'🛁'},{n:'Douche',i:'🚿'},{n:'WC',i:'🚽'},{n:'Chasse eau',i:'💧'},{n:'Lave-linge',i:'🫧'},{n:'Chauffe-eau',i:'💧'}],
  'Chauffage':[{n:'Radiateur',i:'🌡️'},{n:'Sèche-serv.',i:'🌡️'},{n:'Chaudière',i:'🔥'},{n:'Thermostat',i:'🌡️'},{n:'Cheminée',i:'🔥'}],
  'Structure':[{n:'Mur',i:'🧱'},{n:'Plafond',i:'⬆️'},{n:'Sol',i:'🟫'},{n:'Toiture',i:'🏠'},{n:'Façade',i:'🏠'},{n:'Garde-corps',i:'🚧'},{n:'Boîte lettres',i:'📬'}],
}
const CCOL={Ouvertures:'#F3ECFC',Électricité:'#EBF2FC',Plomberie:'#E8F8F5',Chauffage:'#FDF3E7',Structure:'#F7F5F0'}
const COLS=['#E8F2EB','#EBF2FC','#FDF3E7','#F3ECFC','#FDEAEA','#F0EDE6','#FDF6E3','#E8F8F5']

export default function PlanBien() {
  const {id} = useParams()
  const {session} = useAuth()
  const navigate = useNavigate()
  const [niveau, setNiveau] = useState(0)
  const [niveaux, setNiveaux] = useState(NIVEAUX)
  const [plan, setPlan]   = useState([])
  const [equips, setEquips] = useState([])
  const [selP, setSelP]   = useState(null)
  const [selE, setSelE]   = useState(null)
  const [drag, setDrag]   = useState(null)
  const [dragE, setDragE] = useState(null)
  const [tab, setTab]     = useState('pieces')
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [customNom, setCustomNom] = useState('')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const svgRef = useRef(null)
  // Ref pour accès synchrone dans les event listeners document
  const planRef    = useRef([])
  const isResizing = useRef(false)
  planRef.current = plan

  const {data, loading, error} = useLoad(async () => {
    if (!session?.user || !id) return null
    const [bR,pR,eR] = await Promise.all([
      supabase.from('biens').select('*').eq('id',id).single(),
      supabase.from('plan_pieces').select('*').eq('bien_id',id).eq('etage',niveau),
      supabase.from('plan_equipements').select('*').eq('bien_id',id).eq('etage',niveau),
    ])
    return {bien:bR.data,plan:pR.data||[],equips:eR.data||[]}
  }, [session?.user?.id, id, niveau])

  // Sync data vers state local quand useLoad termine
  React.useEffect(() => {
    if (data) { setPlan(data.plan); setEquips(data.equips) }
  }, [data])

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  async function addPiece(tpl){
    if(tpl.custom){setAdding(true);return}
    let x=0,y=0
    outer:for(let r=0;r<GH;r++)for(let c=0;c<GW;c++){
      if(c+tpl.w>GW||r+tpl.h>GH)continue
      if(!plan.some(p=>c<p.x+p.w&&c+tpl.w>p.x&&r<p.y+p.h&&r+tpl.h>p.y)){x=c;y=r;break outer}
    }
    const{data:d}=await supabase.from('plan_pieces').insert({bien_id:id,etage:niveau,nom:tpl.n,icone:tpl.i,couleur:tpl.c,x,y,w:tpl.w,h:tpl.h}).select().single()
    if(d)setPlan(p=>[...p,d])
  }

  async function addCustom(){
    if(!customNom.trim())return
    const{data:d}=await supabase.from('plan_pieces').insert({bien_id:id,etage:niveau,nom:customNom.trim(),icone:'✏️',couleur:'#F7F5F0',x:0,y:0,w:3,h:3}).select().single()
    if(d)setPlan(p=>[...p,d])
    setCustomNom('');setAdding(false)
  }

  async function addEquip(cat,eq,pid){
    const piece=plan.find(p=>p.id===pid)
    const{data:d}=await supabase.from('plan_equipements').insert({
      bien_id:id,plan_piece_id:pid||null,etage:niveau,nom:eq.n,icone:eq.i,
      categorie:cat,couleur:CCOL[cat]||'#F7F5F0',
      grid_x:piece?piece.x*CELL+Math.floor(piece.w*CELL/2)-12:20,
      grid_y:piece?piece.y*CELL+Math.floor(piece.h*CELL/2)-12:20,
    }).select().single()
    if(d){setEquips(e=>[...e,d]);setSelE(d.id)}
  }

  function getCell(e){
    const r=svgRef.current?.getBoundingClientRect()
    return r?{col:Math.max(0,Math.floor((e.clientX-r.left)/CELL)),row:Math.max(0,Math.floor((e.clientY-r.top)/CELL))}:{col:0,row:0}
  }

  function onMM(e){
    if(drag){
      const{col,row}=getCell(e)
      const p=planRef.current.find(x=>x.id===drag.id);if(!p)return
      setPlan(a=>a.map(x=>x.id===drag.id?{...x,x:Math.max(0,Math.min(GW-p.w,col-drag.ox)),y:Math.max(0,Math.min(GH-p.h,row-drag.oy))}:x))
    }
    if(dragE){
      const dx=e.clientX-dragE.sx,dy=e.clientY-dragE.sy
      setEquips(a=>a.map(x=>x.id===dragE.id?{...x,grid_x:Math.max(0,Math.min(GW*CELL-24,dragE.ox+dx)),grid_y:Math.max(0,Math.min(GH*CELL-24,dragE.oy+dy))}:x))
    }
  }

  async function onMU(){
    if(isResizing.current) return  // resize géré par ses propres listeners
    if(drag){const p=planRef.current.find(x=>x.id===drag.id);if(p)await supabase.from('plan_pieces').update({x:p.x,y:p.y}).eq('id',p.id);setDrag(null)}
    if(dragE){const e=equips.find(x=>x.id===dragE.id);if(e)await supabase.from('plan_equipements').update({grid_x:e.grid_x,grid_y:e.grid_y}).eq('id',e.id);setDragE(null)}
  }

  // ── RESIZE : fix définitif ──────────────────────────────
  // On capture les valeurs initiales par valeur (pas par référence)
  // et on utilise une mise à jour fonctionnelle de setState
  // qui reçoit toujours la valeur la plus récente du state.
  function onResizeMouseDown(e, pieceId) {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startY = e.clientY
    // Lire les dimensions de départ depuis planRef (toujours à jour)
    const startPiece = planRef.current.find(p => p.id === pieceId)
    if (!startPiece) return
    const startW = startPiece.w
    const startH = startPiece.h

    function onMove(ev) {
      const dw = Math.round((ev.clientX - startX) / CELL)
      const dh = Math.round((ev.clientY - startY) / CELL)
      // Mise à jour fonctionnelle : prev est TOUJOURS le state actuel
      setPlan(prev => {
        const cur = prev.find(p => p.id === pieceId)
        if (!cur) return prev
        const nw = Math.max(1, Math.min(GW - cur.x, startW + dw))
        const nh = Math.max(1, Math.min(GH - cur.y, startH + dh))
        return prev.map(p => p.id === pieceId ? { ...p, w: nw, h: nh } : p)
      })
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      isResizing.current = false
      // Lire depuis planRef pour la valeur finale
      const cur = planRef.current.find(p => p.id === pieceId)
      if (cur) await supabase.from('plan_pieces').update({ w: cur.w, h: cur.h }).eq('id', cur.id)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const selPiece=plan.find(p=>p.id===selP)
  const selEquip=equips.find(e=>e.id===selE)
  const nlLabel=niveaux.find(n=>n.v===niveau)?.l||'Niveau'
  const filtCats=Object.entries(ECAT).reduce((acc,[cat,items])=>{
    const f=items.filter(i=>!search||i.n.toLowerCase().includes(search.toLowerCase()))
    if(f.length)acc[cat]=f;return acc
  },{})

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  return(
    <Layout>
      <div className="page-header" style={{marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/biens')}>← Retour</button>
          <div><h1 className="page-title" style={{fontSize:18}}>{data?.bien?.adresse}</h1><p className="page-sub">{plan.length} pièce(s) · {equips.length} équipement(s)</p></div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <select className="btn btn-secondary btn-sm" value={niveau} onChange={e=>{setNiveau(Number(e.target.value));setSelP(null);setSelE(null)}} style={{cursor:'pointer'}}>{niveaux.map(n=><option key={n.v} value={n.v}>{n.l}</option>)}</select>
          <button className="btn btn-secondary btn-sm" onClick={()=>{const l=prompt('Nom du niveau');if(l){const v=100+niveaux.length;setNiveaux(n=>[...n,{v,l}]);setNiveau(v)}}}>+ Niveau</button>
        </div>
      </div>

      {adding&&<div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',padding:'9px 13px',background:'#E8F2EB',borderRadius:8}}>
        <input style={{flex:1,padding:'7px 11px',border:'1px solid rgba(0,0,0,.15)',borderRadius:7,fontFamily:'inherit',fontSize:13,outline:'none'}} value={customNom} autoFocus placeholder="Nom de la pièce…" onChange={e=>setCustomNom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()}/>
        <button className="btn btn-primary btn-sm" onClick={addCustom}>Ajouter</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setAdding(false)}>✕</button>
      </div>}

      <div style={{display:'flex',gap:10,height:'calc(100vh - 195px)',minHeight:450}}>
        <div style={{width:155,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:'8px',overflowY:'auto',flexShrink:0}}>
          <div style={{display:'flex',gap:4,marginBottom:8}}>
            {[['pieces','🏠'],['equips','🔧']].map(([t,ic])=>(
              <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:6,border:`1px solid ${tab===t?'#2D5A3D':'rgba(0,0,0,.1)'}`,borderRadius:7,background:tab===t?'#E8F2EB':'#F7F5F0',cursor:'pointer',fontSize:16}}>{ic}</button>
            ))}
          </div>
          {tab==='pieces'&&PTPL.map(t=><div key={t.n} onClick={()=>addPiece(t)} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 7px',borderRadius:7,cursor:'pointer',border:'1px solid rgba(0,0,0,.06)',background:'#FAFAF8',marginBottom:3,fontSize:12}}><span style={{fontSize:15}}>{t.i}</span>{t.n}</div>)}
          {tab==='equips'&&<>
            <div style={{fontSize:9,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginBottom:4}}>Équipements{selPiece&&<span style={{color:'#2D5A3D'}}> → {selPiece.nom}</span>}</div>
            <input style={{width:'100%',padding:'5px 8px',border:'1px solid rgba(0,0,0,.14)',borderRadius:6,fontFamily:'inherit',fontSize:11,outline:'none',marginBottom:6,boxSizing:'border-box'}} placeholder="Chercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {Object.entries(filtCats).map(([cat,items])=>(
              <div key={cat}><div style={{fontSize:9,fontWeight:700,color:'#C8813A',textTransform:'uppercase',marginTop:6,marginBottom:2}}>{cat}</div>
              {items.map(eq=><div key={eq.n} onClick={()=>addEquip(cat,eq,selP)} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 6px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(0,0,0,.05)',background:'#FAFAF8',marginBottom:2}}><span style={{fontSize:13}}>{eq.i}</span><span style={{fontSize:11}}>{eq.n}</span></div>)}</div>
            ))}
          </>}
        </div>

        <div style={{flex:1,overflow:'auto',background:'#F0EDE6',borderRadius:12,border:'1px solid rgba(0,0,0,.08)'}}>
          <svg ref={svgRef} width={GW*CELL} height={GH*CELL}
            style={{display:'block',cursor:(drag||dragE)?'grabbing':'default',userSelect:'none',minWidth:GW*CELL}}
            onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
            onClick={()=>{setSelP(null);setSelE(null)}}>
            <defs><pattern id="pg" width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="1"/></pattern></defs>
            <rect width="100%" height="100%" fill="#FAFAF8"/>
            <rect width="100%" height="100%" fill="url(#pg)"/>
            <text x={8} y={18} fontSize="11" fill="rgba(0,0,0,.2)" fontFamily="sans-serif">{nlLabel}</text>

            {plan.map(p=>{
              const px=p.x*CELL,py=p.y*CELL,pw=p.w*CELL,ph=p.h*CELL,isSel=selP===p.id
              return(
                <g key={p.id} style={{cursor:drag?.id===p.id?'grabbing':'grab'}}
                  onMouseDown={e=>{e.stopPropagation();setSelP(p.id);setSelE(null);const r=svgRef.current?.getBoundingClientRect();setDrag({id:p.id,ox:Math.floor((e.clientX-r.left)/CELL)-p.x,oy:Math.floor((e.clientY-r.top)/CELL)-p.y})}}
                  onDoubleClick={e=>{e.stopPropagation();setForm({nom:p.nom,icone:p.icone,couleur:p.couleur,w:p.w,h:p.h});setModal({type:'piece',id:p.id})}}>
                  <rect x={px+1} y={py+1} width={pw-2} height={ph-2} rx="6" fill={p.couleur||'#E8F2EB'} stroke={isSel?'#2D5A3D':'rgba(0,0,0,.18)'} strokeWidth={isSel?2.5:1} opacity=".93"/>
                  <text x={px+pw/2} y={py+ph/2-(ph>80?14:4)} textAnchor="middle" dominantBaseline="middle" fontSize={ph>80?20:13} style={{pointerEvents:'none'}}>{p.icone}</text>
                  {ph>52&&<text x={px+pw/2} y={py+ph/2+(ph>80?12:8)} textAnchor="middle" fontSize="11" fontWeight="500" fill="#1A1714" fontFamily="sans-serif" style={{pointerEvents:'none'}}>{p.nom}</text>}
                  {isSel&&<>
                    <g onClick={e=>{e.stopPropagation();if(window.confirm('Supprimer ?')){supabase.from('plan_pieces').delete().eq('id',p.id);setPlan(a=>a.filter(x=>x.id!==p.id));setSelP(null)}}} style={{cursor:'pointer'}}>
                      <circle cx={px+pw-9} cy={py+9} r="9" fill="#B83232" opacity=".85"/>
                      <text x={px+pw-9} y={py+9} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="white">✕</text>
                    </g>
                    {/* Poignée resize — onMouseDown sur document via handler stable */}
                    <g onMouseDown={e=>onResizeMouseDown(e,p.id)} style={{cursor:'se-resize'}}>
                      <rect x={px+pw-16} y={py+ph-16} width="14" height="14" rx="3" fill="#2D5A3D" opacity=".8"/>
                      <text x={px+pw-9} y={py+ph-9} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="white" style={{pointerEvents:'none'}}>↘</text>
                    </g>
                  </>}
                </g>
              )
            })}

            {equips.map(eq=>{
              const ex=eq.grid_x||20,ey=eq.grid_y||20,isSel=selE===eq.id
              return(
                <g key={eq.id} style={{cursor:dragE?.id===eq.id?'grabbing':'grab'}}
                  onMouseDown={e=>{e.stopPropagation();setSelE(eq.id);setSelP(null);setDragE({id:eq.id,sx:e.clientX,sy:e.clientY,ox:eq.grid_x||0,oy:eq.grid_y||0})}}
                  onDoubleClick={e=>{e.stopPropagation();setForm({nom:eq.nom,icone:eq.icone,notes:eq.notes||'',piece_id:eq.plan_piece_id||''});setModal({type:'equip',id:eq.id})}}>
                  <circle cx={ex+12} cy={ey+12} r="13" fill={CCOL[eq.categorie]||'#F7F5F0'} stroke={isSel?'#2D5A3D':'rgba(0,0,0,.2)'} strokeWidth={isSel?2.5:1.5} opacity=".95"/>
                  <text x={ex+12} y={ey+12} textAnchor="middle" dominantBaseline="middle" fontSize="13" style={{pointerEvents:'none'}}>{eq.icone}</text>
                  {isSel&&<>
                    <text x={ex+12} y={ey+30} textAnchor="middle" fontSize="9" fill="#1A1714" fontFamily="sans-serif" style={{pointerEvents:'none'}}>{eq.nom.length>16?eq.nom.slice(0,16)+'…':eq.nom}</text>
                    <g onClick={e=>{e.stopPropagation();supabase.from('plan_equipements').delete().eq('id',eq.id);setEquips(a=>a.filter(x=>x.id!==eq.id));setSelE(null)}} style={{cursor:'pointer'}}>
                      <circle cx={ex+22} cy={ey+2} r="7" fill="#B83232" opacity=".85"/>
                      <text x={ex+22} y={ey+2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="white">✕</text>
                    </g>
                  </>}
                </g>
              )
            })}
            {plan.length===0&&equips.length===0&&<text x={GW*CELL/2} y={GH*CELL/2} textAnchor="middle" fontSize="14" fill="rgba(0,0,0,.2)" fontFamily="sans-serif">← Cliquez sur une pièce pour commencer</text>}
          </svg>
        </div>

        <div style={{width:155,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,padding:12,overflowY:'auto',flexShrink:0}}>
          {selPiece&&<><div style={{fontSize:26,margin:'4px 0'}}>{selPiece.icone}</div><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selPiece.nom}</div><div style={{fontSize:11,color:'#6B6560',marginBottom:8}}>{selPiece.w}×{selPiece.h} cellules</div><button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%',marginBottom:5}} onClick={()=>{setForm({nom:selPiece.nom,icone:selPiece.icone,couleur:selPiece.couleur,w:selPiece.w,h:selPiece.h});setModal({type:'piece',id:selPiece.id})}}>✏️ Modifier</button></>}
          {selEquip&&<><div style={{fontSize:26,margin:'4px 0'}}>{selEquip.icone}</div><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{selEquip.nom}</div><div style={{fontSize:11,color:'#6B6560',marginBottom:8}}>{selEquip.categorie}</div><button className="btn btn-sm" style={{background:'#E8F2EB',color:'#2D5A3D',border:'none',width:'100%',marginBottom:5}} onClick={()=>{setForm({nom:selEquip.nom,icone:selEquip.icone,notes:selEquip.notes||'',piece_id:selEquip.plan_piece_id||''});setModal({type:'equip',id:selEquip.id})}}>✏️ Modifier</button></>}
          {!selPiece&&!selEquip&&<><div style={{fontSize:10,color:'#9E9890',lineHeight:2}}>🏠 = pièces<br/>🔧 = équipements<br/>• Glisser pour déplacer<br/>• ↘ pour redimensionner<br/>• Double-clic pour éditer<br/>• ✕ pour supprimer</div>
          {plan.length>0&&plan.map(p=><div key={p.id} onClick={()=>setSelP(p.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 4px',borderRadius:5,cursor:'pointer',background:selP===p.id?'#E8F2EB':'transparent',marginBottom:2,marginTop:2}}><div style={{width:10,height:10,borderRadius:2,background:p.couleur,border:'1px solid rgba(0,0,0,.1)',flexShrink:0}}/><span style={{fontSize:10.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.icone} {p.nom}</span></div>)}</>}
        </div>
      </div>

      {modal&&<div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
        <div className="modal" style={{maxWidth:360}}>
          <div className="modal-header"><span className="modal-title">{modal.type==='piece'?'Modifier la pièce':'Modifier l\'équipement'}</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="grid2"><div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div><div className="fld"><label>Icône</label><input value={form.icone||''} onChange={e=>set('icone',e.target.value)}/></div></div>
            {modal.type==='piece'&&<>
              <div className="grid2"><div className="fld"><label>Largeur</label><input type="number" value={form.w||''} onChange={e=>set('w',e.target.value)}/></div><div className="fld"><label>Hauteur</label><input type="number" value={form.h||''} onChange={e=>set('h',e.target.value)}/></div></div>
              <div className="fld"><label>Couleur</label><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>{COLS.map(c=><div key={c} onClick={()=>set('couleur',c)} style={{width:24,height:24,borderRadius:5,background:c,cursor:'pointer',border:`2.5px solid ${form.couleur===c?'#2D5A3D':'rgba(0,0,0,.12)'}`}}/>)}</div></div>
            </>}
            {modal.type==='equip'&&<>
              <div className="fld"><label>Pièce</label><select value={form.piece_id||''} onChange={e=>set('piece_id',e.target.value)}><option value="">— Libre —</option>{plan.map(p=><option key={p.id} value={p.id}>{p.icone} {p.nom}</option>)}</select></div>
              <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
            </>}
            <button className="btn btn-primary" onClick={async()=>{
              if(modal.type==='piece'){const u={nom:form.nom,icone:form.icone,couleur:form.couleur,w:Number(form.w)||2,h:Number(form.h)||2};setPlan(p=>p.map(x=>x.id===modal.id?{...x,...u}:x));await supabase.from('plan_pieces').update(u).eq('id',modal.id)}
              else{const u={nom:form.nom,icone:form.icone,notes:form.notes||null,plan_piece_id:form.piece_id||null};setEquips(e=>e.map(x=>x.id===modal.id?{...x,...u}:x));await supabase.from('plan_equipements').update(u).eq('id',modal.id)}
              setModal(null)
            }}>💾 Enregistrer</button>
          </div>
        </div>
      </div>}
    </Layout>
  )
}
