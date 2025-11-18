// src/App.test.tsx
import type { ReactNode } from "react"; // type-only import из-за verbatimModuleSyntax
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { describe, it, expect, vi } from "vitest";

// Мокаем модуль аутентификации, чтобы не падать из-за контекста Auth
vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { is_admin: false },
    logout: vi.fn(),
  }),
  // RequireAuth просто пропускает детей
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Мокаем NotificationProvider и useNotification,
// чтобы не было ошибки "useNotification must be used within a NotificationProvider"
vi.mock("./notifications/NotificationProvider", () => ({
  NotificationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useNotification: () => ({
    notify: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const queryClient = new QueryClient();

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/some-unknown-route"]}>
      <QueryClientProvider client={queryClient}>
        {/* App внутри реального QueryClientProvider */}
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders 404 page for unknown route", () => {
    renderApp();

    // Тексты возьми ровно из App.tsx в роуте "*"
    expect(screen.getByText(/Страница не найдена/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Проверьте адрес или выберите раздел в меню слева/i),
    ).toBeInTheDocument();
  });
});
