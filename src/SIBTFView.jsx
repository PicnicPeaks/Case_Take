import { useState } from 'react'
import { saveCase } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY = '#1a2e4a'

// ── Wizard step definitions ────────────────────────────────────────────────────

const ALL_STEPS = ['client', 'legal', 'ssa', 'pension', 'calpers', 'mva', 'work']

const STEP_META = {
  client:  { icon: '👤', label: 'Client Info' },
  legal:   { icon: '🪪', label: 'Legal Status' },
  ssa:     { icon: '🏛️', label: 'Social Security' },
  pension: { icon: '💰', label: 'Pension' },
  calpers: { icon: '🏢', label: 'CALPERs' },
  mva:     { icon: '🚗', label: 'MVA Settlement' },
  work:    { icon: '💼', label: 'Work History' },
}

function visibleSteps(vals) {
  return vals.legal_status === 'no'
    ? ALL_STEPS.filter(s => s !== 'ssa')
    : ALL_STEPS
}

// ── Validation — can the user advance from this step? ─────────────────────────

function canAdvance(stepId, vals) {
  switch (stepId) {
    case 'client':
      return !!(vals.name?.trim() && vals.phone?.trim() && vals.doi)
    case 'legal':
      return !!vals.legal_status
    case 'ssa': {
      if (!vals.ssa_status) return false
      const neverRcvd  = vals.ssa_status === 'Never received SS / SSDI / SSI benefits'
      const hasOrHad   = !neverRcvd
      if (neverRcvd) return !!vals.benefit_verification_letter
      if (hasOrHad)  return !!(vals.ssdi_award_notice && vals.ssdi_1099s && vals.current_year_rate && vals.consent_for_release)
      return false
    }
    case 'pension':
      if (!vals.pension_release_signed || !vals.receiving_pension) return false
      if (vals.receiving_pension === 'yes' && !vals.pension_details?.trim()) return false
      return true
    case 'calpers':
      return !!vals.calpers_member
    case 'mva':
      if (!vals.mva_received) return false
      if (vals.mva_received === 'yes' && !vals.mva_details?.trim()) return false
      return true
    case 'work':
      if (!vals.worked_10yr) return false
      if (vals.worked_10yr === 'yes') {
        if (!vals.work_years?.trim() || !vals.work_schedule || !vals.new_injuries) return false
        if (vals.new_injuries === 'yes' && !vals.injury_details?.trim()) return false
      }
      return true
    default:
      return true
  }
}

// ── Summary builder — no AI, pure form values ─────────────────────────────────

