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
  if (Array.isArray(payload?.providers)) return payload.providers;
  if (Array.isArray(payload?.integrations)) return payload.integrations;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.providers)) return payload.data.providers;
  if (Array.isArray(payload?.data?.integrations)) return payload.data.integrations;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;

  if (payload && typeof payload === 'object') {
    const inner = payload?.data ?? payload?.result ?? payload?.payload;
    if (inner && inner !== payload) {
      const nested = normalizeList(inner);
      if (nested.length) return nested;
    }

    const metaKeys = new Set([
      'success',
      'message',
      'error',
      'errors',
      'status',
      'code',
      'meta',
      'pagination',
      'page',
      'limit',
      'total',
      'items',
      'data',
      'results',
      'providers',
      'integrations',
      'list',
    ]);
    const keys = Object.keys(payload).filter((k) => !metaKeys.has(k));
    if (keys.length) {
      const values = keys
        .map((k) => {
          const v = payload[k];
          if (v && typeof v === 'object' && !Array.isArray(v)) return { key: k, ...v };
          if (v != null) return { key: k, value: v };
          return null;
        })
        .filter(Boolean);
      if (values.length) return values;
    }
  }
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
