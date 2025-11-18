import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { NotificationProvider } from "@/notifications/NotificationProvider";
import { AuthProvider } from "@/auth/AuthProvider";

export const renderWithProviders = (ui: React.ReactNode, route = "/") => {
  const client = global.__TEST_QUERY_CLIENT__;

  return (
    <QueryClientProvider client={client}>
      <NotificationProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
};
