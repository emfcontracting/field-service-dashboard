// Authentication Service (WITH OFFLINE SUPPORT)

export async function loginUser(supabase, email, pin) {
  try {
    console.log('Attempting login with email:', email);
    
    // If offline, try to use cached user
    if (!navigator.onLine) {
      console.log('📴 Offline - checking cached user');
      const cachedUser = getCachedUser();
      
      if (cachedUser && cachedUser.email === email && cachedUser.pin === pin) {
        console.log('✅ Offline login successful with cached credentials');
        return cachedUser;
      } else if (cachedUser && cachedUser.email === email) {
        throw new Error('Invalid PIN - PIN does not match');
      } else {
        throw new Error('Cannot login offline. Please connect to internet for first login.');
      }
    }
    
    // Online - verify with server
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
    
    // Cache user data for offline use
    cacheUser(users);
    
    return users;
  } catch (err) {
    console.error('Login error:', err);
    
    // If online request failed but we have cached data, try offline login
    if (err.message?.includes('fetch') || err.message?.includes('network')) {
      console.log('⚠️ Network error - trying cached login');
      const cachedUser = getCachedUser();
      
      if (cachedUser && cachedUser.email === email && cachedUser.pin === pin) {
        console.log('✅ Fallback offline login successful');
        return cachedUser;
      }
    }
    
    throw err;
  }
}

export async function changeUserPin(supabase, userId, newPin) {
  if (!navigator.onLine) {
    throw new Error('Cannot change PIN while offline. Please connect to internet.');
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('user_id', userId);

    if (error) throw error;
    
    // Update cached user with new PIN
    const cachedUser = getCachedUser();
    if (cachedUser && cachedUser.user_id === userId) {
      cachedUser.pin = newPin;
      cacheUser(cachedUser);
    }
    
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

// ==================== OFFLINE USER CACHE ====================

export function cacheUser(user) {
  try {
    localStorage.setItem('cachedUser', JSON.stringify({
      ...user,
      cached_at: new Date().toISOString()
    }));
    console.log('✅ User cached for offline use');
  } catch (err) {
    console.error('Failed to cache user:', err);
  }
}

export function getCachedUser() {
  try {
    const cached = localStorage.getItem('cachedUser');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Failed to get cached user:', err);
  }
  return null;
}

export function clearCachedUser() {
  localStorage.removeItem('cachedUser');
}
