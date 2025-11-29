// mobile/utils/authHelpers.js

export async function loginWithCredentials(supabase, emailValue, pinValue) {
  try {
    console.log('Attempting login with email:', emailValue);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', emailValue)
      .single();

    console.log('User query result:', users, error);

    if (error || !users) {
      return {
        success: false,
        error: 'Invalid email - user not found'
      };
    }

    if (!users.pin) {
      return {
        success: false,
        error: 'No PIN set for this user. Contact admin to set up your PIN.'
      };
    }

    if (users.pin !== pinValue) {
      return {
        success: false,
        error: 'Invalid PIN - PIN does not match'
      };
    }

    console.log('Login successful! User:', users);
    
    // Store credentials
    localStorage.setItem('mobileEmail', emailValue);
    localStorage.setItem('mobilePin', pinValue);
    
    return {
      success: true,
      user: users
    };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: 'Login failed: ' + err.message
    };
  }
}

export async function checkStoredAuth(supabase) {
  const savedEmail = localStorage.getItem('mobileEmail');
  const savedPin = localStorage.getItem('mobilePin');
  
  if (!savedEmail || !savedPin) {
    return { success: false, user: null };
  }
  
  return await loginWithCredentials(supabase, savedEmail, savedPin);
}

export function logout() {
  localStorage.removeItem('mobileEmail');
  localStorage.removeItem('mobilePin');
}

export async function changePin(supabase, userId, newPin, confirmPin) {
  // Validation
  if (!newPin || !confirmPin) {
    return {
      success: false,
      error: 'Please enter both PIN fields'
    };
  }

  if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
    return {
      success: false,
      error: 'PIN must be exactly 4 digits'
    };
  }

  if (newPin !== confirmPin) {
    return {
      success: false,
      error: 'PINs do not match'
    };
  }

  // Update PIN
  try {
    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('user_id', userId);

    if (error) throw error;

    // Update stored PIN
    localStorage.setItem('mobilePin', newPin);

    return {
      success: true,
      message: 'PIN changed successfully!'
    };
  } catch (err) {
    return {
      success: false,
      error: 'Error changing PIN: ' + err.message
    };
  }
}