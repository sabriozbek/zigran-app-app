import apiClient from '../client';

async function requestWithFallback(steps) {
  let lastError;
  for (const step of steps) {
    try {
      const response = await apiClient.request(step);
      return response?.data;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      const canFallback = status === 404 || status === 405 || status === 501;
      if (!canFallback) throw err;
    }
  }
  throw lastError;
}

export const tasksService = {
  getAll: async (params = {}) => {
    return requestWithFallback([
      { method: 'get', url: '/tasks', params },
      { method: 'get', url: '/tasks/list', params },
    ]);
  },

  create: async (data) => {
    return requestWithFallback([
      { method: 'post', url: '/tasks', data },
      { method: 'post', url: '/tasks/create', data },
    ]);
  },

  update: async (id, data) => {
    const encodedId = encodeURIComponent(String(id));
    return requestWithFallback([
      { method: 'patch', url: `/tasks/${encodedId}`, data },
      { method: 'put', url: `/tasks/${encodedId}`, data },
    ]);
  },

  updateStatus: async (id, status) => {
    const encodedId = encodeURIComponent(String(id));
    const s = String(status ?? '').trim();
    const normalized = s === 'done' ? 'completed' : s;
    const completed = ['completed', 'done', 'success', 'closed'].includes(normalized.toLowerCase());
    return requestWithFallback([
      { method: 'patch', url: '/tasks/status', data: { id: String(id), status: normalized || 'open' } },
      { method: 'patch', url: `/tasks/${encodedId}/status`, data: { status: normalized || 'open' } },
      { method: 'patch', url: `/tasks/${encodedId}`, data: { status: normalized || 'open' } },
      { method: 'patch', url: `/tasks/${encodedId}`, data: { completed } },
    ]);
  },

  delete: async (id) => {
    const encodedId = encodeURIComponent(String(id));
    return requestWithFallback([{ method: 'delete', url: `/tasks/${encodedId}` }]);
  },
};
