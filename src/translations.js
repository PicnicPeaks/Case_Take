// ─── UI strings ───────────────────────────────────────────────────────────────

export const t = {
  en: {
    langToggle:      'Español',
    newCase:         'New Case',
    intakeComplete:  'Intake complete — report sent to the firm.',
    waiting:         'Waiting for response…',
    fillForm:        'Fill out the form above ↑',
    enterToSend:     'Enter to send · Shift+Enter for new line',
    typeResponse:    'Type your response…',
    submit:          'Submit',
    submitted:       '✓ Submitted',
    helpful:         'Helpful?',
    noteRequired:    'Note required…',
    recorded:        'recorded',
    intakeQuestion:  'Intake Question',

    yesno: { yes: 'Yes', no: 'No', unsure: 'Not sure' },

    pre: {
      // Employment step
      empQ:        'How are you employed?',
      empW2:       'W-2 Employee',
      emp1099:     '1099 / Independent Contractor',
      empUnsure:   'Not sure',

      // Gov step
      govQ:        'Who do you work for?',
      govPrivate:  'Private company or business',
      govState:    'State or local government',
      govFederal:  'Federal government (USPS, military, VA, etc.)',
      govUnsure:   'Not sure',

      // Location step
      liveLabel:         'Where do you live?',
      injuredLabel:      'Where did the injury occur?',
      cityPlaceholder:   'City',
      statePlaceholder:  'State (e.g. CA)',
      sameStateQ:        'Do you primarily work in the same state as the injury?',
      sameYes:           'Yes',
      sameDiff:          'No — I primarily work in another state',
      primaryWorkState:  'Primary work state',
      nextBtn:           'Next →',

      // Activity step
      actQ:          'What were you doing when the injury occurred?',
      actWorking:    'Working at their workplace / worksite',
      actTravel:     'Business travel — away from home for work',
      actCommuting:  'Commuting to or from work',
      actOther:      'Something else / not sure',

      // Commuting step
      commutingTitle: 'A few more questions about your commute',
      commuting: [
        'Were you traveling between two work locations (e.g. job sites, offices)?',
        'Does your employer provide or pay for your vehicle?',
        'Were you running a work-related errand during the commute?',
        'Do you work from home and were traveling to a client or job site?',
      ],

      // Stops
      stop1099Title: 'We may not be able to help',
      stop1099Body:  "California workers' compensation covers W-2 employees. Independent contractors are generally not eligible. If you believe you may be misclassified, we recommend speaking with an employment attorney.",

      stopFedTitle:  'Federal employees have different coverage',
      stopFedBody:   'Federal employees are covered under FECA (Federal Employees\' Compensation Act), not California workers\' compensation. We recommend contacting the U.S. Department of Labor.',

      softStopTitle:    'Jurisdiction may be limited',
      softStopBody:     "Based on your answers, it's unclear whether California workers' compensation covers your injury. An attorney will need to review the specific facts.",
      softStopContinue: 'Continue anyway →',
      softStopBack:     '← Go back',

      startBtn: 'Start Intake →',

      beforeBeginTitle:       'Before we begin',
      beforeBeginSub:         'A few quick questions to confirm eligibility and establish jurisdiction.',
      locationTitle:          'Location & Circumstances',
      startOver:              '← Start Over',
      outOfStateNote:         'Injury occurred outside California — a few more questions to check jurisdiction',
      commutingExcSub:        'Injuries that occur while commuting are generally not covered, but several exceptions apply. Please answer each question:',
      softStopCommutingTitle: 'Claim May Not Be Covered',
      softStopCommutingBody:  "Injuries that occur during a commute to or from work are generally excluded from California workers' compensation coverage, and no applicable exception was identified based on your answers.",
      softStopJurTitle:       'Jurisdiction Review Needed',
      softStopJurBody:        "The injury occurred outside California ({state}) and a clear California workers' compensation jurisdiction connection wasn't established based on your answers. This claim may need to be filed in {state} instead.",
      softStopNote:           "This isn't necessarily the end. An attorney may identify additional facts that establish coverage. You can continue the intake and the jurisdiction question will be flagged for attorney review.",
      softStopContinueFlag:   'Continue — Flag for Attorney Review',
      stop1099Misclass:       'Were you misclassified?',
      stop1099MisclassBody:   'If you believe your employer incorrectly classified you as a 1099 contractor when you should be a W-2 employee, that determination requires attorney review — please contact us directly.',
    },

    landing: {
      tagline:  'California • Case Screening',
      title:    "Workers' Comp Intake\nScreening Tool",
      subtitle: "AI-powered intake interviews for California workers' compensation cases. Structured, thorough, and designed to surface what matters most before the attorney review.",
      startBtn: 'Start New Intake →',
      features: [
        { icon: '📋', title: 'Structured Questions',  desc: "AI-guided 10-stage intake covering employment, injury mechanics, treatment, claim status, QME disputes, witnesses, prior history, and more." },
        { icon: '🚩', title: 'Red Flag Detection',    desc: 'Automatically tracks late reporting, contractor status, conflicting timelines, and 10+ other risk factors — silently.' },
        { icon: '📊', title: 'Viability Report',      desc: 'Generates a scored case summary with a red-flag list and attorney recommendation ready for review.' },
      ],
    },
  },

  es: {
    langToggle:      'English',
    newCase:         'Nuevo caso',
    intakeComplete:  'Proceso completado — informe enviado al bufete.',
    waiting:         'Esperando respuesta…',
    fillForm:        'Complete el formulario de arriba ↑',
    enterToSend:     'Enter para enviar · Shift+Enter para nueva línea',
    typeResponse:    'Escriba su respuesta…',
    submit:          'Enviar',
    submitted:       '✓ Enviado',
    helpful:         '¿Fue útil?',
    noteRequired:    'Nota requerida…',
    recorded:        'registrado',
    intakeQuestion:  'Pregunta de admisión',

    yesno: { yes: 'Sí', no: 'No', unsure: 'No estoy seguro/a' },

    pre: {
      // Employment step
      empQ:        '¿Cómo está empleado/a?',
      empW2:       'Empleado/a W-2',
      emp1099:     'Contratista independiente (1099)',
      empUnsure:   'No estoy seguro/a',

      // Gov step
      govQ:        '¿Para quién trabaja?',
      govPrivate:  'Empresa o negocio privado',
      govState:    'Gobierno estatal o local',
      govFederal:  'Gobierno federal (USPS, militar, VA, etc.)',
      govUnsure:   'No estoy seguro/a',

      // Location step
      liveLabel:         '¿Dónde vive?',
      injuredLabel:      '¿Dónde ocurrió la lesión?',
      cityPlaceholder:   'Ciudad',
      statePlaceholder:  'Estado (ej. CA)',
      sameStateQ:        '¿Trabaja principalmente en el mismo estado donde ocurrió la lesión?',
      sameYes:           'Sí',
      sameDiff:          'No — trabajo principalmente en otro estado',
      primaryWorkState:  'Estado de trabajo principal',
      nextBtn:           'Siguiente →',

      // Activity step
      actQ:          '¿Qué estaba haciendo cuando se lesionó?',
      actWorking:    'Trabajando en su lugar de trabajo',
      actTravel:     'Viaje de negocios — fuera de casa por trabajo',
      actCommuting:  'Yendo o viniendo del trabajo',
      actOther:      'Otra cosa / no estoy seguro/a',

      // Commuting step
      commutingTitle: 'Algunas preguntas sobre su trayecto',
      commuting: [
        '¿Viajaba entre dos lugares de trabajo (p. ej. obras, oficinas)?',
        '¿Su empleador le proporciona o paga su vehículo?',
        '¿Realizaba un encargo de trabajo durante el trayecto?',
        '¿Trabaja desde casa y viajaba a un cliente o sitio de trabajo?',
      ],

      // Stops
      stop1099Title: 'Es posible que no podamos ayudarle',
      stop1099Body:  'La compensación laboral de California cubre a empleados W-2. Los contratistas independientes generalmente no son elegibles. Si cree que puede estar clasificado/a incorrectamente, le recomendamos hablar con un abogado laboral.',

      stopFedTitle:  'Los empleados federales tienen cobertura diferente',
      stopFedBody:   'Los empleados del gobierno federal están cubiertos bajo FECA (Ley de Compensación de Empleados Federales), no la compensación laboral de California. Le recomendamos contactar al Departamento de Trabajo de EE.UU.',

      softStopTitle:    'La jurisdicción puede ser limitada',
      softStopBody:     'Según sus respuestas, no está claro si la compensación laboral de California cubre su lesión. Un abogado deberá revisar los hechos específicos.',
      softStopContinue: 'Continuar de todas formas →',
      softStopBack:     '← Volver',

      startBtn: 'Comenzar →',

      beforeBeginTitle:       'Antes de comenzar',
      beforeBeginSub:         'Algunas preguntas rápidas para confirmar elegibilidad y establecer jurisdicción.',
      locationTitle:          'Ubicación y circunstancias',
      startOver:              '← Volver a empezar',
      outOfStateNote:         'La lesión ocurrió fuera de California — algunas preguntas más para verificar jurisdicción',
      commutingExcSub:        'Las lesiones durante el trayecto al trabajo generalmente no están cubiertas, pero existen varias excepciones. Por favor responda cada pregunta:',
      softStopCommutingTitle: 'Es posible que la lesión no esté cubierta',
      softStopCommutingBody:  'Las lesiones que ocurren durante el trayecto al o del trabajo generalmente están excluidas de la compensación laboral de California, y no se identificó ninguna excepción aplicable según sus respuestas.',
      softStopJurTitle:       'Se requiere revisión de jurisdicción',
      softStopJurBody:        'La lesión ocurrió fuera de California ({state}) y no se estableció una conexión clara con la jurisdicción de compensación laboral de California según sus respuestas. Es posible que esta reclamación deba presentarse en ese estado.',
      softStopNote:           'Esto no es necesariamente el final. Un abogado puede identificar hechos adicionales que establezcan cobertura. Puede continuar el proceso de admisión y la pregunta de jurisdicción será marcada para revisión del abogado.',
      softStopContinueFlag:   'Continuar — Marcar para revisión del abogado',
      stop1099Misclass:       '¿Fue clasificado/a incorrectamente?',
      stop1099MisclassBody:   'Si cree que su empleador lo/la clasificó incorrectamente como contratista independiente cuando debería ser empleado/a W-2, esa determinación requiere revisión de un abogado — comuníquese con nosotros directamente.',
    },

    landing: {
      tagline:  'California • Evaluación de casos',
      title:    "Herramienta de Evaluación\nde Compensación Laboral",
      subtitle: "Entrevistas de admisión impulsadas por IA para casos de compensación laboral en California. Estructuradas, exhaustivas y diseñadas para identificar lo más importante antes de la revisión del abogado.",
      startBtn: 'Comenzar nueva admisión →',
      features: [
        { icon: '📋', title: 'Preguntas estructuradas',    desc: 'Admisión de 10 etapas guiada por IA que cubre empleo, mecánica de la lesión, tratamiento, estado del reclamo, disputas de QME, testigos, historial previo y más.' },
        { icon: '🚩', title: 'Detección de alertas',       desc: 'Rastrea automáticamente retrasos en reportes, estado de contratista, cronologías contradictorias y más de 10 factores de riesgo.' },
        { icon: '📊', title: 'Informe de viabilidad',      desc: 'Genera un resumen del caso con puntuación, lista de alertas y recomendación para el abogado.' },
      ],
    },
  },
}

