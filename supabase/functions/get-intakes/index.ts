import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('intakes')
    .select('id, status, fluent_case_id, created_at, claimant, employer, viability_score, viability_label, summary')
    .order('created_at', { ascending: false })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Return slim rows — only what the dashboard needs
  const rows = (data ?? []).map(r => ({
    id:              r.id,
    status:          r.status          ?? 'pending',
    fluent_case_id:  r.fluent_case_id  ?? null,
    created_at:      r.created_at,
    claimant:        r.claimant,
    employer:        r.employer,
    viability_score: r.viability_score,
    viability_label: r.viability_label,
    // excerpt from summary JSONB
    intake_date:     r.summary?.intake_date     ?? null,
    injury_date:     r.summary?.injury_date     ?? null,
    body_part:       r.summary?.body_part       ?? null,
    recommendation:  r.summary?.recommendation  ?? null,
    red_flags:       Array.isArray(r.summary?.red_flags) ? r.summary.red_flags.length : 0,
  }))

  return new Response(JSON.stringify(rows), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
