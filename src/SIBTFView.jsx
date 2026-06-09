import { useState } from 'react'
import { saveCase } from './supabase.js'
import { onBrand } from './colorUtils.js'

const NAVY = '#1a2e4a'

// ── Translations ───────────────────────────────────────────────────────────────

const T = {
  en: {
    langToggle: 'Español',
    headerSub:  'SIBTF Information Gathering',
    poweredBy:  'Powered by CaseTake',
    stepOf:     (n, t) => `Step ${n} of ${t}`,
    stepSub:    'SIBTF Information Gathering',
    back:       '← Back',
    continue:   'Continue →',
    submit:     'Submit →',
    submitting: 'Submitting…',
    footer:     `© ${new Date().getFullYear()} Picnic Peaks LLC · Confidential`,

    steps: {
      client:  'Client Info',
      legal:   'Legal Status',
      ssa:     'Social Security',
      pension: 'Pension',
      calpers: 'CALPERs',
      mva:     'MVA Settlement',
      work:    'Work History',
    },

    yesno: { yes: 'Yes', no: 'No', unsure: 'Not sure' },

    client: {
      name:      'Full Legal Name',        namePH:  'First Last',
      phone:     'Phone Number',           phonePH: '(555) 555-5555',
      doi:       'Date of Injury (Primary Case)',
      claim:     'Claim / Case Number',    claimPH: 'ADJ1234567',
      claimHint: 'Optional — skip if unknown',
    },

    legal: {
      q:        'Are you a U.S. citizen or legal permanent resident?',
      noNotice: '⚠️ Affidavit re Status required. Because you are not a U.S. citizen or legal permanent resident, an Affidavit re Status must be signed. The Social Security section does not apply to you.',
    },

    ssa: {
      statusQ:  'What is your Social Security / SSDI / SSI benefit status?',
      opt1:     'Never received SS / SSDI / SSI benefits',
      opt2:     'Currently receiving SSDI or SSI',
      opt3:     'Received SSDI / SSI in the past — no longer receiving',
      neverInfo:'📄 You will need a Benefit Verification Letter from Social Security confirming no SS/SSDI benefits were paid or applied for. Get it at ssa.gov or your local SS office.',
      bvlQ:     'Do you have this Benefit Verification Letter?',
      awardQ:   'Do you have your Notice of SSDI Award and/or SSDI Benefit Verification Letter?',
      s1099Q:   'Do you have 1099s from when SSDI payments started through the current year?',
      s1099H:   'SSDI payments only — not SSI',
      cyrQ:     'Do you have your 2026 Current Year Rate information (SSDI and/or SSI)?',
      consentQ: 'Have you already signed an Undated Consent for Release of Information?',
      consentNo:'✍️ You will need to sign a Consent for Release of Social Security Records — we can take care of that at your appointment.',
    },

    pension: {
      releaseQ:  'Have you signed an Undated Pension Release form?',
      releaseNo: '✍️ You will need to sign a Pension Release form — we can take care of that at your appointment.',
      receivingQ:'Are you currently receiving any pension benefits?',
      detailsQ:  'Describe your pension (source and approximate monthly amount)',
      detailsPH: 'e.g., City of LA pension, ~$1,200/month',
    },

    calpers: {
      q:        "Are you a CALPERs member (California Public Employees' Retirement System)?",
      yesNotice:'✍️ CALPERs members must sign an Undated CALPERs Release form — we can take care of that at your appointment.',
      noNotice: '✅ No CALPERs release required.',
    },

    mva: {
      q:        'Have you ever received a financial settlement from a motor vehicle accident?',
      hint:     'At any point in your lifetime',
      detailsQ: 'Please describe the settlement(s) — approximate amount and year',
      detailsPH:'e.g., 2018 rear-end accident, settled for ~$15,000',
    },

    work: {
      q:            'Have you been working in the past 10 years (or since your date of injury)?',
      yearsQ:       'How many years have you worked during that period, and for which employers?',
      yearsPH:      'e.g., 2015–2022 at LAUSD, 2022–present at City of Long Beach',
      scheduleQ:    'What was your typical work schedule?',
      scheduleOpts: ['Full-time', 'Part-time', 'Both full and part-time at different times'],
      injuriesQ:    'Have you had any new work-related injuries since your primary date of injury?',
      injuryQ:      'Please describe the injury or injuries',
      injuryPH:     'Describe what happened, when, and which body parts were affected',
    },

    done: {
      title: 'Information Submitted',
      body:  'Your SIBTF information has been received. The firm will review your file and reach out to schedule your appointment.',
    },
  },

  es: {
    langToggle: 'English',
    headerSub:  'Recopilación de Información SIBTF',
    poweredBy:  'Con tecnología de CaseTake',
    stepOf:     (n, t) => `Paso ${n} de ${t}`,
    stepSub:    'Recopilación de Información SIBTF',
    back:       '← Atrás',
    continue:   'Continuar →',
    submit:     'Enviar →',
    submitting: 'Enviando…',
    footer:     `© ${new Date().getFullYear()} Picnic Peaks LLC · Confidencial`,

    steps: {
      client:  'Datos del Cliente',
      legal:   'Estado Legal',
      ssa:     'Seguridad Social',
      pension: 'Pensión',
      calpers: 'CALPERs',
      mva:     'Accidente de Auto',
      work:    'Historial Laboral',
    },

    yesno: { yes: 'Sí', no: 'No', unsure: 'No estoy seguro/a' },

    client: {
      name:      'Nombre Legal Completo',  namePH:  'Nombre Apellido',
      phone:     'Número de Teléfono',     phonePH: '(555) 555-5555',
      doi:       'Fecha de la Lesión (Caso Principal)',
      claim:     'Número de Reclamación',  claimPH: 'ADJ1234567',
      claimHint: 'Opcional — omita si no lo sabe',
    },

    legal: {
      q:        '¿Es usted ciudadano/a estadounidense o residente permanente legal?',
      noNotice: '⚠️ Se requiere una Declaración Jurada de Estatus. Debido a que no es ciudadano/a estadounidense ni residente permanente legal, debe firmar una Declaración Jurada de Estatus. La sección de Seguridad Social no aplica a usted.',
    },

    ssa: {
      statusQ:  '¿Cuál es su estado de beneficios del Seguro Social / SSDI / SSI?',
      opt1:     'Nunca he recibido SS / SSDI / SSI',
      opt2:     'Actualmente recibo SSDI o SSI',
      opt3:     'Recibí SSDI / SSI antes — ya no lo recibo',
      neverInfo:'📄 Necesitará una Carta de Verificación de Beneficios del Seguro Social que confirme que no se pagaron ni solicitaron beneficios. Puede obtenerla en ssa.gov o en su oficina local del Seguro Social.',
      bvlQ:     '¿Tiene esta Carta de Verificación de Beneficios?',
      awardQ:   '¿Tiene su Aviso de Otorgamiento de SSDI y/o Carta de Verificación de Beneficios de SSDI?',
      s1099Q:   '¿Tiene los formularios 1099 desde que comenzaron los pagos del SSDI hasta el año actual?',
      s1099H:   'Solo pagos de SSDI — no SSI',
      cyrQ:     '¿Tiene la información de la Tasa del Año Actual 2026 (SSDI y/o SSI)?',
      consentQ: '¿Ya firmó un Consentimiento sin Fecha para la Divulgación de Información?',
      consentNo:'✍️ Necesitará firmar un Consentimiento para la Divulgación de Registros — podemos encargarnos de eso en su cita.',
    },

    pension: {
      releaseQ:  '¿Ha firmado un Formulario de Autorización de Pensión sin fecha?',
      releaseNo: '✍️ Necesitará firmar un Formulario de Autorización de Pensión — podemos encargarnos de eso en su cita.',
      receivingQ:'¿Está recibiendo actualmente algún beneficio de pensión?',
      detailsQ:  'Describa su pensión (fuente y monto mensual aproximado)',
      detailsPH: 'Ej: Pensión de la Ciudad de LA, ~$1,200/mes',
    },

    calpers: {
      q:        '¿Es miembro de CALPERs (Sistema de Jubilación de Empleados Públicos de California)?',
      yesNotice:'✍️ Los miembros de CALPERs deben firmar un Formulario de Autorización de CALPERs sin fecha — podemos encargarnos de eso en su cita.',
      noNotice: '✅ No se requiere autorización de CALPERs.',
    },

    mva: {
      q:        '¿Alguna vez recibió una compensación por un accidente de vehículo de motor?',
      hint:     'En cualquier momento de su vida',
      detailsQ: 'Describa la(s) compensación(es) — monto aproximado y año',
      detailsPH:'Ej: Accidente en 2018, compensación de ~$15,000',
    },

    work: {
      q:            '¿Ha estado trabajando en los últimos 10 años (o desde la fecha de su lesión)?',
      yearsQ:       '¿Cuántos años ha trabajado y para qué empleadores?',
      yearsPH:      'Ej: 2015–2022 en LAUSD, 2022–presente en la Ciudad de Long Beach',
      scheduleQ:    '¿Cuál era su horario de trabajo habitual?',
      scheduleOpts: ['Tiempo completo', 'Medio tiempo', 'Ambos en diferentes momentos'],
      injuriesQ:    '¿Ha tenido nuevas lesiones laborales desde la fecha principal de su lesión?',
      injuryQ:      'Describa la(s) lesión(es)',
      injuryPH:     'Describa qué ocurrió, cuándo y qué partes del cuerpo fueron afectadas',
    },

    done: {
      title: 'Información Enviada',
      body:  'Su información de SIBTF ha sido recibida. El despacho revisará su expediente y se comunicará para programar su cita.',
    },
  },
}

