import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { userId, requestorEmail } = await request.json();

    // Verify requestor is superuser
    if (requestorEmail !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json(
        { error: 'Unauthorized: Only superuser can delete users' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // First, get the user to check if they have an auth_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('auth_id, email')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear foreign key references first to avoid constraint errors
    // Update work_orders to remove lead_tech_id references
    await supabase
      .from('work_orders')
      .update({ lead_tech_id: null })
      .eq('lead_tech_id', userId);

    // Delete work_order_assignments for this user
    await supabase
      .from('work_order_assignments')
      .delete()
      .eq('user_id', userId);

    // Delete daily_hours_log entries for this user
    await supabase
      .from('daily_hours_log')
      .delete()
      .eq('user_id', userId);

    // Delete availability records for this user
    await supabase
      .from('availability')
      .delete()
      .eq('user_id', userId);

    // Delete work_order_quotes created by this user
    await supabase
      .from('work_order_quotes')
      .update({ created_by: null })
      .eq('created_by', userId);

    // Now delete the user from the users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // If user had an auth account, try to delete it from Supabase Auth
    // This requires the service role key
    if (user.auth_id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.auth_id);
        if (authDeleteError) {
          console.error('Error deleting auth user (non-fatal):', authDeleteError);
          // Don't fail the request - the users table record is already deleted
        }
      } catch (authErr) {
        console.error('Auth deletion error (non-fatal):', authErr);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'User permanently deleted'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
