import { useState, useRef, useEffect, useCallback } from 'react'
import { saveCase } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY = '#1a2e4a'

// ── Scripted Questions ─────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    idx: 0, type: 'form', topic: 'Client Information',
    intro: "Let's start with some basic information about you and your case.",
    fields: [
      { key: 'name',         label: 'Full Legal Name',               type: 'text', required: true,  placeholder: 'First Last' },
      { key: 'phone',        label: 'Phone Number',                  type: 'tel',  required: true,  placeholder: '(555) 555-5555' },
      { key: 'doi',          label: 'Date of Injury (Primary Case)', type: 'date', required: true  },
      { key: 'claim_number', label: 'Claim / Case Number',           type: 'text', required: false, placeholder: 'Optional — skip if unknown' },
    ],
  },
  {
    idx: 1, type: 'form', topic: 'Legal / Immigration Status',
    intro: 'We need to confirm your legal status. This determines which documents are required for your SIBTF petition.',
    fields: [
      { key: 'legal_status', label: 'Are you a U.S. citizen or legal permanent resident?', type: 'yesno', required: true },
    ],
  },
  {
    // Shown only if legal_status = yes
    idx: 2, type: 'form', topic: 'Social Security Benefits & Documentation',
    intro: 'Please tell us about your Social Security, SSDI, or SSI status and what documentation you currently have available.',
    fields: [
      {
        key: 'ssa_status', label: 'What is your SS / SSDI / SSI benefit status?',
        type: 'select', required: true,
        options: [
          'Never received SS / SSDI / SSI benefits',
          'Currently receiving SSDI or SSI',
          'Received SSDI / SSI in the past — no longer receiving',
        ],
      },
      // If never received ─────────────────────────────────────────────────────
      {
        key: 'benefit_verification_letter',
        label: 'Do you have a Benefit Verification Letter from Social Security stating no SS/SSDI benefits were paid or applied for?',
        type: 'yesno', required: true, includeUnsure: true,
        conditionKey: 'ssa_status', conditionValues: ['Never received SS / SSDI / SSI benefits'],
      },
      // If currently / previously received ────────────────────────────────────
      {
        key: 'ssdi_award_notice',
        label: 'Do you have your Notice of SSDI Award and/or SSDI Benefit Verification Letter?',
        type: 'yesno', required: true, includeUnsure: true,
        conditionKey: 'ssa_status',
        conditionValues: ['Currently receiving SSDI or SSI', 'Received SSDI / SSI in the past — no longer receiving'],
      },
      {
        key: 'ssdi_1099s',
        label: 'Do you have 1099s from when SSDI payments started through the current year? (SSDI payments only)',
        type: 'yesno', required: true, includeUnsure: true,
        conditionKey: 'ssa_status',
        conditionValues: ['Currently receiving SSDI or SSI', 'Received SSDI / SSI in the past — no longer receiving'],
      },
      {
        key: 'current_year_rate',
        label: 'Do you have your 2026 Current Year Rate information (SSDI and/or SSI)?',
        type: 'yesno', required: true, includeUnsure: true,
        conditionKey: 'ssa_status',
        conditionValues: ['Currently receiving SSDI or SSI', 'Received SSDI / SSI in the past — no longer receiving'],
      },
      {
        key: 'consent_for_release',
        label: 'Have you already signed an Undated Consent for Release of Information?',
        type: 'yesno', required: true,
        conditionKey: 'ssa_status',
        conditionValues: ['Currently receiving SSDI or SSI', 'Received SSDI / SSI in the past — no longer receiving'],
      },
    ],
  },
  {
    idx: 3, type: 'form', topic: 'Pension',
    intro: 'We need to gather information about your pension release and any current pension benefits.',
    fields: [
      { key: 'pension_release_signed', label: 'Have you signed an Undated Pension Release form?',  type: 'yesno',    required: true },
      { key: 'receiving_pension',      label: 'Are you currently receiving any pension benefits?', type: 'yesno',    required: true },
      {
        key: 'pension_details', label: 'Please describe your pension (source and approximate monthly amount)',
        type: 'textarea', required: true, placeholder: 'e.g., City of LA pension, ~$1,200/month',
        conditionKey: 'receiving_pension', conditionValue: 'yes',
      },
    ],
  },
  {
    idx: 4, type: 'form', topic: 'CALPERs',
    intro: "Are you a member of CALPERs (California Public Employees' Retirement System)?",
    fields: [
      { key: 'calpers_member', label: 'Are you a CALPERs member?', type: 'yesno', required: true },
    ],
  },
  {
    idx: 5, type: 'text', topic: 'Motor Vehicle Accident (MVA) Settlements',
    text: 'Have you ever received a financial settlement from a motor vehicle accident at any point in your lifetime?',
  },
  {
    idx: 6, type: 'text', topic: 'Work History',
    text: 'Have you been working in the past 10 years — or since your date of injury, if that was less than 10 years ago?',
  },
]

