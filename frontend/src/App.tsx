// frontend/src/App.tsx
import { memo, useMemo, useState, type MouseEvent } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  CssBaseline,
  IconButton,
  Badge,
  Tooltip,
  Button,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LogoutIcon from "@mui/icons-material/Logout";

import StaffAndStructurePage from "./pages/StaffAndStructurePage";
import ZonesPage from "./pages/ZonesPage";
import ImportRosterPage from "./pages/ImportRosterPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import DocumentsPage from "./pages/DocumentsPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import AdminLogsPage from "./pages/AdminLogsPage";

import { RequireAuth, useAuth } from "./auth/AuthProvider";
import Sidebar from "./components/Sidebar";
import NotificationsPopover from "./components/NotificationsPopover";

import { useQuery } from "@tanstack/react-query";
import { fetchNotifications } from "./services/api";
import type { Notification } from "./types";

/** ──────────────────────────────────────────────────────────────────────
 * Типы пропсов
 * ────────────────────────────────────────────────────────────────────── */
interface NotificationsWidgetProps {
  readonly onOpen: (event: MouseEvent<HTMLElement>) => void;
}

interface RequireAdminProps {
  readonly children: JSX.Element;
}

/** ──────────────────────────────────────────────────────────────────────
 * Лёгкий мемоизированный виджет уведомлений
 * ────────────────────────────────────────────────────────────────────── */
const NotificationsWidget = memo(function NotificationsWidget(
  props: NotificationsWidgetProps
) {
  const { onOpen } = props;

  // ИСПРАВЛЕНИЕ ЗДЕСЬ:
  // 1. Добавлен дженерик <Notification[]>
  // 2. queryFn обернут в () => fetchNotifications(), чтобы избежать конфликта типов контекста
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    // При необходимости можно включить периодическое обновление:
    // refetchInterval: 30000,
  });

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  return (
    <Tooltip title="Уведомления">
      <IconButton color="inherit" onClick={onOpen}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
});

const MINI_WIDTH = 72;

/** ──────────────────────────────────────────────────────────────────────
 * Обёртка для страниц, доступных только администратору
 * ────────────────────────────────────────────────────────────────────── */
function RequireAdmin({ children }: RequireAdminProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom>
          Доступ запрещён
        </Typography>
        <Typography color="text.secondary">
          Этот раздел доступен только администраторам.
        </Typography>
      </Box>
    );
  }

  return children;
}

/** ──────────────────────────────────────────────────────────────────────
 * Корневой компонент приложения
 * ────────────────────────────────────────────────────────────────────── */
export default function App() {
  const theme = useTheme();
  const isMediumUp = useMediaQuery(theme.breakpoints.up("md"));
  const isSmallUp = useMediaQuery(theme.breakpoints.up("sm"));

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleOpenPopover = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const toggleMobile = () => {
    setMobileOpen((previous) => !previous);
  };

  // Отдельный рендер страницы логина — без AppBar и Sidebar
  if (location.pathname === "/login") {
    return (
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        color="primary"
        sx={{
          zIndex: (currentTheme) => currentTheme.zIndex.drawer + 1,
          overflow: "hidden",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, overflow: "hidden" }}>
          {!isMediumUp && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={toggleMobile}
              sx={{ marginRight: 1 }}
              aria-label="Открыть меню"
            >
              <MenuIcon />
            </IconButton>
          )}

          <DashboardIcon
            sx={{
              marginRight: 1,
              display: { xs: "none", sm: "inline-flex" },
            }}
          />

          <Typography
            variant={isSmallUp ? "h6" : "subtitle1"}
            noWrap
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              maxWidth: { xs: "60vw", sm: "unset" },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            МЧС | Единое рабочее пространство
          </Typography>

          {user && (
            <>
              <Typography
                variant="body2"
                sx={{
                  marginRight: 2,
                  display: { xs: "none", sm: "block" },
                }}
              >
                {user.full_name}
              </Typography>
              {user.is_admin && (
                <Chip
                  label="Администратор"
                  size="small"
                  color="secondary"
                  sx={{
                    marginRight: 2,
                    display: { xs: "none", sm: "inline-flex" },
                  }}
                />
              )}
            </>
          )}

          <NotificationsWidget onOpen={handleOpenPopover} />

          {isSmallUp ? (
            <Button color="inherit" onClick={handleLogout}>
              Выйти
            </Button>
          ) : (
            <Tooltip title="Выйти">
              <IconButton
                color="inherit"
                onClick={handleLogout}
                aria-label="Выйти"
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      {/* Левое меню: мини на десктопе, выезжающее на мобильных устройствах */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isAdmin={Boolean(user?.is_admin)}
      />

      {/* Основной контент: отступ слева под мини-меню и спейсер под AppBar */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          paddingX: { xs: 1.5, md: 3 },
          paddingY: { xs: 2, md: 3 },
          marginLeft: { xs: 0, md: `${MINI_WIDTH}px` },
        }}
      >
        {/* Спейсер под шапку — равен высоте Toolbar */}
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />

        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/structure"
            element={
              <RequireAuth>
                <StaffAndStructurePage />
              </RequireAuth>
            }
          />
          <Route
            path="/structure/import"
            element={
              <RequireAuth>
                <ImportRosterPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tasks"
            element={
              <RequireAuth>
                <TasksPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <RequireAuth>
                <TaskDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/zones"
            element={
              <RequireAuth>
                <ZonesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/documents"
            element={
              <RequireAuth>
                <DocumentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminLogsPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="*"
            element={
              <RequireAuth>
                <Box sx={{ padding: { xs: 1, sm: 0 } }}>
                  <Typography variant="h5" gutterBottom>
                    Страница не найдена
                  </Typography>
                  <Typography color="text.secondary">
                    Проверьте адрес или выберите раздел в меню слева.
                  </Typography>
                </Box>
              </RequireAuth>
            }
          />
        </Routes>
      </Box>

      {/* Popover уведомлений */}
      <NotificationsPopover
        notifications={[]}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        onMarkAsRead={() => {}}
      />
    </Box>
  );
}