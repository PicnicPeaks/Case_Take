import { useState, useRef, useEffect, useCallback } from 'react'
import { saveCase, saveFeedback } from './supabase.js'

// ─── Brand ────────────────────────────────────────────────────────────────────
const NAVY       = '#1a2e4a'
const NAVY_MID   = '#243d5e'
const NAVY_LIGHT = '#2e4e78'

// ─── Scripted Questions ───────────────────────────────────────────────────────
// type:'form' → IntakeFormCard rendered; type:'chat' → ScriptedQuestionBubble + free-form textarea
const SCRIPTED_QUESTIONS = [
  {
    idx: 0, type: 'form', topic: 'Contact Information',
    intro: "Let's start with a few basics.",
    fields: [
      { key: 'name',  label: 'Full Legal Name',  type: 'text',  placeholder: 'e.g. Maria Garcia', required: true },
      { key: 'phone', label: 'Phone Number',      type: 'tel',   placeholder: '(555) 555-5555',    required: true },
      { key: 'email', label: 'Email Address',     type: 'email', placeholder: 'you@email.com',      required: false },
    ],
  },
  {
    idx: 1, type: 'form', topic: 'Employment',
    intro: "Tell me about your job.",
    fields: [
      { key: 'employer',       label: 'Employer / Company Name',  type: 'text',   placeholder: 'e.g. Amazon Logistics',    required: true },
      { key: 'job_title',      label: 'Job Title',                type: 'text',   placeholder: 'e.g. Warehouse Associate', required: true },
      { key: 'hours_per_week', label: 'Avg. Hours Per Week',      type: 'number', placeholder: '40',                       required: true },
    ],
  },
  {
    idx: 2, type: 'form', topic: 'Injury Details',
    intro: "Tell me about the injury itself.",
    fields: [
      { key: 'injury_date',        label: 'Date of Injury',          type: 'date',     required: true },
      { key: 'injury_time',        label: 'Approximate Time of Day', type: 'text',     placeholder: 'e.g. around 2:30 PM',          required: true },
      { key: 'injury_location',    label: 'Where Did It Happen?',    type: 'text',     placeholder: 'e.g. Warehouse floor, aisle 3 — 123 Main St, Oakland', required: true },
      { key: 'body_part',          label: 'Body Part(s) Injured',    type: 'text',     placeholder: 'e.g. Lower back, right knee',  required: true },
      { key: 'injury_description', label: 'How Did It Happen?',      type: 'textarea', placeholder: 'Describe step by step what happened…', required: true },
    ],
  },
  {
    idx: 3, type: 'form', topic: 'Reporting',
    intro: "Tell me about how and when the injury was reported.",
    fields: [
      { key: 'report_date',    label: 'Date employer was first notified',    type: 'date',   required: true },
      { key: 'reported_to',    label: 'Who was notified? (name and role)',   type: 'text',   placeholder: 'e.g. Supervisor Jane Doe, HR', required: true },
      { key: 'written_report', label: 'Written incident report completed?',  type: 'select', options: ['Yes', 'No', 'Unknown'], required: true },
    ],
  },
  {
    idx: 4, type: 'form', topic: 'Medical Treatment',
    intro: "Tell me about the medical care you received.",
    fields: [
      { key: 'facility',    label: 'Medical Facility or Hospital',  type: 'text', placeholder: 'e.g. Kaiser Permanente Oakland', required: true },
      { key: 'doctor',      label: 'Treating Doctor (if known)',     type: 'text', placeholder: 'e.g. Dr. Kim',                   required: false },
      { key: 'first_visit', label: 'Date of First Treatment',        type: 'date',                                                required: true },
    ],
  },
  {
    idx: 5, type: 'chat',
    text: "Was anyone else present when the injury occurred — coworkers, supervisors, or bystanders? If so, please share their names and contact information if you have it.",
  },
  {
    idx: 6, type: 'form', topic: 'Prior Injury History',
    intro: "One question about prior injuries.",
    fields: [
      { key: 'has_prior',     label: 'Prior injuries, accidents, or pre-existing conditions to the same body part?', type: 'yesno', includeUnsure: true, required: true },
      { key: 'prior_details', label: 'Describe the prior injury or condition', type: 'textarea', conditionKey: 'has_prior', conditionValue: 'yes', placeholder: 'Condition and when it occurred…', required: false },
    ],
  },
  {
    idx: 7, type: 'form', topic: 'Current Employment Status',
    intro: "What is your current work situation?",
    fields: [
      { key: 'status', label: 'Current status', type: 'select', options: ['Still working — same position', 'Modified / light duty', 'Terminated', 'Resigned / quit', 'On medical leave', 'Other'], required: true },
      { key: 'term_date',         label: 'Date of termination or last day worked', type: 'date',     conditionKey: 'status', conditionValues: ['Terminated', 'Resigned / quit'], required: false },
      { key: 'term_circumstances', label: 'Circumstances (describe what happened)', type: 'textarea', conditionKey: 'status', conditionValues: ['Terminated', 'Resigned / quit'], placeholder: 'What happened and when…', required: false },
    ],
  },
  {
    idx: 8, type: 'form', topic: 'Recorded Statements',
    intro: "Last question — regarding any statements you may have provided.",
    fields: [
      { key: 'statement_given',   label: 'Have you given a recorded or written statement to the insurance company or your employer?', type: 'yesno', includeUnsure: true, required: true },
      { key: 'statement_details', label: 'When, with whom, and what was discussed?', type: 'textarea', conditionKey: 'statement_given', conditionValue: 'yes', placeholder: 'e.g. May 15 — spoke to adjuster Sarah Jones, discussed how the injury occurred…', required: false },
    ],
  },
]

