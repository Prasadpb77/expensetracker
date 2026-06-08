import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, Family, ToastMessage } from '@/types';

interface AppState {
  // User
  profile: Profile | null;
  family: Family | null;
  familyMembers: Profile[];

  // UI
  isDarkMode: boolean;
  sidebarOpen: boolean;
  toasts: ToastMessage[];

  // Actions - User
  setProfile: (profile: Profile | null) => void;
  setFamily: (family: Family | null) => void;
  setFamilyMembers: (members: Profile[]) => void;

  // Actions - UI
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Actions - Toast
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      profile: null,
      family: null,
      familyMembers: [],
      isDarkMode: false,
      sidebarOpen: true,
      toasts: [],

      // User actions
      setProfile: (profile) => set({ profile }),
      setFamily: (family) => set({ family }),
      setFamilyMembers: (familyMembers) => set({ familyMembers }),

      // UI actions
      toggleDarkMode: () =>
        set((state) => {
          const isDarkMode = !state.isDarkMode;
          if (isDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { isDarkMode };
        }),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      // Toast actions
      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: crypto.randomUUID() },
          ],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),
    }),
    {
      name: 'family-finance-store',
      partialize: (state) => ({ isDarkMode: state.isDarkMode }),
    }
  )
);
