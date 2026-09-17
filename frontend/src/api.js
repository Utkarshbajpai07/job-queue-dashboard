const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Small wrapper around fetch that throws a normal Error with a readable
// message on non-2xx responses, so callers can just try/catch.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(
      'Could not reach the server. Check your connection and that the API is running.',
    );
  }

  if (res.status === 204) return null;

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. empty response) - fine for successful responses
  }

  if (!res.ok) {
    const message =
      (body && (Array.isArray(body.message) ? body.message.join(', ') : body.message)) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return body;
}

export const api = {
  listJobs: () => request('/jobs'),
  createJob: (data) =>
    request('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/jobs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
};