// Build a message object for a scripted question (form or chat)
function makeScriptedMsg(q) {
  if (q.type === 'form') {
    return { role: 'assistant', displayContent: q.topic, isScripted: true, formDef: q, formSubmitted: false, formSummary: null }
  }
  return { role: 'assistant', displayContent: q.text, isScripted: true }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const ACTIVITY_LABELS = {
  working:   'Working at their workplace / worksite',
  travel:    'Business travel — away from home for work',
  commuting: 'Commuting to or from work',
  other:     'Other (not specified)',
}

const JURISDICTION_BASIS_LABELS = {
  'injury-in-ca':               'Injury occurred in California — standard CA workers\' comp jurisdiction (LC § 3600)',
  'principally-localized':      'Employee\'s employment is principally localized in CA — CA jurisdiction applies per LC § 3600.5',
  'temp-outside-ca':            'Employee was on business travel from CA-based employment — CA jurisdiction per LC § 3600.5',
  'going-coming-exception':     'Commute injury — covered under a going-and-coming rule exception',
  'ca-employer-unclear-activity': 'CA employer but activity at time of injury unclear — jurisdiction may apply, flag for attorney review',
  'out-of-state-no-ca-connection': 'Out-of-state injury with no established CA connection — jurisdiction review needed',
  'commuting-no-exception':     'Commute injury with no applicable exception established — jurisdiction review needed',
}

const getSystemPrompt = (preForm = null, scriptedIdx = 0) => {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return buildSystemPrompt(today, preForm, scriptedIdx)
}

function buildSystemPrompt(today, preForm, scriptedIdx) {
  const needsJurisdictionReview = preForm?.jurisdictionStatus === 'review'
  const preCollected = preForm ? `
PRE-COLLECTED VIA INTAKE FORM (do not ask for any of this again):
- Employment type: W-2 employee (confirmed${preForm.employmentType === 'unsure' ? ' — client was unsure, verify during intake' : ''})
- Employer type: ${preForm.governmentType === 'state-local' ? 'State or local government' : preForm.governmentType === 'unsure' ? 'Unknown — confirm during intake' : 'Private employer'}
- Client residence: ${preForm.residenceCity}, ${preForm.residenceState}
- Injury location: ${preForm.injuryCity}, ${preForm.injuryState}
${preForm.primaryWorkState && preForm.primaryWorkState !== preForm.injuryState ? `- Primary work state: ${preForm.primaryWorkState}` : ''}\
${preForm.activity ? `\n- Activity at time of injury: ${ACTIVITY_LABELS[preForm.activity] ?? preForm.activity}` : ''}\
- CA jurisdiction basis: ${JURISDICTION_BASIS_LABELS[preForm.jurisdictionBasis] ?? 'Confirmed'}
${needsJurisdictionReview ? `\n⚠️ JURISDICTION FLAG: CA workers' comp coverage is not clearly established based on pre-screening. Flag this prominently in the final report and note it requires attorney review before filing.` : ''}\
` : ''

  const currentQ = (() => {
    if (scriptedIdx < 0 || scriptedIdx >= SCRIPTED_QUESTIONS.length) return ''
    const q = SCRIPTED_QUESTIONS[scriptedIdx]
    if (q.type === 'form') {
      const fields = q.fields.map(f => f.label).join(', ')
      return `\nCURRENT TOPIC (question ${scriptedIdx + 1} of ${SCRIPTED_QUESTIONS.length}): ${q.topic}
Type: Structured form submission. The client just submitted form data covering: ${fields}.
The submitted values are in the most recent user message. For most clean submissions, emit <next_question/> quickly after a brief acknowledgment. Only probe if there is a specific concern — e.g., invalid phone format, implausible date, or missing critical information.
`
    }
    return `\nCURRENT SCRIPTED QUESTION (question ${scriptedIdx + 1} of ${SCRIPTED_QUESTIONS.length}):
"${q.text}"
This question has already been displayed to the client. Evaluate their response for completeness. Probe if vague or incomplete; emit <next_question/> when satisfied.
`
  })()

  return `Today's date is ${today}.
${preCollected}${currentQ}
You are an intake follow-up specialist at a California workers' compensation law firm. The interview uses a scripted question system — fixed questions are shown to the client one at a time by the application. Your role is to:

1. Probe or clarify when the client's answer is vague, incomplete, inconsistent, or raises a concern
2. Signal readiness to advance by appending <next_question/> at the very end of your message when the current topic is fully addressed

RULES:
- Do NOT ask the scripted question yourself — it is already displayed to the client.
- Keep responses brief — one focused follow-up question at a time, or a short acknowledgment + <next_question/>.
- Only include <next_question/> when you are satisfied the current topic is complete.
- Never ask multiple follow-up questions in one message.
- Be warm, professional, and empathetic.

PHONE NUMBER VALIDATION (Topic 1):
Silently validate the phone number. A valid US number has exactly 10 digits. If clearly invalid — wrong digit count or obvious typo — say: "That number doesn't look quite right — could you double-check it for me?" Otherwise accept it and emit <next_question/> when ready.

1099 HARD STOP (Topic 2):
If the client confirms they are a 1099 independent contractor (not a W-2 employee), warmly inform them the firm can only represent W-2 employees in California workers' compensation cases. Thank them, wish them well, and end the intake. Then output a <case_summary> block reflecting the declination — do NOT emit <next_question/> in this case.

INTERNAL RED FLAG MONITORING (track silently — never mention to the client):
- Injury reported to employer AFTER a termination or layoff notice
- No witnesses AND no immediate medical treatment
- Injury occurred on a Monday (possible unreported weekend incident)
- Prior injury or condition affecting the same body part(s)
- Reporting delay of more than 3 days
- Recorded statement given without attorney representation
- Vague, inconsistent, or evolving description of injury mechanism
- Injury within first 7 days of starting employment
- Termination or resignation shortly after reporting injury

GENERATING THE CASE SUMMARY:
When instructed to generate the case summary, wrap up in one or two warm sentences, then output the complete JSON inside <case_summary> tags.

<case_summary>
{
  "intake_date": "Today's date as YYYY-MM-DD",
  "claimant": "Full legal name",
  "phone": "Phone number as confirmed by client",
  "email": "Email address",
  "residence": "City and state where client lives",
  "injury_jurisdiction": "City and state where injury occurred (controls CA jurisdiction)",
  "employer": "Employer name",
  "job_title": "Job title",
  "employment_type": "W2 Employee | 1099 Contractor | Unknown",
  "hours_per_week": "Average hours per week",
  "injury_date": "YYYY-MM-DD or best description",
  "injury_time": "Approximate time of day",
  "injury_location": "Specific worksite location",
  "body_part": "Body part(s) injured",
  "injury_description": "Step-by-step mechanism of injury",
  "reported_to_employer": "Date reported and to whom",
  "written_report_filed": "Yes | No | Unknown",
  "medical_facility": "Name of treating facility",
  "treating_doctor": "Doctor name",
  "first_treatment_date": "YYYY-MM-DD or description",
  "witnesses": "Witness names and contact info, or 'None reported'",
  "prior_injuries": "Description of prior injuries/conditions, or 'None reported'",
  "current_status": "Working | Modified Duty | Terminated | Unknown",
  "termination_details": "Details if terminated, or 'N/A'",
  "recorded_statement": "Yes | No | Unknown",
  "recorded_statement_details": "When, with whom, and what was discussed — or 'N/A'",
  "red_flags": ["Each detected red flag as a plain-English string"],
  "viability_score": 72,
  "viability_label": "Moderate",
  "recommendation": "Two to three sentences for the reviewing attorney",
  "notes": "Any other facts, inconsistencies, or concerns for the attorney"
}
</case_summary>

VIABILITY SCORING:
- 80–100 → "Strong": Clean facts, timely reporting, clear liability, good documentation
- 60–79 → "Moderate": Viable claim with addressable concerns
- 40–59 → "Weak": Significant red flags that may undermine the claim
- 0–39  → "Declined": Multiple serious issues, or client is a 1099 contractor` }

// ─── PDF Print ────────────────────────────────────────────────────────────────

function printSummaryAsPDF(s) {
  const color = { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' }[s.viability_label] ?? '#6b7280'
  const bg    = { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed', Declined: '#fef2f2' }[s.viability_label] ?? '#f9fafb'

  const val  = (v) => v && v !== 'N/A' ? `<span>${esc(v)}</span>` : `<span style="color:#9ca3af">—</span>`
  const esc  = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const field = (label, value) => `
    <div class="field">
      <div class="field-label">${esc(label)}</div>
      <div class="field-value">${val(value)}</div>
    </div>`

  const grid = (pairs) => `<div class="grid">${pairs.map(([l,v]) => field(l,v)).join('')}</div>`

  const section = (icon, title, body) => `
    <div class="section">
      <div class="section-header"><span class="section-icon">${icon}</span>${esc(title)}</div>
      ${body}
    </div>`

  const flags = Array.isArray(s.red_flags) && s.red_flags.length
    ? `<div class="flags">${s.red_flags.map(f => `<div class="flag">⚑ ${esc(f)}</div>`).join('')}</div>`
    : `<div style="color:#9ca3af;font-size:13px">None detected</div>`

  // SVG donut
  const r = 44, circ = 2 * Math.PI * r
  const offset = circ - ((s.viability_score ?? 0) / 100) * circ
  const donut = `
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="11"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="${color}" stroke-width="11"
        stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
        transform="rotate(-90 55 55)"/>
      <text x="55" y="50" text-anchor="middle" font-size="22" font-weight="800" fill="${color}" font-family="system-ui,sans-serif">${s.viability_score ?? 0}</text>
      <text x="55" y="64" text-anchor="middle" font-size="10" fill="#9ca3af" font-family="system-ui,sans-serif">out of 100</text>
    </svg>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Intake Report — ${esc(s.claimant ?? 'Unknown')}</title>
<style>
  @page { size: letter; margin: 0.75in 0.85in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui,-apple-system,'Segoe UI',sans-serif; font-size: 13px; color: #111827; line-height: 1.5; }

  .letterhead { background: #1a2e4a; color: white; padding: 22px 28px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .letterhead-left .firm { font-size: 10px; font-weight: 700; opacity: 0.6; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .letterhead-left .title { font-size: 20px; font-weight: 900; letter-spacing: -0.4px; }
  .letterhead-left .sub { font-size: 12px; opacity: 0.7; margin-top: 3px; }
  .letterhead-right { text-align: right; font-size: 11px; opacity: 0.65; line-height: 1.7; }

  .viability-box { background: ${bg}; border: 1.5px solid ${color}30; border-radius: 10px; padding: 16px 20px; display: flex; gap: 20px; align-items: center; margin-bottom: 4px; }
  .viability-text .badge { display: inline-block; background: ${color}; color: white; border-radius: 20px; padding: 2px 13px; font-weight: 800; font-size: 13px; margin-bottom: 7px; }
  .viability-text .rec { font-size: 13px; color: #374151; line-height: 1.65; max-width: 420px; }

  .section { margin-top: 18px; page-break-inside: avoid; }
  .section-header { display: flex; align-items: center; gap: 7px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; font-weight: 800; font-size: 11.5px; color: #1a2e4a; text-transform: uppercase; letter-spacing: 0.07em; }
  .section-icon { font-size: 13px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .field { margin-bottom: 9px; }
  .field-label { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .field-value { font-size: 13px; color: #111827; }
  .field-full { margin-bottom: 9px; }
  .field-full .field-label { font-size: 10.5px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .field-full .field-value { font-size: 13px; color: #111827; }

  .flags { display: flex; flex-direction: column; gap: 5px; }
  .flag { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 6px 11px; font-size: 12.5px; color: #9a3412; }

  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 11px 14px; font-size: 13px; color: #78350f; line-height: 1.7; }

  .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10.5px; color: #9ca3af; display: flex; justify-content: space-between; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="letterhead">
  <div class="letterhead-left">
    <div class="firm">California Workers' Compensation</div>
    <div class="title">Intake Screening Report</div>
    <div class="sub">${esc(s.claimant ?? '—')}${s.intake_date ? ' &nbsp;·&nbsp; ' + esc(s.intake_date) : ''}</div>
  </div>
  <div class="letterhead-right">
    Confidential — Attorney Work Product<br/>
    For Internal Use Only
  </div>
</div>

${section('📊', 'Viability Assessment', `
  <div class="viability-box">
    ${donut}
    <div class="viability-text">
      <div class="badge">${esc(s.viability_label ?? '—')}</div>
      <div class="rec">${esc(s.recommendation ?? '—')}</div>
    </div>
  </div>`)}

${section('⚠️', 'Red Flags', flags)}

${section('👤', 'Client Information', grid([
  ['Full Name',           s.claimant],
  ['Phone',               s.phone],
  ['Email',               s.email],
  ['Residence',           s.residence],
  ['Injury Jurisdiction', s.injury_jurisdiction],
  ['Intake Date',         s.intake_date],
]))}

${section('🏢', 'Employment', grid([
  ['Employer',        s.employer],
  ['Job Title',       s.job_title],
  ['Employment Type', s.employment_type],
  ['Hours / Week',    s.hours_per_week],
  ['', ''],
  ['', ''],
]))}

${section('🩹', 'Injury Details', `
  ${grid([
    ['Date of Injury', s.injury_date],
    ['Time of Injury', s.injury_time],
    ['Location',       s.injury_location],
    ['Body Part(s)',   s.body_part],
    ['Current Status', s.current_status],
    ['', ''],
  ])}
  <div class="field-full">
    <div class="field-label">Mechanism / Description</div>
    <div class="field-value">${val(s.injury_description)}</div>
  </div>
  ${s.termination_details && s.termination_details !== 'N/A' ? `
  <div class="field-full">
    <div class="field-label">Termination Details</div>
    <div class="field-value">${val(s.termination_details)}</div>
  </div>` : ''}`)}

${section('📋', 'Reporting', grid([
  ['Reported to Employer', s.reported_to_employer],
  ['Written Report Filed', s.written_report_filed],
]))}

${section('🏥', 'Medical Treatment', grid([
  ['Facility',        s.medical_facility],
  ['Treating Doctor', s.treating_doctor],
  ['First Visit',     s.first_treatment_date],
  ['', ''],
]))}

${section('👥', 'Witnesses', `
  <div class="field-full">
    <div class="field-label">Witness Information</div>
    <div class="field-value">${val(s.witnesses)}</div>
  </div>`)}

${section('📁', 'Prior Injury History', `
  <div class="field-full">
    <div class="field-label">Prior Injuries / Pre-existing Conditions</div>
    <div class="field-value">${val(s.prior_injuries)}</div>
  </div>`)}

${section('🎙️', 'Recorded Statements', `
  ${grid([['Statement Given', s.recorded_statement], ['', '']])}
  ${s.recorded_statement_details && s.recorded_statement_details !== 'N/A' ? `
  <div class="field-full">
    <div class="field-label">Details</div>
    <div class="field-value">${val(s.recorded_statement_details)}</div>
  </div>` : ''}`)}

${s.notes ? section('📝', 'Attorney Notes', `<div class="notes-box">${esc(s.notes)}</div>`) : ''}

<div class="footer">
  <span>CaseTake — Confidential Intake Report &nbsp;·&nbsp; © ${new Date().getFullYear()} Picnic Peaks LLC. All rights reserved.</span>
  <span>Generated ${new Date().toLocaleString()}</span>
</div>

</body>
</html>`

  // Write to a hidden iframe, let html2pdf render it to a downloadable PDF blob
  const loadHtml2pdf = () => new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    s.onload = () => resolve(window.html2pdf)
    s.onerror = reject
    document.head.appendChild(s)
  })

  loadHtml2pdf().then(h2p => {
    const container = document.createElement('div')
    container.innerHTML = html
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:816px;background:white;'
    document.body.appendChild(container)

    const filename = `CaseTake-${(s.claimant ?? 'Report').replace(/\s+/g,'-')}-${s.intake_date ?? new Date().toISOString().slice(0,10)}.pdf`
    h2p(container, {
      margin: [0.75, 0.85],
      filename,
      image:    { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF:    { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] },
    }).save().then(() => document.body.removeChild(container))
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function viabilityColor(label) {
  return { Strong: '#16a34a', Moderate: '#ca8a04', Weak: '#ea580c', Declined: '#dc2626' }[label] ?? '#6b7280'
}

function viabilityBg(label) {
  return { Strong: '#f0fdf4', Moderate: '#fefce8', Weak: '#fff7ed', Declined: '#fef2f2' }[label] ?? '#f9fafb'
}

function extractCaseSummary(text) {
  const match = text.match(/<case_summary>([\s\S]*?)<\/case_summary>/)
  if (!match) return { displayText: text, summary: null }
  try {
    const summary = JSON.parse(match[1].trim())
    const displayText = text.replace(/<case_summary>[\s\S]*?<\/case_summary>/, '').trim()
    return { displayText, summary }
  } catch {
    return { displayText: text, summary: null }
  }
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({ score, label }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const color = viabilityColor(label)
  return (
    <svg width="136" height="136" viewBox="0 0 136 136" aria-label={`Viability score: ${score} out of 100`}>
      <circle cx="68" cy="68" r={r} fill="none" stroke="#e5e7eb" strokeWidth="13" />
      <circle
        cx="68" cy="68" r={r} fill="none"
        stroke={color} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (score / 100) * circ}
        transform="rotate(-90 68 68)"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)' }}
      />
      <text x="68" y="62" textAnchor="middle" fontSize="28" fontWeight="800" fill={color} fontFamily="inherit">{score}</text>
      <text x="68" y="80" textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="inherit">out of 100</text>
    </svg>
  )
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16, animation: 'msgFadeIn .2s ease' }}>
      <AiAvatar />
      <div style={{
        background: '#f3f4f6', borderRadius: '18px 18px 18px 4px',
        padding: '13px 18px', display: 'flex', gap: 5, alignItems: 'center'
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#9ca3af',
            animation: 'bounce 1.3s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── AiAvatar ─────────────────────────────────────────────────────────────────

function AiAvatar() {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: NAVY,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0, letterSpacing: '0.05em'
    }}>AI</div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
// Handles **bold**, *italic*, `code`, - bullet lists, and line breaks.
// Called as a plain function (not a component) to avoid remount issues.

function applyInline(text) {
  // Process **bold**, *italic*, `code` in one pass
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  if (parts.length === 1) return text
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*')  && p.endsWith('*'))  return <em     key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`')  && p.endsWith('`'))  return <code   key={i} style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 4, padding: '1px 5px', fontSize: '0.9em' }}>{p.slice(1, -1)}</code>
    return p
  })
}

