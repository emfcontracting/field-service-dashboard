// constants.js - All constant values and configurations

export const LABOR_RATES = {
  REGULAR: 64,
  OVERTIME: 96
};

export const MILEAGE_RATE = 1;

export const MARKUP_RATES = {
  MATERIALS: 0.25,
  EQUIPMENT_RENTAL: 0.15,
  EQUIPMENT_PURCHASE: 0.25
};

export const ROLES = {
  ADMIN: 'admin',
  OFFICE: 'office',
  LEAD_TECH: 'lead_tech',
  TECH: 'tech',
  HELPER: 'helper'
};

export const ELIGIBLE_AVAILABILITY_ROLES = ['tech', 'helper', 'lead_tech'];

export const AVAILABILITY_DEADLINE_HOUR = 20; // 8 PM EST

export const WORK_ORDER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

export const PRIORITY_LABELS = {
  P1: 'P1 - URGENT',
  P2: 'P2 - High',
  P3: 'P3 - Medium',
  P4: 'P4 - Low',
  P5: 'P5 - Routine',
  P6: 'P6',
  P7: 'P7',
  P8: 'P8',
  P9: 'P9',
  P10: 'P10',
  P11: 'P11',
  P12: 'P12',
  P13: 'P13',
  P14: 'P14',
  P15: 'P15',
  P16: 'P16',
  P17: 'P17',
  P18: 'P18',
  P19: 'P19',
  P20: 'P20',
  P21: 'P21',
  P22: 'P22',
  P23: 'P23'
};
