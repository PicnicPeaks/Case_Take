import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fields the firm is allowed to update via the settings page
const ALLOWED_FIELDS = new Set([
  'name', 'tagline', 'logo_url', 'primary_color',
  'intake_emails', 'from_email', 'from_name', 'fluent_case_api_key',
])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => ({}))
  const { slug, settings_token, ...updates } = body as {
    slug?: string
    settings_token?: string
    [key: string]: unknown
  }

  if (!slug || !settings_token) {
    return new Response(JSON.stringify({ error: 'Missing slug or settings_token' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify token — fetch firm and compare
  const { data: firm, error: fetchErr } = await supabase
    .from('firms')
    .select('id, settings_token')
    .eq('slug', slug)
    .single()

  if (fetchErr || !firm) {
    return new Response(JSON.stringify({ error: 'Firm not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (firm.settings_token !== settings_token) {
    return new Response(JSON.stringify({ error: 'Invalid settings token' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Strip disallowed fields
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(updates)) {
    if (ALLOWED_FIELDS.has(k)) safeUpdates[k] = v
  }

  if (Object.keys(safeUpdates).length === 1) {
    return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { error: updateErr } = await supabase
    .from('firms')
    .update(safeUpdates)
    .eq('id', firm.id)

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
