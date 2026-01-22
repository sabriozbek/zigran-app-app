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

async function requestWithFallbackStatuses(steps, extraStatuses) {
  const extra = Array.isArray(extraStatuses) ? new Set(extraStatuses.map((x) => Number(x))) : new Set();
  let lastError;
  for (const step of steps) {
    try {
      const response = await apiClient.request(step);
      return response?.data;
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status);
      const canFallback = status === 404 || status === 405 || status === 501 || extra.has(status);
      if (!canFallback) throw err;
    }
  }
  throw lastError;
}

function splitName(fullName) {
  const n = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return { firstName: '', lastName: '' };
  const parts = n.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toContactsPayload(data) {
  const name = String(data?.name ?? '').trim();
  const explicitFirstName = String(data?.firstName ?? '').trim();
  const explicitLastName = String(data?.lastName ?? '').trim();
  const { firstName: derivedFirstName, lastName: derivedLastName } = splitName(name);
  const firstName = explicitFirstName || derivedFirstName;
  const lastName = explicitLastName || derivedLastName;
  const company = String(data?.company ?? '').trim();
  const email = String(data?.email ?? '').trim();
  const phone = String(data?.phone ?? '').trim();
  const accountId = String(data?.accountId ?? '').trim();
  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(company ? { description: company } : {}),
    ...(accountId ? { accountId } : {}),
  };
}

function toCustomersPayload(data) {
  const name = String(data?.name ?? '').trim();
  const company = String(data?.company ?? '').trim();
  const email = String(data?.email ?? '').trim();
  const phone = String(data?.phone ?? '').trim();
  const { firstName, lastName } = splitName(name);
  return {
    ...(name ? { name } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(company ? { companyName: company } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

const CONTACTS_ENDPOINTS = [
  { base: '/contacts', type: 'contacts' },
  { base: '/crm/contacts', type: 'contacts' },
  { base: '/customers', type: 'customers' },
  { base: '/crm/customers', type: 'customers' },
];

export const contactsService = {
  getAll: async (params = {}) => {
    return requestWithFallback(
      CONTACTS_ENDPOINTS.map((e) => ({
        method: 'get',
        url: e.base,
        params,
      })),
    );
  },

  getOne: async (id) => {
    return requestWithFallback(
      CONTACTS_ENDPOINTS.map((e) => ({
        method: 'get',
        url: `${e.base}/${encodeURIComponent(String(id))}`,
      })),
    );
  },

  create: async (data) => {
    return requestWithFallbackStatuses(
      CONTACTS_ENDPOINTS.flatMap((e) => {
        const payload = e.type === 'customers' ? toCustomersPayload(data) : toContactsPayload(data);
        return [
          { method: 'post', url: e.base, data: payload },
          { method: 'post', url: `${e.base}/create`, data: payload },
        ];
      }),
      [400, 409, 415, 422],
    );
  },

  update: async (id, data) => {
    const encodedId = encodeURIComponent(String(id));
    return requestWithFallbackStatuses(
      CONTACTS_ENDPOINTS.flatMap((e) => {
        const payload = e.type === 'customers' ? toCustomersPayload(data) : toContactsPayload(data);
        const itemUrl = `${e.base}/${encodedId}`;
        return [
          { method: 'patch', url: itemUrl, data: payload },
          { method: 'put', url: itemUrl, data: payload },
        ];
      }),
      [400, 409, 415, 422],
    );
  },

  delete: async (id) => {
    const encodedId = encodeURIComponent(String(id));
    return requestWithFallback(
      CONTACTS_ENDPOINTS.map((e) => ({
        method: 'delete',
        url: `${e.base}/${encodedId}`,
      })),
    );
  }
};
