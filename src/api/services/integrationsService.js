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

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export const integrationsService = {
  list: async () => {
    const data = await requestWithFallback([
      { method: 'get', url: '/integrations' },
      { method: 'get', url: '/integrations/list' },
      { method: 'get', url: '/integrations/providers' },
      { method: 'get', url: '/settings/integrations' },
      { method: 'get', url: '/integration' },
    ]);
    return normalizeList(data);
  },

  connect: async (providerKey) => {
    const key = String(providerKey || '').trim();
    if (!key) return null;
    return requestWithFallback([
      { method: 'post', url: `/integrations/${encodeURIComponent(key)}/connect` },
      { method: 'post', url: '/integrations/connect', data: { provider: key } },
      { method: 'post', url: '/integrations/connect', data: { key } },
    ]);
  },

  disconnect: async (providerKey) => {
    const key = String(providerKey || '').trim();
    if (!key) return null;
    return requestWithFallback([
      { method: 'post', url: `/integrations/${encodeURIComponent(key)}/disconnect` },
      { method: 'delete', url: `/integrations/${encodeURIComponent(key)}` },
      { method: 'post', url: '/integrations/disconnect', data: { provider: key } },
    ]);
  },

  sync: async (providerKey) => {
    const key = String(providerKey || '').trim();
    if (!key) return null;
    return requestWithFallback([
      { method: 'post', url: `/integrations/${encodeURIComponent(key)}/sync` },
      { method: 'post', url: '/integrations/sync', data: { provider: key } },
      { method: 'post', url: `/sync/${encodeURIComponent(key)}` },
    ]);
  },

  getStatus: async (providerKey) => {
    const key = String(providerKey || '').trim();
    if (!key) return null;
    return requestWithFallback([
      { method: 'get', url: `/integrations/${encodeURIComponent(key)}/status` },
      { method: 'get', url: '/integrations/status', params: { provider: key } },
    ]);
  },
};

