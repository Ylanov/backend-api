import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import { Snackbar, Alert } from "@mui/material";

// Свой тип для "уровня" уведомления
type SnackbarSeverity = "success" | "error" | "info" | "warning";

type NotificationState = {
  open: boolean;
  message: string;
  severity: SnackbarSeverity;
};

type NotificationContextValue = {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyInfo: (message: string) => void;
  notifyWarning: (message: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

type NotificationProviderProps = {
  children: ReactNode;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });

  const show = useCallback((message: string, severity: SnackbarSeverity) => {
    setState({ open: true, message, severity });
  }, []);

  const notifySuccess = useCallback(
    (message: string) => show(message, "success"),
    [show]
  );
  const notifyError = useCallback(
    (message: string) => show(message, "error"),
    [show]
  );
  const notifyInfo = useCallback(
    (message: string) => show(message, "info"),
    [show]
  );
  const notifyWarning = useCallback(
    (message: string) => show(message, "warning"),
    [show]
  );

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifySuccess, notifyError, notifyInfo, notifyWarning }}
    >
      {children}

      <Snackbar
        open={state.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return ctx;
};

export default NotificationProvider;
