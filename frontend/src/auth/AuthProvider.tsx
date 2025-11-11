// frontend/src/auth/AuthProvider.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";

import type { Pyrotechnician } from "../types";
import {
  login as apiLogin,
  getMe,
  setAuthToken,
  getStoredToken,
  type LoginRequest,
} from "../services/api";
import { useNotification } from "../notifications/NotificationProvider";

type AuthContextValue = {
  user: Pyrotechnician | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
  // --- НОВАЯ ФУНКЦИЯ ---
  setTokenAndUser: (accessToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { notifyError } = useNotification();

  const [user, setUser] = useState<Pyrotechnician | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- НОВАЯ ВНУТРЕННЯЯ ФУНКЦИЯ ---
  // Она будет использоваться и при обычном логине, и при инициализации, и при смене пароля
  const handleSetToken = async (accessToken: string) => {
    setAuthToken(accessToken);
    setToken(accessToken);
    try {
      const me = await getMe();
      setUser(me);
    } catch (e) {
      // если токен вдруг оказался невалидным, сбрасываем все
      setAuthToken(null);
      setToken(null);
      setUser(null);
      notifyError("Сессия истекла или недействительна. Пожалуйста, войдите снова.");
      throw e; // пробрасываем ошибку дальше, если нужно
    }
  };
  // ---------------------------------

  // Инициализация из localStorage
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Используем новую общую функцию
        await handleSetToken(stored);
      } catch (e) {
        // Ошибка уже обработана внутри handleSetToken
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogin = async (payload: LoginRequest) => {
    // Эта функция остается для обычного логина, но теперь она будет проще
    const { access_token } = await apiLogin(payload);
    await handleSetToken(access_token);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    token,
    loading,
    // Обернем handleLogin в try/catch, чтобы LoginPage мог ловить ошибки
    login: async (payload: LoginRequest) => {
        try {
            await handleLogin(payload);
        } catch(e: any) {
            const msg = e?.responseData?.detail || e?.message || "Не удалось войти";
            // Не показываем ошибку "PASSWORD_CHANGE_REQUIRED" пользователю
            if (msg !== "PASSWORD_CHANGE_REQUIRED") {
              notifyError(msg);
            }
            throw e; // Пробрасываем ошибку для LoginPage
        }
    },
    logout: handleLogout,
    // --- ПРЕДОСТАВЛЯЕМ НОВУЮ ФУНКЦИЮ В КОНТЕКСТ ---
    setTokenAndUser: handleSetToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

// Обёртка для защищённых роутов
export function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null; // или спиннер
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}