import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Invalid admin token' }), {
    status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const adminToken = Deno.env.get('ADMIN_TOKEN')
  if (!adminToken) {
    return new Response(JSON.stringify({ error: 'Admin not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── GET — list all firms ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('admin_token')
    if (token !== adminToken) return unauthorized()

    const { data, error } = await supabase
      .from('firms')
      .select('id, slug, name, tagline, logo_url, primary_color, intake_emails, from_email, from_name, settings_token, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data ?? []), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── POST — create a firm ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body  = await req.json().catch(() => ({}))
    const { admin_token, slug, name, tagline, logo_url, primary_color, intake_emails, from_email, from_name } = body

    if (admin_token !== adminToken) return unauthorized()
    if (!slug || !name) {
      return new Response(JSON.stringify({ error: 'slug and name are required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Validate slug — lowercase letters, digits, hyphens only
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'slug must be lowercase letters, digits, and hyphens only' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabase
      .from('firms')
      .insert({
        slug,
        name,
        tagline:       tagline       ?? 'California Workers\' Compensation',
        logo_url:      logo_url      ?? null,
        primary_color: primary_color ?? '#1a2e4a',
        intake_emails: intake_emails ?? [],
        from_email:    from_email    ?? null,
        from_name:     from_name     ?? null,
      })
      .select('id, slug, name, settings_token')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.code === '23505' ? 409 : 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, firm: data }), {
      status: 201, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── DELETE — remove a firm ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const body  = await req.json().catch(() => ({}))
    const { admin_token, slug } = body
    if (admin_token !== adminToken) return unauthorized()
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('firms').delete().eq('slug', slug)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
