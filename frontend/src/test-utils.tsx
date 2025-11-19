import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { NotificationProvider } from "./notifications/NotificationProvider";
import { AuthProvider } from "./auth/AuthProvider";

// Декларируем глобальный объект, чтобы TS не ругался
declare global {
  // eslint-disable-next-line no-var
  var __TEST_QUERY_CLIENT__: import("@tanstack/react-query").QueryClient;
}

export const renderWithProviders = (ui: React.ReactNode, route = "/") => {
  const client = globalThis.__TEST_QUERY_CLIENT__; // заменили global → globalThis

  return (
    <QueryClientProvider client={client}>
      <NotificationProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>
            {ui}
          </MemoryRouter>
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
};