// ── System Prompt ──────────────────────────────────────────────────────────────

function getSIBTFSystemPrompt(scriptedIdx, skipSSA = false) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const currentQ = (() => {
    if (scriptedIdx < 0 || scriptedIdx >= QUESTIONS.length) return ''
    const q = QUESTIONS[scriptedIdx]
    const qNum = scriptedIdx + 1
    const total = skipSSA ? QUESTIONS.length - 1 : QUESTIONS.length
    if (q.type === 'form') {
      const fields = q.fields.map(f => f.label).join(', ')
      return `\nCURRENT TOPIC (question ${qNum} of ${total}): ${q.topic}
Type: Structured form submission. The client just submitted form data covering: ${fields}.
Acknowledge briefly and emit <next_question/> unless you need to probe a specific concern (e.g., missing required document, "no" on a required signature).
${scriptedIdx === 2 && skipSSA ? '\nNOTE: This client is not a legal U.S. resident — briefly note that Affidavit re Status is required and the SSA section does not apply to them, then emit <next_question/> immediately.' : ''}`
    }
    return `\nCURRENT SCRIPTED QUESTION (question ${qNum} of ${total}): "${q.text}"
This question is already displayed to the client. Evaluate their response; probe if vague or incomplete. Emit <next_question/> when satisfied.`
  })()

  return `Today's date is ${today}.
LANGUAGE: This interview is in English.
${currentQ}

You are an intake specialist gathering information for a SIBTF (Subsequent Injuries Benefits Trust Fund) petition in California. SIBTF provides additional compensation when a new work injury combines with a pre-existing permanent disability to produce a greater combined disability than the current injury alone.

SIBTF DOCUMENT CHECKLIST — use this to probe for missing items and note what still needs to be obtained:

Legal Status
• If NOT a legal U.S. resident → Affidavit re Status required. SSA section does not apply.

SSA Documentation (legal clients only)
• If NEVER received SS/SSDI → Benefit Verification Letter from SSA ("no ss/ssdi benefits paid or applied for")
  - If client doesn't have it: advise them to log in to ssa.gov or visit their local SS office
• If currently OR previously received SSDI/SSI — ALL of the following are required:
  a) Notice of SSDI Award and/or SSDI Benefit Verification Letter
  b) 1099s from start of SSDI payments through current year (SSDI only)
  c) 2026+ Current Year Rate information (SSDI and SSI)
  d) Signed Undated Consent for Release of Information — if NOT signed, note they must sign one

Pension
• Signed Undated Pension Release required — if NOT signed, note they must sign one
• Document if currently receiving pension benefits (source and amount)

CALPERs
• If member → Signed Undated CALPERS Release required

MVA Settlements
• If received → need settlement documents or dollar estimate

Work History (past 10 years, or since DOI if less)
• Years worked, full or part time, any new work injuries?

RULES:
- Do NOT repeat the scripted question — it is already displayed to the client.
- CRITICAL: NEVER include <next_question/> in the same message as a question. If you still need more information, send only the follow-up question with no tag. Only emit <next_question/> in a message that is a pure acknowledgment with zero remaining questions.
- Only emit <next_question/> when fully satisfied the current topic is complete.
- When a required signature is missing, clearly note it (e.g., "We'll need you to sign the Pension Release — we can take care of that at your appointment.").
- Keep responses brief, warm, and professional.

GENERATING THE SIBTF SUMMARY:
When instructed to generate the summary, wrap up in one or two sentences, then output the complete JSON inside <case_summary> tags.

<case_summary>
{
  "type": "sibtf",
  "viability_label": "SIBTF",
  "intake_date": "YYYY-MM-DD",
  "claimant": "Full legal name",
  "phone": "Phone number as confirmed",
  "doi": "Date of injury as YYYY-MM-DD",
  "claim_number": "Claim/case number or 'Not provided'",
  "legal_status": "Legal | Not Legal",
  "affidavit_re_status_needed": "Yes | No",
  "ssa_status": "Never received | Currently receiving SSDI/SSI | Previously received | N/A (not legal)",
  "benefit_verification_letter": "Client has it | Needs to obtain | N/A",
  "ssdi_award_notice": "Client has it | Missing | N/A",
  "ssdi_1099s": "Client has it | Missing | N/A",
  "current_year_rate": "Client has it | Missing | N/A",
  "consent_for_release": "Already signed | Must sign | N/A",
  "pension_release_signed": "Yes | No — must sign",
  "receiving_pension": "Yes | No",
  "pension_details": "Details or N/A",
  "calpers_member": "Yes | No",
  "calpers_release_needed": "Yes | No",
  "mva_settlement": "Yes | No",
  "mva_details": "Settlement details or N/A",
  "work_history_10yr": "Yes | No",
  "work_years": "Description or N/A",
  "work_schedule": "Full time | Part time | Both | N/A",
  "new_work_injuries": "Yes | No | N/A",
  "new_injury_details": "Description or N/A",
  "documents_needed": ["list every document or signature still required — empty array if none"],
  "notes": "Any additional relevant information"
}
</case_summary>`
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── UI helpers ─────────────────────────────────────────────────────────────────

