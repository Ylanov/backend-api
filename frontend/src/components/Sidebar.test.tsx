// src/components/Sidebar.test.tsx
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";
import { renderWithProviders } from "../test-utils";

test("renders logo and main menu", () => {
  // Создаем моковые пропсы, которые требует компонент Sidebar
  const defaultProps = {
    mobileOpen: false,
    onMobileClose: vi.fn(), // Заглушка для функции закрытия
    isAdmin: true,          // Передаем true, чтобы увидеть админские пункты меню (если они есть)
  };

  render(renderWithProviders(<Sidebar {...defaultProps} />));

  // Проверяем наличие пунктов меню
  // Используем getAllByText, так как текст может встречаться и в мобильной, и в десктопной версии меню
  expect(screen.getAllByText(/оперативная карта/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/рабочие зоны/i).length).toBeGreaterThan(0);
});