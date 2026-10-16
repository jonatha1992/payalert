import { describe, expect, it } from "vitest";
import { can, normalizeRole, requirePermission } from "@/lib/server/rbac";
import { ScopeError, type Role } from "@/lib/server/scope";

describe("server RBAC compatibility matrix", () => {
  it("maps legacy roles without requiring data migration", () => {
    expect(normalizeRole("admin")).toBe("manager");
    expect(normalizeRole("employee")).toBe("cashier");
    expect(normalizeRole("owner")).toBe("owner");
  });
  it.each(["owner", "admin"] as Role[])("allows %s to manage connections and reports", (role) => {
    expect(can(role, "connection", "create")).toBe(true);
    expect(can(role, "report", "read")).toBe(true);
  });
  it("restricts legacy employee privileges", () => {
    expect(can("employee", "charge", "create")).toBe(true);
    expect(can("employee", "movement", "read")).toBe(true);
    expect(can("employee", "report", "read")).toBe(false);
    expect(can("employee", "connection", "create")).toBe(false);
    expect(can("employee", "charge", "resolve")).toBe(false);
    expect(can("employee", "configuration", "update")).toBe(false);
  });
  it("returns auth and authorization errors consistently", () => {
    expect(() => requirePermission(null, "report", "read")).toThrowError(ScopeError);
    expect(() => requirePermission({ role: "employee" }, "report", "read")).toThrowError(ScopeError);
    expect(() => requirePermission({ role: "owner" }, "report", "read")).not.toThrow();
  });
});