function renderMarkdown(text) {
  const lines = String(text ?? '').split('\n')
  const out = []
  let listItems = []
  let k = 0

  const flushList = () => {
    if (!listItems.length) return
    out.push(
      <ul key={`ul${k++}`} style={{ paddingLeft: 20, margin: '4px 0 4px' }}>
        {listItems.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{applyInline(s)}</li>)}
      </ul>
    )
    listItems = []
  }

  lines.forEach(line => {
    const bullet = line.match(/^[-*] (.*)/)
    if (bullet) { listItems.push(bullet[1]); return }
    flushList()
    out.push(<span key={k++}>{applyInline(line)}</span>, <br key={k++} />)
  })
  flushList()
  // Drop trailing <br>
  if (out.length && out[out.length - 1]?.type === 'br') out.pop()
  return out
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 10,
      marginBottom: 14,
      paddingLeft: isUser ? 56 : 0,
      paddingRight: isUser ? 0 : 56,
      animation: 'msgFadeIn .22s ease',
    }}>
      {!isUser && <AiAvatar />}
      <div style={{
        background: isUser ? NAVY : '#f3f4f6',
        color: isUser ? 'white' : '#111827',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '11px 16px',
        fontSize: 15,
        lineHeight: 1.55,
        maxWidth: '100%',
        wordBreak: 'break-word',
      }}>
        {isUser ? message.displayContent : renderMarkdown(message.displayContent)}
      </div>
    </div>
  )
}

