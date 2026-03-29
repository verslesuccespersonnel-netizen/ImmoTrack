// src/pages/Catalogue.jsx — Gestion du catalogue pièces/équipements/pannes
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Catalogue() {
  const [zones, setZones]           = useState([])
  const [pieces, setPieces]         = useState([])
  const [equips, setEquips]         = useState([])
  const [pannes, setPannes]         = useState([])
  const [selZone, setSelZone]       = useState(null)
  const [selPiece, setSelPiece]     = useState(null)
  const [selEquip, setSelEquip]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null) // {type, item}
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [z, p, e, pa] = await Promise.all([
      supabase.from('catalogue_zones').select('*').order('ordre'),
      supabase.from('catalogue_pieces').select('*').order('ordre'),
      supabase.from('catalogue_equipements').select('*').order('ordre'),
      supabase.from('catalogue_pannes').select('*').order('ordre'),
    ])
    setZones(z.data||[])
    setPieces(p.data||[])
    setEquips(e.data||[])
    setPannes(pa.data||[])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function save() {
    setSaving(true); setError('')
    try {
      const { type, item } = modal
      if (type === 'zone') {
        if (item) await supabase.from('catalogue_zones').update({ nom:form.nom, icone:form.icone, ordre:Number(form.ordre)||0 }).eq('id', item.id)
        else await supabase.from('catalogue_zones').insert({ nom:form.nom, icone:form.icone||'📦', ordre:Number(form.ordre)||0 })
      } else if (type === 'piece') {
        if (item) await supabase.from('catalogue_pieces').update({ nom:form.nom, icone:form.icone, ordre:Number(form.ordre)||0 }).eq('id', item.id)
        else await supabase.from('catalogue_pieces').insert({ zone_id:selZone, nom:form.nom, icone:form.icone||'🏠', ordre:Number(form.ordre)||0 })
      } else if (type === 'equip') {
        if (item) await supabase.from('catalogue_equipements').update({ nom:form.nom, icone:form.icone, type:form.type_eq, ordre:Number(form.ordre)||0 }).eq('id', item.id)
        else await supabase.from('catalogue_equipements').insert({ piece_id:selPiece, nom:form.nom, icone:form.icone||'🔧', type:form.type_eq||'autre', ordre:Number(form.ordre)||0 })
      } else if (type === 'panne') {
        if (item) await supabase.from('catalogue_pannes').update({ description:form.desc, gravite_defaut:form.gravite, ordre:Number(form.ordre)||0 }).eq('id', item.id)
        else await supabase.from('catalogue_pannes').insert({ equipement_id:selEquip, description:form.desc, gravite_defaut:form.gravite||'moyen', ordre:Number(form.ordre)||0 })
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function del(table, id) {
    if (!window.confirm('Supprimer cet élément et ses enfants ?')) return
    await supabase.from(table).delete().eq('id', id)
    await load()
  }

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  const filtPieces = pieces.filter(p => p.zone_id === selZone)
  const filtEquips = equips.filter(e => e.piece_id === selPiece)
  const filtPannes = pannes.filter(p => p.equipement_id === selEquip)

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Catalogue</h1>
          <p style={css.sub}>{zones.length} zones · {pieces.length} pièces · {equips.length} équipements · {pannes.length} types de pannes</p>
        </div>
      </div>

      <div style={css.cols4}>
        {/* ZONES */}
        <Col title="Zones" icon="🗂️"
          onAdd={() => { setForm({}); setModal({ type:'zone', item:null }) }}>
          {zones.map(z => (
            <ColItem key={z.id} label={`${z.icone||''} ${z.nom}`}
              active={selZone===z.id}
              onClick={() => { setSelZone(z.id); setSelPiece(null); setSelEquip(null) }}
              onEdit={() => { setForm({ nom:z.nom, icone:z.icone, ordre:z.ordre }); setModal({ type:'zone', item:z }) }}
              onDel={() => del('catalogue_zones', z.id)}
              count={pieces.filter(p=>p.zone_id===z.id).length} />
          ))}
        </Col>

        {/* PIÈCES */}
        <Col title="Pièces" icon="🏠" disabled={!selZone}
          onAdd={selZone ? () => { setForm({}); setModal({ type:'piece', item:null }) } : null}>
          {filtPieces.map(p => (
            <ColItem key={p.id} label={`${p.icone||''} ${p.nom}`}
              active={selPiece===p.id}
              onClick={() => { setSelPiece(p.id); setSelEquip(null) }}
              onEdit={() => { setForm({ nom:p.nom, icone:p.icone, ordre:p.ordre }); setModal({ type:'piece', item:p }) }}
              onDel={() => del('catalogue_pieces', p.id)}
              count={equips.filter(e=>e.piece_id===p.id).length} />
          ))}
          {!selZone && <div style={css.hint}>← Sélectionnez une zone</div>}
        </Col>

        {/* ÉQUIPEMENTS */}
        <Col title="Équipements" icon="🔧" disabled={!selPiece}
          onAdd={selPiece ? () => { setForm({ type_eq:'autre' }); setModal({ type:'equip', item:null }) } : null}>
          {filtEquips.map(e => (
            <ColItem key={e.id} label={`${e.icone||''} ${e.nom}`}
              active={selEquip===e.id}
              onClick={() => setSelEquip(e.id)}
              onEdit={() => { setForm({ nom:e.nom, icone:e.icone, type_eq:e.type, ordre:e.ordre }); setModal({ type:'equip', item:e }) }}
              onDel={() => del('catalogue_equipements', e.id)}
              count={pannes.filter(p=>p.equipement_id===e.id).length}
              tag={e.type} />
          ))}
          {!selPiece && <div style={css.hint}>← Sélectionnez une pièce</div>}
        </Col>

        {/* PANNES */}
        <Col title="Types de pannes" icon="⚠️" disabled={!selEquip}
          onAdd={selEquip ? () => { setForm({ gravite:'moyen' }); setModal({ type:'panne', item:null }) } : null}>
          {filtPannes.map(p => (
            <ColItem key={p.id}
              label={p.description}
              onClick={() => {}}
              onEdit={() => { setForm({ desc:p.description, gravite:p.gravite_defaut, ordre:p.ordre }); setModal({ type:'panne', item:p }) }}
              onDel={() => del('catalogue_pannes', p.id)}
              tag={p.gravite_defaut}
              tagColor={p.gravite_defaut==='urgent'?'#B83232':p.gravite_defaut==='moyen'?'#B87E20':'#2D5A3D'} />
          ))}
          {!selEquip && <div style={css.hint}>← Sélectionnez un équipement</div>}
        </Col>
      </div>

      {/* MODAL */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modal}>
            <div style={css.mHeader}>
              <span style={css.mTitle}>
                {modal.item ? 'Modifier' : 'Ajouter'} —{' '}
                {modal.type==='zone'?'Zone':modal.type==='piece'?'Pièce':modal.type==='equip'?'Équipement':'Panne'}
              </span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:12 }}>
              {error && <div style={css.errBox}>{error}</div>}

              {modal.type !== 'panne' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 60px', gap:10 }}>
                  <Fld label="Nom" value={form.nom||''} onChange={v=>set('nom',v)} required />
                  <Fld label="Icône" value={form.icone||''} onChange={v=>set('icone',v)} placeholder="🏠" />
                </div>
              )}
              {modal.type === 'panne' && (
                <>
                  <Fld label="Description de la panne" value={form.desc||''} onChange={v=>set('desc',v)} required />
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={css.lbl}>Gravité par défaut</label>
                    <div style={{ display:'flex', gap:8 }}>
                      {[['faible','🟢 Faible','#2D5A3D','#E8F2EB'],['moyen','🟡 Moyen','#B87E20','#FDF6E3'],['urgent','🔴 Urgent','#B83232','#FDEAEA']].map(([v,l,c,bg])=>(
                        <button key={v} type="button"
                          style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:500, border:`1.5px solid ${form.gravite===v?c:'rgba(0,0,0,0.12)'}`, background:form.gravite===v?bg:'#fff', color:form.gravite===v?c:'#6B6560' }}
                          onClick={()=>set('gravite',v)}>{l}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {modal.type === 'equip' && (
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={css.lbl}>Type</label>
                  <select style={css.sel} value={form.type_eq||''} onChange={e=>set('type_eq',e.target.value)}>
                    {['plomberie','electricite','chauffage','menuiserie','structure','autre'].map(t=>(
                      <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}
              <button style={css.btnP} onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : (modal.item ? '💾 Mettre à jour' : '+ Ajouter')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Col({ title, icon, children, onAdd, disabled }) {
  return (
    <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', background: disabled?'#FAFAF8':'#fff' }}>
        <span style={{ fontWeight:600, fontSize:13, color: disabled?'#9E9890':'#1A1714' }}>{icon} {title}</span>
        {onAdd && <button onClick={onAdd} style={{ width:24, height:24, borderRadius:'50%', border:'1px solid rgba(0,0,0,0.15)', background:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'#2D5A3D', fontWeight:700 }}>+</button>}
      </div>
      <div style={{ flex:1, overflowY:'auto', maxHeight:480 }}>{children}</div>
    </div>
  )
}

function ColItem({ label, active, onClick, onEdit, onDel, count, tag, tagColor }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
      borderBottom:'1px solid rgba(0,0,0,0.05)', cursor:'pointer',
      background: active ? '#E8F2EB' : hover ? '#F7F5F0' : '#fff',
      transition:'.12s' }}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onClick={onClick}>
      <span style={{ flex:1, fontSize:12.5, color: active?'#2D5A3D':'#1A1714', fontWeight: active?500:400, lineHeight:1.4 }}>{label}</span>
      {tag && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:`${tagColor||'#888'}18`, color:tagColor||'#888', fontWeight:600, flexShrink:0 }}>{tag}</span>}
      {count !== undefined && <span style={{ fontSize:10, color:'#9E9890', flexShrink:0 }}>{count}</span>}
      {(hover || active) && (
        <div style={{ display:'flex', gap:3, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <button onClick={onEdit} style={{ ...css.microBtn, color:'#2D5A3D' }}>✏️</button>
          <button onClick={onDel} style={{ ...css.microBtn, color:'#B83232' }}>🗑</button>
        </div>
      )}
    </div>
  )
}

function Fld({ label, value, onChange, required, placeholder }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={css.lbl}>{label}{required&&' *'}</label>
      <input style={css.inp} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}

const css = {
  center: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:{ width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16 },
  h1:     { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:    { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  cols4:  { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 },
  hint:   { padding:'20px 14px', fontSize:12, color:'#9E9890', textAlign:'center' },
  microBtn:{ width:22, height:22, border:'none', background:'transparent', cursor:'pointer', fontSize:12, padding:0, display:'flex', alignItems:'center', justifyContent:'center' },
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:  { background:'#fff', borderRadius:12, width:'100%', maxWidth:400, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', overflow:'hidden' },
  mHeader:{ padding:'16px 22px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  mTitle: { fontFamily:'Georgia,serif', fontSize:16, fontWeight:500 },
  closeBtn:{ width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:    { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:    { padding:'8px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  sel:    { padding:'8px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', background:'#fff' },
  errBox: { background:'#FDEAEA', color:'#B83232', borderRadius:7, padding:'9px 13px', fontSize:12 },
  btnP:   { padding:'9px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
}
