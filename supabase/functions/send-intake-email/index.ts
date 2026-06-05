import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NAVY       = '#1a2e4a'
const VIA_COLOR  = { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' } as Record<string, string>
const VIA_BG     = { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed', Declined: '#fef2f2' } as Record<string, string>

// ── helpers ────────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function val(v: unknown): string {
  const s = String(v ?? '').trim()
  return s && s !== 'N/A' && s !== 'None provided' && s !== 'None reported'
    ? esc(s)
    : '<span style="color:#9ca3af">—</span>'
}

function row(label: string, value: unknown): string {
  return `
    <tr>
      <td style="padding:5px 16px 5px 0;font-size:11px;font-weight:700;color:#6b7280;
                 text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top">
        ${esc(label)}
      </td>
      <td style="padding:5px 0;font-size:13px;color:#111827;vertical-align:top;line-height:1.5">
        ${val(value)}
      </td>
    </tr>`
}

function section(icon: string, title: string, body: string): string {
  return `
    <div style="margin-top:22px">
      <div style="border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin-bottom:12px;
                  font-weight:800;font-size:11px;color:${NAVY};text-transform:uppercase;
                  letter-spacing:0.07em">
        ${icon}&nbsp; ${esc(title)}
      </div>
      ${body}
    </div>`
}

// ── Firm email — full intake report ────────────────────────────────────────────

function buildFirmHtml(s: Record<string, unknown>, reportUrl?: string | null): string {
  const label  = String(s.viability_label ?? '')
  const color  = VIA_COLOR[label]  ?? '#6b7280'
  const bg     = VIA_BG[label]     ?? '#f9fafb'
  const score  = s.viability_score ?? '—'
  const flags  = Array.isArray(s.red_flags) ? s.red_flags as unknown[] : []

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;
             font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f3f4f6;padding:28px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0"
       style="background:white;border-radius:12px;overflow:hidden;
              box-shadow:0 2px 20px rgba(0,0,0,0.09)">

  <!-- Letterhead -->
  <tr><td style="background:${NAVY};padding:24px 30px">
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);
                letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px">
      California Workers' Compensation
    </div>
    <div style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.5px">
      Intake Screening Report
    </div>
    <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:5px">
      ${esc(s.claimant as string)} &nbsp;·&nbsp; ${esc(s.intake_date as string)}
    </div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:26px 30px 32px">

    <!-- Viability -->
    <div style="background:${bg};border:1.5px solid ${color}40;border-radius:10px;
                padding:16px 20px">
      <div style="display:inline-block;background:${color};color:white;border-radius:20px;
                  padding:3px 14px;font-weight:800;font-size:13px;margin-bottom:9px">
        ${esc(label)} &nbsp;—&nbsp; ${score}/100
      </div>
      <div style="font-size:13px;color:#374151;line-height:1.7">
        ${esc(s.recommendation as string)}
      </div>
    </div>

    ${flags.length ? section('⚠️', 'Red Flags', `
      ${flags.map(f => `
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;
                    padding:7px 12px;font-size:12.5px;color:#9a3412;margin-bottom:5px">
          ⚑ ${esc(f)}
        </div>`).join('')}`) : ''}

    ${section('👤', 'Client Information', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Full Name',         s.claimant)}
        ${row('Phone',             s.phone)}
        ${row('Email',             s.email)}
        ${row('Intake Date',       s.intake_date)}
        ${row('Attorney Status',   s.attorney_represented)}
      </table>`)}

    ${section('🏢', 'Employment', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Employer',         s.employer)}
        ${row('Job Title',        s.job_title)}
        ${row('Employment Type',  s.employment_type)}
        ${row('Hours / Week',     s.hours_per_week)}
      </table>`)}

    ${section('🩹', 'Injury Details', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Date of Injury',  s.injury_date)}
        ${row('Time',            s.injury_time)}
        ${row('Location',        s.injury_location)}
        ${row('Body Part(s)',    s.body_part)}
        ${row('Current Status', s.current_status)}
      </table>
      <div style="margin-top:12px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                    letter-spacing:0.05em;margin-bottom:5px">How It Happened</div>
        <div style="font-size:13px;color:#111827;line-height:1.7">${val(s.injury_description)}</div>
      </div>`)}

    ${section('📋', 'Reporting', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Reported to Employer', s.reported_to_employer)}
        ${row('Written Report Filed', s.written_report_filed)}
        ${row('DWC-1 Claim Form',     s.dwc1_provided)}
        ${row('Adjuster Contacted',   s.adjuster_contacted)}
      </table>`)}

    ${section('🏥', 'Medical Treatment', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Facility',       s.medical_facility)}
        ${row('Doctor',         s.treating_doctor)}
        ${row('First Visit',    s.first_treatment_date)}
        ${row('Treating Via',   s.treating_type)}
      </table>`)}

    ${section('⚖️', 'Claim Status & Medical Disputes', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Claim Decision',      s.claim_status)}
        ${row('Denial Reason',       s.denial_reason)}
        ${row('Treatment Denied',    s.treatment_denied)}
        ${row('QME / AME Stage',     s.qme_stage)}
        ${row('QME / AME Findings',  s.qme_findings)}
        ${row('P&S Declared',        s.ps_declared)}
      </table>`)}

    ${section('👥', 'Witnesses', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Witness Info', s.witnesses)}
      </table>`)}

    ${section('📁', 'Prior Injury History', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Prior Injuries', s.prior_injuries)}
      </table>`)}

    ${section('🎙️', 'Recorded Statements', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Statement Given', s.recorded_statement)}
        ${row('Details',         s.recorded_statement_details)}
      </table>`)}

    ${s.notes ? section('📝', 'Attorney Notes', `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                  padding:12px 15px;font-size:13px;color:#78350f;line-height:1.7">
        ${esc(s.notes as string)}
      </div>`) : ''}

    ${reportUrl ? `
    <!-- View Report CTA -->
    <div style="text-align:center;margin-top:28px">
      <a href="${reportUrl}"
         style="display:inline-block;background:#1a2e4a;color:white;text-decoration:none;
                border-radius:9px;padding:12px 32px;font-size:14px;font-weight:800;
                letter-spacing:-0.2px">
        View Full Report &amp; Accept / Reject →
      </a>
      <div style="margin-top:10px;font-size:11px;color:#9ca3af">
        This link lets you review the complete intake and send it directly to Fluent Case.
      </div>
    </div>` : ''}

  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #e5e7eb;padding:12px 30px;
                 font-size:11px;color:#9ca3af">
    Confidential — Attorney Work Product &nbsp;·&nbsp; For Internal Use Only &nbsp;·&nbsp; CaseTake &nbsp;·&nbsp; © ${new Date().getFullYear()} Picnic Peaks LLC. All rights reserved.
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Client confirmation email ──────────────────────────────────────────────────

function buildClientHtml(s: Record<string, unknown>): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;
             font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f3f4f6;padding:28px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:white;border-radius:12px;overflow:hidden;
              box-shadow:0 2px 20px rgba(0,0,0,0.09)">

  <!-- Header -->
  <tr><td style="background:${NAVY};padding:24px 30px">
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);
                letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px">
      California Workers' Compensation
    </div>
    <div style="font-size:20px;font-weight:900;color:white;letter-spacing:-0.4px">
      Your Intake Has Been Received
    </div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 30px 32px">

    <p style="margin:0 0 18px;font-size:15px;color:#111827;line-height:1.65">
      Dear ${esc(s.claimant as string)},
    </p>
    <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.75">
      Thank you for completing your intake screening. We have received your information
      and an attorney will review your case shortly. You do not need to take any further
      action at this time.
    </p>

    <!-- Summary box -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;
                padding:18px 20px;margin:20px 0">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                  letter-spacing:0.06em;margin-bottom:12px">
        Your Intake Summary
      </div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${row('Intake Date',       s.intake_date)}
        ${row('Employer',          s.employer)}
        ${row('Date of Injury',    s.injury_date)}
        ${row('Location',          s.injury_location)}
        ${row('Body Part(s)',      s.body_part)}
        ${row('Medical Facility',  s.medical_facility)}
      </table>
    </div>

    <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.75">
      If you have additional information to share or any questions, please contact
      our office directly.
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6">
      Please keep this email for your records.
    </p>

  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #e5e7eb;padding:12px 30px;
                 font-size:11px;color:#9ca3af">
    This is an automated confirmation from CaseTake &nbsp;·&nbsp; California Workers' Compensation Intake System<br/>
    © ${new Date().getFullYear()} Picnic Peaks LLC. All rights reserved.
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Send via Resend ────────────────────────────────────────────────────────────

async function send(resendKey: string, from: string, to: string | string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  return res.json()
}

// ── Handler ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const resendKey   = Deno.env.get('RESEND_API_KEY')
  const firmEmail   = Deno.env.get('FIRM_EMAIL')
  const fromEmail   = Deno.env.get('FROM_EMAIL')   ?? 'CaseTake <onboarding@resend.dev>'
  const caseBaseUrl = Deno.env.get('CASE_BASE_URL') ?? 'https://casetake.picnicpeaks.com'

  if (!resendKey || !firmEmail) {
    console.error('Missing RESEND_API_KEY or FIRM_EMAIL')
    return new Response(
      JSON.stringify({ error: 'Missing required env vars' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const payload  = await req.json()
  const record   = payload.record
  const s        = (record?.summary ?? {}) as Record<string, unknown>
  const caseId   = record?.id   as string | undefined
  const firmSlug = record?.firm_slug as string | undefined
  const reportUrl = caseId ? `${caseBaseUrl}?case=${caseId}` : null

  // ── Load firm config if this intake belongs to a firm ──────────────────
  let firmRecipients: string[] = firmEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
  let effectiveFrom  = fromEmail

  if (firmSlug) {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: firm } = await supabase
        .from('firms')
        .select('intake_emails, from_email, from_name, name')
        .eq('slug', firmSlug)
        .single()

      if (firm) {
        if (firm.intake_emails?.length) firmRecipients = firm.intake_emails
        if (firm.from_email) {
          effectiveFrom = firm.from_name
            ? `${firm.from_name} <${firm.from_email}>`
            : firm.from_email
        }
      }
    } catch (e) {
      console.error('Failed to load firm config:', e)
    }
  }

  const results: Record<string, unknown> = {}

  // ── Firm email (always) ────────────────────────────────────────────────────
  results.firm = await send(
    resendKey,
    effectiveFrom,
    firmRecipients,
    `New Intake: ${s.claimant} — ${s.viability_label} (${s.viability_score})`,
    buildFirmHtml(s, reportUrl),
  )

  // ── Client email (if provided) ──
  const clientEmail = String(s.email ?? '').trim()
  if (clientEmail && clientEmail !== 'None provided' && clientEmail.includes('@')) {
    results.client = await send(
      resendKey,
      effectiveFrom,
      clientEmail,
      "Your Workers' Comp Intake Has Been Received",
      buildClientHtml(s),
    )
  }

  console.log('Email results:', JSON.stringify(results))
  return new Response(JSON.stringify(results), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
