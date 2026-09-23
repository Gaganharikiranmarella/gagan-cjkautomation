(function () {
  const overlay = document.getElementById('authOverlay');
  const form = document.getElementById('authForm');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const submitLabel = document.getElementById('authSubmitLabel');
  const submitBtn = document.getElementById('authSubmit');

  const tabApplicant = document.getElementById('tabApplicant');
  const tabCompany = document.getElementById('tabCompany');
  const modeLogin = document.getElementById('modeLogin');
  const modeRegister = document.getElementById('modeRegister');

  let state = { role: 'applicant', mode: 'login' };

  function render() {
    tabApplicant.classList.toggle('active', state.role === 'applicant');
    tabCompany.classList.toggle('active', state.role === 'company');
    modeLogin.classList.toggle('active', state.mode === 'login');
    modeRegister.classList.toggle('active', state.mode === 'register');

    document.querySelectorAll('.applicant-only').forEach((el) => {
      el.style.display = state.role === 'applicant' ? '' : 'none';
    });
    document.querySelectorAll('.company-only').forEach((el) => {
      el.style.display = state.role === 'company' ? '' : 'none';
    });
    document.querySelectorAll('.register-only').forEach((el) => {
      el.style.display = state.mode === 'register' ? el.dataset.forcedDisplay || '' : 'none';
    });
    // re-apply role visibility after mode toggle overwrote it
    if (state.mode === 'register') {
      document.querySelectorAll('.applicant-only.register-only').forEach((el) => {
        el.style.display = state.role === 'applicant' ? '' : 'none';
      });
      document.querySelectorAll('.company-only.register-only').forEach((el) => {
        el.style.display = state.role === 'company' ? '' : 'none';
      });
    }

    const roleLabel = state.role === 'applicant' ? 'applicant' : 'company';
    if (state.mode === 'login') {
      title.textContent = 'Welcome back';
      subtitle.textContent = `Sign in to your ${roleLabel} account`;
      submitLabel.textContent = 'Sign In';
    } else {
      title.textContent = state.role === 'applicant' ? 'Create your applicant account' : 'Create your company account';
      subtitle.textContent = state.role === 'applicant' ? 'Start applying with instant ATS scoring' : 'Start posting roles in minutes';
      submitLabel.textContent = 'Create Account';
    }

    form.querySelector('[name="name"]').required = state.mode === 'register' && state.role === 'applicant';
    form.querySelector('[name="companyName"]').required = state.mode === 'register' && state.role === 'company';
  }

  function openModal(role, mode) {
    state = { role: role || 'applicant', mode: mode || 'login' };
    form.reset();
    render();
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    overlay.classList.add('hidden');
  }

  document.querySelectorAll('[data-open-auth]').forEach((el) => {
    el.addEventListener('click', () => openModal(el.dataset.openAuth, el.dataset.mode));
  });

  document.getElementById('authClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  tabApplicant.addEventListener('click', () => {
    state.role = 'applicant';
    render();
  });
  tabCompany.addEventListener('click', () => {
    state.role = 'company';
    render();
  });
  modeLogin.addEventListener('click', () => {
    state.mode = 'login';
    render();
  });
  modeRegister.addEventListener('click', () => {
    state.mode = 'register';
    render();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { role: state.role, email: fd.get('email'), password: fd.get('password') };
    if (state.mode === 'register') {
      if (state.role === 'applicant') {
        payload.name = fd.get('name');
        payload.phone = fd.get('phone');
      } else {
        payload.companyName = fd.get('companyName');
        payload.industry = fd.get('industry');
        payload.website = fd.get('website');
      }
    }

    submitBtn.disabled = true;
    try {
      const path = state.mode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api.post(path, payload);
      session.save(data.token, data.user);
      showToast(state.mode === 'login' ? 'Welcome back!' : 'Account created!', 'success');
      window.location.href = state.role === 'applicant' ? '/applicant.html' : '/company.html';
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
    }
  });

  // If already logged in, skip the landing page.
  const existingUser = session.getUser();
  if (existingUser && session.getToken()) {
    window.location.href = existingUser.role === 'applicant' ? '/applicant.html' : '/company.html';
  }
})();
