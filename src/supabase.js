import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://jwtduvkobkfhdzcxxjhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dGR1dmtvYmtmaGR6Y3h4amhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDc3NzcsImV4cCI6MjA5NTUyMzc3N30.TycC97P5M_WC2lfOoh-7zoOgYxDQd1iUAZsQzZlwvV4'
)

export async function saveCase(summary, chatLog) {
  const { error } = await supabase.from('intakes').insert({
    claimant:        summary.claimant,
    intake_date:     summary.intake_date,
    employer:        summary.employer,
    employment_type: summary.employment_type,
    viability_score: summary.viability_score,
    viability_label: summary.viability_label,
    summary,
    chat_log: chatLog,
  })
  if (error) console.error('Supabase save error:', error.message)
  return !error
}

export async function saveFeedback({ rating, comment, snippet }) {
  const { error } = await supabase.from('feedback').insert({
    rating,
    comment,
    message_text: snippet,
  })
  if (error) console.error('Supabase feedback error:', error.message)
  return !error
}
