import apiClient from '../client';

export const tasksService = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/tasks', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/tasks', data);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await apiClient.patch(`/tasks/${id}`, { status });
    return response.data;
  }
};
