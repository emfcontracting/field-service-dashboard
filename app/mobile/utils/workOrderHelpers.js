// mobile/utils/workOrderHelpers.js

export async function loadWorkOrders(supabase, userId, userRole) {
  try {
    let query = supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(user_id, first_name, last_name, email, role)
      `)
      .neq('status', 'completed')
      .order('date_entered', { ascending: false });

    // Filter based on role
    if (userRole === 'lead_tech' || userRole === 'tech' || userRole === 'helper') {
      query = query.eq('lead_tech_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading work orders:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function loadCompletedWorkOrders(supabase, userId, userRole) {
  try {
    let query = supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(user_id, first_name, last_name, email, role)
      `)
      .eq('status', 'completed')
      .order('date_completed', { ascending: false })
      .limit(50);

    // Filter based on role
    if (userRole === 'lead_tech' || userRole === 'tech' || userRole === 'helper') {
      query = query.eq('lead_tech_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading completed work orders:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function updateWorkOrder(supabase, woId, updates) {
  try {
    const { error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('wo_id', woId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error updating work order:', err);
    return { success: false, error: err.message };
  }
}

export async function acknowledgeWorkOrder(supabase, woId) {
  return await updateWorkOrder(supabase, woId, {
    status: 'acknowledged',
    acknowledged_at: new Date().toISOString()
  });
}

export async function checkInWorkOrder(supabase, woId, latitude, longitude) {
  return await updateWorkOrder(supabase, woId, {
    time_in: new Date().toISOString(),
    check_in_latitude: latitude || null,
    check_in_longitude: longitude || null,
    status: 'in_progress'
  });
}

export async function checkOutWorkOrder(supabase, woId, latitude, longitude) {
  return await updateWorkOrder(supabase, woId, {
    time_out: new Date().toISOString(),
    check_out_latitude: latitude || null,
    check_out_longitude: longitude || null
  });
}

export async function completeWorkOrder(supabase, woId) {
  return await updateWorkOrder(supabase, woId, {
    status: 'completed',
    date_completed: new Date().toISOString()
  });
}

export async function addComment(supabase, woId, userId, commentText) {
  try {
    const { error } = await supabase
      .from('work_order_comments')
      .insert({
        wo_id: woId,
        user_id: userId,
        comment: commentText,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error adding comment:', err);
    return { success: false, error: err.message };
  }
}

export async function loadComments(supabase, woId) {
  try {
    const { data, error } = await supabase
      .from('work_order_comments')
      .select(`
        *,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading comments:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function loadMaterials(supabase, woId) {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('wo_id', woId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading materials:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function addMaterial(supabase, material) {
  try {
    const { error } = await supabase
      .from('materials')
      .insert(material);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error adding material:', err);
    return { success: false, error: err.message };
  }
}

export async function updateMaterial(supabase, materialId, updates) {
  try {
    const { error } = await supabase
      .from('materials')
      .update(updates)
      .eq('material_id', materialId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error updating material:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteMaterial(supabase, materialId) {
  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('material_id', materialId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error deleting material:', err);
    return { success: false, error: err.message };
  }
}

export async function loadEquipment(supabase, woId) {
  try {
    const { data, error } = await supabase
      .from('equipment_rentals')
      .select('*')
      .eq('wo_id', woId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading equipment:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function addEquipment(supabase, equipment) {
  try {
    const { error } = await supabase
      .from('equipment_rentals')
      .insert(equipment);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error adding equipment:', err);
    return { success: false, error: err.message };
  }
}

export async function updateEquipment(supabase, equipmentId, updates) {
  try {
    const { error } = await supabase
      .from('equipment_rentals')
      .update(updates)
      .eq('equipment_id', equipmentId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error updating equipment:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteEquipment(supabase, equipmentId) {
  try {
    const { error } = await supabase
      .from('equipment_rentals')
      .delete()
      .eq('equipment_id', equipmentId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error deleting equipment:', err);
    return { success: false, error: err.message };
  }
}