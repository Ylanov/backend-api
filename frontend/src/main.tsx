// src/main.tsx
import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";

// MUI X Date Pickers
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ru } from "date-fns/locale"; // ✔ правильный импорт

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Наша тема
import { makeTheme, type ThemeMode } from "./lib/theme";

// Приложение и провайдеры
import App from "./App";
import { NotificationProvider } from "./notifications/NotificationProvider";
import { AuthProvider } from "./auth/AuthProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
    mutations: { retry: 0 },
  },
});

const THEME_STORAGE_KEY = "theme-mode";

function Root() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "dark" || saved === "light") {
      setMode(saved);
    }
  }, []);

  const theme = useMemo(() => makeTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </NotificationProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
