import { expect, test } from "vitest";
import { can } from "./permissions";

test("staff can't edit schedules; schedulers can't change configuration; admins can do both", () => {
  expect(can({ permission: "staff" }, "schedule:edit")).toBe(false);
  expect(can({ permission: "scheduler" }, "schedule:edit")).toBe(true);
  expect(can({ permission: "scheduler" }, "config:edit")).toBe(false);
  expect(can({ permission: "admin" }, "config:edit")).toBe(true);
});
