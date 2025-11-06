import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, requestorEmail } = body;

    if (requestorEmail !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json(
        { error: 'Unauthorized. Only superuser can delete users.' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('auth_id, email, user_id')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (userData.email === 'jones.emfcontracting@gmail.com') {
      return NextResponse.json(
        { error: 'Cannot delete the superuser account' },
        { status: 400 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userData.auth_id
    );

    if (authError) {
      console.error('Error deleting auth user:', authError);
    }

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (dbError) {
      console.error('Error deleting user from database:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete user from database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${userData.email} deleted successfully`
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}