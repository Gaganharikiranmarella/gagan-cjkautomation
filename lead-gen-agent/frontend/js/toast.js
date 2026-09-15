function showToast(message, type = 'default') {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast-error' : ''}${type === 'success' ? ' toast-success' : ''}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close-modal]');
  if (closeBtn) closeModal(closeBtn.dataset.closeModal);
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('open');
});
