import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { action, workOrderIds, updates } = await request.json();

    if (!action || !workOrderIds || workOrderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'update_status':
        result = await bulkUpdateStatus(workOrderIds, updates.status);
        break;
      case 'reassign':
        result = await bulkReassign(workOrderIds, updates.assigned_to, updates.assigned_name);
        break;
      case 'update_priority':
        result = await bulkUpdatePriority(workOrderIds, updates.priority);
        break;
      case 'add_comment':
        result = await bulkAddComment(workOrderIds, updates.comment);
        break;
      case 'close_completed':
        result = await bulkCloseCompleted(workOrderIds);
        break;
      case 'delete':
        result = await bulkDelete(workOrderIds);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log the bulk operation
    await supabase.from('system_logs').insert({
      log_type: 'bulk_operation',
      message: `Bulk ${action}: ${result.updated} work orders affected`,
      status: 'success',
      metadata: {
        action,
        count: result.updated,
        workOrderIds: workOrderIds.slice(0, 10), // Log first 10 IDs
        updates
      }
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Bulk operation error:', error);
    
    // Log the error
    await supabase.from('system_logs').insert({
      log_type: 'bulk_operation',
      message: `Bulk operation failed: ${error.message}`,
      status: 'failed',
      metadata: { error: error.message }
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Bulk operation failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Bulk update status
async function bulkUpdateStatus(workOrderIds, newStatus) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .in('wo_id', workOrderIds)
    .select('wo_number');

  if (error) throw error;

  return {
    updated: data.length,
    workOrders: data.map(wo => wo.wo_number),
    message: `Updated status to "${newStatus}" for ${data.length} work order(s)`
  };
}

// Bulk reassign
async function bulkReassign(workOrderIds, assignedTo, assignedName) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ 
      assigned_to: assignedTo,
      status: 'assigned',
      updated_at: new Date().toISOString()
    })
    .in('wo_id', workOrderIds)
    .select('wo_number');

  if (error) throw error;

  return {
    updated: data.length,
    workOrders: data.map(wo => wo.wo_number),
    message: `Reassigned ${data.length} work order(s) to ${assignedName}`
  };
}

// Bulk update priority
async function bulkUpdatePriority(workOrderIds, newPriority) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ 
      priority: newPriority,
      updated_at: new Date().toISOString()
    })
    .in('wo_id', workOrderIds)
    .select('wo_number');

  if (error) throw error;

  return {
    updated: data.length,
    workOrders: data.map(wo => wo.wo_number),
    message: `Updated priority to "${newPriority}" for ${data.length} work order(s)`
  };
}

// Bulk add comment
async function bulkAddComment(workOrderIds, comment) {
  const timestamp = new Date().toLocaleString();
  const commentText = `[BULK UPDATE ${timestamp}]\n${comment}`;

  // Fetch current comments
  const { data: workOrders, error: fetchError } = await supabase
    .from('work_orders')
    .select('wo_id, wo_number, comments')
    .in('wo_id', workOrderIds);

  if (fetchError) throw fetchError;

  // Update each with appended comment
  const updates = workOrders.map(wo => ({
    wo_id: wo.wo_id,
    comments: wo.comments 
      ? `${wo.comments}\n\n${commentText}`
      : commentText,
    updated_at: new Date().toISOString()
  }));

  const { error: updateError } = await supabase
    .from('work_orders')
    .upsert(updates);

  if (updateError) throw updateError;

  return {
    updated: workOrders.length,
    workOrders: workOrders.map(wo => wo.wo_number),
    message: `Added comment to ${workOrders.length} work order(s)`
  };
}

// Bulk close completed jobs
async function bulkCloseCompleted(workOrderIds) {
  const { data, error } = await supabase
    .from('work_orders')
    .update({ 
      status: 'completed',
      date_completed: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .in('wo_id', workOrderIds)
    .eq('status', 'in_progress')
    .select('wo_number');

  if (error) throw error;

  return {
    updated: data.length,
    workOrders: data.map(wo => wo.wo_number),
    message: `Closed ${data.length} work order(s)`
  };
}

// Bulk delete
async function bulkDelete(workOrderIds) {
  const { data, error } = await supabase
    .from('work_orders')
    .delete()
    .in('wo_id', workOrderIds)
    .select('wo_number');

  if (error) throw error;

  return {
    updated: data.length,
    workOrders: data.map(wo => wo.wo_number),
    message: `Deleted ${data.length} work order(s)`
  };
}
