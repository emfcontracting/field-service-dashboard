// utils/translations.js - Complete Translation Dictionary
export const translations = {
  en: {
    // Login Screen
    login: 'Login',
    email: 'Email',
    pin: 'PIN',
    fourDigitPin: '4-digit PIN',
    emailPlaceholder: 'your.email@example.com',
    fieldServiceMobile: 'Field Service Mobile',

    // Navigation & Actions
    back: 'Back',
    logout: 'Logout',
    dashboard: 'Dashboard',
    completed: 'Completed',

    // Work Orders List
    myWorkOrders: 'My Work Orders',
    activeWork: 'active work',
    order: 'order',
    orders: 'orders',
    noActiveWorkOrders: 'No active work orders',
    checkBackLater: 'Check back later for new assignments',
    entered: 'Entered',
    daysOld: 'days old',

    // Work Order Detail
    workOrderDetails: 'Work Order Details',
    building: 'Building',
    requestor: 'Requestor',
    description: 'Description',
    dateEntered: 'Date Entered',
    age: 'Age',
    days: 'days',
    nte: 'NTE (Not to Exceed)',
    quickActions: 'Quick Actions',
    printWO: 'Print WO',
    checkIn: 'CHECK IN',
    checkOut: 'CHECK OUT',
    firstCheckIn: 'First Check-In',
    firstCheckOut: 'First Check-Out',

    // Team
    primaryAssignment: 'Primary Assignment',
    teamMembers: 'Team Members',
    addHelperTech: '+ Add Helper/Tech',
    addHelper: 'Add Helper',
    noTeamMembers: 'No additional team members yet',

    // Status
    updateStatus: 'Update Status',
    assigned: 'Assigned',
    inProgress: 'In Progress',
    pending: 'Pending',
    returnTrip: 'Return Trip',
    rejected: '❌ Rejected',

    // Field Data
    regularHours: 'Regular Hours (RT)',
    overtimeHours: 'Overtime Hours (OT)',
    miles: 'Miles',
    emfEquipment: 'EMF Equipment ($)',
    trailerCost: 'Trailer Cost ($)',
    rentalCost: 'Rental Cost ($)',
    hrs: 'hrs',

    // Cost Summary
    costSummary: 'Cost Summary',
    teamRTHours: 'TEAM RT Hours',
    teamOTHours: 'TEAM OT Hours',
    adminHours: '+ Admin Hours',
    totalLabor: 'Total Labor:',
    materials: 'Materials:',
    markup: '+ 25% Markup:',
    equipment: 'Equipment:',
    trailer: 'Trailer:',
    rental: 'Rental:',
    totalMileage: 'Total Mileage (All Team):',
    nteBudget: 'NTE Budget:',
    remaining: 'Remaining:',

    // Photos
    sendPhotos: 'Send Photos',
    takePhotosEmail: 'Take photos and email them for this work order',

    // Comments
    commentsAndNotes: 'Comments & Notes',
    noCommentsYet: 'No comments yet',
    addComment: 'Add a comment...',

    // Complete Work Order
    completeWorkOrder: 'Complete Work Order',

    // Completed Work Orders
    completedWorkOrders: 'Completed Work Orders',
    noCompletedWorkOrders: 'No completed work orders',
    tapToView: 'Tap any completed work order to view details',
    completedLabel: 'Completed',
    completedDate: 'Completed:',
    tech: 'Tech:',

    // PIN Management
    changePIN: 'Change PIN',
    newPIN: 'New PIN',
    confirmPIN: 'Confirm PIN',
    reenterPIN: 'Re-enter PIN',
    changePINButton: 'Change PIN',
    changing: 'Changing...',
    pinChangedSuccess: 'PIN changed successfully!',

    // Availability Modal
    availability: 'Availability',
    scheduledWork: 'Scheduled Work',
    availableForPlanned: 'Available for planned jobs',
    emergencyWork: 'Emergency Work',
    availableForUrgent: 'Available for urgent calls TODAY',
    notAvailable: 'Not Available',
    cannotWork: 'Cannot work',
    today: 'today',
    tomorrow: 'tomorrow',
    selectionRules: 'Selection Rules:',
    selectScheduledOrEmergency: 'Select Scheduled, Emergency, or both',
    orSelectNotAvailable: 'OR select Not Available',
    cannotCombineOptions: 'Cannot combine work options with Not Available',
    submitAvailability: 'Submit Availability',
    submitting: 'Submitting...',

    // Have work / need work + manual availability
    workStatusPrompt: "You're available — do you already have work, or do you need work?",
    haveWork: 'I already have work',
    needWork: 'I need work',
    reasonPrompt: 'Why? (so the office knows)',
    reasonReturnTrip: 'Return trip',
    reasonWaitingMaterial: 'Waiting on material',
    reasonOther: 'Other',
    workNotePlaceholder: 'Add a note (optional)…',
    myAvailability: 'My Availability',
    updateAvailability: 'Update your availability',
    close: 'Close',

    // Error Messages
    errorChangingPIN: 'Error changing PIN:',
    enterEmailAndPIN: 'Please enter both email and PIN',
    pinMustBeFourDigits: 'PIN must be exactly 4 digits',
    pinsDoNotMatch: 'PINs do not match',

    // Status Labels

    // Other
    loading: 'Loading...',
    saving: 'Saving...',
    unknown: 'Unknown',
    na: 'N/A',

    // Daily Hours Logging
    logHours: 'Log Hours',
    workDate: 'Work Date',
    notes: 'Notes',
    optional: 'optional',
    noHoursLogged: 'No hours logged yet',
    loggedAt: 'Logged at',

    // Validation Messages
    hoursCannotBeNegative: 'Hours cannot be negative',

    // CSV Export
  },

  es: {
    // Login Screen
    login: 'Iniciar sesión',
    email: 'Correo electrónico',
    pin: 'PIN',
    fourDigitPin: 'PIN de 4 dígitos',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    fieldServiceMobile: 'Servicio de Campo Móvil',

    // Navigation & Actions
    back: 'Atrás',
    logout: 'Cerrar sesión',
    dashboard: 'Panel',
    completed: 'Completadas',

    // Work Orders List
    myWorkOrders: 'Mis Órdenes de Trabajo',
    activeWork: 'trabajo activo',
    order: 'orden',
    orders: 'órdenes',
    noActiveWorkOrders: 'No hay órdenes de trabajo activas',
    checkBackLater: 'Vuelva más tarde para nuevas asignaciones',
    entered: 'Ingresado',
    daysOld: 'días',

    // Work Order Detail
    workOrderDetails: 'Detalles de la Orden de Trabajo',
    building: 'Edificio',
    requestor: 'Solicitante',
    description: 'Descripción',
    dateEntered: 'Fecha de Entrada',
    age: 'Antigüedad',
    days: 'días',
    nte: 'NTE (No Exceder)',
    quickActions: 'Acciones Rápidas',
    printWO: 'Imprimir OT',
    checkIn: 'REGISTRAR ENTRADA',
    checkOut: 'REGISTRAR SALIDA',
    firstCheckIn: 'Primera Entrada',
    firstCheckOut: 'Primera Salida',

    // Team
    primaryAssignment: 'Asignación Principal',
    teamMembers: 'Miembros del Equipo',
    addHelperTech: '+ Agregar Ayudante/Técnico',
    addHelper: 'Agregar Ayudante',
    noTeamMembers: 'Aún no hay miembros adicionales del equipo',

    // Status
    updateStatus: 'Actualizar Estado',
    assigned: 'Asignado',
    inProgress: 'En Progreso',
    pending: 'Pendiente',
    returnTrip: 'Viaje de Retorno',
    rejected: '❌ Rechazado',

    // Field Data
    regularHours: 'Horas Regulares (RT)',
    overtimeHours: 'Horas Extra (OT)',
    miles: 'Millas',
    emfEquipment: 'Equipo EMF ($)',
    trailerCost: 'Costo de Remolque ($)',
    rentalCost: 'Costo de Alquiler ($)',
    hrs: 'hrs',

    // Cost Summary
    costSummary: 'Resumen de Costos',
    teamRTHours: 'Horas RT del EQUIPO',
    teamOTHours: 'Horas OT del EQUIPO',
    adminHours: '+ Horas Admin',
    totalLabor: 'Total Mano de Obra:',
    materials: 'Materiales:',
    markup: '+ 25% Margen:',
    equipment: 'Equipo:',
    trailer: 'Remolque:',
    rental: 'Alquiler:',
    totalMileage: 'Kilometraje Total (Todo el Equipo):',
    nteBudget: 'Presupuesto NTE:',
    remaining: 'Restante:',

    // Photos
    sendPhotos: 'Enviar Fotos',
    takePhotosEmail: 'Tome fotos y envíelas por correo para esta orden de trabajo',

    // Comments
    commentsAndNotes: 'Comentarios y Notas',
    noCommentsYet: 'Aún no hay comentarios',
    addComment: 'Agregar un comentario...',

    // Complete Work Order
    completeWorkOrder: 'Completar Orden de Trabajo',

    // Completed Work Orders
    completedWorkOrders: 'Órdenes de Trabajo Completadas',
    noCompletedWorkOrders: 'No hay órdenes de trabajo completadas',
    tapToView: 'Toque cualquier orden de trabajo completada para ver detalles',
    completedLabel: 'Completado',
    completedDate: 'Completado:',
    tech: 'Técnico:',

    // PIN Management
    changePIN: 'Cambiar PIN',
    newPIN: 'Nuevo PIN',
    confirmPIN: 'Confirmar PIN',
    reenterPIN: 'Vuelva a ingresar el PIN',
    changePINButton: 'Cambiar PIN',
    changing: 'Cambiando...',
    pinChangedSuccess: '¡PIN cambiado exitosamente!',

    // Availability Modal
    availability: 'Disponibilidad',
    scheduledWork: 'Trabajo Programado',
    availableForPlanned: 'Disponible para trabajos planificados',
    emergencyWork: 'Trabajo de Emergencia',
    availableForUrgent: 'Disponible para llamadas urgentes HOY',
    notAvailable: 'No Disponible',
    cannotWork: 'No puede trabajar',
    today: 'hoy',
    tomorrow: 'mañana',
    selectionRules: 'Reglas de Selección:',
    selectScheduledOrEmergency: 'Seleccione Programado, Emergencia o ambos',
    orSelectNotAvailable: 'O seleccione No Disponible',
    cannotCombineOptions: 'No se pueden combinar opciones de trabajo con No Disponible',
    submitAvailability: 'Enviar Disponibilidad',
    submitting: 'Enviando...',

    // Have work / need work + manual availability
    workStatusPrompt: '¿Está disponible — ya tiene trabajo o necesita trabajo?',
    haveWork: 'Ya tengo trabajo',
    needWork: 'Necesito trabajo',
    reasonPrompt: '¿Por qué? (para que la oficina sepa)',
    reasonReturnTrip: 'Viaje de retorno',
    reasonWaitingMaterial: 'Esperando material',
    reasonOther: 'Otro',
    workNotePlaceholder: 'Agregar una nota (opcional)…',
    myAvailability: 'Mi Disponibilidad',
    updateAvailability: 'Actualiza tu disponibilidad',
    close: 'Cerrar',

    // Error Messages
    errorChangingPIN: 'Error al cambiar PIN:',
    enterEmailAndPIN: 'Por favor ingrese correo electrónico y PIN',
    pinMustBeFourDigits: 'El PIN debe ser exactamente de 4 dígitos',
    pinsDoNotMatch: 'Los PINs no coinciden',

    // Status Labels

    // Other
    loading: 'Cargando...',
    saving: 'Guardando...',
    unknown: 'Desconocido',
    na: 'N/D',

    // Daily Hours Logging
    logHours: 'Registrar Horas',
    workDate: 'Fecha de Trabajo',
    notes: 'Notas',
    optional: 'opcional',
    noHoursLogged: 'Aún no hay horas registradas',
    loggedAt: 'Registrado el',

    // Validation Messages
    hoursCannotBeNegative: 'Las horas no pueden ser negativas',

    // CSV Export
  }
};

// Translation helper function
export function t(key, language = 'en') {
  return translations[language]?.[key] || translations['en']?.[key] || key;
}