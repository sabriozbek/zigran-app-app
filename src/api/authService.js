import * as SecureStore from 'expo-secure-store';
import apiClient from './client';

const TOKEN_KEY = 'zigran_auth_token';
const PROFILE_KEY = 'zigran_profile_cache';

async function setToken(token) {
  if (typeof token !== 'string' || token.length === 0) return;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function setProfileCache(profile) {
  if (!profile || typeof profile !== 'object') return;
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

async function getProfileCache() {
  const raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(PROFILE_KEY);
}

function extractUrl(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const s = value.trim();
    return s;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const u = extractUrl(item);
      if (u) return u;
    }
    return '';
  }

  if (typeof value !== 'object') return '';

  const direct =
    value.uri ??
    value.url ??
    value.src ??
    value.href ??
    value.path ??
    value.location ??
    value.downloadUrl ??
    value.download_url ??
    value.publicUrl ??
    value.public_url ??
    value.id ??
    value.uuid ??
    value.documentId ??
    value.document_id;

  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);

  const nestedCandidates = [
    value.data,
    value.attributes,
    value.file,
    value.image,
    value.avatar,
    value.photo,
    value.picture,
    value.profilePhoto,
    value.profile_photo,
  ];

  for (const candidate of nestedCandidates) {
    const u = extractUrl(candidate);
    if (u) return u;
  }

  const keys = Object.keys(value);
  for (const k of keys) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const v = value[k];
    const u = extractUrl(v);
    if (u) return u;
  }

  return '';
}

function normalizeUser(data, emailInput = '') {
  // Try to find user object in various places
  const user = data?.user ?? data?.profile ?? data?.data?.user ?? data?.data ?? data ?? {};
  
  // Basic fields extraction with multiple fallback keys
  let firstName = 
    user.firstName ?? user.first_name ?? user.givenName ?? user.given_name ?? 
    data?.firstName ?? data?.first_name ?? '';
    
  let lastName = 
    user.lastName ?? user.last_name ?? user.familyName ?? user.family_name ?? 
    data?.lastName ?? data?.last_name ?? '';
    
  let email = 
    user.email ?? user.mail ?? 
    data?.email ?? data?.mail ?? 
    emailInput ?? '';
    
  let name = 
    user.name ?? user.fullName ?? user.full_name ?? user.displayName ?? user.display_name ?? 
    data?.name ?? data?.fullName ?? data?.full_name ?? '';
  
  // Avatar extraction
  const avatarCandidate =
    user.avatarUrl ?? user.avatar_url ?? 
    user.photoUrl ?? user.photo_url ?? 
    user.picture ?? user.photo ?? user.avatar ?? 
    user.profilePhotoUrl ?? user.profile_photo_url ?? 
    user.profile_photo ?? user.imageUrl ?? user.image_url ?? 
    user.avatarId ?? user.avatar_id ??
    '';
  let avatarUrl = extractUrl(avatarCandidate);

  // Logic to split full name if first name is missing
  if (!firstName && name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length > 0) {
      firstName = parts[0];
      if (parts.length > 1) {
        lastName = parts.slice(1).join(' ');
      }
    }
  }
  
  // Fallback to email username if still no name
  if (!firstName && email) {
    const parts = String(email).split('@');
    if (parts.length > 0) firstName = parts[0];
  }

  // Company info
  const companyName = 
    user.companyName ?? user.company_name ?? 
    data?.companyName ?? data?.company_name ?? 
    user.company?.name ?? data?.company?.name ?? '';

  return {
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    email: String(email || '').toLowerCase().trim(),
    avatarUrl: String(avatarUrl || '').trim(),
    companyName: String(companyName || '').trim(),
  };
}

