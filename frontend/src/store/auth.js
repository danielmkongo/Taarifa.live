import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user:         null,
  token:        localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    set({ user, token, refreshToken: refreshToken ?? localStorage.getItem('refreshToken') });
  },

  setUser: (user) => set({ user }),

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, refreshToken: null });
  },
}));
