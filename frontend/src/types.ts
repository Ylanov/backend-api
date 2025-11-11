// frontend/src/types.ts

// --- Enum-ы ---
export enum TaskStatus {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// --- Общие типы ---
export type LatLngPoint = {
  lat: number;
  lng: number;
};

// --- Pyrotechnicians (Сотрудники) ---
export type Pyrotechnician = {
  id: number;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  rank?: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: string | null;
  login_count: number;
  must_change_password: boolean; // <-- НОВОЕ ПОЛЕ
};

export type PyrotechnicianCreate = Omit<Pyrotechnician, "id" | "last_login_at" | "login_count" | "must_change_password">;
export type PyrotechnicianUpdate = Omit<Pyrotechnician, "id" | "last_login_at" | "login_count" | "must_change_password">;
export type PyrotechnicianFlagsUpdate = {
  is_active?: boolean;
  is_admin?: boolean;
  must_change_password?: boolean;
};

// --- Teams (Команды/Группы) ---
export type Team = {
  id: number;
  name: string;
  lead?: Pyrotechnician | null;
  organization_unit_id?: number | null;
  members: Pyrotechnician[];
};

export type TeamCreate = {
  name: string;
  lead_id?: number | null;
  organization_unit_id?: number | null;
  member_ids?: number[];
};

export type TeamUpdate = {
  name: string;
  lead_id?: number | null;
  organization_unit_id?: number | null;
  member_ids: number[];
};

export type TeamPatch = {
  name?: string;
  lead_id?: number | null;
  organization_unit_id?: number | null;
  member_ids?: number[];
};

// --- Organization Units (Подразделения) ---
export type OrganizationUnit = {
  id: number;
  name: string;
  parent_id?: number | null;
  description?: string | null;
  children: OrganizationUnit[];
  teams: Team[];
};

export type OrganizationUnitCreate = Omit<OrganizationUnit, "id" | "children" | "teams">;
export type OrganizationUnitUpdate = Omit<OrganizationUnit, "id" | "children" | "teams">;

// --- Organization Structure (Дерево для фронтенда) ---
export type OrganizationNode = {
  id: string;
  name: string;
  description?: string | null;
  children: OrganizationNode[];
  type: "unit" | "team" | "pyro";
};

// --- Zones (Рабочие зоны) ---
export type Zone = {
  id: number;
  name: string;
  description?: string | null;
  points: LatLngPoint[];
};

export interface ZoneWithTasks extends Zone {
  tasks: Task[];
}

export type ZoneCreate = Omit<Zone, "id">;
export type ZoneUpdate = Omit<Zone, "id">;

// --- Task Attachments (Вложения к задачам) ---
export type TaskAttachment = {
  id: number;
  file_name: string;
  mime_type: string;
  url: string;
};

// --- Task Comments (Комментарии к задачам) ---
export type TaskComment = {
  id: number;
  text?: string | null;
  created_at: string;
  author: Pyrotechnician;
  attachments: TaskAttachment[];
};

export type TaskCommentCreate = {
  text?: string | null;
  files?: File[];
};

// --- Tasks (Задачи) ---
export type Task = {
  id: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at?: string | null;
  team_id?: number | null;
  zone_id?: number | null;
  team?: Team | null;
  zone?: Zone | null;
  comments: TaskComment[];
};

export type TaskCreate = Omit<Task, "id" | "created_at" | "updated_at" | "team" | "zone" | "comments">;
export type TaskUpdate = TaskCreate;

// --- Notifications ---
export type Notification = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  link?: string | null;
};

// --- Documents ---
export type Document = {
  id: number;
  title: string;
  description?: string | null;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  tags: string[];
  download_url: string;
};

// --- Admin: журналы логинов ---
export type LoginEvent = {
  id: number;
  created_at: string;
  user_id?: number | null;
  email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  success: boolean;
};

// --- Admin: аудит-лог ---
export type AuditLogEntry = {
  id: number;
  created_at: string;
  actor_id?: number | null;
  actor_email?: string | null;
  action: string;
  object_type?: string | null;
  object_id?: number | null;
  details?: string | null;
};

// --- Admin: Установка пароля ---
export type AdminSetPasswordResponse = {
  password: string;
};

// --- Auth: Смена пароля при первом входе ---
export type FirstPasswordChangeRequest = {
  email: string;
  temp_password: string;
  new_password: string;
};