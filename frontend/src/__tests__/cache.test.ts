import { afterEach, expect, test, vi } from "vitest";
import { cacheDelete, cacheGet, cacheSet, DAY_MS } from "../lib/cache";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("set/get roundtrip", () => {
  cacheSet("k", { a: 1 });
  expect(cacheGet("k")).toEqual({ a: 1 });
});

test("delete removes the entry", () => {
  cacheSet("k", "v");
  cacheDelete("k");
  expect(cacheGet("k")).toBeUndefined();
});

test("expired entries are a miss and get removed", () => {
  vi.useFakeTimers();
  cacheSet("k", "v");
  vi.setSystemTime(Date.now() + DAY_MS + 1);
  expect(cacheGet("k")).toBeUndefined();
  expect(localStorage.getItem("athena:cache:v1:k")).toBeNull();
});

test("corrupt entries are a miss and get removed", () => {
  localStorage.setItem("athena:cache:v1:k", "{not json");
  expect(cacheGet("k")).toBeUndefined();
  expect(localStorage.getItem("athena:cache:v1:k")).toBeNull();
});

test("storage failures degrade to a no-op", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => cacheSet("k", "v")).not.toThrow();
});
