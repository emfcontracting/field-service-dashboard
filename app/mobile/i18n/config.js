// i18n Configuration and Translation System
import { useState, useEffect } from 'react';

// Get saved language from localStorage or default to English
export function getSavedLanguage() {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem('appLanguage') || 'en';
}

// Save language preference
export function saveLanguage(lang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('appLanguage', lang);
}

// Custom hook for translations
export function useTranslation() {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    setLanguage(getSavedLanguage());
  }, []);

  const changeLanguage = (newLang) => {
    setLanguage(newLang);
    saveLanguage(newLang);
    // Force re-render of the entire app
    window.dispatchEvent(new Event('languagechange'));
  };

  const t = (key) => {
    const translation = translations[language]?.[key] || translations['en']?.[key] || key;
    return translation;
  };

  return { t, language, changeLanguage };
}

// All translations
const translations = {
  en: {
    // Loading & Auth
    'loading': 'Loading...',
    'login': 'Login',
    'email': 'Email',
    'pin': 'PIN',
    'logout': 'Logout',
    'changePin': 'Change PIN',
    'newPin': 'New PIN',
    'confirmPin': 'Confirm PIN',
    'changingPin': 'Changing...',
    'pinChanged': 'PIN changed successfully!',
    
    // Header
    'dashboard': 'Dashboard',
    'completed': 'Completed',
    
    // Work Orders List
    'myWorkOrders': 'My Work Orders',
    'activeWorkOrders': 'active work orders',
    'activeWorkOrder': 'active work order',
    'noActiveWorkOrders': 'No active work orders',
    'checkBackLater': 'Check back later for new assignments',
    
    // Work Order Detail
    'back': 'Back',
    'workOrderDetails': 'Work Order Details',
    'building': 'Building',
    'requestor': 'Requestor',
    'description': 'Description',
    'dateEntered': 'Date Entered',
    'age': 'Age',
    'daysOld': 'days old',
    'nte': 'NTE (Not to Exceed)',
    
    // Quick Actions
    'quickActions': 'Quick Actions',
    'printWO': 'Print WO',
    
    // Check In/Out
    'checkIn': 'CHECK IN',
    'checkOut': 'CHECK OUT',
    'firstCheckIn': 'First Check-In',
    'firstCheckOut': 'First Check-Out',
    'seeCommentsHistory': 'See Comments below for full check-in/out history',
    
    // Team
    'primaryAssignment': 'Primary Assignment',
    'teamMembers': 'Team Members',
    'addHelper': 'Add Helper/Tech',
    'addHelperModal': 'Add Helper',
    'noTeamMembers': 'No additional team members yet',
    
    // Status
    'updateStatus': 'Update Status',
    'assigned': 'Assigned',
    'inProgress': 'In Progress',
    'pending': 'Pending',
    'needsReturn': 'Needs Return',
    'returnTrip': 'Return Trip',
    'completedStatus': 'Completed',
    
    // Field Data
    'primaryTechFieldData': 'Primary Tech Field Data',
    'regularHours': 'Regular Hours (RT)',
    'overtimeHours': 'Overtime Hours (OT)',
    'miles': 'Miles',
    'materialCost': 'Material Cost ($)',
    'emfEquipment': 'EMF Equipment ($)',
    'trailerCost': 'Trailer Cost ($)',
    'rentalCost': 'Rental Cost ($)',
    
    // Photos
    'sendPhotos': 'Send Photos',
    'takePhotosEmail': 'Take photos and email them for this work order',
    'emailPhotos': 'Email Photos to Office',
    
    // Cost Summary
    'costSummary': 'Cost Summary',
    'teamRTHours': 'TEAM RT Hours',
    'teamOTHours': 'TEAM OT Hours',
    'adminHours': '+ Admin Hours',
    'totalLabor': 'Total Labor:',
    'materials': 'Materials:',
    'markup': '+ 25% Markup:',
    'equipment': 'Equipment:',
    'trailer': 'Trailer:',
    'rental': 'Rental:',
    'totalMileage': 'Total Mileage (All Team):',
    'nteBudget': 'NTE Budget:',
    'remaining': 'Remaining:',
    
    // Comments
    'commentsNotes': 'Comments & Notes',
    'noComments': 'No comments yet',
    'addComment': 'Add a comment...',
    'addCommentButton': 'Add Comment',
    
    // Complete WO
    'completeWorkOrder': 'Complete Work Order',
    'confirmComplete': 'Are you sure you want to mark this work order as completed? This action cannot be undone from the mobile app.',
    'workOrderCompleted': 'Work order marked as completed! ✅',
    
    // Completed Work Orders Page
    'completedWorkOrders': 'Completed Work Orders',
    'noCompletedWorkOrders': 'No completed work orders',
    'tapToView': '👆 Tap any completed work order to view details',
    'completedOn': 'Completed:',
    'tech': 'Tech:',
    'hours': 'Hours:',
    
    // Availability Modal
    'availabilityOverdue': '🚨 AVAILABILITY OVERDUE',
    'submitAvailability': 'You must submit your availability to continue using the app!',
    'deadline': 'Deadline: 8:00 PM EST',
    'scheduledWork': '📅 Scheduled Work',
    'emergencyWork': '🚨 Emergency Work',
    'notAvailable': '🚫 Not Available',
    'availableForPlanned': 'Available for planned jobs',
    'availableForUrgent': 'Available for urgent calls TODAY',
    'cannotWork': 'Cannot work',
    'selectionRules': 'ℹ️ Selection Rules:',
    'selectOptions': '• Select Scheduled, Emergency, or both',
    'orSelectNotAvailable': '• OR select Not Available',
    'cannotCombine': '• Cannot combine work options with Not Available',
    'submitting': 'Submitting...',
    'submitAvailabilityButton': '✅ Submit Availability',
    'appLocked': '⚠️ App is locked until you submit',
    'availabilitySubmitted': '✅ Availability submitted successfully!',
    'selectAtLeastOne': 'Please select at least one availability option',
    
    // Errors & Validation
    'error': 'Error',
    'errorCheckingIn': 'Error checking in:',
    'errorCheckingOut': 'Error checking out:',
    'errorCompleting': 'Error completing work order:',
    'errorUpdating': 'Error updating:',
    'errorAddingComment': 'Error adding comment:',
    'errorLoadingTeam': 'Error loading team members:',
    'errorAddingTeamMember': 'Error adding team member:',
    'errorUpdatingTeamMember': 'Error updating team member:',
    'enterBothFields': 'Please enter both email and PIN',
    'enterBothPinFields': 'Please enter both PIN fields',
    'pinMustBe4Digits': 'PIN must be exactly 4 digits',
    'pinsDoNotMatch': 'PINs do not match',
    'errorChangingPin': 'Error changing PIN:',
    
    // Print Labels
    'createdOn': 'Created:',
    'priority': 'Priority:',
    'status': 'Status:',
    'signature': 'Signature:',
    'date': 'Date:',
    'print': 'Print',
    'timeAndCosts': 'Time & Costs',
    'item': 'Item',
    'amount': 'Amount',
    
    // Misc
    'hrs': 'hrs',
    'mi': 'mi',
    'saving': 'Saving...',
  },
  
  es: {
    // Loading & Auth
    'loading': 'Cargando...',
    'login': 'Iniciar sesión',
    'email': 'Correo electrónico',
    'pin': 'PIN',
    'logout': 'Cerrar sesión',
    'changePin': 'Cambiar PIN',
    'newPin': 'Nuevo PIN',
    'confirmPin': 'Confirmar PIN',
    'changingPin': 'Cambiando...',
    'pinChanged': '¡PIN cambiado exitosamente!',
    
    // Header
    'dashboard': 'Panel',
    'completed': 'Completadas',
    
    // Work Orders List
    'myWorkOrders': 'Mis Órdenes de Trabajo',
    'activeWorkOrders': 'órdenes de trabajo activas',
    'activeWorkOrder': 'orden de trabajo activa',
    'noActiveWorkOrders': 'No hay órdenes de trabajo activas',
    'checkBackLater': 'Vuelva más tarde para nuevas asignaciones',
    
    // Work Order Detail
    'back': 'Atrás',
    'workOrderDetails': 'Detalles de Orden de Trabajo',
    'building': 'Edificio',
    'requestor': 'Solicitante',
    'description': 'Descripción',
    'dateEntered': 'Fecha de Entrada',
    'age': 'Antigüedad',
    'daysOld': 'días',
    'nte': 'NTE (No Exceder)',
    
    // Quick Actions
    'quickActions': 'Acciones Rápidas',
    'printWO': 'Imprimir OT',
    
    // Check In/Out
    'checkIn': 'REGISTRAR ENTRADA',
    'checkOut': 'REGISTRAR SALIDA',
    'firstCheckIn': 'Primera Entrada',
    'firstCheckOut': 'Primera Salida',
    'seeCommentsHistory': 'Ver Comentarios abajo para historial completo',
    
    // Team
    'primaryAssignment': 'Asignación Principal',
    'teamMembers': 'Miembros del Equipo',
    'addHelper': 'Agregar Ayudante/Técnico',
    'addHelperModal': 'Agregar Ayudante',
    'noTeamMembers': 'Aún no hay miembros del equipo adicionales',
    
    // Status
    'updateStatus': 'Actualizar Estado',
    'assigned': 'Asignado',
    'inProgress': 'En Progreso',
    'pending': 'Pendiente',
    'needsReturn': 'Necesita Retorno',
    'returnTrip': 'Viaje de Retorno',
    'completedStatus': 'Completado',
    
    // Field Data
    'primaryTechFieldData': 'Datos de Campo del Técnico Principal',
    'regularHours': 'Horas Regulares (RT)',
    'overtimeHours': 'Horas Extra (OT)',
    'miles': 'Millas',
    'materialCost': 'Costo de Materiales ($)',
    'emfEquipment': 'Equipo EMF ($)',
    'trailerCost': 'Costo de Remolque ($)',
    'rentalCost': 'Costo de Alquiler ($)',
    
    // Photos
    'sendPhotos': 'Enviar Fotos',
    'takePhotosEmail': 'Tome fotos y envíelas por correo para esta orden de trabajo',
    'emailPhotos': 'Enviar Fotos a la Oficina',
    
    // Cost Summary
    'costSummary': 'Resumen de Costos',
    'teamRTHours': 'Horas RT del EQUIPO',
    'teamOTHours': 'Horas OT del EQUIPO',
    'adminHours': '+ Horas Admin',
    'totalLabor': 'Mano de Obra Total:',
    'materials': 'Materiales:',
    'markup': '+ 25% Margen:',
    'equipment': 'Equipo:',
    'trailer': 'Remolque:',
    'rental': 'Alquiler:',
    'totalMileage': 'Millaje Total (Todo el Equipo):',
    'nteBudget': 'Presupuesto NTE:',
    'remaining': 'Restante:',
    
    // Comments
    'commentsNotes': 'Comentarios y Notas',
    'noComments': 'Aún no hay comentarios',
    'addComment': 'Agregar un comentario...',
    'addCommentButton': 'Agregar Comentario',
    
    // Complete WO
    'completeWorkOrder': 'Completar Orden de Trabajo',
    'confirmComplete': '¿Está seguro de que desea marcar esta orden de trabajo como completada? Esta acción no se puede deshacer desde la aplicación móvil.',
    'workOrderCompleted': '¡Orden de trabajo marcada como completada! ✅',
    
    // Completed Work Orders Page
    'completedWorkOrders': 'Órdenes de Trabajo Completadas',
    'noCompletedWorkOrders': 'No hay órdenes de trabajo completadas',
    'tapToView': '👆 Toque cualquier orden completada para ver detalles',
    'completedOn': 'Completado:',
    'tech': 'Técnico:',
    'hours': 'Horas:',
    
    // Availability Modal
    'availabilityOverdue': '🚨 DISPONIBILIDAD VENCIDA',
    'submitAvailability': '¡Debe enviar su disponibilidad para continuar usando la aplicación!',
    'deadline': 'Fecha límite: 8:00 PM EST',
    'scheduledWork': '📅 Trabajo Programado',
    'emergencyWork': '🚨 Trabajo de Emergencia',
    'notAvailable': '🚫 No Disponible',
    'availableForPlanned': 'Disponible para trabajos planificados',
    'availableForUrgent': 'Disponible para llamadas urgentes HOY',
    'cannotWork': 'No puede trabajar',
    'selectionRules': 'ℹ️ Reglas de Selección:',
    'selectOptions': '• Seleccione Programado, Emergencia, o ambos',
    'orSelectNotAvailable': '• O seleccione No Disponible',
    'cannotCombine': '• No puede combinar opciones de trabajo con No Disponible',
    'submitting': 'Enviando...',
    'submitAvailabilityButton': '✅ Enviar Disponibilidad',
    'appLocked': '⚠️ La aplicación está bloqueada hasta que envíe',
    'availabilitySubmitted': '✅ ¡Disponibilidad enviada exitosamente!',
    'selectAtLeastOne': 'Por favor seleccione al menos una opción de disponibilidad',
    
    // Errors & Validation
    'error': 'Error',
    'errorCheckingIn': 'Error al registrar entrada:',
    'errorCheckingOut': 'Error al registrar salida:',
    'errorCompleting': 'Error al completar orden de trabajo:',
    'errorUpdating': 'Error al actualizar:',
    'errorAddingComment': 'Error al agregar comentario:',
    'errorLoadingTeam': 'Error al cargar miembros del equipo:',
    'errorAddingTeamMember': 'Error al agregar miembro del equipo:',
    'errorUpdatingTeamMember': 'Error al actualizar miembro del equipo:',
    'enterBothFields': 'Por favor ingrese correo electrónico y PIN',
    'enterBothPinFields': 'Por favor ingrese ambos campos de PIN',
    'pinMustBe4Digits': 'El PIN debe ser exactamente de 4 dígitos',
    'pinsDoNotMatch': 'Los PINs no coinciden',
    'errorChangingPin': 'Error al cambiar PIN:',
    
    // Print Labels
    'createdOn': 'Creado:',
    'priority': 'Prioridad:',
    'status': 'Estado:',
    'signature': 'Firma:',
    'date': 'Fecha:',
    'print': 'Imprimir',
    'timeAndCosts': 'Tiempo y Costos',
    'item': 'Artículo',
    'amount': 'Cantidad',
    
    // Misc
    'hrs': 'hrs',
    'mi': 'mi',
    'saving': 'Guardando...',
  }
};

export default translations;
