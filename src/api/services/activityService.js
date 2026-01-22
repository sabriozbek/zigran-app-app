import apiClient from '../client';

export const activityService = {
  list: async (params = {}) => {
    const response = await apiClient.get('/activities', { params });
    return response.data;
  },
  create: async (data) => {
    const payload = {
      type: data?.type,
      description: data?.description,
      metadata: data?.metadata,
    };
    const response = await apiClient.post('/activities', payload);
    return response.data;
  },
  markAsRead: async (id) => {
    const response = await apiClient.patch(`/activities/${id}`, { isRead: true });
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/activities/${id}`);
    return response.data;
  },
  clearAll: async () => {
    const response = await apiClient.delete('/activities');
    return response.data;
  },
};
