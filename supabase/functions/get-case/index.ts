import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url       = new URL(req.url)
  const id        = url.searchParams.get('id')
  const firmSlug  = url.searchParams.get('firm_slug') ?? null

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('intakes')
    .select('id, summary, status, fluent_case_id, firm_slug, created_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Case not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // If caller supplied a firm_slug, verify it matches the intake's firm
  if (firmSlug && data.firm_slug !== firmSlug) {
    return new Response(JSON.stringify({ error: 'Case not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
