// Authentication Service

export async function loginUser(supabase, email, pin) {
  try {
    console.log('Attempting login with email:', email);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    console.log('User query result:', users, error);

    if (error || !users) {
      throw new Error('Invalid email - user not found');
    }

    if (!users.pin) {
      throw new Error('No PIN set for this user. Contact admin to set up your PIN.');
    }

    if (users.pin !== pin) {
      throw new Error('Invalid PIN - PIN does not match');
    }

    console.log('Login successful! User:', users);
    return users;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
}

export async function changeUserPin(supabase, userId, newPin) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('user_id', userId);

    if (error) throw error;
    
    return true;
  } catch (err) {
    console.error('Error changing PIN:', err);
    throw err;
  }
}

export function saveCredentials(email, pin) {
  localStorage.setItem('mobileEmail', email);
  localStorage.setItem('mobilePin', pin);
}

export function getSavedCredentials() {
  return {
    email: localStorage.getItem('mobileEmail'),
    pin: localStorage.getItem('mobilePin')
  };
}

export function clearCredentials() {
  localStorage.removeItem('mobileEmail');
  localStorage.removeItem('mobilePin');
}
