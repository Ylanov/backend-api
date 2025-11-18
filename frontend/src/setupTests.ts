import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Глобальный QueryClient для всех тестов
beforeEach(() => {
  global.__TEST_QUERY_CLIENT__ = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
});

// Моки CSS, SCSS
vi.mock("*.css", () => ({}));
vi.mock("*.scss", () => ({}));
vi.mock("./styles.css", () => ({}));
