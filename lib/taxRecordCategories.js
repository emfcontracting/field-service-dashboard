// lib/taxRecordCategories.js
// ─────────────────────────────────────────────────────────────────────────────
// Default tax expense categories for the Contractor Tax Records feature.
// Mirrors the standard "TaxRecord_Template.xlsx" layout (26 columns, 6 groups).
//
// Custom categories beyond these defaults are stored in the
// contractor_tax_categories table and merged in at the page level.
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_CATEGORY_GROUPS = [
  { key: 'business',   label: 'Business Expenses', color: '#E06666', icon: '💼' },
  { key: 'vehicle',    label: 'Vehicle',           color: '#93C47D', icon: '🚛' },
  { key: 'medical',    label: 'Medical',           color: '#6D9EEB', icon: '⚕️' },
  { key: 'home',       label: 'Home',              color: '#F6B26B', icon: '🏠' },
  { key: 'insurance',  label: 'Insurance',         color: '#8E7CC3', icon: '🛡️' },
  { key: 'charitable', label: 'Charitable',        color: '#76A5AF', icon: '❤️' },
  { key: 'custom',     label: 'Custom',            color: '#9CA3AF', icon: '✏️' },
];

export const DEFAULT_TAX_CATEGORIES = [
  // Business Expenses (red)
  { name: 'Material',         group: 'business', color: '#E06666', order: 1  },
  { name: 'Clothing',         group: 'business', color: '#E06666', order: 2  },
  { name: 'Boots',            group: 'business', color: '#E06666', order: 3  },
  { name: 'Tools',            group: 'business', color: '#E06666', order: 4  },
  { name: 'Phone',            group: 'business', color: '#E06666', order: 5  },
  { name: 'Office',           group: 'business', color: '#E06666', order: 6  },
  { name: 'Internet',         group: 'business', color: '#E06666', order: 7  },
  { name: 'Liability',        group: 'business', color: '#E06666', order: 8  },
  { name: 'Hotels',           group: 'business', color: '#E06666', order: 9  },

  // Vehicle (green)
  { name: 'Truck Loan',       group: 'vehicle',  color: '#93C47D', order: 10 },
  { name: 'Insurance',        group: 'vehicle',  color: '#93C47D', order: 11 },
  { name: 'Maintenance',      group: 'vehicle',  color: '#93C47D', order: 12 },
  { name: 'Mileage',          group: 'vehicle',  color: '#93C47D', order: 13 },
  { name: 'Gas',              group: 'vehicle',  color: '#93C47D', order: 14 },
  { name: 'Taxes',            group: 'vehicle',  color: '#93C47D', order: 15 },

  // Medical (blue)
  { name: 'Health',           group: 'medical',  color: '#6D9EEB', order: 16 },
  { name: 'Medication',       group: 'medical',  color: '#6D9EEB', order: 17 },
  { name: 'Dental',           group: 'medical',  color: '#6D9EEB', order: 18 },
  { name: 'Surgery',          group: 'medical',  color: '#6D9EEB', order: 19 },

  // Home (orange)
  { name: 'Mortgage',         group: 'home',     color: '#F6B26B', order: 20 },
  { name: 'Property Tax',     group: 'home',     color: '#F6B26B', order: 21 },
  { name: 'House Repairs',    group: 'home',     color: '#F6B26B', order: 22 },

  // Insurance (purple)
  { name: 'House Insurance',  group: 'insurance',color: '#8E7CC3', order: 23 },
  { name: 'Life Insurance',   group: 'insurance',color: '#8E7CC3', order: 24 },

  // Charitable (teal)
  { name: 'Charity',          group: 'charitable',color: '#76A5AF',order: 25 },
];

/**
 * Merge default categories with user's custom categories.
 * Returns ordered list with defaults first, then customs by display_order.
 */
export function mergeCategories(customCategories = []) {
  const defaults = DEFAULT_TAX_CATEGORIES.map(c => ({
    ...c,
    isDefault: true,
    category_id: `default:${c.name}`,
  }));
  const customs = customCategories.map(c => ({
    name: c.category_name,
    group: 'custom',
    color: c.color_hex || '#9CA3AF',
    order: 1000 + (c.display_order || 0),
    isDefault: false,
    category_id: c.category_id,
  }));
  return [...defaults, ...customs].sort((a, b) => a.order - b.order);
}

/**
 * Group categories by their group key for UI display.
 */
export function groupCategories(categories) {
  const grouped = {};
  for (const cat of categories) {
    if (!grouped[cat.group]) grouped[cat.group] = [];
    grouped[cat.group].push(cat);
  }
  return grouped;
}

/**
 * Get the color for a given category name (used in exports).
 */
export function getCategoryColor(categoryName, customCategories = []) {
  const def = DEFAULT_TAX_CATEGORIES.find(c => c.name === categoryName);
  if (def) return def.color;
  const custom = customCategories.find(c => c.category_name === categoryName);
  if (custom) return custom.color_hex || '#9CA3AF';
  return '#9CA3AF';
}
