import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, newPassword, requestorEmail } = body;

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not configured. Please contact admin.' },
        { status: 500 }
      );
    }

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

    if (requestorEmail !== 'jones.emfcontracting@gmail.com') {
      return NextResponse.json(
        { error: 'Unauthorized. Only superuser can reset passwords.' },
        { status: 403 }
      );
    }

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

    // Get the user's auth_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('auth_id, email')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!userData.auth_id) {
      return NextResponse.json(
        { error: 'User does not have an auth account. They may be using PIN login only.' },
        { status: 400 }
      );
    }

    // Update the password using admin API
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

    console.log(`Password reset successfully for ${userData.email}`);

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${userData.email}`
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
