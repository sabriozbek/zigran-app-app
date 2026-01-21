import apiClient from '../client';

export const pipelinesService = {
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/deals', { params });
      return response.data;
    } catch (error) {
      console.warn('pipelinesService.getAll failed, returning empty list', error);
      return [];
    }
  },

  get: async (id) => {
    const response = await apiClient.get(`/deals/${id}`);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.patch(`/deals/${id}`, data);
    return response.data;
  },
};
