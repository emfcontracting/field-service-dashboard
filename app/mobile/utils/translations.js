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
    seeCommentsForHistory: 'See Comments below for full check-in/out history',
    
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
    needsReturn: 'Needs Return',
    returnTrip: 'Return Trip',
    completedStatus: 'Completed',
    
    // Field Data
    primaryTechFieldData: 'Primary Tech Field Data',
    regularHours: 'Regular Hours (RT)',
    overtimeHours: 'Overtime Hours (OT)',
    miles: 'Miles',
    materialCost: 'Material Cost ($)',
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
    emailPhotosToOffice: 'Email Photos to Office',
    
    // Comments
    commentsAndNotes: 'Comments & Notes',
    noCommentsYet: 'No comments yet',
    addComment: 'Add a comment...',
    addCommentButton: 'Add Comment',
    
    // Complete Work Order
    completeWorkOrder: 'Complete Work Order',
    completeConfirmation: 'Are you sure you want to mark this work order as completed? This action cannot be undone from the mobile app.',
    workOrderCompleted: 'Work order marked as completed!',
    
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
    availabilityOverdue: 'AVAILABILITY OVERDUE',
    availability: 'Availability',
    mustSubmitAvailability: 'You must submit your availability to continue using the app!',
    deadline: 'Deadline: 8:00 PM EST',
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
    appLockedUntilSubmit: 'App is locked until you submit',
    availabilitySubmittedSuccess: 'Availability submitted successfully!',
    
    // Error Messages
    errorCheckingIn: 'Error checking in:',
    errorCheckingOut: 'Error checking out:',
    errorCompletingWO: 'Error completing work order:',
    errorUpdating: 'Error updating:',
    errorAddingComment: 'Error adding comment:',
    errorLoadingTeam: 'Error loading team members:',
    errorAddingTeamMember: 'Error adding team member:',
    errorUpdatingTeamMember: 'Error updating team member:',
    errorSubmittingAvailability: 'Error submitting availability:',
    errorChangingPIN: 'Error changing PIN:',
    invalidCredentials: 'Invalid email - user not found',
    noPinSet: 'No PIN set for this user. Contact admin to set up your PIN.',
    invalidPIN: 'Invalid PIN - PIN does not match',
    enterEmailAndPIN: 'Please enter both email and PIN',
    pinMustBeFourDigits: 'PIN must be exactly 4 digits',
    pinsDoNotMatch: 'PINs do not match',
    selectAtLeastOne: 'Please select at least one availability option',
    
    // Status Labels
    statusNew: 'New',
    statusInProgress: 'In Progress',
    statusCompleted: 'Completed',
    statusOnHold: 'On Hold',
    
    // Other
    loading: 'Loading...',
    saving: 'Saving...',
    unknown: 'Unknown',
    na: 'N/A'
	  },
};
	
	export const englishAdditions = {
  // Daily Hours Logging
  dailyHoursLog: 'Daily Hours Log',
  downloadCSV: 'Download CSV',
  myTotals: 'My Totals',
  teamTotals: 'Team Totals',
  addHoursForToday: 'Add Hours for Today',
  logHours: 'Log Hours',
  workDate: 'Work Date',
  loggingFor: 'Logging For',
  me: 'Me',
  notes: 'Notes',
  optional: 'optional',
  addNotesHere: 'Add notes here...',
  noHoursLogged: 'No hours logged yet',
  clickAboveToStart: 'Click above to start logging',
  you: 'You',
  loggedAt: 'Logged at',
  hoursAddedSuccess: '✅ Hours logged successfully!',
  errorLoadingDailyHours: 'Error loading daily hours',
  errorAddingHours: 'Error adding hours',
  errorDownloadingCSV: 'Error downloading CSV',
  
  // Validation Messages
  hoursCannotBeNegative: 'Hours cannot be negative',
  totalHoursExceed24: 'Total hours cannot exceed 24 hours per day',
  mustEnterHoursOrMiles: 'Must enter at least hours or miles',
  milesCannotBeNegative: 'Miles cannot be negative',
  hoursAlreadyLogged: 'Hours already logged for this date. Please edit the existing entry.',
  
  // CSV Export
  dateColumn: 'Date',
  techNameColumn: 'Tech Name',
  roleColumn: 'Role',
  regularHoursColumn: 'Regular Hours',
  overtimeHoursColumn: 'Overtime Hours',
  milesColumn: 'Miles',
  notesColumn: 'Notes',
  loggedAtColumn: 'Logged At',
};
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
    seeCommentsForHistory: 'Ver Comentarios abajo para historial completo de entrada/salida',
    
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
    needsReturn: 'Necesita Retorno',
    returnTrip: 'Viaje de Retorno',
    completedStatus: 'Completado',
    
    // Field Data
    primaryTechFieldData: 'Datos de Campo del Técnico Principal',
    regularHours: 'Horas Regulares (RT)',
    overtimeHours: 'Horas Extra (OT)',
    miles: 'Millas',
    materialCost: 'Costo de Materiales ($)',
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
    emailPhotosToOffice: 'Enviar Fotos a la Oficina',
    
    // Comments
    commentsAndNotes: 'Comentarios y Notas',
    noCommentsYet: 'Aún no hay comentarios',
    addComment: 'Agregar un comentario...',
    addCommentButton: 'Agregar Comentario',
    
    // Complete Work Order
    completeWorkOrder: 'Completar Orden de Trabajo',
    completeConfirmation: '¿Está seguro de que desea marcar esta orden de trabajo como completada? Esta acción no se puede deshacer desde la aplicación móvil.',
    workOrderCompleted: '¡Orden de trabajo marcada como completada!',
    
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
    availabilityOverdue: 'DISPONIBILIDAD VENCIDA',
    availability: 'Disponibilidad',
    mustSubmitAvailability: '¡Debe enviar su disponibilidad para continuar usando la aplicación!',
    deadline: 'Fecha límite: 8:00 PM EST',
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
    appLockedUntilSubmit: 'La aplicación está bloqueada hasta que envíe',
    availabilitySubmittedSuccess: '¡Disponibilidad enviada exitosamente!',
    
    // Error Messages
    errorCheckingIn: 'Error al registrar entrada:',
    errorCheckingOut: 'Error al registrar salida:',
    errorCompletingWO: 'Error al completar orden de trabajo:',
    errorUpdating: 'Error al actualizar:',
    errorAddingComment: 'Error al agregar comentario:',
    errorLoadingTeam: 'Error al cargar miembros del equipo:',
    errorAddingTeamMember: 'Error al agregar miembro del equipo:',
    errorUpdatingTeamMember: 'Error al actualizar miembro del equipo:',
    errorSubmittingAvailability: 'Error al enviar disponibilidad:',
    errorChangingPIN: 'Error al cambiar PIN:',
    invalidCredentials: 'Correo electrónico inválido - usuario no encontrado',
    noPinSet: 'No hay PIN configurado para este usuario. Contacte al administrador para configurar su PIN.',
    invalidPIN: 'PIN inválido - El PIN no coincide',
    enterEmailAndPIN: 'Por favor ingrese correo electrónico y PIN',
    pinMustBeFourDigits: 'El PIN debe ser exactamente de 4 dígitos',
    pinsDoNotMatch: 'Los PINs no coinciden',
    selectAtLeastOne: 'Por favor seleccione al menos una opción de disponibilidad',
    
    // Status Labels
    statusNew: 'Nuevo',
    statusInProgress: 'En Progreso',
    statusCompleted: 'Completado',
    statusOnHold: 'En Espera',
    
    // Other
    loading: 'Cargando...',
    saving: 'Guardando...',
    unknown: 'Desconocido',
    na: 'N/D'
  }
  
  export const spanishAdditions = {
  // Daily Hours Logging
  dailyHoursLog: 'Registro Diario de Horas',
  downloadCSV: 'Descargar CSV',
  myTotals: 'Mis Totales',
  teamTotals: 'Totales del Equipo',
  addHoursForToday: 'Agregar Horas para Hoy',
  logHours: 'Registrar Horas',
  workDate: 'Fecha de Trabajo',
  loggingFor: 'Registrando Para',
  me: 'Yo',
  notes: 'Notas',
  optional: 'opcional',
  addNotesHere: 'Agregar notas aquí...',
  noHoursLogged: 'Aún no hay horas registradas',
  clickAboveToStart: 'Haga clic arriba para comenzar a registrar',
  you: 'Tú',
  loggedAt: 'Registrado el',
  hoursAddedSuccess: '✅ ¡Horas registradas exitosamente!',
  errorLoadingDailyHours: 'Error al cargar horas diarias',
  errorAddingHours: 'Error al agregar horas',
  errorDownloadingCSV: 'Error al descargar CSV',
  
  // Validation Messages
  hoursCannotBeNegative: 'Las horas no pueden ser negativas',
  totalHoursExceed24: 'El total de horas no puede exceder 24 horas por día',
  mustEnterHoursOrMiles: 'Debe ingresar al menos horas o millas',
  milesCannotBeNegative: 'Las millas no pueden ser negativas',
  hoursAlreadyLogged: 'Las horas ya están registradas para esta fecha. Por favor edite la entrada existente.',
  
  // CSV Export
  dateColumn: 'Fecha',
  techNameColumn: 'Nombre del Técnico',
  roleColumn: 'Rol',
  regularHoursColumn: 'Horas Regulares',
  overtimeHoursColumn: 'Horas Extra',
  milesColumn: 'Millas',
  notesColumn: 'Notas',
  loggedAtColumn: 'Registrado el',
};
};

// Translation helper function
export function t(key, language = 'en') {
  return translations[language]?.[key] || translations['en']?.[key] || key;
}
