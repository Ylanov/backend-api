// frontend/src/index.ts
// Баррель-файл: сюда можно добавлять то, что нужно реэкспортировать из src

export * from "./notifications/NotificationProvider";
export { default as App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { NotificationProvider } from "./notifications/NotificationProvider";