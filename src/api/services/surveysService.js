import apiClient from '../client';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export const surveysService = {
  list: async () => {
    const response = await apiClient.get('/surveys');
    return normalizeList(response?.data);
  },

  get: async (id) => {
    const response = await apiClient.get(`/surveys/${encodeURIComponent(String(id))}`);
    return response?.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/surveys', {
      name: data?.name,
      audience: data?.audience,
      schemaJson: data?.schemaJson ?? null,
    });
    return response?.data;
  },

  update: async (id, data) => {
    const response = await apiClient.patch(`/surveys/${encodeURIComponent(String(id))}`, data || {});
    return response?.data;
  },

  remove: async (id) => {
    const response = await apiClient.delete(`/surveys/${encodeURIComponent(String(id))}`);
    return response?.data;
  },
};

