// Work Order Service - All WO-related API operations

export async function loadActiveWorkOrders(supabase, currentUser) {
  if (!currentUser) return [];

  try {
    // Get work orders where user is the lead tech
    const { data: leadWOs, error: leadError } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .eq('lead_tech_id', currentUser.user_id)
      .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
      .order('priority', { ascending: true })
      .order('date_entered', { ascending: true });

    if (leadError) throw leadError;

    // Get work orders where user is assigned as helper
    const { data: assignments, error: assignError } = await supabase
      .from('work_order_assignments')
      .select('wo_id, role_on_job')
      .eq('user_id', currentUser.user_id);

    if (assignError) throw assignError;

    let helperWOs = [];
    if (assignments && assignments.length > 0) {
      const woIds = assignments.map(a => a.wo_id);
      const { data: helperWOData, error: helperError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .in('wo_id', woIds)
        .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip']);

      if (helperError) throw helperError;
      helperWOs = helperWOData || [];
    }

    // Combine and deduplicate
    const allWOs = [...(leadWOs || []), ...helperWOs];
    const uniqueWOs = Array.from(
      new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
    );

    return uniqueWOs;
  } catch (err) {
    console.error('Error loading work orders:', err);
    return [];
  }
}

export async function loadCompletedWorkOrders(supabase, currentUser) {
  if (!currentUser) return [];

  try {
    const { data: leadWOs, error: leadError } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .eq('lead_tech_id', currentUser.user_id)
      .eq('status', 'completed')
      .order('date_completed', { ascending: false })
      .limit(50);

    const { data: assignments } = await supabase
      .from('work_order_assignments')
      .select('wo_id')
      .eq('user_id', currentUser.user_id);

    let helperWOs = [];
    if (assignments && assignments.length > 0) {
      const woIds = assignments.map(a => a.wo_id);
      const { data: helperWOData } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .in('wo_id', woIds)
        .eq('status', 'completed')
        .order('date_completed', { ascending: false })
        .limit(50);

      helperWOs = helperWOData || [];
    }

    const allWOs = [...(leadWOs || []), ...helperWOs];
    const uniqueWOs = Array.from(
      new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
    );

    return uniqueWOs;
  } catch (err) {
    console.error('Error loading completed work orders:', err);
    return [];
  }
}

export async function checkIn(supabase, woId, currentUser) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const isoTime = now.toISOString();
  
  const { data: wo } = await supabase
    .from('work_orders')
    .select('*')
    .eq('wo_id', woId)
    .single();
  
  const existingComments = wo.comments || '';
  const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✔ CHECKED IN`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${checkInNote}`
    : checkInNote;
  
  const updateData = {
    comments: updatedComments,
    status: 'in_progress'
  };
  
  if (!wo.time_in) {
    updateData.time_in = isoTime;
  }
  
  const { error } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('wo_id', woId);

  if (error) throw error;
  
  return true;
}

export async function checkOut(supabase, woId, currentUser) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const isoTime = now.toISOString();
  
  const { data: wo } = await supabase
    .from('work_orders')
    .select('*')
    .eq('wo_id', woId)
    .single();
  
  const existingComments = wo.comments || '';
  const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${checkOutNote}`
    : checkOutNote;
  
  const updateData = {
    comments: updatedComments
  };
  
  if (!wo.time_out) {
    updateData.time_out = isoTime;
  }
  
  const { error } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('wo_id', woId);

  if (error) throw error;
  
  return true;
}

export async function completeWorkOrder(supabase, woId, currentUser) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const isoTime = now.toISOString();
  
  const { data: wo } = await supabase
    .from('work_orders')
    .select('*')
    .eq('wo_id', woId)
    .single();
  
  const existingComments = wo.comments || '';
  const completionNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✅ WORK ORDER COMPLETED`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${completionNote}`
    : completionNote;
  
  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'completed',
      date_completed: isoTime,
      comments: updatedComments
    })
    .eq('wo_id', woId);

  if (error) throw error;
  
  return true;
}

export async function updateField(supabase, woId, field, value) {
  const { error } = await supabase
    .from('work_orders')
    .update({ [field]: value })
    .eq('wo_id', woId);

  if (error) throw error;
  
  return true;
}

export async function addComment(supabase, woId, commentText, currentUser) {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('comments')
    .eq('wo_id', woId)
    .single();
    
  const existingComments = wo.comments || '';
  const timestamp = new Date().toLocaleString();
  const updatedComments = existingComments 
    ? `${existingComments}\n\n[${timestamp}] ${currentUser.first_name}: ${commentText}`
    : `[${timestamp}] ${currentUser.first_name}: ${commentText}`;

  const { error } = await supabase
    .from('work_orders')
    .update({ comments: updatedComments })
    .eq('wo_id', woId);

  if (error) throw error;
  
  return true;
}

export async function getWorkOrder(supabase, woId) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('wo_id', woId)
    .single();
    
  if (error) throw error;
  
  return data;
}