// ─── Scripted questions per language ──────────────────────────────────────────

const QUESTIONS_EN = [
  {
    idx: 0, type: 'form', topic: 'Contact Information',
    intro: "Let's start with a few basics.",
    fields: [
      { key: 'name',  label: 'Full Legal Name',  type: 'text',  placeholder: 'e.g. Maria Garcia',   required: true },
      { key: 'phone', label: 'Phone Number',      type: 'tel',   placeholder: '(555) 555-5555',       required: true },
      { key: 'email', label: 'Email Address',     type: 'email', placeholder: 'you@email.com',        required: false },
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
      { key: 'injury_time',        label: 'Approximate Time of Day', type: 'text',     placeholder: 'e.g. around 2:30 PM',                          required: true },
      { key: 'injury_location',    label: 'Where Did It Happen?',    type: 'text',     placeholder: 'e.g. Warehouse floor, aisle 3 — 123 Main St', required: true },
      { key: 'body_part',          label: 'Body Part(s) Injured',    type: 'text',     placeholder: 'e.g. Lower back, right knee',                  required: true },
      { key: 'injury_description', label: 'How Did It Happen?',      type: 'textarea', placeholder: 'Describe step by step what happened…',         required: true },
    ],
  },
  {
    idx: 3, type: 'form', topic: 'Reporting',
    intro: "Tell me about how and when the injury was reported.",
    fields: [
      { key: 'report_date',    label: 'Date employer was first notified',   type: 'date',   required: true },
      { key: 'reported_to',    label: 'Who was notified? (name and role)',  type: 'text',   placeholder: 'e.g. Supervisor Jane Doe, HR', required: true },
      { key: 'written_report', label: 'Written incident report completed?', type: 'select', options: ['Yes', 'No', 'Unknown'],           required: true },
    ],
  },
  {
    idx: 4, type: 'form', topic: 'Medical Treatment',
    intro: "Tell me about the medical care you received.",
    fields: [
      { key: 'facility',    label: 'Medical Facility or Hospital', type: 'text', placeholder: 'e.g. Kaiser Permanente Oakland', required: true },
      { key: 'doctor',      label: 'Treating Doctor (if known)',   type: 'text', placeholder: 'e.g. Dr. Kim',                   required: false },
      { key: 'first_visit', label: 'Date of First Treatment',     type: 'date',                                                required: true },
    ],
  },
  {
    idx: 5, type: 'form', topic: 'Claim Status & Medical Disputes',
    intro: 'A few questions about how the insurance company has responded and whether any independent medical evaluation has been involved.',
    fields: [
      {
        key: 'claim_status',
        label: 'Has the insurance company issued a decision on your claim?',
        type: 'select',
        options: ['Accepted (liability admitted)', 'Denied', 'Still under investigation — no decision yet', 'Unknown / unsure'],
        required: true,
      },
      {
        key: 'denial_reason',
        label: 'What reason did they give for denying the claim?',
        type: 'textarea',
        conditionKey: 'claim_status', conditionValue: 'Denied',
        placeholder: 'e.g. "Injury not work-related" or "Missed the reporting deadline"…',
        required: false,
      },
      {
        key: 'treating_type',
        label: 'Who is your current treating physician?',
        type: 'select',
        options: [
          'Employer\'s assigned MPN (network) doctor',
          'My own pre-designated personal doctor',
          'Emergency / urgent care only — no ongoing treating physician',
          'No treatment yet',
          'Unknown / unsure',
        ],
        required: true,
      },
      {
        key: 'treatment_denied',
        label: 'Has the insurance company denied or delayed any treatment recommended by your doctor?',
        type: 'yesno', includeUnsure: true,
        required: true,
      },
      {
        key: 'qme_stage',
        label: 'Has a Qualified Medical Evaluator (QME) or Agreed Medical Evaluator (AME) been involved?',
        type: 'select',
        options: [
          'No — not involved yet',
          'Requested — waiting for panel from DWC',
          'Panel received — I still need to choose a doctor (10-day deadline)',
          'Appointment scheduled — exam upcoming',
          'Exam completed — awaiting or received the report',
          'Unknown / unsure',
        ],
        required: true,
      },
      {
        key: 'qme_findings',
        label: 'Briefly describe the QME / AME outcome — did the evaluator agree with your treating doctor?',
        type: 'textarea',
        conditionKey: 'qme_stage', conditionValue: 'Exam completed — awaiting or received the report',
        placeholder: 'e.g. QME agreed with treating doctor — or — QME found a lesser injury and gave a 5% PD rating…',
        required: false,
      },
      {
        key: 'ps_declared',
        label: 'Has your treating doctor declared you Permanent & Stationary (P&S) — meaning your condition has stabilized and further treatment won\'t significantly improve it?',
        type: 'yesno', includeUnsure: true,
        required: true,
      },
    ],
  },
  {
    idx: 6, type: 'chat',
    text: "Was anyone else present when the injury occurred — coworkers, supervisors, or bystanders? If so, please share their names and contact information if you have it.",
  },
  {
    idx: 7, type: 'form', topic: 'Prior Injury History',
    intro: "One question about prior injuries.",
    fields: [
      { key: 'has_prior',     label: 'Prior injuries, accidents, or pre-existing conditions to the same body part?', type: 'yesno',    includeUnsure: true, required: true },
      { key: 'prior_details', label: 'Describe the prior injury or condition',                                       type: 'textarea', conditionKey: 'has_prior', conditionValue: 'yes', placeholder: 'Condition and when it occurred…', required: false },
    ],
  },
  {
    idx: 8, type: 'form', topic: 'Current Employment Status',
    intro: "What is your current work situation?",
    fields: [
      { key: 'status',             label: 'Current status',                              type: 'select',   options: ['Still working — same position', 'Modified / light duty', 'Terminated', 'Resigned / quit', 'On medical leave', 'Other'], required: true },
      { key: 'term_date',          label: 'Date of termination or last day worked',      type: 'date',     conditionKey: 'status', conditionValues: ['Terminated', 'Resigned / quit'], required: false },
      { key: 'term_circumstances', label: 'Circumstances (describe what happened)',      type: 'textarea', conditionKey: 'status', conditionValues: ['Terminated', 'Resigned / quit'], placeholder: 'What happened and when…', required: false },
    ],
  },
  {
    idx: 9, type: 'form', topic: 'Recorded Statements',
    intro: "Last question — regarding any statements you may have provided.",
    fields: [
      { key: 'statement_given',   label: 'Have you given a recorded or written statement to the insurance company or your employer?', type: 'yesno',    includeUnsure: true, required: true },
      { key: 'statement_details', label: 'When, with whom, and what was discussed?',                                                  type: 'textarea', conditionKey: 'statement_given', conditionValue: 'yes', placeholder: 'e.g. May 15 — spoke to adjuster Sarah Jones…', required: false },
    ],
  },
]

