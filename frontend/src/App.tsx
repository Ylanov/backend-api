// frontend/src/App.tsx
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link as RouterLink,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";

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

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CssBaseline,
  IconButton,
  Badge,
  Tooltip,
  Button,
  Chip,
} from "@mui/material";

import PublicIcon from "@mui/icons-material/Public";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MapIcon from "@mui/icons-material/Map";
import AssessmentIcon from "@mui/icons-material/Assessment";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DescriptionIcon from "@mui/icons-material/Description";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SecurityIcon from "@mui/icons-material/Security";

import { fetchNotifications } from "./services/api";
import type { Notification } from "./types";
import NotificationsPopover from "./components/NotificationsPopover";

const drawerWidth = 240;

type NavItem = {
  text: string;
  path: string;
  icon: JSX.Element;
};

const navItems: NavItem[] = [
  { text: "Оперативная карта", path: "/", icon: <MapIcon /> },
  { text: "Рабочие зоны", path: "/zones", icon: <PublicIcon /> },
  { text: "Отчеты", path: "/reports", icon: <AssessmentIcon /> },
  { text: "Документы", path: "/documents", icon: <DescriptionIcon /> },
];

function isItemActive(currentPath: string, item: NavItem) {
  if (item.path === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(item.path);
}

// Только для администратора
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return (
      <Box sx={{ p: 3 }}>
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

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // --- Уведомления ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const drawer = (
    <Box>
      <Toolbar />
      <Divider />
      <List>
        {navItems.map((item) => {
          const selected = isItemActive(location.pathname, item);
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={selected}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}

        {user?.is_admin && (
          <>
            <Divider sx={{ mt: 1, mb: 1 }} />
            <ListItem disablePadding>
              <ListItemButton
                component={RouterLink}
                to="/admin"
                selected={location.pathname === "/admin"}
              >
                <ListItemIcon>
                  <AdminPanelSettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Администрирование" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                component={RouterLink}
                to="/admin/logs"
                selected={location.pathname.startsWith("/admin/logs")}
              >
                <ListItemIcon>
                  <SecurityIcon />
                </ListItemIcon>
                <ListItemText primary="Журналы безопасности" />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  // Для страницы логина — без AppBar/Drawer
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
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        color="primary"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1 }}
          >
            МЧС | Единое рабочее пространство
          </Typography>

          {user && (
            <>
              <Typography variant="body2" sx={{ mr: 2 }}>
                {user.full_name}
              </Typography>
              {user.is_admin && (
                <Chip
                  label="Администратор"
                  size="small"
                  color="secondary"
                  sx={{ mr: 2 }}
                />
              )}
            </>
          )}

          <Tooltip title="Уведомления">
            <IconButton
              color="inherit"
              onClick={handleOpenPopover}
              sx={{ mr: 1 }}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Button color="inherit" onClick={handleLogout}>
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerWidth}px)`,
        }}
      >
        <Toolbar />

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
                <Box>
                  <Typography variant="h5" gutterBottom>
                    Страница не найдена
                  </Typography>
                  <Typography color="text.secondary">
                    Проверьте адрес или выберите раздел в левом меню.
                  </Typography>
                </Box>
              </RequireAuth>
            }
          />
        </Routes>
      </Box>

      <NotificationsPopover
        notifications={notifications}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        onMarkAsRead={handleMarkAsRead}
      />
    </Box>
  );
}
