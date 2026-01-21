import apiClient from './client';

export const crmService = {
  // Müşterileri Getir
  getCustomers: async () => {
    try {
      const response = await apiClient.get('/customers');
      // API'den dönen verinin yapısına göre burayı düzenliyoruz.
      // Örn: response.data veya response.data.data
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Müşteri Detayı Getir (İleride kullanılabilir)
  getCustomerDetails: async (id) => {
    try {
      const response = await apiClient.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Yeni Müşteri Ekle
  addCustomer: async (customerData) => {
    try {
      const response = await apiClient.post('/customers', customerData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
