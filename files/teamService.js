// Team Service - All team management API operations

export async function loadAllTeamMembers(supabase) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['tech', 'helper', 'lead_tech'])
      .eq('is_active', true)
      .order('first_name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading team members:', err);
    throw err;
  }
}

export async function loadTeamForWorkOrder(supabase, woId) {
  if (!woId) {
    console.error('loadTeamForWorkOrder: No work order ID provided');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('work_order_assignments')
      .select(`
        assignment_id,
        user_id,
        role_on_job,
        hours_regular,
        hours_overtime,
        miles,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', woId);
    
    if (error) {
      console.error('Error loading team for work order:', error);
      return [];
    }
    
    console.log('Team loaded successfully:', data);
    return data || [];
  } catch (err) {
    console.error('Exception in loadTeamForWorkOrder:', err);
    return [];
  }
}

export async function addTeamMember(supabase, woId, memberId, roleOnJob = 'helper') {
  try {
    const { error } = await supabase
      .from('work_order_assignments')
      .insert({
        wo_id: woId,
        user_id: memberId,
        role_on_job: roleOnJob
      });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding team member:', err);
    throw err;
  }
}

export async function updateTeamMemberField(supabase, assignmentId, field, value) {
  try {
    const { error } = await supabase
      .from('work_order_assignments')
      .update({ [field]: value })
      .eq('assignment_id', assignmentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating team member:', err);
    throw err;
  }
}

export async function removeTeamMember(supabase, assignmentId) {
  try {
    const { error } = await supabase
      .from('work_order_assignments')
      .delete()
      .eq('assignment_id', assignmentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error removing team member:', err);
    throw err;
  }
}
