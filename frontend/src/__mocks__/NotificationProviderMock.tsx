import React, { createContext, useContext } from "react";

export const NotificationContext = createContext({
  notify: () => {},
});

export const NotificationProvider = ({ children }: any) => (
  <NotificationContext.Provider value={{ notify: () => {} }}>
    {children}
  </NotificationContext.Provider>
);

export const useNotification = () => useContext(NotificationContext);
