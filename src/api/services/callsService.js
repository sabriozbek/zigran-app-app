import apiClient from '../client';

export const callsService = {
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/calls', { params });
      return response.data;
    } catch (error) {
      console.warn('callsService.getAll failed, returning empty list', error);
      return [];
    }
  },

  get: async (id) => {
    const response = await apiClient.get(`/calls/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/calls', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/calls/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/calls/${id}`);
    return response.data;
  },
};