const QUESTIONS_ES = [
  {
    idx: 0, type: 'form', topic: 'Información de contacto',
    intro: "Comencemos con algunos datos básicos.",
    fields: [
      { key: 'name',  label: 'Nombre legal completo', type: 'text',  placeholder: 'ej. María García',    required: true },
      { key: 'phone', label: 'Número de teléfono',    type: 'tel',   placeholder: '(555) 555-5555',       required: true },
      { key: 'email', label: 'Correo electrónico',    type: 'email', placeholder: 'usted@correo.com',     required: false },
    ],
  },
  {
    idx: 1, type: 'form', topic: 'Empleo',
    intro: "Cuénteme sobre su trabajo.",
    fields: [
      { key: 'employer',       label: 'Empleador / Nombre de la empresa', type: 'text',   placeholder: 'ej. Amazon Logistics',    required: true },
      { key: 'job_title',      label: 'Título del puesto',                type: 'text',   placeholder: 'ej. Asociado de almacén', required: true },
      { key: 'hours_per_week', label: 'Horas promedio por semana',        type: 'number', placeholder: '40',                      required: true },
    ],
  },
  {
    idx: 2, type: 'form', topic: 'Detalles de la lesión',
    intro: "Cuénteme sobre la lesión.",
    fields: [
      { key: 'injury_date',        label: 'Fecha de la lesión',              type: 'date',     required: true },
      { key: 'injury_time',        label: 'Hora aproximada',                 type: 'text',     placeholder: 'ej. alrededor de las 2:30 PM',             required: true },
      { key: 'injury_location',    label: '¿Dónde ocurrió?',                 type: 'text',     placeholder: 'ej. Piso del almacén, pasillo 3 — 123 Main St', required: true },
      { key: 'body_part',          label: 'Parte(s) del cuerpo lesionada(s)', type: 'text',    placeholder: 'ej. Espalda baja, rodilla derecha',         required: true },
      { key: 'injury_description', label: '¿Cómo ocurrió?',                  type: 'textarea', placeholder: 'Describa paso a paso lo que pasó…',         required: true },
    ],
  },
  {
    idx: 3, type: 'form', topic: 'Reporte del accidente',
    intro: "Cuénteme cómo y cuándo se reportó la lesión.",
    fields: [
      { key: 'report_date',    label: 'Fecha en que notificó al empleador',   type: 'date',   required: true },
      { key: 'reported_to',    label: '¿A quién notificó? (nombre y cargo)',  type: 'text',   placeholder: 'ej. Supervisora Jane Doe, Recursos Humanos', required: true },
      { key: 'written_report', label: '¿Se completó un reporte escrito?',     type: 'select', options: ['Sí', 'No', 'No sé'],                            required: true },
    ],
  },
  {
    idx: 4, type: 'form', topic: 'Atención médica',
    intro: "Cuénteme sobre la atención médica que recibió.",
    fields: [
      { key: 'facility',    label: 'Clínica u hospital',                type: 'text', placeholder: 'ej. Kaiser Permanente Oakland', required: true },
      { key: 'doctor',      label: 'Médico tratante (si lo sabe)',      type: 'text', placeholder: 'ej. Dr. Kim',                   required: false },
      { key: 'first_visit', label: 'Fecha de la primera consulta',     type: 'date',                                               required: true },
    ],
  },
  {
    idx: 5, type: 'form', topic: 'Estado del reclamo y disputas médicas',
    intro: 'Algunas preguntas sobre la respuesta de la aseguradora y si ha habido alguna evaluación médica independiente.',
    fields: [
      {
        key: 'claim_status',
        label: '¿Ha emitido la aseguradora una decisión sobre su reclamo?',
        type: 'select',
        options: ['Aceptado (responsabilidad admitida)', 'Denegado', 'En investigación — sin decisión aún', 'No sé / no estoy seguro/a'],
        required: true,
      },
      {
        key: 'denial_reason',
        label: '¿Qué razón le dieron para denegar el reclamo?',
        type: 'textarea',
        conditionKey: 'claim_status', conditionValue: 'Denegado',
        placeholder: 'ej. "La lesión no está relacionada con el trabajo" o "No reportó a tiempo"…',
        required: false,
      },
      {
        key: 'treating_type',
        label: '¿Quién es su médico tratante actual?',
        type: 'select',
        options: [
          'Médico asignado por el empleador (MPN)',
          'Mi propio médico personal predesignado',
          'Solo atención de urgencias — sin médico tratante permanente',
          'Sin tratamiento aún',
          'No sé / no estoy seguro/a',
        ],
        required: true,
      },
      {
        key: 'treatment_denied',
        label: '¿Ha denegado o retrasado la aseguradora algún tratamiento recomendado por su médico?',
        type: 'yesno', includeUnsure: true,
        required: true,
      },
      {
        key: 'qme_stage',
        label: '¿Se ha involucrado un Evaluador Médico Calificado (QME) o un Evaluador Médico Acordado (AME)?',
        type: 'select',
        options: [
          'No — aún no',
          'Solicitado — esperando el panel del DWC',
          'Panel recibido — debo elegir un médico (plazo de 10 días)',
          'Cita programada — examen próximo',
          'Examen completado — esperando o recibido el informe',
          'No sé / no estoy seguro/a',
        ],
        required: true,
      },
      {
        key: 'qme_findings',
        label: '¿El evaluador estuvo de acuerdo con su médico tratante? Describa brevemente el resultado.',
        type: 'textarea',
        conditionKey: 'qme_stage', conditionValue: 'Examen completado — esperando o recibido el informe',
        placeholder: 'ej. El QME estuvo de acuerdo con el médico tratante — o — El QME encontró una lesión menor y dio 5% de discapacidad permanente…',
        required: false,
      },
      {
        key: 'ps_declared',
        label: '¿Ha declarado su médico tratante que está Permanente y Estacionario (P&S) — es decir, que su condición se ha estabilizado y el tratamiento adicional no la mejorará significativamente?',
        type: 'yesno', includeUnsure: true,
        required: true,
      },
    ],
  },
  {
    idx: 6, type: 'chat',
    text: "¿Había otras personas presentes cuando ocurrió la lesión — compañeros de trabajo, supervisores o testigos? Si es así, por favor comparta sus nombres e información de contacto si la tiene.",
  },
  {
    idx: 7, type: 'form', topic: 'Historial de lesiones previas',
    intro: "Una pregunta sobre lesiones anteriores.",
    fields: [
      { key: 'has_prior',     label: '¿Ha tenido lesiones, accidentes o condiciones previas en la misma parte del cuerpo?', type: 'yesno',    includeUnsure: true, required: true },
      { key: 'prior_details', label: 'Describa la lesión o condición anterior',                                             type: 'textarea', conditionKey: 'has_prior', conditionValue: 'yes', placeholder: 'Condición y cuándo ocurrió…', required: false },
    ],
  },
  {
    idx: 8, type: 'form', topic: 'Situación laboral actual',
    intro: "¿Cuál es su situación laboral actual?",
    fields: [
      { key: 'status',             label: 'Estado actual',                              type: 'select',   options: ['Trabajando — mismo puesto', 'Trabajo modificado / labores ligeras', 'Despedido/a', 'Renunció', 'En licencia médica', 'Otro'], required: true },
      { key: 'term_date',          label: 'Fecha de despido o último día trabajado',    type: 'date',     conditionKey: 'status', conditionValues: ['Despedido/a', 'Renunció'], required: false },
      { key: 'term_circumstances', label: 'Circunstancias (describa lo que ocurrió)',  type: 'textarea', conditionKey: 'status', conditionValues: ['Despedido/a', 'Renunció'], placeholder: 'Qué pasó y cuándo…', required: false },
    ],
  },
  {
    idx: 9, type: 'form', topic: 'Declaraciones grabadas',
    intro: "Última pregunta — sobre declaraciones que haya dado.",
    fields: [
      { key: 'statement_given',   label: '¿Ha dado una declaración grabada o escrita a la aseguradora o a su empleador?', type: 'yesno',    includeUnsure: true, required: true },
      { key: 'statement_details', label: '¿Cuándo, con quién y qué se habló?',                                             type: 'textarea', conditionKey: 'statement_given', conditionValue: 'yes', placeholder: 'ej. 15 de mayo — hablé con la ajustadora Sarah Jones…', required: false },
    ],
  },
]

export function getQuestions(lang) {
  return lang === 'es' ? QUESTIONS_ES : QUESTIONS_EN
}
