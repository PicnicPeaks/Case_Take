import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://jwtduvkobkfhdzcxxjhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dGR1dmtvYmtmaGR6Y3h4amhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDc3NzcsImV4cCI6MjA5NTUyMzc3N30.TycC97P5M_WC2lfOoh-7zoOgYxDQd1iUAZsQzZlwvV4'
)

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dGR1dmtvYmtmaGR6Y3h4amhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDc3NzcsImV4cCI6MjA5NTUyMzc3N30.TycC97P5M_WC2lfOoh-7zoOgYxDQd1iUAZsQzZlwvV4'
const FUNCTIONS_BASE   = 'https://jwtduvkobkfhdzcxxjhm.supabase.co/functions/v1'

// ── Core helpers ───────────────────────────────────────────────────────────────

async function callFunction(name, method = 'GET', body = null, queryParams = '') {
  const url = `${FUNCTIONS_BASE}/${name}${queryParams}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return res.json()
}

// ── Intake ─────────────────────────────────────────────────────────────────────

/** Save a completed intake. Returns { success, id } — id is the UUID for the case view URL. */
export async function saveCase(summary, chatLog, firmSlug = null) {
  const { data, error } = await supabase
    .from('intakes')
    .insert({
      claimant:        summary.claimant,
      intake_date:     summary.intake_date,
      employer:        summary.employer,
      employment_type: summary.employment_type,
      viability_score: summary.viability_score,
      viability_label: summary.viability_label,
      summary,
      chat_log:  chatLog,
      firm_slug: firmSlug ?? null,
    })
    .select('id')
    .single()
  if (error) console.error('Supabase save error:', error.message)
  return { success: !error, id: data?.id ?? null }
}

// ── Feedback ───────────────────────────────────────────────────────────────────

export async function saveFeedback({ rating, comment, snippet }) {
  const { error } = await supabase.from('feedback').insert({
    rating,
    comment,
    message_text: snippet,
  })
  if (error) console.error('Supabase feedback error:', error.message)
  return !error
}

// ── Case review ────────────────────────────────────────────────────────────────

/** Fetch a case summary by UUID for the review view. Optionally scoped to a firm. */
export async function getCaseSummary(id, firmSlug = null) {
  const qs = firmSlug
    ? `?id=${encodeURIComponent(id)}&firm_slug=${encodeURIComponent(firmSlug)}`
    : `?id=${encodeURIComponent(id)}`
  return callFunction('get-case', 'GET', null, qs)
}

/** Accept a case — POSTs to Fluent Case API and marks accepted. */
export async function acceptCase(id, firmSlug = null) {
  return callFunction('accept-case', 'POST', { id, ...(firmSlug ? { firm_slug: firmSlug } : {}) })
}

/** Reject a case — marks rejected in the DB. */
export async function rejectCase(id, reason = '', firmSlug = null) {
  return callFunction('reject-case', 'POST', { id, reason, ...(firmSlug ? { firm_slug: firmSlug } : {}) })
}

/** Fetch intakes, optionally scoped to a firm. */
export async function getIntakes(firmSlug = null) {
  const qs = firmSlug ? `?firm_slug=${encodeURIComponent(firmSlug)}` : ''
  return callFunction('get-intakes', 'GET', null, qs)
}

/** Verify a firm's dashboard password. Returns { success } or { error }. */
export async function verifyFirmPassword(slug, password) {
  return callFunction('verify-firm-password', 'POST', { slug, password })
}

/** Fetch public firm config by slug. */
export async function getFirm(slug) {
  return callFunction('get-firm', 'GET', null, `?slug=${encodeURIComponent(slug)}`)
}

/** Update firm settings. Authenticates via dashboard_password stored in localStorage. */
export async function updateFirm(slug, fields) {
  const password = localStorage.getItem(`ct_firm_auth_${slug}`) ?? ''
  return callFunction('update-firm', 'POST', { slug, dashboard_password: password, ...fields })
}

/** Admin: list all firms. */
export async function adminListFirms(adminToken) {
  return callFunction('firm-admin', 'GET', null, `?admin_token=${encodeURIComponent(adminToken)}`)
}

/** Admin: create a firm. */
export async function adminCreateFirm(adminToken, firmData) {
  return callFunction('firm-admin', 'POST', { admin_token: adminToken, ...firmData })
}

/** Admin: update a firm. */
export async function adminUpdateFirm(adminToken, slug, fields) {
  return callFunction('firm-admin', 'PUT', { admin_token: adminToken, slug, ...fields })
}

/** Admin: delete a firm. */
export async function adminDeleteFirm(adminToken, slug) {
  return callFunction('firm-admin', 'DELETE', { admin_token: adminToken, slug })
}
