import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Декларация глобального клиента
declare global {
  // eslint-disable-next-line no-var
  var __TEST_QUERY_CLIENT__: QueryClient;
}

beforeEach(() => {
  globalThis.__TEST_QUERY_CLIENT__ = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
});
