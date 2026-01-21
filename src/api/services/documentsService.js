import apiClient from '../client';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export const documentsService = {
  list: async (params = {}) => {
    const response = await apiClient.get('/documents', { params });
    return normalizeList(response?.data);
  },

  upload: async ({ name, file, leadId, parentId }) => {
    const form = new FormData();
    if (name) form.append('name', String(name));
    if (leadId) form.append('leadId', String(leadId));
    if (parentId) form.append('parentId', String(parentId));
    form.append('file', file);
    const response = await apiClient.post('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  createFolder: async ({ name, parentId, accessControl } = {}) => {
    const payload = { name };
    if (parentId) payload.parentId = parentId;
    if (accessControl) payload.accessControl = accessControl;
    const response = await apiClient.post('/documents/folder', payload);
    return response.data;
  },

  getSignedUrl: async (id) => {
    const response = await apiClient.get(`/documents/${id}/url`);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/documents/${id}`);
    return response.data;
  },
};
