import apiClient from '../client';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

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

export const automationsService = {
  list: async () => {
    const response = await apiClient.get('/automations');
    return normalizeList(response?.data);
  },

  create: async (data) => {
    const response = await apiClient.post('/automations', {
      name: data?.name,
      trigger: data?.trigger,
      actions: Array.isArray(data?.actions) ? data.actions : [],
      active: data?.active,
    });
    return response?.data;
  },

  update: async (id, data) => {
    const safeId = encodeURIComponent(String(id));
    const payload = data || {};
    const canCreate =
      typeof payload?.name === 'string' &&
      payload.name.trim().length > 0 &&
      !!payload?.trigger &&
      Array.isArray(payload?.actions);
    return requestWithFallback([
      { method: 'patch', url: `/automations/${safeId}`, data: payload },
      { method: 'post', url: `/automations/${safeId}`, data: payload },
      canCreate
        ? {
            method: 'post',
            url: '/automations',
            data: {
              name: payload?.name,
              trigger: payload?.trigger,
              actions: Array.isArray(payload?.actions) ? payload.actions : [],
              active: payload?.active,
            },
          }
        : { method: 'post', url: `/automations/${safeId}`, data: payload },
    ]);
  },

  remove: async (id) => {
    const safeId = encodeURIComponent(String(id));
    return requestWithFallback([
      { method: 'delete', url: `/automations/${safeId}` },
      { method: 'patch', url: `/automations/${safeId}`, data: { active: false } },
      { method: 'post', url: `/automations/${safeId}`, data: { active: false } },
    ]);
  },

  execute: async (data) => {
    const response = await apiClient.post('/automations/execute', {
      type: data?.type,
      leadId: data?.leadId,
      payload: data?.payload,
    });
    return response?.data;
  },
};
