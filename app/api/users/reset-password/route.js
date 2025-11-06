import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, newPassword, requestorEmail } = body;

    // Verify the requestor is the superuser
    if (requestorEmail !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json(
        { error: 'Unauthorized. Only superuser can reset passwords.' },
        { status: 403 }
      );
    }

    // Validate inputs
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Get user's auth ID from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('auth_id, email')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Reset the password using Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userData.auth_id,
      { password: newPassword }
    );

    if (error) {
      console.error('Error resetting password:', error);
      return NextResponse.json(
        { error: 'Failed to reset password: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${userData.email}`
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}