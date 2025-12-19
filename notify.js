document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
});

/**
 * showToast({message, type, timeout})
 * types: info | success | warning | error
 */
function showToast({ message = '', type = 'info', timeout = 3000 } = {}) {
  const container = document.querySelector('.toast-container') || (() => {
    const c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); return c;
  })();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '&times;';

  toast.appendChild(body);
  toast.appendChild(close);
  container.appendChild(toast);

  // show animation
  requestAnimationFrame(() => toast.classList.add('show'));

  let timer = null;
  if (timeout && timeout > 0) {
    timer = setTimeout(() => hide(), timeout);
  }

  function hide() {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
    if (timer) clearTimeout(timer);
  }

  close.addEventListener('click', hide);

  return { hide, element: toast };
}

window.showToast = showToast;