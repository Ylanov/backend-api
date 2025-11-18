// src/pages/DashboardPage.test.tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, render, fireEvent } from "@testing-library/react";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "@/test-utils";

// ======================================================================
//                      CORRECT MOCK: AuthProvider
// ======================================================================
vi.mock("../auth/AuthProvider", () => ({
  __esModule: true,
  useAuth: () => ({
    user: { id: 1, is_admin: true, email: "admin@test.com" },
    setUser: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}));

// ======================================================================
//                          MOCK YANDEX MAPS
// ======================================================================
vi.mock("@pbe/react-yandex-maps", () => ({
  YMaps: ({ children }: any) => <div data-testid="ymaps">{children}</div>,
  Map: ({ children }: any) => <div data-testid="map">{children}</div>,
  Polygon: ({ onClick }: any) => (
    <div data-testid="polygon" onClick={() => onClick?.()} />
  ),
  Placemark: ({ onClick }: any) => (
    <div data-testid="placemark" onClick={() => onClick?.()} />
  ),
}));

// ======================================================================
//                              MOCK API
// ======================================================================
vi.mock("../services/api", () => ({
  fetchTasks: vi.fn(),
  fetchTeams: vi.fn(),
  fetchZones: vi.fn(),
  fetchZoneDetails: vi.fn(),
}));

import {
  fetchTasks,
  fetchTeams,
  fetchZones,
  fetchZoneDetails,
} from "../services/api";

// ======================================================================
//                        beforeEach
// ======================================================================
beforeEach(() => {
  vi.clearAllMocks();

  fetchTasks.mockResolvedValue([]);
  fetchTeams.mockResolvedValue([]);
  fetchZones.mockResolvedValue([]);
  fetchZoneDetails.mockResolvedValue({
    id: 99,
    name: "Зона X",
    description: "Описание зоны",
    tasks: [],
    points: [],
  });
});

// ======================================================================
//                         1. Заголовок
// ======================================================================
test("renders dashboard title", () => {
  render(renderWithProviders(<DashboardPage />));
  expect(screen.getByText(/оперативная карта/i)).toBeInTheDocument();
});

// ======================================================================
//                        2. Spinner загрузки
// ======================================================================
test("shows loading Spinner", () => {
  fetchTasks.mockReturnValue(new Promise(() => {}));
  fetchTeams.mockReturnValue(new Promise(() => {}));
  fetchZones.mockReturnValue(new Promise(() => {}));

  render(renderWithProviders(<DashboardPage />));

  expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
});

// ======================================================================
//                            3. Ошибка API
// ======================================================================
test("shows error when API fails", async () => {
  fetchTasks.mockRejectedValue(new Error("Fail"));

  render(renderWithProviders(<DashboardPage />));

  expect(await screen.findByText(/fail/i)).toBeInTheDocument();
});

// ======================================================================
//                         4. Статистика
// ======================================================================
test("renders statistics correctly", async () => {
  fetchTasks.mockResolvedValue([
    { id: 1, title: "A", status: "in_progress", team_id: 10, zone: null },
  ]);

  fetchTeams.mockResolvedValue([
    { id: 10, name: "Team A" },
    { id: 11, name: "Team B" },
  ]);

  render(renderWithProviders(<DashboardPage />));

  const numbers = await screen.findAllByText("1");
  expect(numbers.length).toBeGreaterThan(0);
});

// ======================================================================
//                      5. Карта, полигоны, точки
// ======================================================================
test("renders map, polygons and placemarks", async () => {
  fetchZones.mockResolvedValue([
    { id: 5, name: "Zone A", points: [{ lat: 55, lng: 37 }] },
  ]);

  fetchTasks.mockResolvedValue([
    {
      id: 1,
      title: "Test Task",
      status: "in_progress",
      priority: "normal",
      team_id: null,
      zone: { points: [{ lat: 55, lng: 37 }] },
    },
  ]);

  render(renderWithProviders(<DashboardPage />));

  expect(await screen.findByTestId("map")).toBeInTheDocument();
  expect(await screen.findByTestId("polygon")).toBeInTheDocument();
  expect(await screen.findByTestId("placemark")).toBeInTheDocument();
});

// ======================================================================
//                6. Клик по задаче — открытие drawer
// ======================================================================
test("opens task drawer on placemark click", async () => {
  fetchTasks.mockResolvedValue([
    {
      id: 10,
      title: "Test Task",
      status: "in_progress",
      priority: "normal",
      team_id: null,
      zone: { points: [{ lat: 55, lng: 37 }] },
      description: "desc",
    },
  ]);

  render(renderWithProviders(<DashboardPage />));

  fireEvent.click(await screen.findByTestId("placemark"));

  expect(await screen.findByText(/test task/i)).toBeInTheDocument();
});

// ======================================================================
//                7. Клик по зоне — открытие drawer
// ======================================================================
test("opens zone drawer on polygon click", async () => {
  fetchZones.mockResolvedValue([
    { id: 99, name: "Z1", points: [{ lat: 55, lng: 37 }] },
  ]);

  render(renderWithProviders(<DashboardPage />));

  fireEvent.click(await screen.findByTestId("polygon"));

  expect(await screen.findByText(/зона x/i)).toBeInTheDocument();
});
