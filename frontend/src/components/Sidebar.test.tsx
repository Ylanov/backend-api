import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";
import { renderWithProviders } from "@/test-utils";

test("renders logo and main menu", () => {
  render(renderWithProviders(<Sidebar />));

  // Проверяем хотя бы один пункт
  expect(screen.getAllByText(/оперативная карта/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/рабочие зоны/i).length).toBeGreaterThan(0);
});
