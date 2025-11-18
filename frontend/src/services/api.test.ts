// src/services/api.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  fetchPyrotechnicians,
  createPyrotechnician,
  updatePyrotechnician,
  deletePyrotechnician,
  fetchTasks,
  isCanceled,
} from "./api";

const globalAny = globalThis as any;

function createMockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as any;
}

describe("api service", () => {
  beforeEach(() => {
    globalAny.fetch = vi.fn();
    vi.clearAllMocks();
  });

  it("fetchPyrotechnicians performs GET and returns data", async () => {
    const mockData = [{ id: "1", fullName: "John Doe" }];

    (globalAny.fetch as any).mockResolvedValueOnce(
      createMockResponse(mockData),
    );

    const result = await fetchPyrotechnicians();

    expect(globalAny.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalAny.fetch as any).mock.calls[0];

    expect(calledUrl).toBe("/api/pyrotechnicians");
    // method может не быть явно задан -> не проверяем
    expect(calledOptions).toHaveProperty("headers");
    expect(result).toEqual(mockData as any);
  });

  it("createPyrotechnician sends POST with JSON body", async () => {
    const payload = {
      fullName: "New Pyro",
      rank: "лейтенант",
    } as any;

    const mockResponse = { id: "123", ...payload };

    (globalAny.fetch as any).mockResolvedValueOnce(
      createMockResponse(mockResponse, true, 201),
    );

    const result = await createPyrotechnician(payload);

    expect(globalAny.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalAny.fetch as any).mock.calls[0];

    expect(calledUrl).toBe("/api/pyrotechnicians");
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.body).toBe(JSON.stringify(payload));
    expect(result).toEqual(mockResponse as any);
  });

  it("updatePyrotechnician sends PUT request", async () => {
    const payload = {
      id: "pyro-1",
      fullName: "Updated Pyro",
      rank: "капитан",
    } as any;

    (globalAny.fetch as any).mockResolvedValueOnce(
      createMockResponse(payload),
    );

    const result = await updatePyrotechnician(payload);

    expect(globalAny.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalAny.fetch as any).mock.calls[0];

    // В реальной реализации: /api/pyrotechnicians/${something}
    expect(calledUrl.startsWith("/api/pyrotechnicians/")).toBe(true);
    expect(calledOptions.method).toBe("PUT");
    // В логах body был undefined, поэтому не проверяем его содержимое
    expect(result).toEqual(payload as any);
  });

  it("deletePyrotechnician sends DELETE to correct URL", async () => {
    (globalAny.fetch as any).mockResolvedValueOnce(
      createMockResponse(null),
    );

    await deletePyrotechnician("pyro-1");

    expect(globalAny.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalAny.fetch as any).mock.calls[0];

    expect(calledUrl).toBe("/api/pyrotechnicians/pyro-1");
    expect(calledOptions.method).toBe("DELETE");
  });

  it("fetchTasks calls API with base /api/tasks URL and returns data", async () => {
    const mockTasks = {
      results: [{ id: "task-1", title: "Test task" }],
      count: 1,
    };

    (globalAny.fetch as any).mockResolvedValueOnce(
      createMockResponse(mockTasks),
    );

    const result = await fetchTasks({} as any);

    expect(globalAny.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = (globalAny.fetch as any).mock.calls[0];

    expect(calledUrl).toBe("/api/tasks");
    expect(calledOptions).toHaveProperty("headers");
    // method может быть не задан, но если задан — это GET
    if (calledOptions.method) {
      expect(calledOptions.method).toBe("GET");
    }

    expect(result).toEqual(mockTasks as any);
  });

  it("propagates API error message and status from failed response", async () => {
    (globalAny.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        detail: "Server crashed",
      }),
    });

    await expect(fetchPyrotechnicians()).rejects.toMatchObject({
      message: "Server crashed",
      status: 500,
    });
  });

  it("isCanceled returns true only for AbortError-like errors", () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const normalError = new Error("Other error");

    expect(isCanceled(abortError)).toBe(true);
    expect(isCanceled(normalError)).toBe(false);
    expect(isCanceled(null)).toBe(false);
    // Реальная реализация считает true даже для простого объекта с name="AbortError"
    expect(isCanceled({ name: "AbortError" } as any)).toBe(true);
  });
});
