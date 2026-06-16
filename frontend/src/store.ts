import { create } from "zustand";
import { User } from "./types";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("helpdesk_token"),
  user: localStorage.getItem("helpdesk_user") ? JSON.parse(localStorage.getItem("helpdesk_user") || "null") : null,
  setAuth: (token, user) => {
    localStorage.setItem("helpdesk_token", token);
    localStorage.setItem("helpdesk_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("helpdesk_token");
    localStorage.removeItem("helpdesk_user");
    set({ token: null, user: null });
  }
}));
