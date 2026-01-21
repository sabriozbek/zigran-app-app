import apiClient from '../client';

export const segmentsService = {
  summary: async () => {
    const response = await apiClient.get('/segments/summary');
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/segments', {
      name: data?.name,
      description: data?.description,
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/segments/${id}`);
    return response.data;
  },

  getLeads: async (id) => {
    const response = await apiClient.get(`/segments/${id}/leads`);
    return response.data;
  },

  addLead: async (id, email) => {
    const response = await apiClient.post(`/segments/${id}/leads`, { email });
    return response.data;
  },

  removeLead: async (id, leadId) => {
    const response = await apiClient.delete(`/segments/${id}/leads/${leadId}`);
    return response.data;
  },

  patchRules: async (id, rules) => {
    const response = await apiClient.patch(`/segments/${id}/rules`, rules);
    return response.data;
  },
};