// ── SSA stored values (English keys, always) ───────────────────────────────────
// Maps display option index → stored English value used in buildSummary
const SSA_VALS = [
  'Never received SS / SSDI / SSI benefits',
  'Currently receiving SSDI or SSI',
  'Received SSDI / SSI in the past — no longer receiving',
]
// Work schedule stored values
const SCHEDULE_VALS = ['Full-time', 'Part-time', 'Both full and part-time at different times']

// ── Wizard step definitions ────────────────────────────────────────────────────

const ALL_STEPS = ['client', 'legal', 'ssa', 'pension', 'calpers', 'mva', 'work']
const STEP_ICONS = { client: '👤', legal: '🪪', ssa: '🏛️', pension: '💰', calpers: '🏢', mva: '🚗', work: '💼' }

function visibleSteps(vals) {
  return vals.legal_status === 'no' ? ALL_STEPS.filter(s => s !== 'ssa') : ALL_STEPS
}

// ── Validation ─────────────────────────────────────────────────────────────────

function canAdvance(stepId, vals) {
  switch (stepId) {
    case 'client':
      return !!(vals.name?.trim() && vals.phone?.trim() && vals.doi)
    case 'legal':
      return !!vals.legal_status
    case 'ssa': {
      if (!vals.ssa_status) return false
      const neverRcvd = vals.ssa_status === SSA_VALS[0]
      const hasOrHad  = vals.ssa_status === SSA_VALS[1] || vals.ssa_status === SSA_VALS[2]
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
    default: return true
  }
}

// ── Summary builder ────────────────────────────────────────────────────────────

function buildSummary(vals) {
  const today   = new Date().toISOString().slice(0, 10)
  const isLegal = vals.legal_status === 'yes'
  const ssa     = vals.ssa_status ?? ''
  const neverRcvd = ssa === SSA_VALS[0]
  const hadSSA    = ssa === SSA_VALS[1] || ssa === SSA_VALS[2]

  const docs = []
  if (!isLegal) docs.push('Affidavit re Status (client is not a U.S. citizen or legal permanent resident)')
  if (isLegal) {
    if (neverRcvd && vals.benefit_verification_letter !== 'yes')
      docs.push('Benefit Verification Letter from Social Security (confirming no SS/SSDI paid or applied for)')
    if (hadSSA) {
      if (vals.ssdi_award_notice   !== 'yes') docs.push('Notice of SSDI Award / SSDI Benefit Verification Letter')
      if (vals.ssdi_1099s          !== 'yes') docs.push('SSDI 1099s (from start of payments through current year)')
      if (vals.current_year_rate   !== 'yes') docs.push('2026 Current Year Rate information (SSDI and/or SSI)')
      if (vals.consent_for_release !== 'yes') docs.push('Signed Undated Consent for Release of Social Security Records')
    }
  }
  if (vals.pension_release_signed !== 'yes') docs.push('Signed Undated Pension Release form')
  if (vals.calpers_member === 'yes')         docs.push('Signed Undated CALPERs Release form')

  const yn    = (v) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : (v ?? 'N/A')
  const hasDoc = (v) => v === 'yes' ? 'Has it' : v === 'no' ? 'Missing' : v === 'unsure' ? 'Not sure' : 'N/A'

  return {
    type: 'sibtf', viability_label: 'SIBTF', intake_date: today,
    claimant: vals.name, phone: vals.phone, doi: vals.doi,
    claim_number: vals.claim_number?.trim() || 'Not provided',
    legal_status: isLegal ? 'Yes — U.S. Citizen / Legal Permanent Resident' : 'No — not a legal U.S. resident',
    affidavit_re_status_needed: isLegal ? 'No' : 'Yes',
    ssa_status:                  isLegal ? ssa : 'N/A (non-legal resident)',
    benefit_verification_letter: isLegal && neverRcvd ? hasDoc(vals.benefit_verification_letter) : 'N/A',
    ssdi_award_notice:           isLegal && hadSSA ? hasDoc(vals.ssdi_award_notice)   : 'N/A',
    ssdi_1099s:                  isLegal && hadSSA ? hasDoc(vals.ssdi_1099s)          : 'N/A',
    current_year_rate:           isLegal && hadSSA ? hasDoc(vals.current_year_rate)   : 'N/A',
    consent_for_release:         isLegal && hadSSA
      ? (vals.consent_for_release === 'yes' ? 'Already signed' : 'Must sign') : 'N/A',
    pension_release_signed: vals.pension_release_signed === 'yes' ? 'Yes' : 'No — must sign',
    receiving_pension: yn(vals.receiving_pension),
    pension_details:   vals.pension_details?.trim() || 'N/A',
    calpers_member:        yn(vals.calpers_member),
    calpers_release_needed: vals.calpers_member === 'yes' ? 'Yes' : 'No',
    mva_settlement: yn(vals.mva_received),
    mva_details:    vals.mva_details?.trim() || 'N/A',
    work_history_10yr:  yn(vals.worked_10yr),
    work_years:         vals.work_years?.trim()     || 'N/A',
    work_schedule:      vals.work_schedule          || 'N/A',
    new_work_injuries:  yn(vals.new_injuries),
    new_injury_details: vals.injury_details?.trim() || 'N/A',
    documents_needed: docs,
    notes: '',
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

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

function YesNo({ value, onChange, includeUnsure, BRAND, lang }) {
  const labels = T[lang].yesno
  const opts = ['yes', 'no', ...(includeUnsure ? ['unsure'] : [])]
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
    <input type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}
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
    <textarea value={value ?? ''} rows={3} placeholder={placeholder} onChange={e => onChange(e.target.value)}
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
  // options: array of { value, label } or plain strings
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
        border: '1.5px solid #d1d5db', fontSize: 14, fontFamily: 'inherit',
        outline: 'none', color: value ? '#111827' : '#9ca3af', background: 'white', cursor: 'pointer',
      }}
      onFocus={e => (e.target.style.borderColor = BRAND ?? NAVY)}
      onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
    >
      <option value="">Select…</option>
      {options.map(o =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  )
}

function InfoBox({ children, type = 'warning' }) {
  const s = { warning: { bg: '#fef3c7', border: '#fcd34d', color: '#78350f' }, info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' }, success: { bg: '#f0fdf4', border: '#86efac', color: '#15803d' } }[type]
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '11px 14px', fontSize: 13, color: s.color, lineHeight: 1.6, marginBottom: 14 }}>
      {children}
    </div>
  )
}