function AiAvatar() {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: NAVY,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" fill="white"/>
        <path d="M19 3L20 5L22 6L20 7L19 9L18 7L16 6L18 5Z" fill="rgba(255,255,255,0.5)"/>
      </svg>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
      <AiAvatar />
      <div style={{ background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '13px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#9ca3af',
            animation: 'bounce 1.3s ease-in-out infinite', animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function applyInline(text) {
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
    out.push(<ul key={`ul${k++}`} style={{ paddingLeft: 20, margin: '4px 0' }}>{listItems.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{applyInline(s)}</li>)}</ul>)
    listItems = []
  }
  lines.forEach(line => {
    const bullet = line.match(/^[-*] (.*)/)
    if (bullet) { listItems.push(bullet[1]); return }
    flushList()
    out.push(<span key={k++}>{applyInline(line)}</span>, <br key={k++} />)
  })
  flushList()
  if (out.length && out[out.length - 1]?.type === 'br') out.pop()
  return out
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 10, marginBottom: 14,
      paddingLeft: isUser ? 56 : 0, paddingRight: isUser ? 0 : 56,
      animation: 'msgFadeIn .22s ease',
    }}>
      {!isUser && <AiAvatar />}
      <div style={{
        background: isUser ? NAVY : '#f3f4f6',
        color: isUser ? 'white' : '#111827',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '11px 16px', fontSize: 15, lineHeight: 1.55,
        maxWidth: '100%', wordBreak: 'break-word',
      }}>
        {isUser ? message.displayContent : renderMarkdown(message.displayContent)}
      </div>
    </div>
  )
}

