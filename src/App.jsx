import { useState, useRef, useEffect, useCallback } from 'react'
import { saveCase, saveFeedback } from './supabase.js'
import { t, getQuestions } from './translations.js'
import { onBrand } from './colorUtils.js'
import CaseSummaryView from './CaseSummaryView.jsx'

// ─── Brand ────────────────────────────────────────────────────────────────────
const NAVY       = '#1a2e4a'
const NAVY_MID   = '#243d5e'
const NAVY_LIGHT = '#2e4e78'


// Build a message object for a scripted question (form or chat).
// Stores only the question index so the current language is always looked up at render time.
function makeScriptedMsg(q) {
  if (q.type === 'form') {
    return { role: 'assistant', isScripted: true, questionIdx: q.idx, formSubmitted: false, formSummary: null }
  }
  return { role: 'assistant', isScripted: true, questionIdx: q.idx }
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

const getSystemPrompt = (preForm = null, scriptedIdx = 0, lang = 'en') => {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return buildSystemPrompt(today, preForm, scriptedIdx, lang)
}

function buildSystemPrompt(today, preForm, scriptedIdx, lang = 'en') {
  const needsJurisdictionReview = preForm?.jurisdictionStatus === 'review'
  const preCollected = preForm ? `
PRE-COLLECTED VIA INTAKE FORM (do not re-ask, re-confirm, or probe any of these — they are already settled):
- Employment type: ${preForm.employmentType === 'w2' ? 'W-2 employee (confirmed — do NOT ask about this again)' : preForm.employmentType === 'unsure' ? 'Unknown — client was unsure, gently verify during the Employment topic only' : 'W-2 employee (confirmed)'}
- Employer type: ${preForm.governmentType === 'state-local' ? 'State or local government' : preForm.governmentType === 'unsure' ? 'Unknown — confirm during intake' : 'Private employer'}
- Attorney representation: ${preForm.represented === 'yes' ? 'CURRENTLY REPRESENTED BY ANOTHER ATTORNEY — flag this prominently in your notes and in the summary recommendation' : preForm.represented === 'formerly' ? 'Previously had an attorney but no longer represented' : 'Not currently represented by an attorney'}
- Client residence: ${preForm.residenceCity}, ${preForm.residenceState}
- Injury location: ${preForm.injuryCity}, ${preForm.injuryState}
${preForm.primaryWorkState && preForm.primaryWorkState !== preForm.injuryState ? `- Primary work state: ${preForm.primaryWorkState}` : ''}\
${preForm.activity ? `\n- Activity at time of injury: ${ACTIVITY_LABELS[preForm.activity] ?? preForm.activity}` : ''}\
- CA jurisdiction basis: ${JURISDICTION_BASIS_LABELS[preForm.jurisdictionBasis] ?? 'Confirmed'}
${needsJurisdictionReview ? `\n⚠️ JURISDICTION FLAG: CA workers' comp coverage is not clearly established based on pre-screening. Flag this prominently in the final report and note it requires attorney review before filing.` : ''}\
` : ''

  const currentQ = (() => {
    const questions = getQuestions(lang)
    if (scriptedIdx < 0 || scriptedIdx >= questions.length) return ''
    const q = questions[scriptedIdx]
    if (q.type === 'form') {
      const fields = q.fields.map(f => f.label).join(', ')
      return `\nCURRENT TOPIC (question ${scriptedIdx + 1} of ${questions.length}): ${q.topic}
Type: Structured form submission. The client just submitted form data covering: ${fields}.
The submitted values are in the most recent user message. For most clean submissions, emit <next_question/> quickly after a brief acknowledgment. Only probe if there is a specific concern — e.g., invalid phone format, implausible date, or missing critical information.
`
    }
    return `\nCURRENT SCRIPTED QUESTION (question ${scriptedIdx + 1} of ${questions.length}):
"${q.text}"
This question has already been displayed to the client. Evaluate their response for completeness. Probe if vague or incomplete; emit <next_question/> when satisfied.
`
  })()

  const langInstruction = lang === 'es'
    ? 'LANGUAGE: This interview is in Spanish. You MUST respond entirely in Spanish at all times — no English whatsoever, even for legal terms. Use plain, clear Spanish appropriate for a client who may not have legal expertise.'
    : 'LANGUAGE: This interview is in English.'

  return `Today's date is ${today}.
${langInstruction}
${preCollected}${currentQ}
You are an intake follow-up specialist at a California workers' compensation law firm. The interview uses a scripted question system — fixed questions are shown to the client one at a time by the application. Your role is to:

1. Probe or clarify when the client's answer is vague, incomplete, inconsistent, or raises a concern
2. Signal readiness to advance by appending <next_question/> at the very end of your message when the current topic is fully addressed

RULES:
- Do NOT ask the scripted question yourself — it is already displayed to the client.
- Keep responses brief — one focused follow-up question at a time, or a short acknowledgment + <next_question/>.
- CRITICAL: NEVER include <next_question/> in the same message as a question. If you still need more information, send only your follow-up question — no tag. Only emit <next_question/> in a message that is a pure acknowledgment with zero remaining questions.
- Only include <next_question/> when you are fully satisfied the current topic is complete and you have nothing more to ask.
- Never ask multiple follow-up questions in one message.
- Be warm, professional, and empathetic.

PHONE NUMBER VALIDATION (Topic 1):
Silently validate the phone number. A valid US number has exactly 10 digits. If clearly invalid — wrong digit count or obvious typo — say: "That number doesn't look quite right — could you double-check it for me?" Otherwise accept it and emit <next_question/> when ready.

1099 HARD STOP:
Employment type was already screened before this interview began. Do NOT re-ask or re-confirm it unless the pre-collected data explicitly says the client was unsure. If it was confirmed as W-2, treat it as settled and move on. Only trigger this stop if the pre-collected data says "unsure" AND the client reveals during the Employment topic that they are in fact a 1099 contractor — in that case, warmly inform them the firm can only represent W-2 employees, thank them, and end the intake with a <case_summary> block reflecting the declination. Do NOT emit <next_question/>.

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
- Client is currently represented by another attorney on this claim (potential ethical conflict — flag prominently in summary and recommendation)
- Employer did not provide a DWC-1 claim form (required by LC § 5401 within 24 hours of injury notice) — possible claim suppression or uninsured employer
- No contact from an insurance adjuster despite time having passed — potential uninsured employer (UEBTF may apply) or claim was not filed with the insurer
- Claim formally denied by the insurance company (defense already established — note the stated reason)
- Insurance company has denied or delayed recommended medical treatment (Utilization Review denial — IMR deadline may apply)
- QME panel received but doctor not yet selected (10-day selection deadline is imminent or may have already passed — if missed, insurer selects)
- QME evaluation completed without attorney representation (client may have made statements or concessions without knowing the legal weight of the exam)
- QME / AME findings conflict with the treating physician's opinion (contested medical opinion — significant litigation risk)
- Treating solely through employer's MPN with no independent physician (employer controls medical evidence)
- Permanent & Stationary declared unusually early in the claim — before treatment could reasonably stabilize the condition

GENERATING THE CASE SUMMARY:
When instructed to generate the case summary, wrap up in one or two warm sentences, then output the complete JSON inside <case_summary> tags.

<case_summary>
{
  "intake_date": "Today's date as YYYY-MM-DD",
  "claimant": "Full legal name",
  "phone": "Phone number as confirmed by client",
  "email": "Email address",
  "attorney_represented": "Not represented | Currently represented by another attorney | Previously represented",
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
  "dwc1_provided": "Yes, submitted | Yes, not submitted | No | Unknown",
  "adjuster_contacted": "Yes | No | Unknown",
  "medical_facility": "Name of treating facility",
  "treating_doctor": "Doctor name",
  "first_treatment_date": "YYYY-MM-DD or description",
  "treating_type": "MPN doctor | Pre-designated personal doctor | ER only | None | Unknown",
  "claim_status": "Accepted | Denied | Pending | Unknown",
  "denial_reason": "Stated reason for denial, or 'N/A'",
  "treatment_denied": "Yes | No | Unknown — note what treatment was denied if known",
  "qme_stage": "None | Requested | Panel received | Scheduled | Completed | Unknown",
  "qme_findings": "Summary of evaluator outcome and agreement/disagreement with treating physician, or 'N/A'",
  "ps_declared": "Yes | No | Unknown",
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


// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      flexShrink: 0,
    }}>
      {/* 4-pointed sparkle + small accent — conveys AI without text */}
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" fill="white"/>
        <path d="M19 3L20 5L22 6L20 7L19 9L18 7L16 6L18 5Z" fill="rgba(255,255,255,0.5)"/>
      </svg>
    </div>
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

function MessageFeedback({ msgId, snippet, feedbackMap, onSubmit, language }) {
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
        <span style={{ fontSize: 11, color: '#9ca3af' }}>· {t[language].recorded}</span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 5, marginBottom: 14, marginLeft: 44 }}>
      {!expanded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 2 }}>{t[language].helpful}</span>
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
            placeholder={t[language].noteRequired}
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
          >{t[language].submit}</button>
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
          >✕</button>
        </div>
      )}
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

function PreIntakeFormCard({ onSubmit, language }) {
  const [step,             setStep]            = useState('employment')
  const [empType,          setEmpType]         = useState(null)    // 'w2' | '1099' | 'unsure'
  const [govType,          setGovType]         = useState(null)    // 'private' | 'state-local' | 'federal' | 'unsure'
  const [represented,      setRepresented]     = useState(null)    // 'no' | 'yes' | 'formerly'
  const [residenceCity,    setResidenceCity]   = useState('')
  const [residenceState,   setResidenceState]  = useState('California')
  const [injuryCity,       setInjuryCity]      = useState('')
  const [injuryState,      setInjuryState]     = useState('California')
  const [primaryWorkState, setPrimaryWorkState] = useState('California')
  const [activity,         setActivity]        = useState(null)    // 'working' | 'travel' | 'commuting' | 'other'
  const [exceptions,       setExceptions]      = useState({ traveling: null, vehicle: null, errand: null, ownVehicle: null })
  const [softStopBasis,    setSoftStopBasis]   = useState(null)

  const P  = t[language].pre
  const YN = t[language].yesno

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
      represented,
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
    setRepresented(null)
    setActivity(null); setExceptions({ traveling: null, vehicle: null, errand: null, ownVehicle: null })
  }

  // ── STEP: Employment eligibility ──────────────────────────────────────────
  if (step === 'employment') return (
    <PreFormBubble>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 3 }}>{P.beforeBeginTitle}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 }}>
        {P.beforeBeginSub}
      </div>

      <PreFormLabel>{P.empQ}</PreFormLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
        {[['w2', P.empW2], ['1099', P.emp1099], ['unsure', P.empUnsure]].map(([val, label]) => (
          <button key={val} style={sb(empType === val)} onClick={() => {
            setEmpType(val)
            if (val === '1099') setStep('stop-1099')
          }}>{label}</button>
        ))}
      </div>

      {(empType === 'w2' || empType === 'unsure') && (<>
        <PreFormLabel>{P.govQ}</PreFormLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {[['private', P.govPrivate], ['state-local', P.govState], ['federal', P.govFederal], ['unsure', P.govUnsure]].map(([val, label]) => (
            <button key={val} style={sb(govType === val)} onClick={() => {
              setGovType(val)
              if (val === 'federal') setStep('stop-federal')
            }}>{label}</button>
          ))}
        </div>
        {govType && govType !== 'federal' && (
          <button onClick={() => setStep('represented')} style={{
            background: NAVY, color: 'white', border: 'none', borderRadius: 9,
            padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>{P.nextBtn}</button>
        )}
      </>)}
    </PreFormBubble>
  )

  // ── STEP: Attorney representation ────────────────────────────────────────
  if (step === 'represented') return (
    <PreFormBubble>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 14 }}>{P.repQ}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
        {[['no', P.repNo], ['yes', P.repYes], ['formerly', P.repFormerly]].map(([val, label]) => (
          <button key={val} style={sb(represented === val)} onClick={() => setRepresented(val)}>{label}</button>
        ))}
      </div>
      {represented === 'yes' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.65, marginBottom: 14 }}>
          ⚠️ {P.repAdvisory}
        </div>
      )}
      {represented && (
        <button onClick={() => setStep('location')} style={{
          background: NAVY, color: 'white', border: 'none', borderRadius: 9,
          padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>{P.nextBtn}</button>
      )}
    </PreFormBubble>
  )

  // ── STOP: 1099 ────────────────────────────────────────────────────────────
  if (step === 'stop-1099') return (
    <PreFormBubble>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>{P.stop1099Title}</div>
      </div>
      <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
        {P.stop1099Body}
      </div>
      <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.65, marginBottom: 18 }}>
        <strong>{P.stop1099Misclass}</strong> {P.stop1099MisclassBody}
      </div>
      <button onClick={resetToStart} style={{ background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
        {P.startOver}
      </button>
    </PreFormBubble>
  )

  // ── STOP: Federal ─────────────────────────────────────────────────────────
  if (step === 'stop-federal') return (
    <PreFormBubble>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>ℹ️</span>
        <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>{P.stopFedTitle}</div>
      </div>
      <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
        {P.stopFedBody}
      </div>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#0c4a6e', lineHeight: 1.65, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>U.S. Dept. of Labor — Office of Workers' Compensation Programs</div>
        <div>Phone: <strong>1-866-692-7487</strong> (1-866-OWCP-IVR)</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>Monday – Friday, 8 AM – 5 PM local time</div>
      </div>
      <button onClick={resetToStart} style={{ background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
        {P.startOver}
      </button>
    </PreFormBubble>
  )

  // ── STEP: Location & circumstances ────────────────────────────────────────
  if (step === 'location') return (
    <PreFormBubble>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 16 }}>{P.locationTitle}</div>

      <PreFormLabel>{P.liveLabel}</PreFormLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input placeholder={P.cityPlaceholder} value={residenceCity} onChange={e => setResidenceCity(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')} />
        <select value={residenceState} onChange={e => setResidenceState(e.target.value)}
          style={{ ...inputStyle, width: 'auto', paddingRight: 28, cursor: 'pointer' }}
          onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')}>
          {US_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <PreFormLabel>{P.injuredLabel}</PreFormLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: outOfState ? 0 : 16 }}>
        <input placeholder={P.cityPlaceholder} value={injuryCity} onChange={e => setInjuryCity(e.target.value)}
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
            <span>ℹ️</span> {P.outOfStateNote}
          </div>

          <PreFormLabel>{P.primaryWorkState}</PreFormLabel>
          <select value={primaryWorkState} onChange={e => setPrimaryWorkState(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16, cursor: 'pointer' }}
            onFocus={e => (e.target.style.borderColor = NAVY)} onBlur={e => (e.target.style.borderColor = '#d1d5db')}>
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>

          <PreFormLabel>{P.actQ}</PreFormLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 6 }}>
            {[
              ['working',   '🏗',  P.actWorking],
              ['travel',    '✈️', P.actTravel],
              ['commuting', '🚗',  P.actCommuting],
              ['other',     '❓',  P.actOther],
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
      }}>{P.startBtn}</button>
    </PreFormBubble>
  )

  // ── STEP: Going-and-coming exception check ────────────────────────────────
  if (step === 'commuting-check') {
    return (
      <PreFormBubble>
        <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 4 }}>{P.commutingTitle}</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, marginBottom: 18 }}>
          {P.commutingExcSub}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {['traveling', 'vehicle', 'errand', 'ownVehicle'].map((key, i) => (
            <div key={key}>
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{P.commuting[i]}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                {[[true, YN.yes], [false, YN.no]].map(([val, label]) => (
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
            {isCommuting ? P.softStopCommutingTitle : P.softStopJurTitle}
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
          {isCommuting
            ? P.softStopCommutingBody
            : P.softStopJurBody.replace(/{state}/g, injuryState)
          }
        </div>
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.65, marginBottom: 18 }}>
          {P.softStopNote}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => doSubmit('review', softStopBasis)} style={{
            background: NAVY, color: 'white', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{P.softStopContinueFlag}</button>
          <button onClick={resetToStart} style={{
            background: 'none', border: '1.5px solid #d1d5db', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, cursor: 'pointer', color: '#374151',
          }}>{P.startOver}</button>
        </div>
      </PreFormBubble>
    )
  }

  return null
}

// ─── IntakeFormCard ───────────────────────────────────────────────────────────

function IntakeFormCard({ question, msgIdx, formSubmitted, formSummary, onSubmit, language }) {
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
                  {opt === 'yes' ? t[language].yesno.yes : opt === 'no' ? t[language].yesno.no : t[language].yesno.unsure}
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
          {t[language].submitted}
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
        }}>{t[language].submit} →</button>
      </div>
    </div>
  )
}

// ─── ScriptedQuestionBubble ───────────────────────────────────────────────────

function ScriptedQuestionBubble({ question, language }) {
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
          {t[language].intakeQuestion}
        </div>
        <div style={{ color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {question}
        </div>
      </div>
    </div>
  )
}

// ─── LandingScreen ────────────────────────────────────────────────────────────

function LandingScreen({ onStart, language, firm = null }) {
  const L     = t[language].landing
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  return (
    <div style={{ minHeight: '100svh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <nav style={{
        background: BRAND, padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {firm?.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 36, maxWidth: 160, objectFit: 'contain' }} />
            : <>
                <div style={{
                  width: 38, height: 38, borderRadius: 9,
                  background: ON.btnBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>⚖️</div>
                <div>
                  <div style={{ color: ON.text, fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: '-0.3px' }}>
                    {firm?.name ?? 'CaseTake'}
                  </div>
                  <div style={{ color: ON.textMuted, fontSize: 11.5, marginTop: 2 }}>{L.tagline}</div>
                </div>
              </>
          }
        </div>
        {firm && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'white', borderRadius: 20,
            padding: '4px 10px 4px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}>
            <span style={{ fontSize: 13 }}>⚖️</span>
            <span style={{ color: '#1a2e4a', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em' }}>
              Powered by CaseTake
            </span>
          </div>
        )}
      </nav>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(150deg, ${BRAND} 0%, ${BRAND} 100%)`,
        padding: 'clamp(40px,8vw,80px) 24px',
        textAlign: 'center', color: 'white',
      }}>
        <div style={{ fontSize: 52, marginBottom: 18, lineHeight: 1 }}>⚖️</div>
        <h1 style={{
          margin: '0 0 14px', color: 'white', fontWeight: 900,
          fontSize: 'clamp(26px, 5vw, 44px)', letterSpacing: '-0.8px', lineHeight: 1.15,
          whiteSpace: 'pre-line',
        }}>
          {L.title}
        </h1>
        <p style={{
          margin: '0 auto 36px', maxWidth: 560, fontSize: 17,
          opacity: 0.82, lineHeight: 1.65, color: 'white',
        }}>
          {L.subtitle}
        </p>

        <button
          onClick={onStart}
          style={{
            background: 'white', color: NAVY,
            border: 'none', borderRadius: 10, padding: '14px 38px',
            fontSize: 16, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            transition: 'transform 0.12s, box-shadow 0.12s',
            letterSpacing: '-0.2px',
          }}
          onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseOut={e => (e.currentTarget.style.transform = 'none')}
        >
          {L.startBtn}
        </button>
      </div>

      {/* Feature cards */}
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(32px,5vw,56px) 24px', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
        }}>
          {L.features.map((f, i) => (
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

export default function App({ firm = null, demo = false }) {
  // Firm-aware brand values
  const BRAND     = firm?.primary_color ?? NAVY
  const BRAND_MID = firm?.primary_color ?? NAVY_MID
  const ON        = onBrand(BRAND)

  const showAbout = new URLSearchParams(window.location.search).has('about')

  const [screen,      setScreen]      = useState(showAbout ? 'landing' : 'chat')
  const [messages,    setMessages]    = useState([])   // { role, displayContent }
  const [input,       setInput]       = useState('')
  const [isLoading,   setIsLoading]   = useState(false)
  const [showBanner,  setShowBanner]  = useState(false)
  const [caseId,      setCaseId]      = useState(null)   // UUID returned after save — for View Report link
  const [showReport,  setShowReport]  = useState(false)  // demo: reveal inline report
  const [error,       setError]       = useState(null)

  const [feedback,    setFeedback]    = useState(() => { try { return JSON.parse(localStorage.getItem('ct_feedback') || '[]') } catch { return [] } })
  const [showPreForm, setShowPreForm] = useState(!showAbout)  // start intake immediately if not ?about
  const [language,    setLanguage]    = useState('en')
  const preFormRef    = useRef(null)
  const languageRef   = useRef('en')

  // Keep languageRef in sync with state for use inside callbacks
  useEffect(() => { languageRef.current = language }, [language])

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
    saveFeedback({ ...fb, firmSlug: firm?.slug ?? null })
    setFeedback(prev => {
      const updated = [...prev.filter(f => f.msgId !== msgId), { msgId, ...fb, timestamp: new Date().toISOString() }]
      localStorage.setItem('ct_feedback', JSON.stringify(updated))
      return updated
    })
  }, [firm?.slug])

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
          system: getSystemPrompt(preForm, scriptedIdxRef.current, languageRef.current),
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

      // Guard: if the AI's text ends with a question it hasn't finished probing —
      // block advancement even if <next_question/> accidentally slipped in.
      const endsWithQuestion = aiDisplay.trimEnd().endsWith('?')
      const shouldAdvance = hasNextQ && !endsWithQuestion

      // Only render AI bubble if there's actual text content
      if (aiDisplay) {
        setMessages(prev => [...prev, { role: 'assistant', displayContent: aiDisplay, msgId: aiMsgId }])
      }

      if (summary) {
        // Case summary returned (e.g. 1099 hard stop mid-flow, or explicit trigger)
        const { id } = await saveCase(summary, fullHistory, firm?.slug ?? null)
        setCaseId(id)
        setShowBanner(true)
        if (demo && id) setTimeout(() => setShowReport(true), 1200)
      } else if (shouldAdvance) {
        // AI is satisfied with the current topic — advance to next scripted question
        const nextIdx = scriptedIdxRef.current + 1
        scriptedIdxRef.current = nextIdx

        const questions = getQuestions(languageRef.current)
        if (nextIdx < questions.length) {
          // Delay so the AI's acknowledgment bubble renders before the next question card appears
          setTimeout(() => {
            setMessages(prev => [...prev, makeScriptedMsg(questions[nextIdx])])
          }, 500)
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
            const { id } = await saveCase(finalSummary, summaryHistory, firm?.slug ?? null)
            setCaseId(id)
            setShowBanner(true)
            if (demo && id) setTimeout(() => setShowReport(true), 1200)
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
    setShowBanner(false)
    setCaseId(null)
    setError(null)
    setInput('')
    preFormRef.current     = null
    scriptedIdxRef.current = -1
    setShowPreForm(true)
  }, [])

  const submitPreForm = useCallback((formData) => {
    preFormRef.current     = formData
    scriptedIdxRef.current = 0
    conversationRef.current = []
    msgCounterRef.current   = 0
    setShowPreForm(false)
    setMessages([makeScriptedMsg(getQuestions(languageRef.current)[0])])
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
    setScreen('chat')
    setMessages([])
    conversationRef.current = []
    setShowBanner(false)
    setCaseId(null)
    setShowPreForm(true)
    preFormRef.current     = null
    scriptedIdxRef.current = -1
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
      <LandingScreen onStart={startIntake} language={language} firm={firm} />
    )
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: showReport ? 'auto' : '100svh', minHeight: '100svh', background: '#f8fafc', overflow: showReport ? 'visible' : 'hidden' }}>

      {/* Header */}
      <header style={{
        background: BRAND, height: 58,
        padding: '0 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firm?.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 34, maxWidth: 140, objectFit: 'contain' }} />
            : <>
                <span style={{ fontSize: 20 }}>⚖️</span>
                <div>
                  <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1, letterSpacing: '-0.2px' }}>
                    {firm?.name ?? 'CaseTake'}
                  </div>
                  <div style={{ color: ON.textMuted, fontSize: 10.5, marginTop: 2 }}>
                    {firm?.tagline ?? 'California • Case Screening'}
                  </div>
                </div>
              </>
          }
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {firm && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'white', borderRadius: 20,
              padding: '4px 10px 4px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              marginRight: 4,
            }}>
              <span style={{ fontSize: 12 }}>⚖️</span>
              <span style={{ color: '#1a2e4a', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                Powered by CaseTake
              </span>
            </div>
          )}
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')}
            style={{
              background: ON.btnBg, color: ON.btnText,
              border: `1.5px solid ${ON.btnBorder}`,
              borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >{t[language].langToggle}</button>
          <button
            onClick={resetCase}
            style={{
              background: 'transparent', color: ON.btnText,
              border: `1.5px solid ${ON.btnBorder}`,
              borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t[language].newCase}
          </button>
        </div>
      </header>

      {/* Demo banner */}
      {demo && (
        <div style={{
          background: '#f59e0b', color: '#111',
          padding: '7px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 700, flexShrink: 0, gap: 10, letterSpacing: '0.01em',
        }}>
          <span>🎬 DEMO MODE</span>
          <span style={{ fontWeight: 400, opacity: 0.7 }}>—</span>
          <span style={{ fontWeight: 500 }}>Complete the intake to see the attorney report</span>
          <a href="/" style={{ marginLeft: 8, color: '#111', opacity: 0.55, fontSize: 11.5, fontWeight: 600 }}>← Back to home</a>
        </div>
      )}

      {/* Completion banner */}
      {showBanner && (
        <div style={{
          background: '#16a34a', color: 'white',
          padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13.5, flexShrink: 0, animation: 'bannerSlide .3s ease', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span>✅ {t[language].intakeComplete}</span>
            {caseId && (
              <a
                href={firm?.slug ? `?firm=${encodeURIComponent(firm.slug)}&case=${caseId}` : `?case=${caseId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'white', fontWeight: 700, fontSize: 13,
                  background: 'rgba(255,255,255,0.2)', borderRadius: 6,
                  padding: '3px 11px', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >View Report →</a>
            )}
          </div>
          <button
            onClick={() => setShowBanner(false)}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: 19, lineHeight: 1, flexShrink: 0 }}
          >×</button>
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
            <PreIntakeFormCard onSubmit={submitPreForm} language={language} />
          )}
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.isScripted
                ? (() => {
                    const q = getQuestions(language)[msg.questionIdx]
                    if (!q) return null
                    return q.type === 'form'
                      ? <IntakeFormCard
                          question={q}
                          msgIdx={i}
                          formSubmitted={!!msg.formSubmitted}
                          formSummary={msg.formSummary}
                          onSubmit={submitFormAnswer}
                          language={language}
                        />
                      : <ScriptedQuestionBubble question={q.text} language={language} />
                  })()
                : <MessageBubble message={msg} />
              }
              {!msg.isScripted && msg.msgId && (
                <MessageFeedback
                  msgId={msg.msgId}
                  snippet={msg.displayContent}
                  feedbackMap={feedbackMap}
                  onSubmit={addFeedback}
                  language={language}
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
        const lastQ = lastMsg?.isScripted ? getQuestions(language)[lastMsg.questionIdx] : null
        const formActive = !isLoading && lastQ?.type === 'form' && !lastMsg?.formSubmitted
        const inputDisabled = isLoading || formActive
        const T = t[language]
        const placeholder = isLoading
          ? T.waiting
          : formActive
            ? T.fillForm
            : T.typeResponse
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
          <div style={{ fontSize: 11, color: '#bfbfbf' }}>{formActive ? T.fillForm : T.enterToSend}</div>
        </div>
      </footer>
        )
      })()}

    </div>

    {/* ── Demo: inline report reveal ── */}
    {demo && showReport && caseId && (
      <div style={{ animation: 'demoSlideIn 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <style>{`@keyframes demoSlideIn { from { opacity:0; transform:translateY(32px) } to { opacity:1; transform:translateY(0) } }`}</style>

        {/* Demo CTA banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1a2e4a 0%, #243d5e 100%)',
          padding: '36px clamp(20px,5vw,60px)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            🎉 You just completed a full CaseTake intake
          </div>
          <div style={{ fontWeight: 900, fontSize: 'clamp(22px,4vw,32px)', color: 'white', letterSpacing: '-0.5px', marginBottom: 12 }}>
            This is the exact report your attorney team receives
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 28px' }}>
            Viability score, red flags, full case summary — delivered in under 10 minutes,
            with one-click accept to Fluent Case. No phone calls. No wasted consults.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:hello@picnicpeaks.com" style={{
              background: '#f59e0b', color: '#111', fontWeight: 800, fontSize: 15,
              textDecoration: 'none', padding: '14px 32px', borderRadius: 10,
              boxShadow: '0 4px 20px rgba(245,158,11,0.5)',
            }}>Get CaseTake for my firm →</a>
            <a href="/" style={{
              background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, fontSize: 14,
              textDecoration: 'none', padding: '14px 24px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
            }}>← Back to home</a>
          </div>
        </div>

        {/* The actual report */}
        <CaseSummaryView caseId={caseId} demo={true} />
      </div>
    )}
    </>
  )
}