// ── Step panels ────────────────────────────────────────────────────────────────

function ClientStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].client
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.name}</FieldLabel>
        <TextInput value={vals.name} onChange={v => setVal('name', v)} placeholder={L.namePH} BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel required>{L.phone}</FieldLabel>
        <TextInput value={vals.phone} onChange={v => setVal('phone', v)} placeholder={L.phonePH} type="tel" BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel required>{L.doi}</FieldLabel>
        <TextInput value={vals.doi} onChange={v => setVal('doi', v)} type="date" BRAND={BRAND} />
      </FieldWrap>
      <FieldWrap>
        <FieldLabel>{L.claim}</FieldLabel>
        <Hint>{L.claimHint}</Hint>
        <TextInput value={vals.claim_number} onChange={v => setVal('claim_number', v)} placeholder={L.claimPH} BRAND={BRAND} />
      </FieldWrap>
    </>
  )
}

function LegalStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].legal
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.q}</FieldLabel>
        <YesNo value={vals.legal_status} onChange={v => setVal('legal_status', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.legal_status === 'no' && <InfoBox type="warning">{L.noNotice}</InfoBox>}
    </>
  )
}

function SSAStep({ vals, setVal, BRAND, lang }) {
  const L        = T[lang].ssa
  const neverRcvd = vals.ssa_status === SSA_VALS[0]
  const hasOrHad  = vals.ssa_status === SSA_VALS[1] || vals.ssa_status === SSA_VALS[2]

  // Translate display labels while keeping stored English values
  const ssaOptions = SSA_VALS.map((v, i) => ({ value: v, label: [L.opt1, L.opt2, L.opt3][i] }))

  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.statusQ}</FieldLabel>
        <SelectInput value={vals.ssa_status} onChange={v => setVal('ssa_status', v)} options={ssaOptions} BRAND={BRAND} />
      </FieldWrap>

      {neverRcvd && (
        <>
          <InfoBox type="info">{L.neverInfo}</InfoBox>
          <FieldWrap>
            <FieldLabel required>{L.bvlQ}</FieldLabel>
            <YesNo value={vals.benefit_verification_letter} onChange={v => setVal('benefit_verification_letter', v)} includeUnsure BRAND={BRAND} lang={lang} />
          </FieldWrap>
        </>
      )}

      {hasOrHad && (
        <>
          <FieldWrap>
            <FieldLabel required>{L.awardQ}</FieldLabel>
            <YesNo value={vals.ssdi_award_notice} onChange={v => setVal('ssdi_award_notice', v)} includeUnsure BRAND={BRAND} lang={lang} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>{L.s1099Q}</FieldLabel>
            <Hint>{L.s1099H}</Hint>
            <YesNo value={vals.ssdi_1099s} onChange={v => setVal('ssdi_1099s', v)} includeUnsure BRAND={BRAND} lang={lang} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>{L.cyrQ}</FieldLabel>
            <YesNo value={vals.current_year_rate} onChange={v => setVal('current_year_rate', v)} includeUnsure BRAND={BRAND} lang={lang} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>{L.consentQ}</FieldLabel>
            <YesNo value={vals.consent_for_release} onChange={v => setVal('consent_for_release', v)} BRAND={BRAND} lang={lang} />
          </FieldWrap>
          {vals.consent_for_release === 'no' && <InfoBox type="warning">{L.consentNo}</InfoBox>}
        </>
      )}
    </>
  )
}

function PensionStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].pension
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.releaseQ}</FieldLabel>
        <YesNo value={vals.pension_release_signed} onChange={v => setVal('pension_release_signed', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.pension_release_signed === 'no' && <InfoBox type="warning">{L.releaseNo}</InfoBox>}
      <FieldWrap>
        <FieldLabel required>{L.receivingQ}</FieldLabel>
        <YesNo value={vals.receiving_pension} onChange={v => setVal('receiving_pension', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.receiving_pension === 'yes' && (
        <FieldWrap>
          <FieldLabel required>{L.detailsQ}</FieldLabel>
          <TextArea value={vals.pension_details} onChange={v => setVal('pension_details', v)} placeholder={L.detailsPH} BRAND={BRAND} />
        </FieldWrap>
      )}
    </>
  )
}

function CalpersStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].calpers
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.q}</FieldLabel>
        <YesNo value={vals.calpers_member} onChange={v => setVal('calpers_member', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.calpers_member === 'yes' && <InfoBox type="warning">{L.yesNotice}</InfoBox>}
      {vals.calpers_member === 'no'  && <InfoBox type="success">{L.noNotice}</InfoBox>}
    </>
  )
}

function MVAStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].mva
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.q}</FieldLabel>
        <Hint>{L.hint}</Hint>
        <YesNo value={vals.mva_received} onChange={v => setVal('mva_received', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.mva_received === 'yes' && (
        <FieldWrap>
          <FieldLabel required>{L.detailsQ}</FieldLabel>
          <TextArea value={vals.mva_details} onChange={v => setVal('mva_details', v)} placeholder={L.detailsPH} BRAND={BRAND} />
        </FieldWrap>
      )}
    </>
  )
}

