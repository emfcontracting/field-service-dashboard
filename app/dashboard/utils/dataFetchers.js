// app/dashboard/utils/dataFetchers.js

export async function fetchWorkOrders(supabase) {
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      lead_tech:users!lead_tech_id(first_name, last_name, email),
      locked_by_user:users!locked_by(first_name, last_name),
      nte_quotes:work_order_quotes(quote_id, is_verbal_nte, nte_status, created_at)
    `)
    .order('date_entered', { ascending: true });

  if (error) {
    console.error('Error fetching work orders:', error);
    return [];
  }

  // Filter out acknowledged and invoiced work orders
  const filteredData = (data || []).filter(wo => {
    if (wo.acknowledged) return false;
    if (wo.is_locked) return false;
    return true;
  });

  // Fetch daily hours totals for all work orders
  if (filteredData.length > 0) {
    const woIds = filteredData.map(wo => wo.wo_id);
    
    const { data: dailyHoursData, error: dailyError } = await supabase
      .from('daily_hours_log')
      .select('wo_id, hours_regular, hours_overtime, miles')
      .in('wo_id', woIds);

    if (!dailyError && dailyHoursData) {
      // Aggregate daily hours by work order
      const dailyTotals = {};
      dailyHoursData.forEach(log => {
        if (!dailyTotals[log.wo_id]) {
          dailyTotals[log.wo_id] = { hours_regular: 0, hours_overtime: 0, miles: 0 };
        }
        dailyTotals[log.wo_id].hours_regular += parseFloat(log.hours_regular) || 0;
        dailyTotals[log.wo_id].hours_overtime += parseFloat(log.hours_overtime) || 0;
        dailyTotals[log.wo_id].miles += parseFloat(log.miles) || 0;
      });

      // Also fetch team member legacy hours from work_order_assignments
      const { data: assignmentsData } = await supabase
        .from('work_order_assignments')
        .select('wo_id, hours_regular, hours_overtime, miles')
        .in('wo_id', woIds);

      const assignmentTotals = {};
      if (assignmentsData) {
        assignmentsData.forEach(assign => {
          if (!assignmentTotals[assign.wo_id]) {
            assignmentTotals[assign.wo_id] = { hours_regular: 0, hours_overtime: 0, miles: 0 };
          }
          assignmentTotals[assign.wo_id].hours_regular += parseFloat(assign.hours_regular) || 0;
          assignmentTotals[assign.wo_id].hours_overtime += parseFloat(assign.hours_overtime) || 0;
          assignmentTotals[assign.wo_id].miles += parseFloat(assign.miles) || 0;
        });
      }

      // Merge daily hours and assignment totals into work orders
      filteredData.forEach(wo => {
        const daily = dailyTotals[wo.wo_id] || { hours_regular: 0, hours_overtime: 0, miles: 0 };
        const assignments = assignmentTotals[wo.wo_id] || { hours_regular: 0, hours_overtime: 0, miles: 0 };
        
        // Combined totals: WO legacy + daily hours log + team assignments
        wo.total_hours_regular = (parseFloat(wo.hours_regular) || 0) + daily.hours_regular + assignments.hours_regular;
        wo.total_hours_overtime = (parseFloat(wo.hours_overtime) || 0) + daily.hours_overtime + assignments.hours_overtime;
        wo.total_miles = (parseFloat(wo.miles) || 0) + daily.miles + assignments.miles;
      });
    }
  }

  return filteredData;
}

export async function fetchUsers(supabase) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .in('role', ['admin', 'lead_tech', 'tech', 'helper', 'office'])
    .order('first_name');

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

export async function updateWorkOrder(supabase, woId, updates) {
  const { error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('wo_id', woId);

  if (error) {
    console.error('Error updating work order:', error);
    throw error;
  }

  return true;
}

export async function deleteWorkOrder(supabase, woId) {
  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('wo_id', woId);

  if (error) {
    console.error('Error deleting work order:', error);
    throw error;
  }

  return true;
}

export async function acknowledgeWorkOrder(supabase, woId) {
  const { error } = await supabase
    .from('work_orders')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: null
    })
    .eq('wo_id', woId);

  if (error) {
    console.error('Error acknowledging work order:', error);
    throw error;
  }

  return true;
}

export async function assignToField(supabase, woId) {
  const { error } = await supabase
    .from('work_orders')
    .update({
      assigned_to_field: true,
      assigned_to_field_by: 'admin',
      assigned_to_field_at: new Date().toISOString()
    })
    .eq('wo_id', woId);

  if (error) {
    console.error('Error assigning to field:', error);
    throw error;
  }

  return true;
}

export async function unassignFromField(supabase, woId) {
  const { error } = await supabase
    .from('work_orders')
    .update({
      assigned_to_field: false,
      assigned_to_field_by: null,
      assigned_to_field_at: null
    })
    .eq('wo_id', woId);

  if (error) {
    console.error('Error unassigning from field:', error);
    throw error;
  }

  return true;
}

export async function addTeamMember(supabase, woId, userId, role) {
  const { error } = await supabase
    .from('work_order_assignments')
    .insert({
      wo_id: woId,
      user_id: userId,
      role: role,
      hours_regular: 0,
      hours_overtime: 0,
      miles: 0
    });

  if (error) {
    console.error('Error adding team member:', error);
    throw error;
  }

  return true;
}

export async function removeTeamMember(supabase, assignmentId) {
  const { error } = await supabase
    .from('work_order_assignments')
    .delete()
    .eq('assignment_id', assignmentId);

  if (error) {
    console.error('Error removing team member:', error);
    throw error;
  }

  return true;
}

export async function updateTeamMember(supabase, assignmentId, updates) {
  const { error } = await supabase
    .from('work_order_assignments')
    .update(updates)
    .eq('assignment_id', assignmentId);

  if (error) {
    console.error('Error updating team member:', error);
    throw error;
  }

  return true;
}