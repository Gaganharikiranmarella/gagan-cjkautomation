// Local-storage backed session helpers, shared by every page.
const session = {
  save(token, user) {
    localStorage.setItem('resumalyze_token', token);
    localStorage.setItem('resumalyze_user', JSON.stringify(user));
  },
  getUser() {
    const raw = localStorage.getItem('resumalyze_user');
    return raw ? JSON.parse(raw) : null;
  },
  getToken() {
    return localStorage.getItem('resumalyze_token');
  },
  clear() {
    localStorage.removeItem('resumalyze_token');
    localStorage.removeItem('resumalyze_user');
  },
  logout() {
    session.clear();
    window.location.href = '/';
  },
  // Call at the top of a role-gated page. Redirects home if not logged in
  // as the expected role.
  requireRole(role) {
    const user = session.getUser();
    const token = session.getToken();
    if (!token || !user || user.role !== role) {
      window.location.href = '/';
      return null;
    }
    return user;
  },
};