function WorkStep({ vals, setVal, BRAND, lang }) {
  const L = T[lang].work
  const scheduleOptions = SCHEDULE_VALS.map((v, i) => ({ value: v, label: L.scheduleOpts[i] }))
  return (
    <>
      <FieldWrap>
        <FieldLabel required>{L.q}</FieldLabel>
        <YesNo value={vals.worked_10yr} onChange={v => setVal('worked_10yr', v)} BRAND={BRAND} lang={lang} />
      </FieldWrap>
      {vals.worked_10yr === 'yes' && (
        <>
          <FieldWrap>
            <FieldLabel required>{L.yearsQ}</FieldLabel>
            <TextArea value={vals.work_years} onChange={v => setVal('work_years', v)} placeholder={L.yearsPH} BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>{L.scheduleQ}</FieldLabel>
            <SelectInput value={vals.work_schedule} onChange={v => setVal('work_schedule', v)} options={scheduleOptions} BRAND={BRAND} />
          </FieldWrap>
          <FieldWrap>
            <FieldLabel required>{L.injuriesQ}</FieldLabel>
            <YesNo value={vals.new_injuries} onChange={v => setVal('new_injuries', v)} BRAND={BRAND} lang={lang} />
          </FieldWrap>
          {vals.new_injuries === 'yes' && (
            <FieldWrap>
              <FieldLabel required>{L.injuryQ}</FieldLabel>
              <TextArea value={vals.injury_details} onChange={v => setVal('injury_details', v)} placeholder={L.injuryPH} BRAND={BRAND} />
            </FieldWrap>
          )}
        </>
      )}
    </>
  )
}

