// Глобальный мок NotificationProvider

export const NotificationProvider = ({ children }: any) => <>{children}</>;

export const useNotification = () => ({
  notify: () => {},
  success: () => {},
  error: () => {},
});