function buildSummary(vals) {
  const today   = new Date().toISOString().slice(0, 10)
  const isLegal = vals.legal_status === 'yes'
  const ssa     = vals.ssa_status ?? ''
  const neverRcvd = ssa === 'Never received SS / SSDI / SSI benefits'
  const hadSSA    = ssa === 'Currently receiving SSDI or SSI' || ssa === 'Received SSDI / SSI in the past — no longer receiving'

  const docs = []

  if (!isLegal)
    docs.push('Affidavit re Status (client is not a U.S. citizen or legal permanent resident)')

  if (isLegal) {
    if (neverRcvd && vals.benefit_verification_letter !== 'yes')
      docs.push('Benefit Verification Letter from Social Security (confirming no SS/SSDI paid or applied for)')
    if (hadSSA) {
      if (vals.ssdi_award_notice  !== 'yes') docs.push('Notice of SSDI Award / SSDI Benefit Verification Letter')
      if (vals.ssdi_1099s         !== 'yes') docs.push('SSDI 1099s (from start of payments through current year)')
      if (vals.current_year_rate  !== 'yes') docs.push('2026 Current Year Rate information (SSDI and/or SSI)')
      if (vals.consent_for_release !== 'yes') docs.push('Signed Undated Consent for Release of Social Security Records')
    }
  }

  if (vals.pension_release_signed !== 'yes')
    docs.push('Signed Undated Pension Release form')

  if (vals.calpers_member === 'yes')
    docs.push('Signed Undated CALPERs Release form')

  const yesNo = (v) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : (v ?? 'N/A')
  const hasDoc = (v) => v === 'yes' ? 'Has it' : v === 'no' ? 'Missing' : v === 'unsure' ? 'Not sure' : 'N/A'

  return {
    type:          'sibtf',
    viability_label: 'SIBTF',
    intake_date:   today,
    claimant:      vals.name,
    phone:         vals.phone,
    doi:           vals.doi,
    claim_number:  vals.claim_number?.trim() || 'Not provided',
    legal_status:  isLegal ? 'Yes — U.S. Citizen / Legal Permanent Resident' : 'No — not a legal U.S. resident',
    affidavit_re_status_needed: isLegal ? 'No' : 'Yes',

    ssa_status:                  isLegal ? ssa : 'N/A (non-legal resident)',
    benefit_verification_letter: isLegal && neverRcvd ? hasDoc(vals.benefit_verification_letter) : 'N/A',
    ssdi_award_notice:           isLegal && hadSSA ? hasDoc(vals.ssdi_award_notice)   : 'N/A',
    ssdi_1099s:                  isLegal && hadSSA ? hasDoc(vals.ssdi_1099s)          : 'N/A',
    current_year_rate:           isLegal && hadSSA ? hasDoc(vals.current_year_rate)   : 'N/A',
    consent_for_release:         isLegal && hadSSA
      ? (vals.consent_for_release === 'yes' ? 'Already signed' : 'Must sign')
      : 'N/A',

    pension_release_signed: vals.pension_release_signed === 'yes' ? 'Yes' : 'No — must sign',
    receiving_pension:      yesNo(vals.receiving_pension),
    pension_details:        vals.pension_details?.trim() || 'N/A',

    calpers_member:        yesNo(vals.calpers_member),
    calpers_release_needed: vals.calpers_member === 'yes' ? 'Yes' : 'No',

    mva_settlement: yesNo(vals.mva_received),
    mva_details:    vals.mva_details?.trim() || 'N/A',

    work_history_10yr:  yesNo(vals.worked_10yr),
    work_years:         vals.work_years?.trim()    || 'N/A',
    work_schedule:      vals.work_schedule         || 'N/A',
    new_work_injuries:  yesNo(vals.new_injuries),
    new_injury_details: vals.injury_details?.trim() || 'N/A',

    documents_needed: docs,
    notes: '',
  }
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
      {children}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
    </div>
  )
}

function Hint({ children }) {
  return <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, lineHeight: 1.5 }}>{children}</div>
}

function FieldWrap({ children }) {
  return <div style={{ marginBottom: 18 }}>{children}</div>
}

function YesNo({ value, onChange, includeUnsure, BRAND }) {
  const opts = ['yes', 'no', ...(includeUnsure ? ['unsure'] : [])]
  const labels = { yes: 'Yes', no: 'No', unsure: 'Not sure' }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {opts.map(opt => {
        const active = value === opt
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            background: active ? (BRAND ?? NAVY) : 'white',
            color:      active ? 'white' : '#374151',
            border:     `1.5px solid ${active ? (BRAND ?? NAVY) : '#d1d5db'}`,
            borderRadius: 8, padding: '8px 20px', fontSize: 14,
            fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.12s',
          }}>{labels[opt]}</button>
        )
      })}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', BRAND }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
        border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
        outline: 'none', color: '#111827', background: 'white', transition: 'border-color 0.15s',
      }}
      onFocus={e => (e.target.style.borderColor = BRAND ?? NAVY)}
      onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
    />
  )
}

function TextArea({ value, onChange, placeholder, BRAND }) {
  return (
    <textarea
      value={value ?? ''}
      rows={3}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
        border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
        outline: 'none', color: '#111827', background: 'white',
        resize: 'vertical', lineHeight: 1.5, minHeight: 80,
      }}
      onFocus={e => (e.target.style.borderColor = BRAND ?? NAVY)}
      onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
    />
  )
}

function SelectInput({ value, onChange, options, BRAND }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
        border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
        outline: 'none', color: value ? '#111827' : '#9ca3af', background: 'white',
        cursor: 'pointer',
      }}
      onFocus={e => (e.target.style.borderColor = BRAND ?? NAVY)}
      onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
    >
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function InfoBox({ children, type = 'warning' }) {
  const styles = {
    warning: { bg: '#fef3c7', border: '#fcd34d', color: '#78350f' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
      padding: '11px 14px', fontSize: 13, color: s.color, lineHeight: 1.6, marginBottom: 14,
    }}>{children}</div>
  )
}

// ── Step content panels ────────────────────────────────────────────────────────

function ClientStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Full Legal Name</FieldLabel>
        <TextInput value={vals.name} onChange={v => setVal('name', v)} placeholder="First Last" BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel required>Phone Number</FieldLabel>
        <TextInput value={vals.phone} onChange={v => setVal('phone', v)} placeholder="(555) 555-5555" type="tel" BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel required>Date of Injury (Primary Case)</FieldLabel>
        <TextInput value={vals.doi} onChange={v => setVal('doi', v)} type="date" BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel>Claim / Case Number</FieldLabel>
        <Hint>Optional — skip if unknown</Hint>
        <TextInput value={vals.claim_number} onChange={v => setVal('claim_number', v)} placeholder="ADJ1234567" BRAND={BRAND} />
      </FieldWrap>
    </>
  )
}

function LegalStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Are you a U.S. citizen or legal permanent resident?</FieldLabel>
        <YesNo value={vals.legal_status} onChange={v => setVal('legal_status', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.legal_status === 'no' && (
        <InfoBox type="warning">
          ⚠️ <strong>Affidavit re Status required.</strong> Because you are not a U.S. citizen or legal permanent resident,
          an Affidavit re Status must be signed. The Social Security section does not apply to you.
        </InfoBox>
      )}
    </>
  )
}

function SSAStep({ vals, setVal, BRAND }) {
  const ssa         = vals.ssa_status ?? ''
  const neverRcvd   = ssa === 'Never received SS / SSDI / SSI benefits'
  const hasOrHadSSA = ssa === 'Currently receiving SSDI or SSI' || ssa === 'Received SSDI / SSI in the past — no longer receiving'

  return (
    <>
      <FieldWrap>
        <FieldLabel required>What is your Social Security / SSDI / SSI benefit status?</FieldLabel>
        <SelectInput
          value={vals.ssa_status}
          onChange={v => setVal('ssa_status', v)}
          BRAND={BRAND}
          options={[
            'Never received SS / SSDI / SSI benefits',
            'Currently receiving SSDI or SSI',
            'Received SSDI / SSI in the past — no longer receiving',
          ]}
        />
      </FieldWrap>

      {neverRcvd && (
        <>
          <InfoBox type="info">
            📄 You will need a <strong>Benefit Verification Letter</strong> from Social Security confirming that no SS/SSDI
            benefits were paid or applied for. You can get this at <strong>ssa.gov</strong> or your local SS office.
          </InfoBox>
          <FieldWrap>
            <FieldLabel required>Do you have this Benefit Verification Letter?</FieldLabel>
            <YesNo value={vals.benefit_verification_letter} onChange={v => setVal('benefit_verification_letter', v)} includeUnsure BRAND={BRAND} />
          </FieldWrap>
        </>
      )}

      {hasOrHadSSA && (
        <>
          <FieldWrap>
            <FieldLabel required>Do you have your Notice of SSDI Award and/or SSDI Benefit Verification Letter?</FieldLabel>
            <YesNo value={vals.ssdi_award_notice} onChange={v => setVal('ssdi_award_notice', v)} includeUnsure BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>Do you have 1099s from when SSDI payments started through the current year?</FieldLabel>
            <Hint>SSDI payments only — not SSI</Hint>
            <YesNo value={vals.ssdi_1099s} onChange={v => setVal('ssdi_1099s', v)} includeUnsure BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>Do you have your 2026 Current Year Rate information (SSDI and/or SSI)?</FieldLabel>
            <YesNo value={vals.current_year_rate} onChange={v => setVal('current_year_rate', v)} includeUnsure BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>Have you already signed an Undated Consent for Release of Information?</FieldLabel>
            <YesNo value={vals.consent_for_release} onChange={v => setVal('consent_for_release', v)} BRAND={BRAND} />
          </FieldWrap>
          {vals.consent_for_release === 'no' && (
            <InfoBox type="warning">
              ✍️ You will need to sign a <strong>Consent for Release of Social Security Records</strong> — we can take care of that at your appointment.
            </InfoBox>
          )}
        </>
      )}
    </>
  )
}

function PensionStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Have you signed an Undated Pension Release form?</FieldLabel>
        <YesNo value={vals.pension_release_signed} onChange={v => setVal('pension_release_signed', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.pension_release_signed === 'no' && (
        <InfoBox type="warning">
          ✍️ You will need to sign a <strong>Pension Release form</strong> — we can take care of that at your appointment.
        </InfoBox>
      )}
      <FieldWrap>
        <FieldLabel required>Are you currently receiving any pension benefits?</FieldLabel>
        <YesNo value={vals.receiving_pension} onChange={v => setVal('receiving_pension', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.receiving_pension === 'yes' && (
        <FieldWrap>
          <FieldLabel required>Describe your pension (source and approximate monthly amount)</FieldLabel>
          <TextArea value={vals.pension_details} onChange={v => setVal('pension_details', v)} placeholder="e.g., City of LA pension, ~$1,200/month" BRAND={BRAND} />
        </FieldWrap>
      )}
    </>
  )
}

function CalpersStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Are you a CALPERs member (California Public Employees' Retirement System)?</FieldLabel>
        <YesNo value={vals.calpers_member} onChange={v => setVal('calpers_member', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.calpers_member === 'yes' && (
        <InfoBox type="warning">
          ✍️ CALPERs members must sign an <strong>Undated CALPERs Release form</strong> — we can take care of that at your appointment.
        </InfoBox>
      )}
      {vals.calpers_member === 'no' && (
        <InfoBox type="success">
          ✅ No CALPERs release required.
        </InfoBox>
      )}
    </>
  )
}

function MVAStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Have you ever received a financial settlement from a motor vehicle accident?</FieldLabel>
        <Hint>At any point in your lifetime</Hint>
        <YesNo value={vals.mva_received} onChange={v => setVal('mva_received', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.mva_received === 'yes' && (
        <FieldWrap>
          <FieldLabel required>Please describe the settlement(s) — approximate amount and year</FieldLabel>
          <TextArea value={vals.mva_details} onChange={v => setVal('mva_details', v)} placeholder="e.g., 2018 rear-end accident, settled for ~$15,000" BRAND={BRAND} />
        </FieldWrap>
      )}
    </>
  )
}

function WorkStep({ vals, setVal, BRAND }) {
  return (
    <>
      <FieldWrap>
        <FieldLabel required>Have you been working in the past 10 years (or since your date of injury)?</FieldLabel>
        <YesNo value={vals.worked_10yr} onChange={v => setVal('worked_10yr', v)} BRAND={BRAND} />
      </FieldWrap>
      {vals.worked_10yr === 'yes' && (
        <>
          <FieldWrap>
            <FieldLabel required>How many years have you worked during that period, and for which employers?</FieldLabel>
            <TextArea value={vals.work_years} onChange={v => setVal('work_years', v)} placeholder="e.g., 2015–2022 at LAUSD, 2022–present at City of Long Beach" BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>What was your typical work schedule?</FieldLabel>
            <SelectInput
              value={vals.work_schedule}
              onChange={v => setVal('work_schedule', v)}
              BRAND={BRAND}
              options={['Full-time', 'Part-time', 'Both full and part-time at different times']}
            />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>Have you had any new work-related injuries since your primary date of injury?</FieldLabel>
            <YesNo value={vals.new_injuries} onChange={v => setVal('new_injuries', v)} BRAND={BRAND} />
          </FieldWrap>
          {vals.new_injuries === 'yes' && (
            <FieldWrap>
              <FieldLabel required>Please describe the injury or injuries</FieldLabel>
              <TextArea value={vals.injury_details} onChange={v => setVal('injury_details', v)} placeholder="Describe what happened, when, and which body parts were affected" BRAND={BRAND} />
            </FieldWrap>
          )}
        </>
      )}
    </>
  )
}

// ── Completion screen ──────────────────────────────────────────────────────────

