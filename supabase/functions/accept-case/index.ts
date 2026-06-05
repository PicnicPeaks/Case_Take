import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Build the Fluent Case API payload from an intake summary ─────────────────

function buildFluentPayload(s: Record<string, unknown>): Record<string, unknown> {
  // Parse claimant name into first / last
  const claimant   = String(s.claimant ?? '').trim()
  const nameParts  = claimant.split(/\s+/).filter(Boolean)
  const firstName  = nameParts.length > 1 ? nameParts[0]            : ''
  const lastName   = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] ?? ''

  // Phone — strip everything except digits, take last 10
  const phoneRaw   = String(s.phone ?? '').replace(/\D/g, '')
  const phoneDigits = phoneRaw.length >= 10 ? phoneRaw.slice(-10) : ''

  // Email
  const emailAddr  = String(s.email ?? '').trim()
  const hasEmail   = emailAddr.includes('@')

  // Injury date — must be YYYY-MM-DD
  const injuryDate = String(s.injury_date ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null

  // Employer name
  const employer   = String(s.employer ?? '').trim()
  const hasEmployer = employer && employer !== 'N/A' && employer !== 'None provided'

  // ── Parties ──────────────────────────────────────────────────────────────
  const applicantParty: Record<string, unknown> = {
    Contact: {
      people_type_slug: 'applicant',
      ...(firstName ? { first_name: firstName } : {}),
      last_name: lastName || claimant,
    },
    ...(phoneDigits.length === 10 ? { Phone: { digits: phoneDigits, label: 'mobile', is_primary: true } } : {}),
    ...(hasEmail ? { Email: { email_address: emailAddr, is_primary: true } } : {}),
  }

  const parties: unknown[] = [applicantParty]

  if (hasEmployer) {
    parties.push({
      Contact: {
        people_type_slug: 'employer',
        name: employer,
      },
    })
  }

  // ── Root payload ──────────────────────────────────────────────────────────
  return {
    Matter: {
      case_type: 'workers-compensation',
    },
    parties,
    ...(injuryDate ? {
      Injury: {
        date_of_injury: injuryDate,
        injury_type:    'specific',
      },
    } : {}),
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const fluentKey = Deno.env.get('FLUENT_CASE_API_KEY')

  const body = await req.json().catch(() => ({}))
  const { id, firm_slug: bodyFirmSlug } = body as { id?: string; firm_slug?: string }
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing case id' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Fetch intake ──────────────────────────────────────────────────────────
  const { data: intake, error: fetchErr } = await supabase
    .from('intakes')
    .select('id, summary, status, fluent_case_id, firm_slug')
    .eq('id', id)
    .single()

  if (fetchErr || !intake) {
    return new Response(JSON.stringify({ error: 'Case not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Verify firm ownership if caller supplied firm_slug
  if (bodyFirmSlug && intake.firm_slug !== bodyFirmSlug) {
    return new Response(JSON.stringify({ error: 'Case not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Idempotent — already accepted
  if (intake.status === 'accepted') {
    return new Response(
      JSON.stringify({ success: true, already_accepted: true, fluent_case_id: intake.fluent_case_id }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Resolve which Fluent Case key to use (firm key takes priority) ───────
  let activeFluentKey = fluentKey ?? null
  if (intake.firm_slug) {
    const { data: firm } = await supabase
      .from('firms')
      .select('fluent_case_api_key')
      .eq('slug', intake.firm_slug)
      .single()
    if (firm?.fluent_case_api_key) activeFluentKey = firm.fluent_case_api_key
  }

  if (!activeFluentKey) {
    return new Response(JSON.stringify({ error: 'No Fluent Case API key configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── POST to Fluent Case ───────────────────────────────────────────────────
  const payload   = buildFluentPayload(intake.summary as Record<string, unknown>)
  const fluentRes = await fetch('https://app.fluentcase.com/api/matters', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${activeFluentKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  const fluentData = await fluentRes.json()

  if (!fluentRes.ok) {
    console.error('Fluent Case error:', JSON.stringify(fluentData))
    return new Response(JSON.stringify({ error: 'Fluent Case API error', details: fluentData }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const fluentCaseId: number = fluentData.id

  // ── Update Supabase ───────────────────────────────────────────────────────
  await supabase
    .from('intakes')
    .update({ status: 'accepted', fluent_case_id: fluentCaseId })
    .eq('id', id)

  console.log(`Case ${id} accepted → Fluent Case matter ${fluentCaseId}`)

  return new Response(
    JSON.stringify({ success: true, fluent_case_id: fluentCaseId, matter: fluentData }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
