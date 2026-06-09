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

// rawRow: use when value is already-rendered HTML (badges, spans) — skips esc()
function rawRow(label: string, html: string): string {
  return `
    <tr>
      <td style="padding:5px 16px 5px 0;font-size:11px;font-weight:700;color:#6b7280;
                 text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top">
        ${esc(label)}
      </td>
      <td style="padding:5px 0;font-size:13px;color:#111827;vertical-align:top;line-height:1.5">
        ${html}
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

// ── SIBTF firm email ───────────────────────────────────────────────────────────

function buildSIBTFHtml(
  s: Record<string, unknown>,
  reportUrl?: string | null,
  brandColor?: string | null,
  logoUrl?: string | null,
  firmName?: string | null,
): string {
  const BRAND    = brandColor || NAVY
  const docsNeeded = Array.isArray(s.documents_needed) ? s.documents_needed as string[] : []

  // Badge + yesno helpers
  const badge = (text: string, ok: boolean) =>
    `<span style="display:inline-block;background:${ok ? '#f0fdf4' : '#fef2f2'};` +
    `color:${ok ? '#15803d' : '#dc2626'};border:1px solid ${ok ? '#86efac' : '#fca5a5'};` +
    `border-radius:20px;padding:2px 10px;font-size:11.5px;font-weight:700">${esc(text)}</span>`

  const yesno = (v: unknown) => {
    const sv = String(v ?? '').toLowerCase()
    if (sv.includes('yes') || sv.includes('has it') || sv.includes('signed') || sv.includes('already')) return badge(String(v ?? ''), true)
    if (sv.includes('no') || sv.includes('missing') || sv.includes('must sign') || sv.includes('needs')) return badge(String(v ?? ''), false)
    return val(v)
  }

  // Field rows — label fixed 180px, subtle border-bottom between rows (matches online)
  const TD_LABEL = `style="padding:6px 12px 6px 0;font-size:11px;font-weight:700;color:#6b7280;` +
    `text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top;` +
    `border-bottom:1px solid #f3f4f6;width:180px"`
  const TD_VALUE = `style="padding:6px 0;font-size:13.5px;color:#111827;vertical-align:top;` +
    `line-height:1.55;border-bottom:1px solid #f3f4f6"`

  const fRow = (label: string, value: unknown) => {
    const v = String(value ?? '').trim()
    const display = v && v !== 'N/A' && v !== 'None provided' && v !== 'None reported'
      ? esc(v)
      : '<span style="color:#d1d5db">—</span>'
    return `<tr><td ${TD_LABEL}>${esc(label)}</td><td ${TD_VALUE}>${display}</td></tr>`
  }

  const fRawRow = (label: string, html: string) =>
    `<tr><td ${TD_LABEL}>${esc(label)}</td><td ${TD_VALUE}>${html}</td></tr>`

  // Section header — icon + title with 2px bottom border (matches online)
  const sect = (icon: string, title: string, body: string) => `
    <div style="margin-bottom:28px">
      <table cellpadding="0" cellspacing="0" style="border-bottom:2px solid #e5e7eb;width:100%;margin-bottom:14px">
        <tr>
          <td style="padding-bottom:7px;font-size:16px;width:24px;vertical-align:middle">${icon}</td>
          <td style="padding-bottom:7px;padding-left:8px;font-weight:800;font-size:11px;color:${NAVY};
                     text-transform:uppercase;letter-spacing:0.07em;vertical-align:middle">${esc(title)}</td>
        </tr>
      </table>
      ${body}
    </div>`

  // Letterhead — logo in white pill if available, else ⚖️ + firm name
  const letterLogo = logoUrl
    ? `<table cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
         <td style="background:white;border-radius:10px;padding:7px 14px">
           <img src="${logoUrl}" alt="${esc(firmName ?? '')}"
                style="max-height:38px;max-width:140px;display:block"/>
         </td></tr></table>`
    : `<table cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
         <td style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;
                    text-align:center;vertical-align:middle;font-size:20px">⚖️</td>
         <td style="padding-left:10px;vertical-align:middle">
           <div style="color:white;font-weight:900;font-size:18px;letter-spacing:-0.3px;line-height:1.2">
             ${esc(firmName ?? 'CaseTake')}
           </div>
           <div style="color:rgba(255,255,255,0.65);font-size:11px;margin-top:2px">
             California Workers' Compensation
           </div>
         </td></tr></table>`

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
  <tr><td style="background:${BRAND};padding:24px 30px">
    ${letterLogo}
    <div style="color:white;font-weight:900;font-size:22px;letter-spacing:-0.5px;margin-bottom:5px">
      SIBTF Information Gathering Report
    </div>
    <div style="font-size:13px;color:rgba(255,255,255,0.65)">
      ${esc(s.claimant as string)} &nbsp;·&nbsp; DOI: ${esc(s.doi as string)} &nbsp;·&nbsp; ${esc(s.intake_date as string)}
    </div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 30px 32px">

    ${docsNeeded.length ? `
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;
                padding:16px 20px;margin-bottom:28px">
      <div style="font-weight:800;font-size:12px;color:#dc2626;text-transform:uppercase;
                  letter-spacing:0.07em;margin-bottom:10px">⚠️ &nbsp;Documents / Signatures Still Needed</div>
      ${docsNeeded.map(d => `
        <div style="background:white;border:1px solid #fecaca;border-radius:6px;
                    padding:6px 12px;font-size:13px;color:#9a3412;margin-bottom:5px">
          • ${esc(d)}
        </div>`).join('')}
    </div>` : `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;
                padding:14px 20px;margin-bottom:28px;font-size:13px;color:#15803d;font-weight:700">
      ✅ &nbsp;All required documents and signatures appear to be in order.
    </div>`}

    ${sect('👤', 'Client Information', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRow('Full Name',      s.claimant)}
        ${fRow('Phone',          s.phone)}
        ${fRow('Date of Injury', s.doi)}
        ${fRow('Claim Number',   s.claim_number)}
        ${fRow('Intake Date',    s.intake_date)}
        ${fRow('Legal Status',   s.legal_status)}
        ${s.affidavit_re_status_needed === 'Yes'
          ? `<tr><td colspan="2" style="padding:8px 0">
               <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;
                           padding:7px 12px;font-size:13px;color:#78350f">
                 ⚠️ <strong>Affidavit re Status required</strong> — client is not a legal U.S. resident
               </div></td></tr>`
          : ''}
      </table>`)}

    ${sect('🏛️', 'Social Security / SSDI', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRow('SSA Status', s.ssa_status)}
        ${s.benefit_verification_letter && s.benefit_verification_letter !== 'N/A'
          ? fRawRow('Benefit Verification Letter', yesno(s.benefit_verification_letter)) : ''}
        ${s.ssdi_award_notice && s.ssdi_award_notice !== 'N/A'
          ? fRawRow('SSDI Award Notice',           yesno(s.ssdi_award_notice)) : ''}
        ${s.ssdi_1099s && s.ssdi_1099s !== 'N/A'
          ? fRawRow('SSDI 1099s',                  yesno(s.ssdi_1099s)) : ''}
        ${s.current_year_rate && s.current_year_rate !== 'N/A'
          ? fRawRow('Current Year Rate (2026+)',    yesno(s.current_year_rate)) : ''}
        ${s.consent_for_release && s.consent_for_release !== 'N/A'
          ? fRawRow('Consent for Release',         yesno(s.consent_for_release)) : ''}
      </table>`)}

    ${sect('💰', 'Pension', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRawRow('Pension Release Signed', yesno(s.pension_release_signed))}
        ${fRow('Receiving Pension',      s.receiving_pension)}
        ${s.pension_details && s.pension_details !== 'N/A'
          ? fRow('Pension Details', s.pension_details) : ''}
      </table>`)}

    ${sect('🏢', 'CALPERs', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRow('CALPERs Member', s.calpers_member)}
        ${s.calpers_release_needed === 'Yes'
          ? fRawRow('CALPERS Release', badge('Must sign undated CALPERS Release', false)) : ''}
      </table>`)}

    ${sect('🚗', 'MVA Settlements', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRow('MVA Settlement Received', s.mva_settlement)}
        ${s.mva_details && s.mva_details !== 'N/A' ? fRow('Details', s.mva_details) : ''}
      </table>`)}

    ${sect('💼', 'Work History (Past 10 Years)', `
      <table cellpadding="0" cellspacing="0" width="100%">
        ${fRow('Working Past 10 Years', s.work_history_10yr)}
        ${s.work_years       && s.work_years       !== 'N/A' ? fRow('Years Worked',     s.work_years)       : ''}
        ${s.work_schedule    && s.work_schedule    !== 'N/A' ? fRow('Schedule',         s.work_schedule)    : ''}
        ${s.new_work_injuries && s.new_work_injuries !== 'N/A' ? fRow('New Work Injuries', s.new_work_injuries) : ''}
        ${s.new_injury_details && s.new_injury_details !== 'N/A' ? fRow('Injury Details', s.new_injury_details) : ''}
      </table>`)}

    ${s.notes ? sect('📝', 'Notes', `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                  padding:13px 16px;font-size:13.5px;color:#78350f;line-height:1.7">
        ${esc(s.notes as string)}
      </div>`) : ''}

    ${reportUrl ? `
    <div style="text-align:center;margin-top:28px">
      <a href="${reportUrl}"
         style="display:inline-block;background:${BRAND};color:white;text-decoration:none;
                border-radius:9px;padding:12px 32px;font-size:14px;font-weight:800;
                letter-spacing:-0.2px">
        Open SIBTF Case Online →
      </a>
      <div style="margin-top:10px;font-size:11px;color:#9ca3af">
        View the complete report and mark this case complete in your browser.
      </div>
    </div>` : ''}

  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #e5e7eb;padding:12px 30px;
                 font-size:11px;color:#9ca3af">
    Confidential — Attorney Work Product &nbsp;·&nbsp; For Internal Use Only &nbsp;·&nbsp; CaseTake SIBTF &nbsp;·&nbsp; © ${new Date().getFullYear()} Picnic Peaks LLC
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
  const caseBaseUrl = Deno.env.get('CASE_BASE_URL') ?? 'https://casetake.picnicpeaks.com'
  const FROM_ADDRESS = 'casetake@notifications.picnicpeaks.com'

  if (!resendKey) {
    console.error('Missing RESEND_API_KEY')
    return new Response(
      JSON.stringify({ error: 'Missing RESEND_API_KEY' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const payload  = await req.json()
  const record   = payload.record
  const s        = (record?.summary ?? {}) as Record<string, unknown>
  const caseId   = record?.id        as string | undefined
  const firmSlug = record?.firm_slug as string | undefined

  // Non-firm intakes (demos, direct) never send email
  if (!firmSlug) {
    console.log('No firm_slug — skipping email for non-firm intake', caseId)
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const isSIBTFRecord = s.type === 'sibtf'
  const caseSegment   = isSIBTFRecord ? 'sibtf' : 'intake'
  const reportUrl     = `${caseBaseUrl}/firm/${encodeURIComponent(firmSlug)}/${caseSegment}/${caseId}`

  // ── Load firm config ───────────────────────────────────────────────────
  let firmRecipients: string[]  = []
  let effectiveFrom             = `CaseTake <${FROM_ADDRESS}>`
  let firmBrandColor: string | null = null
  let firmLogoUrl:    string | null = null
  let firmDisplayName: string | null = null

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: firm } = await supabase
      .from('firms')
      .select('intake_emails, name, primary_color, logo_url')
      .eq('slug', firmSlug)
      .single()

    if (firm) {
      if (firm.intake_emails?.length) firmRecipients = firm.intake_emails
      if (firm.name) effectiveFrom = `${firm.name} <${FROM_ADDRESS}>`
      if (firm.primary_color) firmBrandColor = firm.primary_color
      if (firm.logo_url)      firmLogoUrl    = firm.logo_url
      if (firm.name)          firmDisplayName = firm.name
    }
  } catch (e) {
    console.error('Failed to load firm config:', e)
  }

  if (!firmRecipients.length) {
    console.log('Firm has no intake_emails configured — skipping email for', firmSlug)
    return new Response(JSON.stringify({ skipped: true, reason: 'no recipients' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const results: Record<string, unknown> = {}
  // ── Firm email ─────────────────────────────────────────────────────────────
  if (isSIBTFRecord) {
    results.firm = await send(
      resendKey,
      effectiveFrom,
      firmRecipients,
      `SIBTF Info Gathering: ${s.claimant} — DOI ${s.doi}`,
      buildSIBTFHtml(s, reportUrl, firmBrandColor, firmLogoUrl, firmDisplayName),
    )
  } else {
    results.firm = await send(
      resendKey,
      effectiveFrom,
      firmRecipients,
      `New Intake: ${s.claimant} — ${s.viability_label} (${s.viability_score})`,
      buildFirmHtml(s, reportUrl),
    )

    // Client confirmation only for workers' comp (SIBTF has no client email field)
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
  }

  console.log('Email results:', JSON.stringify(results))
  return new Response(JSON.stringify(results), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