function CompletionScreen({ firm, BRAND, ON }) {
  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6', display: 'flex', flexDirection: 'column',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>
      <header style={{
        background: BRAND, height: 58, padding: '0 18px',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        {firm?.logo_url
          ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 34, objectFit: 'contain' }} />
          : <>
              <span style={{ fontSize: 20 }}>⚖️</span>
              <div style={{ color: ON.text, fontWeight: 800, fontSize: 15 }}>{firm?.name ?? 'CaseTake'}</div>
            </>
        }
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{
          background: 'white', borderRadius: 16, padding: '40px 36px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)', maxWidth: 500, width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#111827', marginBottom: 10, letterSpacing: '-0.3px' }}>
            Information Submitted
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
            Your SIBTF information has been received. The firm will review your file and reach out to schedule your appointment.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SIBTFView({ firm = null }) {
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  const [vals,    setValsState] = useState({})
  const [stepIdx, setStepIdx]   = useState(0)
  const [saving,  setSaving]    = useState(false)
  const [caseId,  setCaseId]    = useState(null)
  const [error,   setError]     = useState(null)

  const setVal = (key, value) => setValsState(prev => ({ ...prev, [key]: value }))

  const steps   = visibleSteps(vals)
  const stepId  = steps[stepIdx]
  const isFirst = stepIdx === 0
  const isLast  = stepIdx === steps.length - 1
  const ok      = canAdvance(stepId, vals)
  const meta    = STEP_META[stepId]

  const handleNext = async () => {
    if (!ok) return
    if (isLast) {
      setSaving(true)
      setError(null)
      try {
        const summary = buildSummary(vals)
        const { id, success } = await saveCase(summary, [], firm?.slug ?? null)
        if (!success) throw new Error('Failed to save — please try again.')
        setCaseId(id)
      } catch (e) {
        setError(e.message)
      } finally {
        setSaving(false)
      }
    } else {
      setStepIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    setStepIdx(i => i - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (caseId) return <CompletionScreen firm={firm} BRAND={BRAND} ON={ON} />

  const progressPct = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0

  return (
    <div style={{
      minHeight: '100svh', background: '#f3f4f6',
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
    }}>

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
                  <div style={{ color: ON.textMuted, fontSize: 10.5, marginTop: 2 }}>SIBTF Information Gathering</div>
                </div>
              </>
          }
        </div>
        {firm && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'white', borderRadius: 20, padding: '4px 10px 4px 8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}>
            <span style={{ fontSize: 12 }}>⚖️</span>
            <span style={{ color: NAVY, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>Powered by CaseTake</span>
          </div>
        )}
      </header>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', borderBottom: '1px solid #fecaca',
          padding: '10px 18px', fontSize: 13, color: '#dc2626',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Step {stepIdx + 1} of {steps.length}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {steps.map((s, i) => (
                <span key={s} style={{
                  marginLeft: i > 0 ? 6 : 0,
                  color: i < stepIdx ? '#16a34a' : i === stepIdx ? BRAND : '#d1d5db',
                  fontWeight: i === stepIdx ? 700 : 400,
                }}>
                  {i < stepIdx ? '✓' : STEP_META[s].icon}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: BRAND, borderRadius: 4,
              width: `${progressPct}%`, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'white', borderRadius: 14,
          padding: '28px 28px 24px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
        }}>
          {/* Step header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${BRAND}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
            }}>{meta.icon}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', letterSpacing: '-0.2px' }}>{meta.label}</div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>SIBTF Information Gathering</div>
            </div>
          </div>

          {/* Step content */}
          {stepId === 'client'  && <ClientStep  vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'legal'   && <LegalStep   vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'ssa'     && <SSAStep     vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'pension' && <PensionStep vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'calpers' && <CalpersStep vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'mva'     && <MVAStep     vals={vals} setVal={setVal} BRAND={BRAND} />}
          {stepId === 'work'    && <WorkStep    vals={vals} setVal={setVal} BRAND={BRAND} />}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
            <button
              onClick={handleBack}
              disabled={isFirst}
              style={{
                background: 'white', color: isFirst ? '#d1d5db' : '#374151',
                border: `1.5px solid ${isFirst ? '#e5e7eb' : '#d1d5db'}`,
                borderRadius: 9, padding: '11px 24px', fontSize: 14, fontWeight: 600,
                cursor: isFirst ? 'not-allowed' : 'pointer',
              }}
            >← Back</button>
            <button
              onClick={handleNext}
              disabled={!ok || saving}
              style={{
                background: ok && !saving ? BRAND : '#e5e7eb',
                color: ok && !saving ? ON.text : '#9ca3af',
                border: 'none', borderRadius: 9, padding: '11px 32px', fontSize: 14, fontWeight: 700,
                cursor: ok && !saving ? 'pointer' : 'not-allowed',
                boxShadow: ok && !saving ? `0 3px 12px ${BRAND}44` : 'none',
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Submitting…' : isLast ? 'Submit →' : 'Continue →'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#d1d5db' }}>
          © {new Date().getFullYear()} Picnic Peaks LLC · Confidential
        </div>
      </div>
    </div>
  )
}