export const authService = {
  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', {
      email: String(email || '').toLowerCase().trim(),
      password: String(password || ''),
    });

    if (response?.data?.twoFactorRequired) {
      return response.data;
    }

    const token = response?.data?.access_token;
    await setToken(token);
    
    const profile = normalizeUser(response.data, email);
    await setProfileCache(profile);
    
    return response.data;
  },

  loginWithGoogle: async (idToken) => {
    const response = await apiClient.post('/auth/google', {
      token: String(idToken || '').trim(),
    });
    const token = response?.data?.access_token;
    await setToken(token);
    
    const profile = normalizeUser(response.data);
    await setProfileCache(profile);
    
    return response.data;
  },

  signup: async (payload) => {
    const response = await apiClient.post('/auth/signup', {
      companyName: payload.companyName,
      companySize: payload.companySize,
      email: String(payload.email || '').toLowerCase().trim(),
      password: payload.password,
      firstName: payload.firstName,
      lastName: payload.lastName,
      position: payload.position,
      phone: payload.phone,
    });
    const token = response?.data?.access_token;
    await setToken(token);
    
    const profile = normalizeUser({ ...response.data, ...payload }, payload.email);
    await setProfileCache(profile);
    
    return response.data;
  },

  verifyTwoFactor: async ({ ticketId, code }) => {
    const response = await apiClient.post('/auth/2fa/verify', {
      ticketId: String(ticketId || '').trim(),
      code: String(code || '').trim(),
    });
    const token = response?.data?.access_token;
    await setToken(token);
    
    const profile = normalizeUser(response.data);
    await setProfileCache(profile);
    
    return response.data;
  },

  resendTwoFactor: async ({ ticketId }) => {
    const response = await apiClient.post('/auth/2fa/resend', {
      ticketId: String(ticketId || '').trim(),
    });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot', {
      email: String(email || '').toLowerCase().trim(),
    });
    return response.data;
  },

  resetPassword: async ({ token, newPassword }) => {
    const response = await apiClient.post('/auth/reset', {
      token: String(token || '').trim(),
      newPassword: String(newPassword || ''),
    });
    return response.data;
  },

  me: async () => {
    const results = await Promise.allSettled([apiClient.get('/auth/me'), apiClient.get('/settings/profile')]);
    const authData = results[0].status === 'fulfilled' ? results[0].value?.data : null;
    const settingsData = results[1].status === 'fulfilled' ? results[1].value?.data : null;

    const cached = await getProfileCache();

    const normalizedAuth = authData ? normalizeUser(authData) : null;
    const normalizedSettings = settingsData ? normalizeUser(settingsData) : null;

    const normalized = {
      firstName: normalizedSettings?.firstName || normalizedAuth?.firstName || '',
      lastName: normalizedSettings?.lastName || normalizedAuth?.lastName || '',
      email: normalizedSettings?.email || normalizedAuth?.email || '',
      avatarUrl: normalizedSettings?.avatarUrl || normalizedAuth?.avatarUrl || '',
      companyName: normalizedSettings?.companyName || normalizedAuth?.companyName || '',
    };

    if (!normalized.firstName && cached?.firstName) normalized.firstName = cached.firstName;
    if (!normalized.lastName && cached?.lastName) normalized.lastName = cached.lastName;
    if (!normalized.email && cached?.email) normalized.email = cached.email;
    if (!normalized.avatarUrl && cached?.avatarUrl) normalized.avatarUrl = cached.avatarUrl;
    if (!normalized.companyName && cached?.companyName) normalized.companyName = cached.companyName;

    if (normalized.email) await setProfileCache(normalized);

    const nextBase = authData && typeof authData === 'object' ? authData : {};
    const next =
      settingsData && typeof settingsData === 'object'
        ? { ...nextBase, ...settingsData }
        : { ...nextBase };

    const patch = (target) => {
      if (!target) return;
      if (!target.firstName && normalized.firstName) target.firstName = normalized.firstName;
      if (!target.lastName && normalized.lastName) target.lastName = normalized.lastName;
      if (!target.email && normalized.email) target.email = normalized.email;
      if (!target.avatarUrl && normalized.avatarUrl) target.avatarUrl = normalized.avatarUrl;
    };

    patch(next);
    if (next.user) patch(next.user);
    if (next.profile) patch(next.profile);
    if (next.data) {
      patch(next.data);
      if (next.data.user) patch(next.data.user);
      if (next.data.profile) patch(next.data.profile);
    }

    return next;
  },

  logout: async () => {
    await clearToken();
  },

  getToken: async () => {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },
};
