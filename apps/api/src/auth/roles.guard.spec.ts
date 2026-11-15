import { describe, expect, it, vi } from "vitest";
import { RolesGuard } from "./roles.guard.js";

function context(role: "CUSTOMER" | "STAFF" | "MANAGER") {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  };
}

describe("RolesGuard", () => {
  it("allows Manager to use Staff operations", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["STAFF"]),
    };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(context("MANAGER") as never)).toBe(true);
  });

  it("does not allow a Customer to use Staff operations", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["STAFF"]),
    };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(context("CUSTOMER") as never)).toBe(false);
  });
});
