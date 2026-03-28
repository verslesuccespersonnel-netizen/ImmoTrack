// src/lib/utils.js
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(dateStr, withTime = false) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (withTime) return format(d, "d MMM yyyy 'à' HH:mm", { locale: fr })
    return format(d, 'd MMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function formatRelative(dateStr) {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr })
  } catch {
    return dateStr
  }
}

export function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024)       return `${bytes} o`
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} Ko`
  return `${(bytes/(1024*1024)).toFixed(1)} Mo`
}

// ── GRAVITÉ ─────────────────────────────────────────────
export function graviteLabel(g) {
  return { faible: 'Faible', moyen: 'Moyen', urgent: 'Urgent' }[g] || g
}

export function graviteColor(g) {
  return { faible: '#2D5A3D', moyen: '#B87E20', urgent: '#B83232' }[g] || '#888'
}

// ── STATUT ───────────────────────────────────────────────
export function statutLabel(s) {
  return { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', annule: 'Annulé' }[s] || s
}

export function statutColor(s) {
  return { nouveau: '#2B5EA7', en_cours: '#B87E20', resolu: '#2D5A3D', annule: '#888' }[s] || '#888'
}
