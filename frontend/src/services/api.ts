// frontend/src/services/api.ts
import type {
  OrganizationNode,
  OrganizationUnit,
  OrganizationUnitCreate,
  OrganizationUnitUpdate,
  Pyrotechnician,
  PyrotechnicianCreate,
  PyrotechnicianUpdate,
  PyrotechnicianFlagsUpdate,
  Team,
  TeamCreate,
  TeamPatch,
  TeamUpdate,
  Zone,
  ZoneCreate,
  ZoneUpdate,
  Task,
  TaskCreate,
  TaskUpdate,
  TaskComment,
  Notification,
  Document,
  ZoneWithTasks,
  LoginEvent,
  AuditLogEntry,
  AdminSetPasswordResponse,
  FirstPasswordChangeRequest,
  Token,
  DashboardStats,
  AssistantResponse,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "access_token";

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export type QueryFnContext = {
  signal?: AbortSignal;
  queryKey?: readonly (string | number)[];
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers || {});
  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = (errorData as any).detail || `HTTP error! status: ${response.status}`;
    const error = new Error(detail) as any;
    error.response = { data: errorData, status: response.status };
    error.status = response.status;
    error.responseData = errorData;
    throw error;
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// --- Pyrotechnicians ---

export const fetchPyrotechnicians = ({ signal }: QueryFnContext = {}) =>
  request<Pyrotechnician[]>(`${BASE_URL}/pyrotechnicians`, { signal });

export const fetchUnassignedPyrotechnicians = ({ signal }: QueryFnContext = {}) =>
  request<Pyrotechnician[]>(`${BASE_URL}/pyrotechnicians/unassigned`, { signal });

export const createPyrotechnician = (payload: PyrotechnicianCreate) =>
  request<Pyrotechnician>(`${BASE_URL}/pyrotechnicians`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updatePyrotechnician = (id: number, payload: PyrotechnicianUpdate) =>
  request<Pyrotechnician>(`${BASE_URL}/pyrotechnicians/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updatePyrotechnicianFlags = (id: number, payload: PyrotechnicianFlagsUpdate) =>
  request<Pyrotechnician>(`${BASE_URL}/pyrotechnicians/${id}/flags`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deletePyrotechnician = (id: number) =>
  request<void>(`${BASE_URL}/pyrotechnicians/${id}`, { method: "DELETE" });

export const deletePyrotechniciansBulk = (ids: number[]) =>
  request<void>(`${BASE_URL}/pyrotechnicians/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export type AdminSetPasswordRequest = {
  password?: string;
};

export const adminSetPassword = (
  id: number,
  payload?: AdminSetPasswordRequest
) =>
  request<AdminSetPasswordResponse>(`${BASE_URL}/pyrotechnicians/${id}/set-password`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });

// --- Teams ---

export const fetchTeams = ({ signal }: QueryFnContext = {}) =>
  request<Team[]>(`${BASE_URL}/teams`, { signal });

export const fetchTeamById = ({ signal, queryKey }: QueryFnContext) => {
  const [, id] = queryKey!;
  return request<Team>(`${BASE_URL}/teams/${id}`, { signal });
};

export const createTeam = (payload: TeamCreate) =>
  request<Team>(`${BASE_URL}/teams`, { method: "POST", body: JSON.stringify(payload) });

export const updateTeam = (id: number, payload: TeamUpdate) =>
  request<Team>(`${BASE_URL}/teams/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const patchTeam = (id: number, payload: TeamPatch) =>
  request<Team>(`${BASE_URL}/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteTeam = (id: number) =>
  request<void>(`${BASE_URL}/teams/${id}`, { method: "DELETE" });

// --- Organization Units ---

export const fetchOrganizationUnits = ({ signal }: QueryFnContext = {}) =>
  request<OrganizationUnit[]>(`${BASE_URL}/organization/units`, { signal });

export const createOrganizationUnit = (payload: OrganizationUnitCreate) =>
  request<OrganizationUnit>(`${BASE_URL}/organization/units`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateOrganizationUnit = (id: number, payload: OrganizationUnitUpdate) =>
  request<OrganizationUnit>(`${BASE_URL}/organization/units/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteOrganizationUnit = (id: number) =>
  request<void>(`${BASE_URL}/organization/units/${id}`, { method: "DELETE" });

export const deleteOrganizationUnitCascade = (id: number) =>
  request<void>(`${BASE_URL}/organization/units/${id}/cascade`, { method: "DELETE" });

// --- Organization Structure ---

export const fetchOrganizationStructure = ({ signal }: QueryFnContext = {}) =>
  request<OrganizationNode[]>(`${BASE_URL}/organization/structure`, { signal });

// --- Zones ---

export const fetchZones = ({ signal }: QueryFnContext = {}) =>
  request<Zone[]>(`${BASE_URL}/zones`, { signal });

export const fetchZoneDetails = ({ signal, queryKey }: QueryFnContext) => {
  const [, id] = queryKey!;
  return request<ZoneWithTasks>(`${BASE_URL}/zones/${id}/details`, { signal });
};

export const createZone = (payload: ZoneCreate) =>
  request<Zone>(`${BASE_URL}/zones`, { method: "POST", body: JSON.stringify(payload) });

export const updateZone = (id: number, payload: ZoneUpdate) =>
  request<Zone>(`${BASE_URL}/zones/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteZone = (id: number) =>
  request<void>(`${BASE_URL}/zones/${id}`, { method: "DELETE" });

// --- Tasks ---

export const fetchTasks = ({ signal }: QueryFnContext = {}) =>
  request<Task[]>(`${BASE_URL}/tasks`, { signal });

export const fetchTaskById = ({ signal, queryKey }: QueryFnContext) => {
  const [, id] = queryKey!;
  return request<Task>(`${BASE_URL}/tasks/${id}`, { signal });
};

export const createTask = (payload: TaskCreate) =>
  request<Task>(`${BASE_URL}/tasks`, { method: "POST", body: JSON.stringify(payload) });

export const updateTask = (id: number, payload: TaskUpdate) =>
  request<Task>(`${BASE_URL}/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteTask = (id: number) =>
  request<void>(`${BASE_URL}/tasks/${id}`, { method: "DELETE" });

// --- Task Comments ---

export type TaskCommentPayload = { text?: string; files?: File[] };

export const createTaskCommentWithAttachments = async (
  taskId: number,
  payload: TaskCommentPayload,
): Promise<TaskComment> => {
  const formData = new FormData();
  if (payload.text) formData.append("text", payload.text);
  if (payload.files)
    payload.files.forEach((file) => formData.append("files", file, file.name));
  return request<TaskComment>(`${BASE_URL}/tasks/${taskId}/comments`, {
    method: "POST",
    body: formData,
  });
};

// --- Notifications ---

export const fetchNotifications = ({ signal }: QueryFnContext = {}) =>
  request<Notification[]>(`${BASE_URL}/notifications`, { signal });

export const markNotificationAsRead = (id: number) =>
  request<Notification>(`${BASE_URL}/notifications/${id}/read`, { method: "POST" });

// --- Documents ---

export const fetchDocuments = ({ signal }: QueryFnContext = {}) =>
  request<Document[]>(`${BASE_URL}/documents`, { signal });

export type DocumentUploadPayload = {
  file: File;
  title?: string;
  description?: string;
  tags?: string[];
};

export const uploadDocument = (payload: DocumentUploadPayload) => {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.title) formData.append("title", payload.title);
  if (payload.description) formData.append("description", payload.description);
  if (payload.tags) formData.append("tags", JSON.stringify(payload.tags));
  return request<Document>(`${BASE_URL}/documents`, {
    method: "POST",
    body: formData,
  });
};

export const deleteDocument = (id: number) =>
  request<void>(`${BASE_URL}/documents/${id}`, { method: "DELETE" });

// --- Reports ---

export type TaskReportFilters = {
  date_from?: string | null;
  date_to?: string | null;
  team_id?: number | null;
  zone_id?: number | null;
  status?: string | null;
  priority?: string | null;
};

export const fetchTasksReport = (
  filters: TaskReportFilters,
  { signal }: QueryFnContext = {},
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== "") params.append(key, String(value));
  });
  return request<Task[]>(`${BASE_URL}/reports/tasks?${params.toString()}`, {
    signal,
  });
};

// --- Admin: журналы ---

export type LoginEventsFilters = {
  email?: string | null;
  user_id?: number | null;
  success?: boolean | null;
  date_from?: string | null;
  date_to?: string | null;
};

export const fetchLoginEvents = (
  filters: LoginEventsFilters = {},
  { signal }: QueryFnContext = {},
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  const url = qs
    ? `${BASE_URL}/admin/login-events?${qs}`
    : `${BASE_URL}/admin/login-events`;
  return request<LoginEvent[]>(url, { signal });
};

export type AuditLogFilters = {
  actor_id?: number | null;
  action?: string | null;
  object_type?: string | null;
  date_from?: string | null;
  date_to?: string | null;
};

export const fetchAuditLogs = (
  filters: AuditLogFilters = {},
  { signal }: QueryFnContext = {},
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  const url = qs
    ? `${BASE_URL}/admin/audit-logs?${qs}`
    : `${BASE_URL}/admin/audit-logs`;
  return request<AuditLogEntry[]>(url, { signal });
};

// --- Auth ---

export type LoginRequest = { email: string; password: string };
export type { Token };

export const login = (payload: LoginRequest) =>
  request<Token>(`${BASE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const firstChangePassword = (payload: FirstPasswordChangeRequest) =>
  request<Token>(`${BASE_URL}/auth/first-change-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getMe = ({ signal }: QueryFnContext = {}) =>
  request<Pyrotechnician>(`${BASE_URL}/auth/me`, { signal });


// --- Dashboard ---

export const fetchDashboardStats = ({ signal }: QueryFnContext = {}) =>
  request<DashboardStats>(`${BASE_URL}/dashboard/stats`, { signal });


// --- Утилита ---

export function isCanceled(e: any): boolean {
  return e?.name === "AbortError";
}
// --- RAG Assistant ---

export const askAssistant = (question: string) =>
  request<AssistantResponse>(`${BASE_URL}/assistant/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });

export const getDocumentDownloadUrl = (docId: number) =>
  `${BASE_URL}/documents/${docId}/download`;