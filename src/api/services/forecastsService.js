import apiClient from '../client';

export const forecastsService = {
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/forecasts', { params });
      return response.data;
    } catch (error) {
      console.warn('forecastsService.getAll failed, returning empty list', error);
      return [];
    }
  },

  get: async (id) => {
    const response = await apiClient.get(`/forecasts/${id}`);
    return response.data;
  },
};
