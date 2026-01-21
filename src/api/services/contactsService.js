import apiClient from '../client';

export const contactsService = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/contacts', { params });
    return response.data;
  },

  getOne: async (id) => {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/contacts', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.patch(`/contacts/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/contacts/${id}`);
    return response.data;
  }
};
