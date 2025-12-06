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