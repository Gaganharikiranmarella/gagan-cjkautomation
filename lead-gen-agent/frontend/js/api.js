// Tiny fetch wrapper shared by every view module.
const api = {
  async request(method, path, body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body || {}); },
  patch(path, body) { return this.request('PATCH', path, body || {}); },
  delete(path) { return this.request('DELETE', path); },
};
