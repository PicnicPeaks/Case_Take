import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => ({}))
  const { id, reason } = body as { id?: string; reason?: string }

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing case id' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: intake } = await supabase
    .from('intakes')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!intake) {
    return new Response(JSON.stringify({ error: 'Case not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (intake.status === 'accepted') {
    return new Response(JSON.stringify({ error: 'Cannot reject a case that has already been accepted' }), {
      status: 409, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const updatePayload: Record<string, unknown> = { status: 'rejected' }
  if (reason) updatePayload.rejection_reason = reason

  await supabase.from('intakes').update(updatePayload).eq('id', id)

  console.log(`Case ${id} rejected${reason ? ` — ${reason}` : ''}`)

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
