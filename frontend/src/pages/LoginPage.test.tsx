import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "./LoginPage";
import { renderWithProviders } from "../test-utils";
import { test, expect } from "vitest";
test("renders email and password fields", () => {
  render(renderWithProviders(<LoginPage />));

  // email
  expect(
    screen.getByRole("textbox", { name: /e-mail/i })
  ).toBeInTheDocument();

  // password (input type=password)
  expect(
    screen.getByLabelText(/пароль/i, { selector: "input" })
  ).toBeInTheDocument();
});

test("submits login form", () => {
  render(renderWithProviders(<LoginPage />));

  const email = screen.getByRole("textbox", { name: /e-mail/i });
  const password = screen.getByLabelText(/пароль/i, { selector: "input" });
  const button = screen.getByRole("button", { name: /войти/i });

  fireEvent.change(email, { target: { value: "test@example.com" } });
  fireEvent.change(password, { target: { value: "123456" } });
  fireEvent.click(button);

  expect(button).toBeInTheDocument();
});
