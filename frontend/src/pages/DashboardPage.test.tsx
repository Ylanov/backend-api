// src/pages/DashboardPage.test.tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, render, fireEvent } from "@testing-library/react";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "../test-utils";
import type { Task, Team, Zone } from "../types";

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
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ======================================================================
//                          MOCK YANDEX MAPS
// ======================================================================
vi.mock("@pbe/react-yandex-maps", () => ({
  YMaps: ({ children }: { children: React.ReactNode }) => <div data-testid="ymaps">{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Polygon: ({ onClick }: { onClick?: () => void }) => (

    <div data-testid="polygon" onClick={() => onClick?.()} />
  ),
  Placemark: ({ onClick }: { onClick?: () => void }) => (

    <div data-testid="placemark" onClick={() => onClick?.()} />
  ),
}));

// ======================================================================
//                              MOCK API
// ======================================================================
import {
  fetchTasks,
  fetchTeams,
  fetchZones,
  fetchZoneDetails,
} from "../services/api";

vi.mock("../services/api");

const mockFetchTasks = vi.mocked(fetchTasks);
const mockFetchTeams = vi.mocked(fetchTeams);
const mockFetchZones = vi.mocked(fetchZones);
const mockFetchZoneDetails = vi.mocked(fetchZoneDetails);

describe("DashboardPage Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchTasks.mockResolvedValue([]);
    mockFetchTeams.mockResolvedValue([]);
    mockFetchZones.mockResolvedValue([]);
    mockFetchZoneDetails.mockResolvedValue({
      id: 99,
      name: "Зона X",
      description: "Описание зоны",
      tasks: [],
      points: [],
    });
  });

  // 1. Заголовок
  test("renders dashboard title", () => {
    render(renderWithProviders(<DashboardPage />));
    expect(screen.getByText(/оперативная карта/i)).toBeInTheDocument();
  });

  // 2. Spinner загрузки
  test("shows loading Spinner", () => {
    mockFetchTasks.mockReturnValue(new Promise(() => {}));
    mockFetchTeams.mockReturnValue(new Promise(() => {}));
    mockFetchZones.mockReturnValue(new Promise(() => {}));

    render(renderWithProviders(<DashboardPage />));

    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
  });

  // 3. Ошибка API
  test("shows error when API fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetchTasks.mockRejectedValue(new Error("Fail"));

    render(renderWithProviders(<DashboardPage />));

    expect(await screen.findByText(/fail/i)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  // 4. Статистика
  test("renders statistics correctly", async () => {
    // Используем 'as any' для статусов и приоритетов, чтобы обойти строгую типизацию в моках,
    // так как для теста важны строковые значения, совпадающие с тем, что ожидает UI.
    const tasksMock = [
      {
        id: 1,
        title: "A",
        status: "in_progress",
        priority: "medium",
        team_id: 10,
        zone: null,
      },
    ] as unknown as Task[];

    const teamsMock = [
      { id: 10, name: "Team A", organization_unit_id: 1, members: [] },
      { id: 11, name: "Team B", organization_unit_id: 1, members: [] },
    ] as Team[];

    mockFetchTasks.mockResolvedValue(tasksMock);
    mockFetchTeams.mockResolvedValue(teamsMock);

    render(renderWithProviders(<DashboardPage />));

    const numbers = await screen.findAllByText("1");
    expect(numbers.length).toBeGreaterThan(0);
  });

  // 5. Карта, полигоны, точки
  test("renders map, polygons and placemarks", async () => {
    const zonesMock = [
      { id: 5, name: "Zone A", description: "desc", points: [{ lat: 55, lng: 37 }] },
    ] as Zone[];

    const tasksMock = [
      {
        id: 1,
        title: "Test Task",
        status: "in_progress",
        priority: "medium",
        team_id: null,
        zone: { id: 5, name: "Zone A", description: "", points: [{ lat: 55, lng: 37 }] },
      },
    ] as unknown as Task[];

    mockFetchZones.mockResolvedValue(zonesMock);
    mockFetchTasks.mockResolvedValue(tasksMock);

    render(renderWithProviders(<DashboardPage />));

    expect(await screen.findByTestId("map")).toBeInTheDocument();
    expect(await screen.findByTestId("polygon")).toBeInTheDocument();
    expect(await screen.findByTestId("placemark")).toBeInTheDocument();
  });

  // 6. Клик по задаче — открытие drawer
  test("opens task drawer on placemark click", async () => {
    const tasksMock = [
      {
        id: 10,
        title: "Test Task",
        status: "in_progress",
        priority: "medium",
        team_id: null,
        zone: { id: 1, name: "Z", description: "", points: [{ lat: 55, lng: 37 }] },
        description: "desc",
      },
    ] as unknown as Task[];

    mockFetchTasks.mockResolvedValue(tasksMock);

    render(renderWithProviders(<DashboardPage />));

    const placemark = await screen.findByTestId("placemark");
    fireEvent.click(placemark);

    expect(await screen.findByText(/test task/i)).toBeInTheDocument();
  });

  // 7. Клик по зоне — открытие drawer
  test("opens zone drawer on polygon click", async () => {
    const zonesMock = [
      { id: 99, name: "Z1", description: "Zone Desc", points: [{ lat: 55, lng: 37 }] },
    ] as Zone[];

    mockFetchZones.mockResolvedValue(zonesMock);

    render(renderWithProviders(<DashboardPage />));

    const polygon = await screen.findByTestId("polygon");
    fireEvent.click(polygon);

    expect(await screen.findByText(/зона x/i)).toBeInTheDocument();
  });
});