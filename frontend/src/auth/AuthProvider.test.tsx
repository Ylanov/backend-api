import { render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { test, expect } from "vitest";
const TestComponent = () => {
  const { user, login, logout } = useAuth();

  return (
    <div>
      <button onClick={() => login("test@example.com", "123456")}>
        doLogin
      </button>
      <button onClick={() => logout()}>doLogout</button>
      <span data-testid="user">{user ? "logged" : "none"}</span>
    </div>
  );
};

test("AuthProvider mounts without crashing", () => {
  render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );

  expect(screen.getByTestId("user")).toBeInTheDocument();
});
