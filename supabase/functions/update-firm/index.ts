import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fields the firm is allowed to update via the settings page
const ALLOWED_FIELDS = new Set([
  'name', 'tagline', 'logo_url', 'primary_color',
  'intake_emails', 'from_email', 'from_name', 'fluent_case_api_key',
])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => ({}))
  const { slug, settings_token, dashboard_password, ...updates } = body as {
    slug?: string
    settings_token?: string
    dashboard_password?: string
    [key: string]: unknown
  }

  if (!slug || (!settings_token && !dashboard_password)) {
    return new Response(JSON.stringify({ error: 'Missing slug or auth credential' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Fetch firm — need settings_token and dashboard_password to verify
  const { data: firm, error: fetchErr } = await supabase
    .from('firms')
    .select('id, settings_token, dashboard_password')
    .eq('slug', slug)
    .single()

  if (fetchErr || !firm) {
    return new Response(JSON.stringify({ error: 'Firm not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Verify auth — accept either settings_token OR dashboard_password
  const tokenOk    = settings_token    && firm.settings_token    === settings_token
  const passwordOk = dashboard_password && firm.dashboard_password === dashboard_password

  if (!tokenOk && !passwordOk) {
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
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
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
