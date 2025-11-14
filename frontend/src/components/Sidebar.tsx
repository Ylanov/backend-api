// frontend/src/components/Sidebar.tsx
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar, // ИЗМЕНЕНИЕ: Импортирован Toolbar
  Tooltip,
  useTheme,
} from "@mui/material";
import { NavLink, useLocation } from "react-router-dom";

import MapIcon from "@mui/icons-material/Map";
import PublicIcon from "@mui/icons-material/Public";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DescriptionIcon from "@mui/icons-material/Description";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SecurityIcon from "@mui/icons-material/Security";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const DRAWER_WIDTH = 240;
const MINI_WIDTH = 72;
const STORAGE_KEY = "sidebar-collapsed";

type SidebarItem = {
  to: string;
  label: string;
  icon: JSX.Element;
  adminOnly?: boolean;
};

export default function Sidebar({
  mobileOpen,
  onMobileClose,
  isAdmin,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  isAdmin: boolean;
}) {
  const theme = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "1";
    // по умолчанию — раскрыто, если key отсутствует
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const items = useMemo<SidebarItem[]>(
    () => [
      { to: "/", label: "Оперативная карта", icon: <MapIcon /> },
      { to: "/zones", label: "Рабочие зоны", icon: <PublicIcon /> },
      { to: "/reports", label: "Отчеты", icon: <AssessmentIcon /> },
      { to: "/documents", label: "Документы", icon: <DescriptionIcon /> },
      {
        to: "/admin",
        label: "Администрирование",
        icon: <AdminPanelSettingsIcon />,
        adminOnly: true,
      },
      {
        to: "/admin/logs",
        label: "Журналы безопасности",
        icon: <SecurityIcon />,
        adminOnly: true,
      },
    ],
    []
  );

  const filteredItems = isAdmin ? items : items.filter((i) => !i.adminOnly);

  const list = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ИЗМЕНЕНИЕ: Добавлен Toolbar для отступа от AppBar */}
      <Toolbar />

      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List disablePadding>
          {filteredItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);

            const button = (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                selected={active}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  minHeight: 44,
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
                onClick={onMobileClose}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 2,
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && <ListItemText primary={item.label} />}
              </ListItemButton>
            );

            return (
              <Fragment key={item.to}>
                {collapsed ? (
                  <Tooltip title={item.label} placement="right">
                    <Box>{button}</Box>
                  </Tooltip>
                ) : (
                  button
                )}
              </Fragment>
            );
          })}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1, display: { xs: "none", md: "flex" }, justifyContent: "center" }}>
        <IconButton
          onClick={() => setCollapsed((v) => !v)}
          size="small"
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Мобильный выезжающий */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        {list}
      </Drawer>

      {/* Десктопный постоянный, сворачиваемый */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: collapsed ? MINI_WIDTH : DRAWER_WIDTH,
          flexShrink: 0,
          whiteSpace: "nowrap",
          "& .MuiDrawer-paper": {
            width: collapsed ? MINI_WIDTH : DRAWER_WIDTH,
            boxSizing: "border-box",
            overflowX: "hidden",
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: (theme as any).transitions.create("width", {
              easing: (theme as any).transitions.easing.sharp,
              duration: (theme as any).transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        {list}
      </Drawer>
    </>
  );
}