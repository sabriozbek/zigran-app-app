import apiClient from '../client';

export const accountsService = {
  getAll: async (params = {}) => {
    try {
      const response = await apiClient.get('/accounts', { params });
      return response.data;
    } catch (error) {
      console.warn('accountsService.getAll failed, returning empty list', error);
      return [];
    }
  },

  get: async (id) => {
    const response = await apiClient.get(`/accounts/${id}`);
    return response.data;
  },

  create: async (data) => {
    const payload = {
      name: data?.name,
      website: data?.website,
      phone: data?.phone,
      industry: data?.industry,
      employeeCount: data?.employeeCount,
      annualRevenue: data?.annualRevenue,
      taxOffice: data?.taxOffice,
      taxNumber: data?.taxNumber,
      billingAddress: data?.billingAddress,
      shippingAddress: data?.shippingAddress,
      description: data?.description,
      assignedToId: data?.assignedToId,
      tags: data?.tags,
    };
    const response = await apiClient.post('/accounts', payload);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.patch(`/accounts/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/accounts/${id}`);
    return response.data;
  },
};
