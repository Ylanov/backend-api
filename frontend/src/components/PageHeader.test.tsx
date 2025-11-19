import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import PageHeader from "./PageHeader";
import { renderWithProviders } from "../test-utils";

test("renders title", () => {
  render(renderWithProviders(<PageHeader title="Тест" />));
  expect(screen.getByText(/тест/i)).toBeInTheDocument();
});

test("renders actions if provided", () => {
  render(
    renderWithProviders(
      <PageHeader title="Title" actions={<button>Action</button>} />,
    ),
  );
  expect(screen.getByText(/action/i)).toBeInTheDocument();
});
