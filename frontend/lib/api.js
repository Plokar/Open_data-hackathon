/**
 * API client pro komunikaci s Django backendem
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Generická metoda pro HTTP requesty
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      credentials: 'include', // Důležité pro session cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw {
          status: response.status,
          message: data?.error || data?.detail || 'Něco se pokazilo',
          data,
        };
      }

      return data;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw {
        status: 500,
        message: 'Nepodařilo se připojit k serveru',
        data: null,
      };
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Authentication endpoints
  auth = {
    register: (data) => this.post('/api/auth/register/', data),
    login: (data) => this.post('/api/auth/login/', data),
    logout: () => this.post('/api/auth/logout/', {}),
    getProfile: () => this.get('/api/auth/profile/'),
    updateProfile: (data) => this.put('/api/auth/profile/', data),
    changePassword: (data) => this.put('/api/auth/change-password/', data),
    checkStatus: () => this.get('/api/auth/status/'),
  };

  // Items endpoints (example)
  items = {
    list: () => this.get('/api/items/'),
    get: (id) => this.get(`/api/items/${id}/`),
    create: (data) => this.post('/api/items/', data),
    update: (id, data) => this.put(`/api/items/${id}/`, data),
    delete: (id) => this.delete(`/api/items/${id}/`),
  };
}

export const api = new ApiClient();
