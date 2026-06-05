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
export async function saveCase(summary, chatLog) {
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
      chat_log: chatLog,
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

/** Fetch a case summary by UUID for the review view. */
export async function getCaseSummary(id) {
  return callFunction('get-case', 'GET', null, `?id=${encodeURIComponent(id)}`)
}

/** Accept a case — POSTs to Fluent Case API and marks accepted. */
export async function acceptCase(id) {
  return callFunction('accept-case', 'POST', { id })
}

/** Reject a case — marks rejected in the DB. */
export async function rejectCase(id, reason = '') {
  return callFunction('reject-case', 'POST', { id, reason })
}