// ─── MessageFeedback ──────────────────────────────────────────────────────────

function MessageFeedback({ msgId, snippet, feedbackMap, onSubmit }) {
  const existing = feedbackMap[msgId]
  const [pendingRating, setPendingRating] = useState(null)
  const [expanded,      setExpanded]      = useState(false)
  const [comment,       setComment]       = useState('')
  const [done,          setDone]          = useState(!!existing)

  const handleThumb = (rating) => {
    if (done) return
    setPendingRating(rating)
    setExpanded(true)
  }

  const submit = () => {
    onSubmit(msgId, { rating: pendingRating, comment: comment.trim(), snippet })
    setDone(true)
    setExpanded(false)
  }

  if (done && existing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, marginBottom: 14, marginLeft: 44, opacity: 0.7 }}>
        <span style={{ fontSize: 13 }}>{existing.rating === 'up' ? '👍' : '👎'}</span>
        {existing.comment && (
          <span style={{ fontSize: 11.5, color: '#6b7280', fontStyle: 'italic' }}>"{existing.comment}"</span>
        )}
        <span style={{ fontSize: 11, color: '#9ca3af' }}>· recorded</span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 5, marginBottom: 14, marginLeft: 44 }}>
      {!expanded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 2 }}>Helpful?</span>
          {['up', 'down'].map(r => (
            <button
              key={r}
              onClick={() => handleThumb(r)}
              title={r === 'up' ? 'Good response' : 'Needs improvement'}
              style={{
                background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
                padding: '2px 7px', cursor: 'pointer', fontSize: 12,
                color: '#6b7280', transition: 'all 0.1s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.color = NAVY }}
              onMouseOut={e  => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' }}
            >{r === 'up' ? '👍' : '👎'}</button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>{pendingRating === 'up' ? '👍' : '👎'}</span>
          <input
            autoFocus
            placeholder="Note required…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && comment.trim() && submit()}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 7,
              border: '1.5px solid #d1d5db', outline: 'none',
              width: 220, fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = NAVY)}
            onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
          />
          <button
            onClick={submit}
            disabled={!comment.trim()}
            style={{
              background: comment.trim() ? NAVY : '#e5e7eb',
              color: comment.trim() ? 'white' : '#9ca3af',
              border: 'none', borderRadius: 7, padding: '4px 12px', fontSize: 12,
              fontWeight: 600, cursor: comment.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >Send</button>
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
          >✕</button>
        </div>
      )}
    </div>
  )
}

// ─── FeedbackLogModal ─────────────────────────────────────────────────────────

function FeedbackLogModal({ feedback, onClose, onClear }) {
  const [copied, setCopied] = useState(false)

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(feedback, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `casetake-feedback-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 14, width: '100%', maxWidth: 600,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)', animation: 'msgFadeIn .2s ease',
      }}>
        {/* Header */}
        <div style={{
          background: NAVY, color: 'white', padding: '16px 20px',
          borderRadius: '14px 14px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Tester Feedback Log</div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{feedback.length} entr{feedback.length === 1 ? 'y' : 'ies'} collected</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copyJSON} style={{
              background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}>{copied ? '✓ Copied' : 'Copy JSON'}</button>
            <button onClick={download} style={{
              background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}>⬇ Download</button>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {feedback.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 14 }}>
              No feedback yet — thumbs up/down appear below each AI response.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...feedback].reverse().map((fb, i) => (
                <div key={i} style={{
                  border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px',
                  background: fb.rating === 'up' ? '#f0fdf4' : '#fff7ed',
                  borderColor: fb.rating === 'up' ? '#bbf7d0' : '#fed7aa',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16 }}>{fb.rating === 'up' ? '👍' : '👎'}</span>
                      <span style={{ fontSize: 11.5, color: '#6b7280' }}>{new Date(fb.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  {fb.comment && (
                    <div style={{ marginTop: 6, fontSize: 13.5, color: '#374151', fontStyle: 'italic' }}>
                      "{fb.comment}"
                    </div>
                  )}
                  {fb.snippet && (
                    <div style={{
                      marginTop: 8, fontSize: 12.5, color: '#374151', lineHeight: 1.6,
                      background: 'white', border: '1px solid #e5e7eb',
                      borderRadius: 6, padding: '8px 11px',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {fb.snippet}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {feedback.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClear}
              style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
            >Clear all feedback</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PreIntakeFormCard ────────────────────────────────────────────────────────

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','Washington D.C.']

// Jurisdiction evaluator — returns { status, basis }
// status: 'confirmed' | 'review' | 'stop-commuting' | 'pending'
function evaluateJurisdiction({ injuryState, primaryWorkState, activity, exceptions }) {
  if (injuryState === 'California') return { status: 'confirmed', basis: 'injury-in-ca' }
  if (primaryWorkState === 'California') {
    if (activity === 'working') return { status: 'confirmed', basis: 'principally-localized' }
    if (activity === 'travel')  return { status: 'confirmed', basis: 'temp-outside-ca' }
    if (activity === 'other')   return { status: 'review',    basis: 'ca-employer-unclear-activity' }
  }
  if (activity === 'commuting') {
    const { traveling, vehicle, errand, ownVehicle } = exceptions
    if (traveling || vehicle || errand || ownVehicle) return { status: 'confirmed', basis: 'going-coming-exception' }
    if ([traveling, vehicle, errand, ownVehicle].every(v => v === false)) return { status: 'stop-commuting', basis: 'commuting-no-exception' }
    return { status: 'pending' }
  }
  return { status: 'review', basis: 'out-of-state-no-ca-connection' }
}

// Shared bubble shell — defined at module level so identity is stable across renders
function PreFormBubble({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16, animation: 'msgFadeIn .22s ease', paddingRight: 56 }}>
      <AiAvatar />
      <div style={{ background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '18px 20px', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

function PreFormLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
      {children}
    </div>
  )
}

function PreIntakeFormCard({ onSubmit }) {
  const [step,             setStep]            = useState('employment')
  const [empType,          setEmpType]         = useState(null)    // 'w2' | '1099' | 'unsure'
  const [govType,          setGovType]         = useState(null)    // 'private' | 'state-local' | 'federal' | 'unsure'
  const [residenceCity,    setResidenceCity]   = useState('')
  const [residenceState,   setResidenceState]  = useState('California')
  const [injuryCity,       setInjuryCity]      = useState('')
  const [injuryState,      setInjuryState]     = useState('California')
  const [primaryWorkState, setPrimaryWorkState] = useState('California')
  const [activity,         setActivity]        = useState(null)    // 'working' | 'travel' | 'commuting' | 'other'
  const [exceptions,       setExceptions]      = useState({ traveling: null, vehicle: null, errand: null, ownVehicle: null })
  const [softStopBasis,    setSoftStopBasis]   = useState(null)

  const outOfState = injuryState !== 'California'
  const canProceedLocation = residenceCity.trim() && injuryCity.trim() &&
    (!outOfState || (primaryWorkState && activity))

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', color: '#111827', background: 'white',
    transition: 'border-color 0.15s',
  }

  // Reusable selection button style
  const sb = (active) => ({
    background: active ? NAVY : 'white',
    color: active ? 'white' : '#374151',
    border: `1.5px solid ${active ? NAVY : '#d1d5db'}`,
    borderRadius: 8, padding: '8px 14px',
    fontSize: 13.5, fontWeight: active ? 700 : 500,
    cursor: 'pointer', transition: 'all 0.12s',
    textAlign: 'left', lineHeight: 1.4,
  })

  const doSubmit = (jurisdictionStatus, jurisdictionBasis) => {
    onSubmit({
      employmentType: empType,
      governmentType: govType,
      residenceCity, residenceState,
      injuryCity, injuryState,
      primaryWorkState: outOfState ? primaryWorkState : 'California',
      activity: outOfState ? activity : null,
      jurisdictionStatus,
      jurisdictionBasis,
      exceptions: activity === 'commuting' ? exceptions : null,
    })
  }

  const handleLocationSubmit = () => {
    if (!canProceedLocation) return
    if (!outOfState) { doSubmit('confirmed', 'injury-in-ca'); return }
    if (activity === 'commuting') { setStep('commuting-check'); return }
    const result = evaluateJurisdiction({ injuryState, primaryWorkState, activity, exceptions })
    if (result.status === 'confirmed') doSubmit(result.status, result.basis)
    else { setSoftStopBasis(result.basis); setStep('soft-stop') }
  }

  const handleException = (key, value) => {
    const exc = { ...exceptions, [key]: value }
    setExceptions(exc)
    const result = evaluateJurisdiction({ injuryState, primaryWorkState, activity: 'commuting', exceptions: exc })
    if (result.status === 'confirmed') doSubmit('confirmed', 'going-coming-exception')
    else if (result.status === 'stop-commuting') { setSoftStopBasis('commuting-no-exception'); setStep('soft-stop') }
  }

  const resetToStart = () => {
    setStep('employment'); setEmpType(null); setGovType(null)
    setActivity(null); setExceptions({ traveling: null, vehicle: null, errand: null, ownVehicle: null })
  }

  // ── STEP: Employment eligibility ──────────────────────────────────────────
  if (step === 'employment') return (
    <PreFormBubble>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 3 }}>Before we begin</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 }}>
        A few quick questions to confirm eligibility and establish jurisdiction.
      </div>

      <PreFormLabel>What is your employment type?</PreFormLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
        {[['w2', 'W-2 Employee'], ['1099', '1099 Contractor'], ['unsure', 'Not sure']].map(([val, label]) => (
          <button key={val} style={sb(empType === val)} onClick={() => {
            setEmpType(val)
            if (val === '1099') setStep('stop-1099')
          }}>{label}</button>
        ))}
      </div>

      {(empType === 'w2' || empType === 'unsure') && (<>
        <PreFormLabel>Is your employer a government agency?</PreFormLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {[['private', 'Private employer'], ['state-local', 'State / local government'], ['federal', 'Federal government'], ['unsure', 'Not sure']].map(([val, label]) => (
            <button key={val} style={sb(govType === val)} onClick={() => {
              setGovType(val)
              if (val === 'federal') setStep('stop-federal')
            }}>{label}</button>
          ))}
        </div>
        {govType && govType !== 'federal' && (
          <button onClick={() => setStep('location')} style={{
            background: NAVY, color: 'white', border: 'none', borderRadius: 9,
            padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Next →</button>
        )}
      </>)}
    </PreFormBubble>
  )

  // ── STOP: 1099 ────────────────────────────────────────────────────────────
  if (step === 'stop-1099') return (
    <PreFormBubble>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>Unable to Proceed</div>
      </div>
      <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
        Our firm represents <strong>W-2 employees</strong> in California workers' compensation cases.
        Independent contractors (1099) are generally not covered under California workers' compensation law.
      </div>
      <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.65, marginBottom: 18 }}>
        <strong>Were you misclassified?</strong> If you believe your employer incorrectly classified you as a 1099 contractor
        when you should be a W-2 employee, that determination requires attorney review — please contact us directly.
      </div>
      <button onClick={resetToStart} style={{ background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
        ← Start Over
      </button>
    </PreFormBubble>
  )

  // ── STOP: Federal ─────────────────────────────────────────────────────────
  if (step === 'stop-federal') return (
    <PreFormBubble>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>ℹ️</span>
        <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>Different Coverage Applies</div>
      </div>
      <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
        <strong>Federal government employees</strong> are covered under the{' '}
        <strong>Federal Employees' Compensation Act (FECA)</strong>, not California workers' compensation.
        Claims must be filed through the U.S. Department of Labor.
      </div>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#0c4a6e', lineHeight: 1.65, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>U.S. Dept. of Labor — Office of Workers' Compensation Programs</div>
        <div>Phone: <strong>1-866-692-7487</strong> (1-866-OWCP-IVR)</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>Monday – Friday, 8 AM – 5 PM local time</div>
      </div>
      <button onClick={resetToStart} style={{ background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
        ← Start Over
      </button>
    </PreFormBubble>
  )

  // ── STEP: Location & circumstances ────────────────────────────────────────
  if (step === 'location') return (
    <PreFormBubble>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 16 }}>Location &amp; Circumstances</div>

      <PreFormLabel>Where do you currently live?</PreFormLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input placeholder="City" value={residenceCity} onChange={e => setResidenceCity(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')} />
        <select value={residenceState} onChange={e => setResidenceState(e.target.value)}
          style={{ ...inputStyle, width: 'auto', paddingRight: 28, cursor: 'pointer' }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')}>
          {US_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <PreFormLabel>Where did the injury occur?</PreFormLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: outOfState ? 0 : 16 }}>
        <input placeholder="City" value={injuryCity} onChange={e => setInjuryCity(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')} />
        <select value={injuryState} onChange={e => { setInjuryState(e.target.value); setActivity(null) }}
          style={{ ...inputStyle, width: 'auto', paddingRight: 28, cursor: 'pointer' }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')}>
          {US_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {outOfState && (
        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>ℹ️</span> Injury occurred outside California — a few more questions to check jurisdiction
          </div>

          <PreFormLabel>What state do you primarily work in?</PreFormLabel>
          <select value={primaryWorkState} onChange={e => setPrimaryWorkState(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer' }}
            onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')}>
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>

          <PreFormLabel>What were you doing when the injury occurred?</PreFormLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 6 }}>
            {[
              ['working',   '🏗',  'Working at my regular workplace or worksite'],
              ['travel',    '✈️', 'Business travel — away from home for work'],
              ['commuting', '🚗',  'Commuting to or from work'],
              ['other',     '❓',  'Other / not sure'],
            ].map(([val, icon, label]) => (
              <button key={val} onClick={() => setActivity(val)}
                style={{ ...sb(activity === val), display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px' }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleLocationSubmit} disabled={!canProceedLocation} style={{
        background: canProceedLocation ? NAVY : '#e5e7eb',
        color: canProceedLocation ? 'white' : '#9ca3af',
        border: 'none', borderRadius: 9, padding: '10px 22px',
        fontSize: 14, fontWeight: 700, cursor: canProceedLocation ? 'pointer' : 'not-allowed',
        marginTop: 18, transition: 'background 0.15s',
      }}>Begin Intake →</button>
    </PreFormBubble>
  )

  // ── STEP: Going-and-coming exception check ────────────────────────────────
  if (step === 'commuting-check') {
    const qs = [
      ['traveling',  'Is your job a traveling position with no fixed workplace — such as delivery, field service, or outside sales?'],
      ['vehicle',    'Were you operating a vehicle provided by your employer at the time of the injury?'],
      ['errand',     'Were you running a specific errand or completing a task that your employer asked you to handle?'],
      ['ownVehicle', 'Does your job require you to use your personal vehicle, and does your employer reimburse you for mileage or require car access as a job condition?'],
    ]
    return (
      <PreFormBubble>
        <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 4 }}>Commuting — Exception Check</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, marginBottom: 18 }}>
          Injuries that occur while commuting are generally not covered, but several exceptions apply. Please answer each question:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {qs.map(([key, q]) => (
            <div key={key}>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{q}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                {[[true, 'Yes'], [false, 'No']].map(([val, label]) => (
                  <button key={String(val)} onClick={() => handleException(key, val)}
                    style={{ ...sb(exceptions[key] === val), minWidth: 70, textAlign: 'center', padding: '7px 16px' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PreFormBubble>
    )
  }

  // ── SOFT STOP: Jurisdiction unclear / commuting no exception ──────────────
  if (step === 'soft-stop') {
    const isCommuting = softStopBasis === 'commuting-no-exception'
    return (
      <PreFormBubble>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>
            {isCommuting ? 'Claim May Not Be Covered' : 'Jurisdiction Review Needed'}
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
          {isCommuting
            ? 'Injuries that occur during a commute to or from work are generally excluded from California workers\' compensation coverage, and no applicable exception was identified based on your answers.'
            : `The injury occurred outside California (${injuryState}) and a clear California workers' compensation jurisdiction connection wasn't established based on your answers. This claim may need to be filed in ${injuryState} instead.`
          }
        </div>
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.65, marginBottom: 18 }}>
          <strong>This isn't necessarily the end.</strong> An attorney may identify additional facts that establish coverage.
          You can continue the intake and the jurisdiction question will be flagged for attorney review.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => doSubmit('review', softStopBasis)} style={{
            background: NAVY, color: 'white', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Continue — Flag for Attorney Review</button>
          <button onClick={resetToStart} style={{
            background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, cursor: 'pointer', color: '#374151',
          }}>← Start Over</button>
        </div>
      </PreFormBubble>
    )
  }

  return null
}

// ─── IntakeFormCard ───────────────────────────────────────────────────────────

function IntakeFormCard({ question, msgIdx, formSubmitted, formSummary, onSubmit }) {
  const [values, setValues] = useState({})

  const isVisible = (field) => {
    if (!field.conditionKey) return true
    const dep = values[field.conditionKey]
    if (field.conditionValues) return field.conditionValues.includes(dep)
    return dep === (field.conditionValue ?? 'yes')
  }

  const canSubmit = question.fields
    .filter(f => f.required && isVisible(f))
    .every(f => { const v = values[f.key]; return v !== undefined && v !== null && String(v).trim() !== '' })

  const setVal = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  const handleSubmit = () => {
    if (!canSubmit) return
    const fmtDate = (v) => {
      const d = new Date(v + 'T12:00:00')
      return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
    const lines = question.fields
      .filter(f => isVisible(f))
      .map(f => {
        const v = values[f.key]
        if (v === undefined || v === null || String(v).trim() === '') return null
        return `${f.label}: ${f.type === 'date' ? fmtDate(v) : v}`
      })
      .filter(Boolean)
    onSubmit(msgIdx, lines.join('\n'))
  }

  // inputBase is a plain object (not a function), so renderField can inline it safely
  const inputBase = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', color: '#111827', background: 'white',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  }

  // renderField is a plain function returning JSX, NOT a React component — no remount/focus issues
  const renderField = (field) => {
    if (!isVisible(field)) return null
    const val = values[field.key] ?? ''

    const lbl = (
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {field.label}{field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </div>
    )

    if (field.type === 'yesno') {
      const opts = ['yes', 'no', ...(field.includeUnsure ? ['unsure'] : [])]
      return (
        <div key={field.key} style={{ marginBottom: 14 }}>
          {lbl}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {opts.map(opt => {
              const active = val === opt
              return (
                <button key={opt} onClick={() => setVal(field.key, opt)} style={{
                  background: active ? NAVY : 'white', color: active ? 'white' : '#374151',
                  border: `1.5px solid ${active ? NAVY : '#d1d5db'}`,
                  borderRadius: 8, padding: '7px 18px', fontSize: 13.5,
                  fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.12s',
                }}>
                  {opt === 'unsure' ? 'Not sure' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (field.type === 'select') return (
      <div key={field.key} style={{ marginBottom: 14 }}>
        {lbl}
        <select value={val} onChange={e => setVal(field.key, e.target.value)}
          style={{ ...inputBase, cursor: 'pointer', paddingRight: 28 }}
          onFocus={e => { e.target.style.borderColor = NAVY }}
          onBlur={e  => { e.target.style.borderColor = '#d1d5db' }}>
          <option value="">Select…</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )

    if (field.type === 'textarea') return (
      <div key={field.key} style={{ marginBottom: 14 }}>
        {lbl}
        <textarea value={val} rows={3} placeholder={field.placeholder || ''}
          onChange={e => setVal(field.key, e.target.value)}
          style={{ ...inputBase, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }}
          onFocus={e => { e.target.style.borderColor = NAVY }}
          onBlur={e  => { e.target.style.borderColor = '#d1d5db' }} />
      </div>
    )

    // text / tel / email / number / date
    return (
      <div key={field.key} style={{ marginBottom: 14 }}>
        {lbl}
        <input type={field.type} value={val} placeholder={field.placeholder || ''}
          onChange={e => setVal(field.key, e.target.value)}
          style={inputBase}
          onFocus={e => { e.target.style.borderColor = NAVY }}
          onBlur={e  => { e.target.style.borderColor = '#d1d5db' }} />
      </div>
    )
  }

  // ── Locked view after submission ──────────────────────────────────────────
  if (formSubmitted) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '18px 18px 18px 4px', padding: '10px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {question.topic}
        </div>
        <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          ✓ Submitted
        </div>
      </div>
    </div>
  )

  // ── Active form ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          {question.topic}
        </div>
        <div style={{ fontSize: 13.5, color: '#374151', marginBottom: 14, lineHeight: 1.55 }}>
          {question.intro}
        </div>
        {question.fields.map(f => renderField(f))}
        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          background: canSubmit ? NAVY : '#e5e7eb',
          color: canSubmit ? 'white' : '#9ca3af',
          border: 'none', borderRadius: 9, padding: '9px 22px',
          fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s', marginTop: 2,
        }}>Submit →</button>
      </div>
    </div>
  )
}

// ─── ScriptedQuestionBubble ───────────────────────────────────────────────────

function ScriptedQuestionBubble({ question }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{
        background: '#f0f4ff',
        border: '1px solid #c7d2fe',
        borderRadius: '18px 18px 18px 4px',
        padding: '11px 16px',
        fontSize: 15,
        lineHeight: 1.55,
        maxWidth: '100%',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          Intake Question
        </div>
        <div style={{ color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {question}
        </div>
      </div>
    </div>
  )
}

// ─── CaseSummaryModal ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      borderBottom: '2px solid #e5e7eb', paddingBottom: 7, marginBottom: 12, marginTop: 24,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 13, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
    </div>
  )
}

function InfoGrid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 13.5, color: value ? '#111827' : '#9ca3af', lineHeight: 1.5 }}>{value || '—'}</div>
        </div>
      ))}
    </div>
  )
}

function InfoBlock({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? '#111827' : '#9ca3af', lineHeight: 1.5 }}>{value || '—'}</div>
    </div>
  )
}

function CaseSummaryModal({ summary, onClose }) {
  if (!summary) return null
  const color = viabilityColor(summary.viability_label)
  const bg    = viabilityBg(summary.viability_label)

  const printReport = () => printSummaryAsPDF(summary)

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Case Intake Report"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 740,
        maxHeight: '93vh', overflowY: 'auto',
        boxShadow: '0 32px 72px rgba(0,0,0,0.28)',
        animation: 'msgFadeIn .25s ease',
      }}>

        {/* ── Report Header ── */}
        <div style={{
          background: NAVY, color: 'white',
          padding: '20px 24px', borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                California Workers' Compensation
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.4px' }}>
                Intake Screening Report
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                {summary.claimant || 'Unknown Claimant'}
                {summary.intake_date ? ` · ${summary.intake_date}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={printReport} style={{
                background: 'rgba(255,255,255,0.13)', color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>🖨 Print</button>
              <button onClick={onClose} aria-label="Close" style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>×</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '4px 24px 28px' }}>

          {/* ── Viability Assessment ── */}
          <SectionHeader icon="📊" title="Viability Assessment" />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 22,
            background: bg, border: `1.5px solid ${color}30`,
            borderRadius: 12, padding: '18px 22px', flexWrap: 'wrap',
          }}>
            <DonutChart score={summary.viability_score} label={summary.viability_label} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{
                display: 'inline-block', background: color, color: 'white',
                borderRadius: 20, padding: '3px 14px', fontWeight: 800, fontSize: 14, marginBottom: 10,
              }}>{summary.viability_label}</div>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7 }}>
                {summary.recommendation}
              </div>
            </div>
          </div>

          {/* ── Red Flags ── */}
          {Array.isArray(summary.red_flags) && summary.red_flags.length > 0 && (
            <>
              <SectionHeader icon="⚠️" title="Red Flags Detected" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.red_flags.map((flag, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9,
                    background: '#fff7ed', border: '1px solid #fed7aa',
                    borderRadius: 8, padding: '8px 13px',
                  }}>
                    <span style={{ color: '#ea580c', fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚑</span>
                    <span style={{ fontSize: 13.5, color: '#9a3412', lineHeight: 1.5 }}>{flag}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Client Information ── */}
          <SectionHeader icon="👤" title="Client Information" />
          <InfoGrid rows={[
            ['Full Name',          summary.claimant],
            ['Phone',              summary.phone],
            ['Email',              summary.email],
            ['Residence',          summary.residence],
            ['Injury Jurisdiction',summary.injury_jurisdiction],
            ['Intake Date',        summary.intake_date],
          ]} />

          {/* ── Employment ── */}
          <SectionHeader icon="🏢" title="Employment" />
          <InfoGrid rows={[
            ['Employer',         summary.employer],
            ['Job Title',        summary.job_title],
            ['Employment Type',  summary.employment_type],
            ['Hours / Week',     summary.hours_per_week],
            ['',                 ''],
            ['',                 ''],
          ]} />

          {/* ── Injury Details ── */}
          <SectionHeader icon="🩹" title="Injury Details" />
          <InfoGrid rows={[
            ['Date of Injury',    summary.injury_date],
            ['Time of Injury',    summary.injury_time],
            ['Location',          summary.injury_location],
            ['Body Part(s)',       summary.body_part],
            ['Current Status',    summary.current_status],
            ['',                  ''],
          ]} />
          <InfoBlock label="Mechanism / Description" value={summary.injury_description} />
          {summary.termination_details && summary.termination_details !== 'N/A' && (
            <InfoBlock label="Termination Details" value={summary.termination_details} />
          )}

          {/* ── Reporting ── */}
          <SectionHeader icon="📋" title="Reporting" />
          <InfoGrid rows={[
            ['Reported to Employer', summary.reported_to_employer],
            ['Written Report Filed', summary.written_report_filed],
          ]} />

          {/* ── Medical Treatment ── */}
          <SectionHeader icon="🏥" title="Medical Treatment" />
          <InfoGrid rows={[
            ['Facility',          summary.medical_facility],
            ['Treating Doctor',   summary.treating_doctor],
            ['First Visit',       summary.first_treatment_date],
            ['',                  ''],
          ]} />

          {/* ── Witnesses ── */}
          <SectionHeader icon="👥" title="Witnesses" />
          <InfoBlock label="Witness Information" value={summary.witnesses} />

          {/* ── Prior Injuries ── */}
          <SectionHeader icon="📁" title="Prior Injury History" />
          <InfoBlock label="Prior Injuries / Pre-existing Conditions" value={summary.prior_injuries} />

          {/* ── Recorded Statements ── */}
          <SectionHeader icon="🎙️" title="Recorded Statements" />
          <InfoGrid rows={[
            ['Statement Given', summary.recorded_statement],
            ['',               ''],
          ]} />
          {summary.recorded_statement_details && summary.recorded_statement_details !== 'N/A' && (
            <InfoBlock label="Details" value={summary.recorded_statement_details} />
          )}

          {/* ── Attorney Notes ── */}
          {summary.notes && (
            <>
              <SectionHeader icon="📝" title="Attorney Notes" />
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 9, padding: '13px 16px',
                fontSize: 13.5, color: '#78350f', lineHeight: 1.7,
              }}>
                {summary.notes}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── LandingScreen ────────────────────────────────────────────────────────────

function LandingScreen({ onStart }) {
  const features = [
    {
      icon: '📋',
      title: 'Structured Questions',
      desc: 'AI-guided 9-stage intake covering employment, injury mechanics, treatment, witnesses, prior history, and more.',
    },
    {
      icon: '🚩',
      title: 'Red Flag Detection',
      desc: 'Automatically tracks late reporting, contractor status, conflicting timelines, and 10+ other risk factors — silently.',
    },
    {
      icon: '📊',
      title: 'Viability Report',
      desc: 'Generates a scored case summary with a donut chart, red-flag list, and attorney recommendation ready for review.',
    },
  ]

  const canStart = true

  return (
    <div style={{ minHeight: '100svh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <nav style={{
        background: NAVY, padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>⚖️</div>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: '-0.3px' }}>CaseTake</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, marginTop: 2 }}>California • Case Screening</div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(150deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
        padding: 'clamp(40px,8vw,80px) 24px',
        textAlign: 'center', color: 'white',
      }}>
        <div style={{ fontSize: 52, marginBottom: 18, lineHeight: 1 }}>⚖️</div>
        <h1 style={{
          margin: '0 0 14px', color: 'white', fontWeight: 900,
          fontSize: 'clamp(26px, 5vw, 44px)', letterSpacing: '-0.8px', lineHeight: 1.15,
        }}>
          Workers' Comp Intake<br />Screening Tool
        </h1>
        <p style={{
          margin: '0 auto 36px', maxWidth: 560, fontSize: 17,
          opacity: 0.82, lineHeight: 1.65, color: 'white',
        }}>
          AI-powered intake interviews for California workers' compensation cases.
          Structured, thorough, and designed to surface what matters most before the attorney review.
        </p>

        <button
          onClick={canStart ? onStart : undefined}
          disabled={!canStart}
          style={{
            background: canStart ? 'white' : 'rgba(255,255,255,0.25)',
            color: canStart ? NAVY : 'rgba(255,255,255,0.45)',
            border: 'none', borderRadius: 10, padding: '14px 38px',
            fontSize: 16, fontWeight: 800, cursor: canStart ? 'pointer' : 'default',
            boxShadow: canStart ? '0 6px 24px rgba(0,0,0,0.25)' : 'none',
            transition: 'transform 0.12s, box-shadow 0.12s',
            letterSpacing: '-0.2px',
          }}
          onMouseOver={e => canStart && (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseOut={e => (e.currentTarget.style.transform = 'none')}
        >
          Start New Intake →
        </button>
      </div>

      {/* Feature cards */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(32px,5vw,56px) 24px', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: 13, padding: '26px 22px',
              boxShadow: '0 2px 14px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb',
            }}>
              <div style={{ fontSize: 32, marginBottom: 13 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: NAVY, marginBottom: 8, letterSpacing: '-0.2px' }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div style={{ textAlign: 'center', padding: '20px 24px', color: '#9ca3af', fontSize: 12 }}>
        © {new Date().getFullYear()} Picnic Peaks LLC. All rights reserved.
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,      setScreen]      = useState('landing')
  const [messages,    setMessages]    = useState([])   // { role, displayContent }
  const [input,       setInput]       = useState('')
  const [isLoading,   setIsLoading]   = useState(false)
  const [caseSummary, setCaseSummary] = useState(null)
  const [showModal,   setShowModal]   = useState(false)
  const [showBanner,  setShowBanner]  = useState(false)
  const [error,       setError]       = useState(null)

  const [feedback,          setFeedback]          = useState(() => { try { return JSON.parse(localStorage.getItem('ct_feedback') || '[]') } catch { return [] } })
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showPreForm,       setShowPreForm]       = useState(false)
  const preFormRef = useRef(null)

  const messagesEndRef  = useRef(null)
  const conversationRef = useRef([])   // full raw history sent to API
  const textareaRef     = useRef(null)
  const msgCounterRef   = useRef(0)
  const scriptedIdxRef  = useRef(-1)   // index of current scripted question (-1 = not started)

  // Re-focus textarea whenever a response finishes loading
  useEffect(() => {
    if (!isLoading) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [isLoading])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Feedback
  const feedbackMap = Object.fromEntries(feedback.map(f => [f.msgId, f]))

  const addFeedback = useCallback((msgId, fb) => {
    saveFeedback(fb)
    setFeedback(prev => {
      const updated = [...prev.filter(f => f.msgId !== msgId), { msgId, ...fb, timestamp: new Date().toISOString() }]
      localStorage.setItem('ct_feedback', JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearFeedback = useCallback(() => {
    setFeedback([])
    localStorage.removeItem('ct_feedback')
  }, [])

  // ── Core API call ──────────────────────────────────────────────────────────
  const callAPI = useCallback(async (history, preForm = preFormRef.current) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let res
    try {
      res = await fetch('https://jwtduvkobkfhdzcxxjhm.supabase.co/functions/v1/chat', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dGR1dmtvYmtmaGR6Y3h4amhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NDc3NzcsImV4cCI6MjA5NTUyMzc3N30.TycC97P5M_WC2lfOoh-7zoOgYxDQd1iUAZsQzZlwvV4',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          temperature: 0.2,
          system: getSystemPrompt(preForm, scriptedIdxRef.current),
          messages: history,
        }),
      })
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out after 30 s')
      throw new Error(`Network error: ${err.message}`)
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message || `API error ${res.status}`)
    }
    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }, [])

  // ── Send a user message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return
    setError(null)

    const userRaw = { role: 'user', content: text }
    const userMsg = { role: 'user', displayContent: text }

    setMessages(prev => [...prev, userMsg])
    const newHistory = [...conversationRef.current, userRaw]
    conversationRef.current = newHistory
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setIsLoading(true)
    try {
      const raw = await callAPI(newHistory)
      const hasNextQ = raw.includes('<next_question/>')
      const stripped = raw.replace(/<next_question\/>/g, '').trim()
      const { displayText, summary } = extractCaseSummary(stripped)

      const fullHistory = [...newHistory, { role: 'assistant', content: raw }]
      conversationRef.current = fullHistory

      const aiDisplay = displayText || stripped
      const aiMsgId   = `msg-${++msgCounterRef.current}`

      // Only render AI bubble if there's actual text content
      if (aiDisplay) {
        setMessages(prev => [...prev, { role: 'assistant', displayContent: aiDisplay, msgId: aiMsgId }])
      }

      if (summary) {
        // Case summary returned (e.g. 1099 hard stop mid-flow, or explicit trigger)
        setCaseSummary(summary)
        setShowBanner(true)
        saveCase(summary, fullHistory)
      } else if (hasNextQ) {
        // AI is satisfied with the current topic — advance to next scripted question
        const nextIdx = scriptedIdxRef.current + 1
        scriptedIdxRef.current = nextIdx

        if (nextIdx < SCRIPTED_QUESTIONS.length) {
          // Show the next scripted question (form or chat)
          setMessages(prev => [...prev, makeScriptedMsg(SCRIPTED_QUESTIONS[nextIdx])])
          // Don't add to conversationRef here — system prompt carries the current question context
        } else {
          // All 9 questions done — auto-trigger summary generation
          const triggerHistory = [
            ...fullHistory,
            { role: 'user', content: 'That covers all of the intake questions. Please generate the complete case summary now.' },
          ]
          conversationRef.current = triggerHistory
          const summaryRaw = await callAPI(triggerHistory)
          const { displayText: sumDisplay, summary: finalSummary } = extractCaseSummary(summaryRaw)
          const summaryHistory = [...triggerHistory, { role: 'assistant', content: summaryRaw }]
          conversationRef.current = summaryHistory

          const sumText = sumDisplay || summaryRaw.replace(/<case_summary>[\s\S]*?<\/case_summary>/g, '').trim()
          if (sumText) {
            setMessages(prev => [...prev, { role: 'assistant', displayContent: sumText, msgId: `msg-${++msgCounterRef.current}` }])
          }
          if (finalSummary) {
            setCaseSummary(finalSummary)
            setShowBanner(true)
            saveCase(finalSummary, summaryHistory)
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, callAPI])

  // ── Start intake ───────────────────────────────────────────────────────────
  const startIntake = useCallback(() => {
    setScreen('chat')
    setMessages([])
    conversationRef.current = []
    setCaseSummary(null)
    setShowBanner(false)
    setShowModal(false)
    setError(null)
    setInput('')
    preFormRef.current    = null
    scriptedIdxRef.current = -1
    setShowPreForm(true)
    setFeedback([])
    localStorage.removeItem('ct_feedback')
  }, [])

  const submitPreForm = useCallback((formData) => {
    preFormRef.current     = formData
    scriptedIdxRef.current = 0
    conversationRef.current = []
    msgCounterRef.current   = 0
    setShowPreForm(false)
    setMessages([makeScriptedMsg(SCRIPTED_QUESTIONS[0])])
  }, [])

  // Called by IntakeFormCard when a form is submitted
  const submitFormAnswer = useCallback((msgIdx, formattedText) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIdx ? { ...m, formSubmitted: true, formSummary: formattedText } : m
    ))
    sendMessage(formattedText)
  }, [sendMessage])

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetCase = useCallback(() => {
    setScreen('landing')
    setMessages([])
    conversationRef.current = []
    setCaseSummary(null)
    setShowBanner(false)
    setShowPreForm(false)
    preFormRef.current     = null
    scriptedIdxRef.current = -1
    setShowModal(false)
    setError(null)
    setInput('')
  }, [])

  // ── Textarea key handler ───────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Landing screen ─────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LandingScreen onStart={startIntake} />
    )
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', background: '#f8fafc', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        background: NAVY, height: 58,
        padding: '0 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚖️</span>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15, lineHeight: 1, letterSpacing: '-0.2px' }}>CaseTake</div>
            <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 10.5, marginTop: 2 }}>California • Case Screening</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {caseSummary && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: 'rgba(255,255,255,0.13)', color: 'white',
                border: '1.5px solid rgba(255,255,255,0.32)',
                borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '-0.1px',
              }}
            >
              View Report
            </button>
          )}
          <button
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            💬 Feedback
            {feedback.length > 0 && (
              <span style={{
                background: '#f59e0b', color: 'white', borderRadius: 10,
                fontSize: 10, fontWeight: 800, padding: '1px 6px', lineHeight: 1.5,
              }}>{feedback.length}</span>
            )}
          </button>
          <button
            onClick={resetCase}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.72)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            New Case
          </button>
        </div>
      </header>

      {/* Summary-ready banner */}
      {showBanner && (
        <div style={{
          background: '#16a34a', color: 'white',
          padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13.5, flexShrink: 0, animation: 'bannerSlide .3s ease',
        }}>
          <span>✅ Intake complete — case summary is ready.</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setShowModal(true); setShowBanner(false) }}
              style={{
                background: 'rgba(255,255,255,0.22)', color: 'white', border: 'none',
                borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700,
              }}
            >View Report →</button>
            <button
              onClick={() => setShowBanner(false)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: 19, lineHeight: 1 }}
            >×</button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#fef2f2', borderBottom: '1px solid #fecaca',
          padding: '9px 18px', fontSize: 13, color: '#dc2626', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}
          >×</button>
        </div>
      )}

      {/* Messages */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          {showPreForm && (
            <PreIntakeFormCard onSubmit={submitPreForm} />
          )}
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.isScripted && msg.formDef
                ? <IntakeFormCard
                    question={msg.formDef}
                    msgIdx={i}
                    formSubmitted={!!msg.formSubmitted}
                    formSummary={msg.formSummary}
                    onSubmit={submitFormAnswer}
                  />
                : msg.isScripted
                  ? <ScriptedQuestionBubble question={msg.displayContent} />
                  : <MessageBubble message={msg} />
              }
              {!msg.isScripted && msg.msgId && (
                <MessageFeedback
                  msgId={msg.msgId}
                  snippet={msg.displayContent}
                  feedbackMap={feedbackMap}
                  onSubmit={addFeedback}
                />
              )}
            </div>
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input bar */}
      {(() => {
        const lastMsg = messages[messages.length - 1]
        const formActive = !isLoading && !!lastMsg?.formDef && !lastMsg?.formSubmitted
        const inputDisabled = isLoading || formActive
        const placeholder = isLoading
          ? 'Waiting for response…'
          : formActive
            ? 'Fill out the form above ↑'
            : 'Type your response…'
        return (
      <footer style={{
        background: 'white', borderTop: '1px solid #e5e7eb',
        padding: '11px 16px 13px', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            disabled={inputDisabled}
            placeholder={placeholder}
            rows={1}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 148) + 'px'
            }}
            onKeyDown={handleKeyDown}
            onFocus={e  => (e.target.style.borderColor = NAVY)}
            onBlur={e   => (e.target.style.borderColor = '#d1d5db')}
            style={{
              flex: 1, resize: 'none',
              border: '1.5px solid #d1d5db', borderRadius: 10,
              padding: '10px 14px', fontSize: 15, fontFamily: 'inherit',
              lineHeight: 1.5, minHeight: 44, maxHeight: 148,
              overflowY: 'auto', background: inputDisabled ? '#f9fafb' : 'white',
              color: '#111827', transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={inputDisabled || !input.trim()}
            aria-label="Send message"
            style={{
              background: (!inputDisabled && input.trim()) ? NAVY : '#e5e7eb',
              color:      (!inputDisabled && input.trim()) ? 'white' : '#9ca3af',
              border: 'none', borderRadius: 10,
              width: 44, height: 44, flexShrink: 0,
              cursor: (!inputDisabled && input.trim()) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, transition: 'background 0.15s',
            }}
          >↑</button>
        </div>
        <div style={{ maxWidth: 740, margin: '5px auto 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#d1d5db' }}>© {new Date().getFullYear()} Picnic Peaks LLC. All rights reserved.</div>
          <div style={{ fontSize: 11, color: '#bfbfbf' }}>{formActive ? 'Submit the form above to continue' : 'Enter to send · Shift+Enter for new line'}</div>
        </div>
      </footer>
        )
      })()}

      {/* Modals */}
      {showModal        && <CaseSummaryModal summary={caseSummary} onClose={() => setShowModal(false)} />}
      {showFeedbackModal && <FeedbackLogModal feedback={feedback} onClose={() => setShowFeedbackModal(false)} onClear={clearFeedback} />}
    </div>
  )
}
