// frontend-ui/src/__mocks__/NotificationProviderMock.tsx
import { createContext, useContext } from "react";

type NotificationContextType = {
  notify: () => void;
};

// Стабильный noop и объект по умолчанию
const noop = () => {};
const defaultValue: NotificationContextType = {
  notify: noop,
};

export const NotificationContext =
  createContext<NotificationContextType>(defaultValue);

type NotificationProviderProps = {
  children?: any;
};

export const NotificationProvider = ({ children }: NotificationProviderProps) => (
  // value — один и тот же объект на всех рендерах,
  // так что правило S6481 выполняется.
  <NotificationContext.Provider value={defaultValue}>
    {children}
  </NotificationContext.Provider>
);

export const useNotification = () => useContext(NotificationContext);
