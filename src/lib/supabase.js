// src/lib/supabase.js
// Remplacez les valeurs par celles de votre projet Supabase
// Supabase Dashboard > Settings > API

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variables REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY manquantes dans .env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── AUTH HELPERS ─────────────────────────────────────────

export async function signUp({ email, password, nom, prenom, role }) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  // Crée le profil après inscription
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, nom, prenom, role })
  if (profileError) throw profileError

  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── INCIDENTS ────────────────────────────────────────────

export async function getIncidents({ bienId, locataireId, statut } = {}) {
  let query = supabase
    .from('incidents')
    .select(`
      *,
      piece:pieces(nom),
      element:elements(nom),
      signale_par:profiles!incidents_signale_par_fkey(nom, prenom),
      medias(id, type, url, commentaire)
    `)
    .order('created_at', { ascending: false })

  if (bienId)      query = query.eq('bien_id', bienId)
  if (locataireId) query = query.eq('signale_par', locataireId)
  if (statut)      query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createIncident(payload) {
  const { data, error } = await supabase
    .from('incidents')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  // Audit log
  await supabase.from('audit_log').insert({
    table_name: 'incidents',
    record_id: data.id,
    action: 'create',
    user_id: payload.signale_par,
    details: { titre: payload.titre, gravite: payload.gravite }
  })

  return data
}

export async function updateIncident(id, updates) {
  const { data, error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── MÉDIAS ───────────────────────────────────────────────

export async function uploadMedia({ incidentId, elementId, file, commentaire, uploadedBy }) {
  const ext = file.name.split('.').pop()
  const path = `incidents/${incidentId}/${Date.now()}.${ext}`

  // 1. Upload dans Storage
  const { error: storageError } = await supabase.storage
    .from('medias')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (storageError) throw storageError

  // 2. URL publique signée (valable 1h)
  const { data: urlData } = await supabase.storage
    .from('medias')
    .createSignedUrl(path, 3600)

  // 3. Insertion en base
  const type = file.type.startsWith('video') ? 'video'
    : file.type.startsWith('audio') ? 'audio'
    : file.type === 'application/pdf' ? 'document' : 'photo'

  const { data, error } = await supabase
    .from('medias')
    .insert({
      incident_id: incidentId,
      element_id: elementId,
      uploaded_by: uploadedBy,
      type,
      url: urlData.signedUrl,
      nom_fichier: file.name,
      taille_bytes: file.size,
      commentaire,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── DOCUMENTS ────────────────────────────────────────────

export async function getDocuments({ bienId, locationId } = {}) {
  let query = supabase
    .from('documents')
    .select('*, uploaded_by:profiles(nom, prenom)')
    .order('created_at', { ascending: false })

  if (bienId)     query = query.eq('bien_id', bienId)
  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function uploadDocument({ bienId, locationId, file, categorie, uploadedBy }) {
  const ext = file.name.split('.').pop()
  const path = `biens/${bienId}/${categorie}/${Date.now()}.${ext}`

  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(path, file)
  if (storageError) throw storageError

  const { data: urlData } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 an

  const { data, error } = await supabase
    .from('documents')
    .insert({
      bien_id: bienId,
      location_id: locationId,
      uploaded_by: uploadedBy,
      categorie,
      nom: file.name,
      url: urlData.signedUrl,
      taille_bytes: file.size,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createShareLink(documentId, heures = 24) {
  const token = crypto.randomUUID()
  const expire = new Date(Date.now() + heures * 3600 * 1000).toISOString()

  const { error } = await supabase
    .from('documents')
    .update({ partage_token: token, partage_expire: expire })
    .eq('id', documentId)
  if (error) throw error

  return `${window.location.origin}/partage/${token}`
}

// ── MESSAGES ─────────────────────────────────────────────

export async function getMessages({ incidentId, expediteur, destinataire }) {
  let query = supabase
    .from('messages')
    .select('*, expediteur:profiles!messages_expediteur_fkey(nom, prenom)')
    .order('created_at', { ascending: true })

  if (incidentId)  query = query.eq('incident_id', incidentId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function sendMessage({ incidentId, expediteur, destinataire, contenu }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ incident_id: incidentId, expediteur, destinataire, contenu })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── REALTIME (notifications live) ────────────────────────

export function subscribeToIncidents(bienId, callback) {
  return supabase
    .channel('incidents-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'incidents',
      filter: `bien_id=eq.${bienId}`
    }, callback)
    .subscribe()
}

export function subscribeToMessages(userId, callback) {
  return supabase
    .channel('messages-' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `destinataire=eq.${userId}`
    }, callback)
    .subscribe()
}
