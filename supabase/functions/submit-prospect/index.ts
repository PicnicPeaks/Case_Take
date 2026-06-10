import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NAVY = '#1a2e4a'

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const INTEREST_LABEL: Record<string, string> = {
  workers_comp: "Workers' Comp Intake",
  sibtf:        'SIBTF Intake',
  both:         "Both — Workers' Comp + SIBTF",
  general:      'General inquiry',
}

function buildNotificationHtml(p: Record<string, string>): string {
  const label = INTEREST_LABEL[p.interest] ?? p.interest
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.09)">
  <tr><td style="background:${NAVY};padding:22px 28px">
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">CaseTake</div>
    <div style="font-size:20px;font-weight:900;color:white;letter-spacing:-0.4px">New prospect inquiry</div>
  </td></tr>
  <tr><td style="padding:24px 28px 30px">

    <table cellpadding="0" cellspacing="0" width="100%">
      ${[
        ['Name',      p.name],
        ['Email',     p.email],
        ['Phone',     p.phone || '—'],
        ['Firm',      p.firm_name || '—'],
        ['Interested in', label],
        ['Source',    p.source || '—'],
      ].map(([label, val]) => `
        <tr>
          <td style="padding:6px 14px 6px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f3f4f6;width:150px">${label}</td>
          <td style="padding:6px 0;font-size:13.5px;color:#111827;vertical-align:top;line-height:1.5;border-bottom:1px solid #f3f4f6">${esc(val)}</td>
        </tr>`).join('')}
    </table>

    ${p.message ? `
    <div style="margin-top:18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Message</div>
      <div style="font-size:13.5px;color:#374151;line-height:1.7">${esc(p.message)}</div>
    </div>` : ''}

    <div style="margin-top:24px">
      <a href="mailto:${esc(p.email)}"
         style="display:inline-block;background:${NAVY};color:white;text-decoration:none;
                border-radius:8px;padding:11px 26px;font-size:13.5px;font-weight:700">
        Reply to ${esc(p.name)} →
      </a>
    </div>

  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:12px 28px;font-size:11px;color:#9ca3af">
    CaseTake · Picnic Peaks LLC · © ${new Date().getFullYear()}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { name, email, phone, firm_name, interest, message, source } = body

  if (!name?.trim() || !email?.trim()) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Insert prospect record
  const { data: prospect, error: dbError } = await supabase
    .from('prospects')
    .insert({
      name:      name.trim(),
      email:     email.trim().toLowerCase(),
      phone:     phone?.trim() || null,
      firm_name: firm_name?.trim() || null,
      interest:  interest || 'general',
      message:   message?.trim() || null,
      source:    source || null,
      status:    'new',
    })
    .select('id')
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError)
    return new Response(JSON.stringify({ error: 'Failed to save inquiry' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Send notification email to hello@picnicpeaks.com
  const label = INTEREST_LABEL[interest] ?? interest ?? 'General inquiry'
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'CaseTake <casetake@notifications.picnicpeaks.com>',
      to:      'hello@picnicpeaks.com',
      subject: `New prospect: ${name.trim()} — ${label}`,
      html:    buildNotificationHtml({ name, email, phone: phone ?? '', firm_name: firm_name ?? '', interest: interest ?? 'general', message: message ?? '', source: source ?? '' }),
    }),
  })

  console.log('Prospect created:', prospect?.id)
  return new Response(JSON.stringify({ success: true, id: prospect?.id }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
