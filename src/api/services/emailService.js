import apiClient from '../client';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export const emailService = {
  listTemplates: async () => {
    const response = await apiClient.get('/email/templates');
    return normalizeList(response?.data);
  },

  seedTemplates: async () => {
    const response = await apiClient.post('/email/templates/seed');
    return response?.data;
  },

  createTemplate: async (data) => {
    const payload = {
      name: data?.name,
      subject: data?.subject,
      html: data?.html,
      category: data?.category,
      description: data?.description,
      previewText: data?.previewText,
      variablesSchema: data?.variablesSchema,
      previewData: data?.previewData,
      design: data?.design,
    };
    const response = await apiClient.post('/email/templates', payload);
    return response?.data;
  },

  updateTemplate: async (id, data) => {
    const payload = {
      name: data?.name,
      subject: data?.subject,
      html: data?.html,
      category: data?.category,
      description: data?.description,
      previewText: data?.previewText,
      variablesSchema: data?.variablesSchema,
      previewData: data?.previewData,
      design: data?.design,
    };
    const response = await apiClient.patch(`/email/templates/${encodeURIComponent(String(id))}`, payload);
    return response?.data;
  },

  deleteTemplate: async (id) => {
    const response = await apiClient.delete(`/email/templates/${encodeURIComponent(String(id))}`);
    return response?.data;
  },

  listLogs: async () => {
    const response = await apiClient.get('/email/logs');
    return normalizeList(response?.data);
  },

  send: async ({ to, subject, html }) => {
    const response = await apiClient.post('/email/send', { to, subject, html });
    return response?.data;
  },

  sendTemplate: async ({ to, templateId, variables }) => {
    const response = await apiClient.post('/email/send-template', {
      to,
      templateId,
      variables: variables || {},
    });
    return response?.data;
  },

  sendSegment: async ({ segmentId, templateId, variables }) => {
    const response = await apiClient.post('/email/send-segment', {
      segmentId,
      templateId,
      variables: variables || {},
    });
    return response?.data;
  },

  listEvents: async () => {
    const response = await apiClient.get('/email/events');
    return response?.data;
  },

  getMappings: async () => {
    const response = await apiClient.get('/email/mappings');
    return response?.data;
  },

  updateMappings: async (mappings) => {
    const response = await apiClient.post('/email/mappings', mappings || {});
    return response?.data;
  },
};