// ── Completion screen ──────────────────────────────────────────────────────────

function CompletionScreen({ firm, BRAND, ON, lang }) {
  const L = T[lang].done
  return (
    <div style={{ minHeight: '100svh', background: '#f3f4f6', display: 'flex', flexDirection: 'column', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <header style={{ background: BRAND, height: 58, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        {firm?.logo_url
          ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 34, objectFit: 'contain' }} />
          : <><span style={{ fontSize: 20 }}>⚖️</span><div style={{ color: ON.text, fontWeight: 800, fontSize: 15 }}>{firm?.name ?? 'CaseTake'}</div></>
        }
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#111827', marginBottom: 10, letterSpacing: '-0.3px' }}>{L.title}</div>
          <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{L.body}</div>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function SIBTFView({ firm = null }) {
  const BRAND = firm?.primary_color ?? NAVY
  const ON    = onBrand(BRAND)

  const [lang,    setLang]      = useState('en')
  const [vals,    setValsState] = useState({})
  const [stepIdx, setStepIdx]   = useState(0)
  const [saving,  setSaving]    = useState(false)
  const [caseId,  setCaseId]    = useState(null)
  const [error,   setError]     = useState(null)

  const setVal = (key, value) => setValsState(prev => ({ ...prev, [key]: value }))

  const steps  = visibleSteps(vals)
  const stepId = steps[stepIdx]
  const isFirst = stepIdx === 0
  const isLast  = stepIdx === steps.length - 1
  const ok      = canAdvance(stepId, vals)
  const Tr      = T[lang]

  const handleNext = async () => {
    if (!ok) return
    if (isLast) {
      setSaving(true); setError(null)
      try {
        const summary = buildSummary(vals)
        const { id, success } = await saveCase(summary, [], firm?.slug ?? null)
        if (!success) throw new Error('Failed to save — please try again.')
        setCaseId(id)
      } catch (e) { setError(e.message) }
      finally { setSaving(false) }
    } else {
      setStepIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => { setStepIdx(i => i - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (caseId) return <CompletionScreen firm={firm} BRAND={BRAND} ON={ON} lang={lang} />

  const progressPct = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0

  return (
    <div style={{ minHeight: '100svh', background: '#f3f4f6', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      {/* Header */}
      <header style={{ background: BRAND, height: 58, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {firm?.logo_url
            ? <img src={firm.logo_url} alt={firm.name} style={{ maxHeight: 34, maxWidth: 140, objectFit: 'contain' }} />
            : <><span style={{ fontSize: 20 }}>⚖️</span>
                <div>
                  <div style={{ color: ON.text, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{firm?.name ?? 'CaseTake'}</div>
                  <div style={{ color: ON.textMuted, fontSize: 10.5, marginTop: 2 }}>{Tr.headerSub}</div>
                </div>
              </>
          }
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {firm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', borderRadius: 20, padding: '4px 10px 4px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
              <span style={{ fontSize: 12 }}>⚖️</span>
              <span style={{ color: NAVY, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{Tr.poweredBy}</span>
            </div>
          )}
          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            style={{ background: ON.btnBg, color: ON.btnText, border: `1.5px solid ${ON.btnBorder}`, borderRadius: 7, padding: '6px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >{Tr.langToggle}</button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 18px', fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {Tr.stepOf(stepIdx + 1, steps.length)}
            </div>
            <div>
              {steps.map((s, i) => (
                <span key={s} style={{ marginLeft: i > 0 ? 6 : 0, color: i < stepIdx ? '#16a34a' : i === stepIdx ? BRAND : '#d1d5db', fontWeight: i === stepIdx ? 700 : 400 }}>
                  {i < stepIdx ? '✓' : STEP_ICONS[s]}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: BRAND, borderRadius: 4, width: `${progressPct}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 14, padding: '28px 28px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>

          {/* Step header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${BRAND}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {STEP_ICONS[stepId]}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', letterSpacing: '-0.2px' }}>{Tr.steps[stepId]}</div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{Tr.stepSub}</div>
            </div>
          </div>

          {/* Step content */}
          {stepId === 'client'  && <ClientStep  vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'legal'   && <LegalStep   vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'ssa'     && <SSAStep     vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'pension' && <PensionStep vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'calpers' && <CalpersStep vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'mva'     && <MVAStep     vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}
          {stepId === 'work'    && <WorkStep    vals={vals} setVal={setVal} BRAND={BRAND} lang={lang} />}

          {/* Nav */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
            <button onClick={handleBack} disabled={isFirst} style={{ background: 'white', color: isFirst ? '#d1d5db' : '#374151', border: `1.5px solid ${isFirst ? '#e5e7eb' : '#d1d5db'}`, borderRadius: 9, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: isFirst ? 'not-allowed' : 'pointer' }}>
              {Tr.back}
            </button>
            <button onClick={handleNext} disabled={!ok || saving} style={{ background: ok && !saving ? BRAND : '#e5e7eb', color: ok && !saving ? ON.text : '#9ca3af', border: 'none', borderRadius: 9, padding: '11px 32px', fontSize: 14, fontWeight: 700, cursor: ok && !saving ? 'pointer' : 'not-allowed', boxShadow: ok && !saving ? `0 3px 12px ${BRAND}44` : 'none', transition: 'all 0.15s' }}>
              {saving ? Tr.submitting : isLast ? Tr.submit : Tr.continue}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#d1d5db' }}>{Tr.footer}</div>
      </div>
    </div>
  )
}
