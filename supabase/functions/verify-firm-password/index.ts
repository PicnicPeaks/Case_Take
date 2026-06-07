import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => ({}))
  const { slug, password } = body as { slug?: string; password?: string }

  if (!slug || !password) {
    return new Response(JSON.stringify({ error: 'Missing slug or password' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('firms')
    .select('dashboard_password')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Firm not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!data.dashboard_password) {
    // No password set — open access
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (data.dashboard_password !== password) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
