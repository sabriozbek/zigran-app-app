import apiClient from '../client';

export const analyticsService = {
  dashboard: async () => {
    const response = await apiClient.get('/analytics/dashboard');
    return response?.data;
  },

  funnel: async () => {
    const response = await apiClient.get('/analytics/funnel');
    return response?.data;
  },

  forms: async () => {
    const response = await apiClient.get('/analytics/forms');
    return response?.data;
  },

  meetings: async () => {
    const response = await apiClient.get('/analytics/meetings');
    return response?.data;
  },

  ads: async () => {
    const response = await apiClient.get('/analytics/ads');
    return response?.data;
  },

  ga4: async () => {
    const response = await apiClient.get('/analytics/ga4');
    return response?.data;
  },

  searchConsole: async () => {
    const response = await apiClient.get('/analytics/search-console');
    return response?.data;
  },

  pipeline: async () => {
    const response = await apiClient.get('/analytics/pipeline');
    return response?.data;
  },

  youtube: async (limit) => {
    const params = {};
    if (limit) params.limit = limit;
    const response = await apiClient.get('/analytics/youtube', { params });
    return response?.data;
  },
};

