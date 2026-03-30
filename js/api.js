import { addActionFab, appShell, authScreen } from './dom.js';
import { state } from './state.js';

export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && !path.startsWith('/api/auth')) {
    state.currentUser = null;
    appShell.classList.add('hidden');
    authScreen.classList.remove('hidden');
    addActionFab.classList.add('hidden');
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const payload = await response.json();
      errorMessage = payload.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return null;
}
