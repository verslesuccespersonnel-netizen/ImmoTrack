import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

export default function Catalogue() {
  const [selZ, setSelZ] = useState(null)
  const [selP, setSelP] = useState(null)
  const [selE, setSelE] = useState(null)

  const { data, loading, error, reload } = useLoad(async () => {
    const [z,p,e,pa] = await Promise.all([
      supabase.from('catalogue_zones').select('*').order('ordre'),
      supabase.from('catalogue_pieces').select('*').order('ordre'),
      supabase.from('catalogue_equipements').select('*').order('ordre'),
      supabase.from('catalogue_pannes').select('*').order('ordre'),
    ])
    return { zones:z.data||[], pieces:p.data||[], equips:e.data||[], pannes:pa.data||[] }
  }, [])

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  const {zones=[],pieces=[],equips=[],pannes=[]} = data||{}

  const Col=({title,items,selId,onSel,countFn,tagFn})=>(
    <div style={{background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(0,0,0,.07)',fontWeight:600,fontSize:13}}>{title}</div>
      <div style={{flex:1,overflowY:'auto',maxHeight:500}}>
        {items.map(item=>(
          <div key={item.id} onClick={()=>onSel(item.id===selId?null:item.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid rgba(0,0,0,.04)',cursor:'pointer',background:selId===item.id?'#E8F2EB':'transparent'}}>
            <span style={{fontSize:13,flex:1,color:selId===item.id?'#2D5A3D':'#1A1714'}}>{item.icone||''} {item.nom||item.description}</span>
            {countFn&&<span style={{fontSize:10,color:'#9E9890'}}>{countFn(item.id)}</span>}
            {tagFn&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:'#F7F5F0',color:'#6B6560'}}>{tagFn(item)}</span>}
          </div>
        ))}
        {items.length===0&&<div style={{padding:16,fontSize:12,color:'#9E9890',textAlign:'center'}}>← Sélectionnez</div>}
      </div>
    </div>
  )

  return(
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Catalogue</h1><p className="page-sub">{zones.length} zones · {pieces.length} pièces · {equips.length} équipements · {pannes.length} pannes</p></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <Col title="🗂️ Zones" items={zones} selId={selZ} onSel={id=>{setSelZ(id);setSelP(null);setSelE(null)}} countFn={id=>pieces.filter(p=>p.zone_id===id).length}/>
        <Col title="🏠 Pièces" items={selZ?pieces.filter(p=>p.zone_id===selZ):[]} selId={selP} onSel={id=>{setSelP(id);setSelE(null)}} countFn={id=>equips.filter(e=>e.piece_id===id).length}/>
        <Col title="🔧 Équipements" items={selP?equips.filter(e=>e.piece_id===selP):[]} selId={selE} onSel={setSelE} countFn={id=>pannes.filter(p=>p.equipement_id===id).length} tagFn={e=>e.type}/>
        <Col title="⚠️ Pannes" items={selE?pannes.filter(p=>p.equipement_id===selE):[]} selId={null} onSel={()=>{}} tagFn={p=>p.gravite_defaut}/>
      </div>
    </Layout>
  )
}
