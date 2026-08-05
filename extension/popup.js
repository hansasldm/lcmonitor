import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loginContainer = document.getElementById('login-container');
  const statusContainer = document.getElementById('status-container');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const errorMsg = document.getElementById('error-msg');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const userEmailDisplay = document.getElementById('user-email');

  // Check if already logged in
  const { session } = await chrome.storage.local.get('session');
  if (session && session.user) {
    showStatus(session.user.email);
  } else {
    showLogin();
  }

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }
    
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.msg || 'Login failed');
      }

      // Save session to chrome local storage
      await chrome.storage.local.set({ session: data });
      showStatus(data.user.email);
      
      // Notify background script that login occurred
      chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS' });
      
    } catch (err) {
      showError(err.message);
    } finally {
      loginBtn.textContent = 'Login';
      loginBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('session');
    showLogin();
    chrome.runtime.sendMessage({ type: 'LOGOUT_SUCCESS' });
  });

  function showStatus(email) {
    loginContainer.style.display = 'none';
    statusContainer.style.display = 'block';
    userEmailDisplay.textContent = email;
  }

  function showLogin() {
    loginContainer.style.display = 'block';
    statusContainer.style.display = 'none';
    emailInput.value = '';
    passwordInput.value = '';
    errorMsg.style.display = 'none';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
});
