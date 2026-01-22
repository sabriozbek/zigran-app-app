import { contactsService } from './services/contactsService';

export const crmService = {
  getCustomers: async (params = {}) => {
    return contactsService.getAll(params);
  },

  getCustomerDetails: async (id) => {
    return contactsService.getOne(id);
  },

  addCustomer: async (customerData) => {
    return contactsService.create(customerData);
  }
};
