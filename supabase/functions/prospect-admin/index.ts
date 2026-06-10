import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url        = new URL(req.url)
  const adminToken = req.method === 'GET'
    ? url.searchParams.get('admin_token')
    : (await req.json().then((b: Record<string, string>) => b).catch(() => ({}))).admin_token

  const expectedToken = Deno.env.get('ADMIN_TOKEN')
  if (!expectedToken || adminToken !== expectedToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (req.method === 'PUT') {
    const body = await req.clone().json()
    const { id, admin_token: _token, ...fields } = body
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    const { error } = await supabase.from('prospects').update(fields).eq('id', id)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ success: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
