const API = {
  getToken() {
    return localStorage.getItem('s7x_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('s7x_token', token);
    } else {
      localStorage.removeItem('s7x_token');
    }
  },

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const error = new Error(data?.error || data?.message || 'Erro na requisição');
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  },

  getDeviceId() {
    let id = localStorage.getItem('s7x_device_id');
    if (!id) {
      id = 'brw_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('s7x_device_id', id);
    }
    return id;
  },

  login(username, password, turnstileToken) {
    const device_id = this.getDeviceId();
    return this.request('/auth/login', {
      method: 'POST',
      body: { username, password, device_id, turnstileToken }
    });
  },

  me() {
    return this.request('/auth/me');
  },

  stats() {
    return this.request('/dashboard/stats');
  },

  listKeys(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/keys?${q}`);
  },

  createKeys(body) {
    return this.request('/keys', { method: 'POST', body });
  },

  pauseKey(id) {
    return this.request(`/keys/${id}/pause`, { method: 'POST' });
  },

  resumeKey(id) {
    return this.request(`/keys/${id}/resume`, { method: 'POST' });
  },

  restoreKey(id) {
    return this.request(`/keys/${id}/restore`, { method: 'POST' });
  },

  deleteKey(id) {
    return this.request(`/keys/${id}`, { method: 'DELETE' });
  },

  listProducts() {
    return this.request('/keys/products');
  },

  claimKeyFromStock(body) {
    return this.request('/keys/claim-from-stock', { method: 'POST', body });
  },

  getReservoirStock(platform, durationDays) {
    return this.request(`/keys/reservoir/stock?platform=${encodeURIComponent(platform)}&duration_days=${encodeURIComponent(durationDays)}`);
  },

  deleteReservoirStockKey(id) {
    return this.request(`/keys/reservoir/stock/${id}`, { method: 'DELETE' });
  },

  deleteBulkReservoirStock(platform, durationDays) {
    return this.request(`/keys/reservoir/stock-bulk/all?platform=${encodeURIComponent(platform)}&duration_days=${encodeURIComponent(durationDays)}`, { method: 'DELETE' });
  },

  listUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/users?${q}`);
  },

  createUser(body) {
    return this.request('/users', { method: 'POST', body });
  },

  updateCredits(id, amount, isSet = false) {
    const body = isSet ? { set: amount } : { amount };
    return this.request(`/users/${id}/credits`, { method: 'PATCH', body });
  },

  updateProfile(id, body) {
    return this.request(`/users/${id}`, { method: 'PATCH', body });
  },

  updateUserStatus(id, status) {
    return this.request(`/users/${id}/status`, { method: 'PATCH', body: { status } });
  },

  deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  },

  resetUserDevice(id) {
    return this.request(`/users/${id}/reset-device`, { method: 'PATCH' });
  },

  banUser(id) {
    return this.request(`/users/${id}/status`, { method: 'PATCH', body: { status: 'suspended' } });
  },

  getUserProductPermissions(id) {
    return this.request(`/users/${id}/product-permissions`);
  },

  setUserProductPermissions(id, permissions) {
    return this.request(`/users/${id}/product-permissions`, { method: 'PUT', body: { permissions } });
  },

  listLogs(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/logs?${q}`);
  },

  listPermissions() {
    return this.request('/permissions');
  },

  addPermission(body) {
    return this.request('/permissions', { method: 'POST', body });
  },

  deletePermission(id) {
    return this.request(`/permissions/${id}`, { method: 'DELETE' });
  },

  addBulkKeys(body) {
    return this.request('/keys/bulk', { method: 'POST', body });
  },

  getReservoirStats() {
    return this.request('/keys/reservoir-stats');
  },

  listPlatforms() {
    return this.request('/platforms');
  },

  createPlatform(body) {
    return this.request('/platforms', { method: 'POST', body });
  },

  updatePlatform(id, body) {
    return this.request(`/platforms/${id}`, { method: 'PUT', body });
  },

  deletePlatform(id, slug) {
    const target = id && id !== 'undefined' ? id : (slug || '');
    return this.request(`/platforms/${encodeURIComponent(target)}`, {
      method: 'DELETE',
      body: { slug: slug || id }
    });
  },

  creditsPage() {
    return this.request('/credits-page');
  },

  getWalletConfig() {
    return this.request('/wallet/config');
  },

  updateWalletConfig(body) {
    return this.request('/wallet/config', { method: 'PUT', body });
  },

  getWalletPricing(credits) {
    return this.request(`/wallet/pricing?credits=${credits}`);
  },

  createPixPayment(body) {
    return this.request('/wallet/pix', { method: 'POST', body });
  },

  checkPaymentStatus(id) {
    return this.request(`/wallet/status/${id}`);
  },

  listTransactions() {
    return this.request('/wallet/transactions');
  },

  getPublicDownload(slug) {
    return this.request(`/downloads/public/${slug}`);
  },

  listDownloads() {
    return this.request('/downloads');
  },

  createDownload(body) {
    return this.request('/downloads', { method: 'POST', body });
  },

  updateDownload(id, body) {
    return this.request(`/downloads/${id}`, { method: 'PUT', body });
  },

  deleteDownload(id) {
    return this.request(`/downloads/${id}`, { method: 'DELETE' });
  },

  listPublicFiles() {
    return this.request('/public-files');
  },

  getPublicFileInfo(slug) {
    return this.request(`/public-files/info/${slug}`);
  },

  async uploadPublicFile(formData) {
    const token = this.getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/public-files/upload', {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
      throw new Error(err.error || 'Erro no upload');
    }
    return res.json();
  },

  deletePublicFile(id) {
    return this.request(`/public-files/${id}`, { method: 'DELETE' });
  },

  updatePublicFile(id, body) {
    return this.request(`/public-files/${id}`, { method: 'PUT', body });
  },

  detectLanguage() {
    return this.request('/geo/detect-language');
  }
};

export default API;
