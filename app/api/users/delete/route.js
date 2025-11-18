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

    // SOFT DELETE: Just mark the user as inactive
    // This preserves all work order history and relationships
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_active: false,
        // Optional: You can add a deleted_at timestamp if the column exists
        // deleted_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error soft-deleting user:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}