function ScriptedQuestionBubble({ question }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{
        background: '#f0f4ff', border: '1px solid #c7d2fe',
        borderRadius: '18px 18px 18px 4px', padding: '11px 16px',
        fontSize: 15, lineHeight: 1.55, maxWidth: '100%',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
          SIBTF Question
        </div>
        <div style={{ color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{question}</div>
      </div>
    </div>
  )
}

// ── IntakeFormCard ─────────────────────────────────────────────────────────────

function IntakeFormCard({ question, msgIdx, formSubmitted, onSubmit }) {
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
    const fmtDate = (v) => { const d = new Date(v + 'T12:00:00'); return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
    const lines = question.fields
      .filter(f => isVisible(f))
      .map(f => {
        const v = values[f.key]
        if (v === undefined || v === null || String(v).trim() === '') return null
        return `${f.label}: ${f.type === 'date' ? fmtDate(v) : v}`
      }).filter(Boolean)
    onSubmit(msgIdx, lines.join('\n'), values)
  }

  const inputBase = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', color: '#111827', background: 'white',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  }

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
                  {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'Not sure'}
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
          style={{ ...inputBase, cursor: 'pointer' }}
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

  if (formSubmitted) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '18px 18px 18px 4px', padding: '10px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{question.topic}</div>
        <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>✓ Submitted</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14, paddingRight: 56, animation: 'msgFadeIn .22s ease' }}>
      <AiAvatar />
      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{question.topic}</div>
        <div style={{ fontSize: 13.5, color: '#374151', marginBottom: 14, lineHeight: 1.55 }}>{question.intro}</div>
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

// ── Intro Card ─────────────────────────────────────────────────────────────────

function SIBTFIntroCard({ onBegin, firm }) {
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16, paddingRight: 56, animation: 'msgFadeIn .3s ease' }}>
      <AiAvatar />
      <div style={{ background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '20px 22px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          SIBTF — Subsequent Injuries Benefits Trust Fund
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 8 }}>
          Welcome to the SIBTF Information Gathering Process
        </div>
        <div style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65, marginBottom: 18 }}>
          This interview will guide you through the information and documentation needed to process your SIBTF petition.
          It covers your legal status, Social Security / SSDI records, pension details, CALPERs membership, any motor vehicle
          settlements, and your recent work history.
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.6, marginBottom: 18 }}>
          💡 Have any relevant documents handy if you can — it will help us give you the most accurate checklist.
        </div>
        <button onClick={onBegin} style={{
          background: BRAND, color: ON.text,
          border: 'none', borderRadius: 9, padding: '11px 28px',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 3px 12px ${BRAND}44`,
        }}>
          Begin SIBTF Process →
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SIBTFView({ firm = null }) {
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  const [showIntro,  setShowIntro]  = useState(true)
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [isLoading,  setIsLoading]  = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [caseId,     setCaseId]     = useState(null)
  const [error,      setError]      = useState(null)

  const messagesEndRef  = useRef(null)
  const conversationRef = useRef([])
  const textareaRef     = useRef(null)
  const msgCounterRef   = useRef(0)
  const scriptedIdxRef  = useRef(-1)
  const skipSSARef      = useRef(false)

  useEffect(() => {
    if (!isLoading) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [isLoading])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const makeMsg = (q) => {
    if (q.type === 'form') return { role: 'assistant', isScripted: true, questionIdx: q.idx, formSubmitted: false }
    return { role: 'assistant', isScripted: true, questionIdx: q.idx }
  }

  // ── API call ─────────────────────────────────────────────────────────────────
  const callAPI = useCallback(async (history) => {
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
          system: getSIBTFSystemPrompt(scriptedIdxRef.current, skipSSARef.current),
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

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return
    setError(null)

    const userMsg = { role: 'user', displayContent: text }
    setMessages(prev => [...prev, userMsg])
    const newHistory = [...conversationRef.current, { role: 'user', content: text }]
    conversationRef.current = newHistory
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setIsLoading(true)
    try {
      const raw      = await callAPI(newHistory)
      const hasNextQ = raw.includes('<next_question/>')
      const stripped = raw.replace(/<next_question\/>/g, '').trim()
      const { displayText, summary } = extractCaseSummary(stripped)

      const fullHistory = [...newHistory, { role: 'assistant', content: raw }]
      conversationRef.current = fullHistory

      const aiDisplay        = displayText || stripped
      const endsWithQuestion = aiDisplay.trimEnd().endsWith('?')
      const shouldAdvance    = hasNextQ && !endsWithQuestion

      if (aiDisplay) {
        setMessages(prev => [...prev, { role: 'assistant', displayContent: aiDisplay, msgId: `msg-${++msgCounterRef.current}` }])
      }

      if (summary) {
        const { id } = await saveCase(summary, fullHistory, firm?.slug ?? null)
        setCaseId(id)
        setShowBanner(true)
      } else if (shouldAdvance) {
        let nextIdx = scriptedIdxRef.current + 1
        // Skip SSA block (idx 2) for non-legal clients
        if (nextIdx === 2 && skipSSARef.current) nextIdx = 3
        scriptedIdxRef.current = nextIdx

        if (nextIdx < QUESTIONS.length) {
          setTimeout(() => {
            setMessages(prev => [...prev, makeMsg(QUESTIONS[nextIdx])])
          }, 500)
        } else {
          // All questions done — trigger summary
          const triggerHistory = [
            ...fullHistory,
            { role: 'user', content: 'That covers all the questions. Please generate the complete SIBTF summary now.' },
          ]
          conversationRef.current = triggerHistory
          const summaryRaw = await callAPI(triggerHistory)
          const { displayText: sumDisplay, summary: finalSummary } = extractCaseSummary(summaryRaw)
          conversationRef.current = [...triggerHistory, { role: 'assistant', content: summaryRaw }]

          const sumText = sumDisplay || summaryRaw.replace(/<case_summary>[\s\S]*?<\/case_summary>/g, '').trim()
          if (sumText) setMessages(prev => [...prev, { role: 'assistant', displayContent: sumText, msgId: `msg-${++msgCounterRef.current}` }])
          if (finalSummary) {
            const { id } = await saveCase(finalSummary, conversationRef.current, firm?.slug ?? null)
            setCaseId(id)
            setShowBanner(true)
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, callAPI])

  // ── Begin (dismiss intro) ─────────────────────────────────────────────────────
  const handleBegin = useCallback(() => {
    setShowIntro(false)
    scriptedIdxRef.current = 0
    setMessages([makeMsg(QUESTIONS[0])])
  }, [])

  // ── Form submitted ────────────────────────────────────────────────────────────
  const submitFormAnswer = useCallback((msgIdx, formattedText, rawValues) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIdx ? { ...m, formSubmitted: true } : m
    ))
    // Track legal status from Q1 to conditionally skip SSA (Q2)
    if (scriptedIdxRef.current === 1 && rawValues?.legal_status === 'no') {
      skipSSARef.current = true
    }
    sendMessage(formattedText)
  }, [sendMessage])

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetCase = useCallback(() => {
    setShowIntro(true)
    setMessages([])
    conversationRef.current = []
    setShowBanner(false)
    setCaseId(null)
    setError(null)
    setInput('')
    scriptedIdxRef.current = -1
    skipSSARef.current     = false
    msgCounterRef.current  = 0
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const lastMsg   = messages[messages.length - 1]
  const lastQ     = lastMsg?.isScripted ? QUESTIONS[lastMsg.questionIdx] : null
  const formActive    = !isLoading && lastQ?.type === 'form' && !lastMsg?.formSubmitted
  const inputDisabled = isLoading || formActive || showIntro

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100svh', minHeight: '100svh',
      background: '#f8fafc', overflow: 'hidden',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes msgFadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes bounce    { 0%,80%,100% { transform: translateY(0) } 40% { transform: translateY(-7px) } }
      `}</style>

      {/* Header */}
      <header style={{
        background: BRAND, height: 58, padding: '0 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firm?.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 34, maxWidth: 140, objectFit: 'contain' }} />
            : <>
                <span style={{ fontSize: 20 }}>⚖️</span>
                <div>
                  <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
                    {firm?.name ?? 'CaseTake'}
                  </div>
                  <div style={{ color: ON.textMuted, fontSize: 10.5, marginTop: 2 }}>
                    SIBTF Information Gathering
                  </div>
                </div>
              </>
          }
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {firm && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'white', borderRadius: 20, padding: '4px 10px 4px 8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)', marginRight: 4,
            }}>
              <span style={{ fontSize: 12 }}>⚖️</span>
              <span style={{ color: '#1a2e4a', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                Powered by CaseTake
              </span>
            </div>
          )}
          <button onClick={resetCase} style={{
            background: 'transparent', color: ON.btnText,
            border: `1.5px solid ${ON.btnBorder}`,
            borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Start Over</button>
        </div>
      </header>

      {/* Completion banner */}
      {showBanner && (
        <div style={{
          background: '#16a34a', color: 'white', padding: '9px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13.5, flexShrink: 0, gap: 10,
        }}>
          <span>✅ SIBTF information gathering complete. Your file has been submitted to the firm for review.</span>
          <button onClick={() => setShowBanner(false)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: 19, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '9px 18px',
          fontSize: 13, color: '#dc2626', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Messages */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          {showIntro && <SIBTFIntroCard onBegin={handleBegin} firm={firm} />}
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.isScripted
                ? (() => {
                    const q = QUESTIONS[msg.questionIdx]
                    if (!q) return null
                    return q.type === 'form'
                      ? <IntakeFormCard
                          question={q}
                          msgIdx={i}
                          formSubmitted={!!msg.formSubmitted}
                          onSubmit={submitFormAnswer}
                        />
                      : <ScriptedQuestionBubble question={q.text} />
                  })()
                : <MessageBubble message={msg} />
              }
            </div>
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input bar */}
      <footer style={{
        background: 'white', borderTop: '1px solid #e5e7eb',
        padding: '11px 16px 13px', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            disabled={inputDisabled}
            placeholder={
              showIntro    ? 'Click "Begin SIBTF Process" above to start…' :
              isLoading    ? 'Please wait…' :
              formActive   ? 'Please complete the form above…' :
                             'Type your response…'
            }
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
              flex: 1, resize: 'none', border: '1.5px solid #d1d5db', borderRadius: 10,
              padding: '10px 14px', fontSize: 15, fontFamily: 'inherit',
              lineHeight: 1.5, minHeight: 44, maxHeight: 148, overflowY: 'auto',
              background: inputDisabled ? '#f9fafb' : 'white',
              color: '#111827', transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={inputDisabled || !input.trim()}
            style={{
              background: (!inputDisabled && input.trim()) ? NAVY : '#e5e7eb',
              color:      (!inputDisabled && input.trim()) ? 'white' : '#9ca3af',
              border: 'none', borderRadius: 10, width: 44, height: 44, flexShrink: 0,
              cursor: (!inputDisabled && input.trim()) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, transition: 'background 0.15s',
            }}
          >↑</button>
        </div>
        <div style={{ maxWidth: 740, margin: '5px auto 0', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 11, color: '#bfbfbf' }}>Press Enter to send</div>
        </div>
      </footer>
    </div>
  )
}
