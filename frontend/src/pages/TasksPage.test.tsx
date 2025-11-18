/// <reference types="vitest" />

import { render, screen } from "@testing-library/react";
import TasksPage from "./TasksPage";
import { renderWithProviders } from "../test-utils";

describe("TasksPage", () => {
  test("renders tasks page title and subtitle", () => {
    render(renderWithProviders(<TasksPage />));

    // Заголовок и подзаголовок PageHeader
    expect(screen.getByText(/Задачи/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Управляйте задачами, командами и зонами/i),
    ).toBeInTheDocument();
  });

  test("renders create task button", () => {
    render(renderWithProviders(<TasksPage />));

    // Кнопка создания новой задачи
    const createButton = screen.getByRole("button", { name: /Новая задача/i });
    expect(createButton).toBeInTheDocument();
  });

  test("renders table headers and loading spinner", () => {
    render(renderWithProviders(<TasksPage />));

    // Заголовки колонок таблицы
    expect(screen.getByText("Название")).toBeInTheDocument();
    expect(screen.getByText("Статус")).toBeInTheDocument();
    expect(screen.getByText("Приоритет")).toBeInTheDocument();
    expect(screen.getByText("Команда")).toBeInTheDocument();
    expect(screen.getByText("Зона")).toBeInTheDocument();
    expect(screen.getByText("Действия")).toBeInTheDocument();

    // Лоадер в теле таблицы
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
