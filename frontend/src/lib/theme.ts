// src/lib/theme.ts
import { createTheme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

export const makeTheme = (mode: ThemeMode = "light") =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#2563eb" },
      secondary: { main: "#0ea5e9" },
      success: { main: "#10b981" },
      warning: { main: "#f59e0b" },
      error: { main: "#ef4444" },
      background: {
        default: mode === "light" ? "#f7f8fb" : "#0b1020",
        paper: mode === "light" ? "#ffffff" : "#0f172a",
      },
      text: {
        primary: mode === "light" ? "#0b1020" : "#f8fafc",
        secondary: mode === "light" ? "#475569" : "#94a3b8",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        '"Roboto", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
      h5: { fontWeight: 700, letterSpacing: 0.2 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { borderRadius: 16 } } },
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
      },
      MuiChip: { defaultProps: { size: "small" } },
      MuiIconButton: { defaultProps: { size: "medium" } },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  });
