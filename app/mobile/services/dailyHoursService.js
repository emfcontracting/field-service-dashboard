// services/dailyHoursService.js - Daily Hours Logging Service

/**
 * Load all daily hours logs for a specific work order
 */
export async function loadDailyHoursForWorkOrder(supabase, woId) {
  try {
    const { data, error } = await supabase
      .from('daily_hours_log')
      .select(`
        *,
        user:users(first_name, last_name, role)
      `)
      .eq('wo_id', woId)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false});

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading daily hours:', err);
    throw err;
  }
}

/**
 * Load daily hours for a specific user and work order
 */
export async function loadUserDailyHours(supabase, woId, userId) {
  try {
    const { data, error } = await supabase
      .from('daily_hours_log')
      .select('*')
      .eq('wo_id', woId)
      .eq('user_id', userId)
      .order('work_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading user daily hours:', err);
    throw err;
  }
}

/**
 * Add new daily hours entry
 */
export async function addDailyHours(supabase, hoursData) {
  try {
    // First check if entry already exists for this user/date
    const { data: existing } = await supabase
      .from('daily_hours_log')
      .select('log_id')
      .eq('wo_id', hoursData.woId)
      .eq('user_id', hoursData.userId)
      .eq('work_date', hoursData.workDate)
      .maybeSingle();

    if (existing) {
      throw new Error('Hours already logged for this date. Please edit the existing entry.');
    }

    // Insert new entry
    const { data, error } = await supabase
      .from('daily_hours_log')
      .insert([{
        wo_id: hoursData.woId,
        user_id: hoursData.userId,
        assignment_id: hoursData.assignmentId || null,
        work_date: hoursData.workDate,
        hours_regular: hoursData.hoursRegular || 0,
        hours_overtime: hoursData.hoursOvertime || 0,
        miles: hoursData.miles || 0,
        notes: hoursData.notes || null,
        created_at: new Date().toISOString()
      }])
      .select(`
        *,
        user:users(first_name, last_name, role)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding daily hours:', err);
    throw err;
  }
}

/**
 * Update existing daily hours entry
 */
export async function updateDailyHours(supabase, logId, updates) {
  try {
    const { data, error } = await supabase
      .from('daily_hours_log')
      .update({
        hours_regular: updates.hoursRegular,
        hours_overtime: updates.hoursOvertime,
        miles: updates.miles,
        notes: updates.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('log_id', logId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating daily hours:', err);
    throw err;
  }
}

/**
 * Delete daily hours entry
 */
export async function deleteDailyHours(supabase, logId) {
  try {
    const { error } = await supabase
      .from('daily_hours_log')
      .delete()
      .eq('log_id', logId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting daily hours:', err);
    throw err;
  }
}

/**
 * Load all daily hours for multiple work orders (dashboard use)
 */
export async function loadBulkDailyHours(supabase, filters = {}) {
  try {
    let query = supabase
      .from('daily_hours_log')
      .select(`
        *,
        user:users(first_name, last_name, role),
        work_order:work_orders(wo_number, building, status)
      `)
      .order('work_date', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('work_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('work_date', filters.endDate);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.woId) {
      query = query.eq('wo_id', filters.woId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading bulk daily hours:', err);
    throw err;
  }
}

/**
 * Generate CSV from daily hours logs
 */
export function generateCSV(logs) {
  if (!logs || logs.length === 0) {
    return 'No data available';
  }

  // CSV Headers
  const headers = [
    'Work Order',
    'Building',
    'Tech Name',
    'Role',
    'Work Date',
    'Regular Hours',
    'Overtime Hours',
    'Total Hours',
    'Miles',
    'Regular Cost',
    'Overtime Cost',
    'Mileage Cost',
    'Total Cost',
    'Notes',
    'Logged At'
  ];

  // Build CSV rows
  const rows = logs.map(log => {
    const rt = parseFloat(log.hours_regular) || 0;
    const ot = parseFloat(log.hours_overtime) || 0;
    const miles = parseFloat(log.miles) || 0;
    const totalHours = rt + ot;
    
    // Calculate costs
    const rtCost = rt * 64;
    const otCost = ot * 96;
    const mileageCost = miles * 1.00;
    const totalCost = rtCost + otCost + mileageCost;

    return [
      log.work_order?.wo_number || 'N/A',
      log.work_order?.building || 'N/A',
      log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown',
      log.user?.role || 'N/A',
      log.work_date,
      rt.toFixed(2),
      ot.toFixed(2),
      totalHours.toFixed(2),
      miles.toFixed(1),
      `$${rtCost.toFixed(2)}`,
      `$${otCost.toFixed(2)}`,
      `$${mileageCost.toFixed(2)}`,
      `$${totalCost.toFixed(2)}`,
      log.notes ? `"${log.notes.replace(/"/g, '""')}"` : '',
      new Date(log.created_at).toLocaleString()
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Alias for generateCSV - for backward compatibility
 */
export function generateDailyHoursCSV(logs) {
  return generateCSV(logs);
}

/**
 * Download CSV helper function
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Calculate totals from daily hours logs
 */
export function calculateTotals(logs) {
  return logs.reduce((totals, log) => ({
    totalRT: totals.totalRT + (parseFloat(log.hours_regular) || 0),
    totalOT: totals.totalOT + (parseFloat(log.hours_overtime) || 0),
    totalMiles: totals.totalMiles + (parseFloat(log.miles) || 0),
    totalHours: totals.totalHours + (parseFloat(log.hours_regular) || 0) + (parseFloat(log.hours_overtime) || 0),
    totalCost: totals.totalCost + (
      ((parseFloat(log.hours_regular) || 0) * 64) +
      ((parseFloat(log.hours_overtime) || 0) * 96) +
      ((parseFloat(log.miles) || 0) * 1.00)
    )
  }), {
    totalRT: 0,
    totalOT: 0,
    totalMiles: 0,
    totalHours: 0,
    totalCost: 0
  });
}

/**
 * Calculate total hours grouped by user for a work order
 */
export async function calculateTotalHours(supabase, woId) {
  try {
    const logs = await loadDailyHoursForWorkOrder(supabase, woId);
    
    // Group by user
    const byUser = {};
    
    logs.forEach(log => {
      if (!byUser[log.user_id]) {
        byUser[log.user_id] = {
          userId: log.user_id,
          userName: log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown',
          totalRT: 0,
          totalOT: 0,
          totalMiles: 0,
          totalHours: 0,
          totalCost: 0
        };
      }
      
      const rt = parseFloat(log.hours_regular) || 0;
      const ot = parseFloat(log.hours_overtime) || 0;
      const miles = parseFloat(log.miles) || 0;
      
      byUser[log.user_id].totalRT += rt;
      byUser[log.user_id].totalOT += ot;
      byUser[log.user_id].totalMiles += miles;
      byUser[log.user_id].totalHours += rt + ot;
      byUser[log.user_id].totalCost += (rt * 64) + (ot * 96) + (miles * 1.00);
    });
    
    // Calculate grand totals
    const grandTotal = calculateTotals(logs);
    
    return {
      byUser,
      grandTotal,
      totalEntries: logs.length
    };
  } catch (err) {
    console.error('Error calculating total hours:', err);
    throw err;
  }
}

/**
 * Validate hours entry before submission
 */
export function validateHoursEntry(hoursData) {
  const errors = [];

  // Check required fields
  if (!hoursData.workDate) {
    errors.push('Work date is required');
  }

  // Check for future dates - fix timezone issue by using local date
  const workDate = new Date(hoursData.workDate + 'T12:00:00');
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (workDate > today) {
    errors.push('Cannot log hours for future dates');
  }

  // Check hours
  const rt = parseFloat(hoursData.hoursRegular) || 0;
  const ot = parseFloat(hoursData.hoursOvertime) || 0;
  const miles = parseFloat(hoursData.miles) || 0;
  const totalHours = rt + ot;

  // Must enter at least hours OR miles
  if (totalHours === 0 && miles === 0) {
    errors.push('Must enter at least hours or miles');
  }

  if (totalHours > 24) {
    errors.push('Total hours cannot exceed 24 hours per day');
  }

  if (rt < 0 || ot < 0) {
    errors.push('Hours cannot be negative');
  }

  // Check miles
  if (miles < 0) {
    errors.push('Miles cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
