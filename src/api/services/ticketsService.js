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

export const ticketsService = {
  list: async (params = {}) => {
    const data = await requestWithFallback([
      { method: 'get', url: '/support/tickets', params },
      { method: 'get', url: '/tickets', params },
      { method: 'get', url: '/support/requests', params },
    ]);
    return normalizeList(data);
  },

  create: async (payload) => {
    return requestWithFallback([
      { method: 'post', url: '/support/tickets', data: payload },
      { method: 'post', url: '/tickets', data: payload },
      { method: 'post', url: '/support/requests', data: payload },
    ]);
  },

  get: async (ticketId) => {
    const id = String(ticketId || '').trim();
    if (!id) return null;
    return requestWithFallback([
      { method: 'get', url: `/support/tickets/${encodeURIComponent(id)}` },
      { method: 'get', url: `/tickets/${encodeURIComponent(id)}` },
    ]);
  },

  update: async (ticketId, payload) => {
    const id = String(ticketId || '').trim();
    if (!id) return null;
    return requestWithFallback([
      { method: 'patch', url: `/support/tickets/${encodeURIComponent(id)}`, data: payload || {} },
      { method: 'patch', url: `/tickets/${encodeURIComponent(id)}`, data: payload || {} },
    ]);
  },

  reply: async (ticketId, payload) => {
    const id = String(ticketId || '').trim();
    if (!id) return null;
    return requestWithFallback([
      { method: 'post', url: `/support/tickets/${encodeURIComponent(id)}/reply`, data: payload },
      { method: 'post', url: `/support/tickets/${encodeURIComponent(id)}/messages`, data: payload },
      { method: 'post', url: `/tickets/${encodeURIComponent(id)}/reply`, data: payload },
      { method: 'post', url: `/tickets/${encodeURIComponent(id)}/messages`, data: payload },
    ]);
  },

  sendEmail: async (ticketId, payload) => {
    const id = String(ticketId || '').trim();
    if (!id) return null;
    const to = payload?.to;
    const subject = payload?.subject;
    const body = payload?.body;
    const html = payload?.html ?? (typeof body === 'string' ? body.replace(/\n/g, '<br/>') : undefined);
    return requestWithFallback([
      { method: 'post', url: `/tickets/${encodeURIComponent(id)}/email`, data: { to, subject, body, html } },
      { method: 'post', url: `/support/tickets/${encodeURIComponent(id)}/email`, data: { to, subject, body, html } },
      { method: 'post', url: '/email/send', data: { to, subject, html } },
    ]);
  },

  close: async (ticketId) => {
    const id = String(ticketId || '').trim();
    if (!id) return null;
    return requestWithFallback([
      { method: 'post', url: `/support/tickets/${encodeURIComponent(id)}/close` },
      { method: 'patch', url: `/support/tickets/${encodeURIComponent(id)}`, data: { status: 'closed' } },
      { method: 'post', url: `/tickets/${encodeURIComponent(id)}/close` },
      { method: 'patch', url: `/tickets/${encodeURIComponent(id)}`, data: { status: 'closed' } },
    ]);
  },
};
