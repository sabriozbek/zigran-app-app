import apiClient from '../client';

export const smsService = {
  send: async (data) => {
    const response = await apiClient.post('/sms/send', {
      to: data?.to,
      message: data?.message,
      leadId: data?.leadId,
      contactId: data?.contactId,
    });
    return response?.data;
  },

  listLogs: async (params = {}) => {
    const response = await apiClient.get('/sms/logs', { params });
    return response?.data;
  },
};

