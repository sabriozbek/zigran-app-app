import apiClient from '../client';

export const leadsService = {
  // Tüm Leadleri Getir
  getAll: async (params = {}) => {
    const response = await apiClient.get('/leads', { params });
    return response.data;
  },

  // Kaynaklar
  getSources: async () => {
    const response = await apiClient.get('/leads/sources');
    return response.data;
  },

  // Tekil Lead Getir
  getOne: async (id) => {
    const response = await apiClient.get(`/leads/${id}`);
    return response.data;
  },

  // History
  getHistory: async (id) => {
    const response = await apiClient.get(`/leads/${id}/history`);
    return response.data;
  },

  // Calls
  getCalls: async (id) => {
    const response = await apiClient.get(`/leads/${id}/calls`);
    return response.data;
  },

  // Yeni Lead Ekle
  create: async (data) => {
    const response = await apiClient.post('/leads', data);
    return response.data;
  },

  // Toplu ekle
  bulkCreate: async (items) => {
    const response = await apiClient.post('/leads/bulk', { items: Array.isArray(items) ? items : [] });
    return response.data;
  },

  // Entegrasyon lead sync
  syncAccounts: async () => {
    const response = await apiClient.post('/leads/sync-accounts');
    return response.data;
  },

  // Güncelle
  update: async (id, data) => {
    const response = await apiClient.patch(`/leads/${id}`, data);
    return response.data;
  },

  // Sil
  delete: async (id) => {
    const response = await apiClient.delete(`/leads/${id}`);
    return response.data;
  }
};
