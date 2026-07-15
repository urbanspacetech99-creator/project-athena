import "@testing-library/jest-dom";
import { afterEach } from "vitest";

// lib/cache.ts persists AI responses in localStorage — never leak between tests.
afterEach(() => localStorage.clear());
