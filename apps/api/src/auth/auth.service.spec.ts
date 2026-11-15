import { UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AuthService", () => {
  it("registers customers with a hashed password and returns a JWT session", async () => {
    vi.stubEnv("JWT_SECRET", "test-secret-with-at-least-thirty-two-characters");
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "BrewLite User",
      email: "customer@example.test",
      role: "CUSTOMER",
      pointsBalance: 0,
    };
    const tx = {
      user: { create: vi.fn().mockResolvedValue(user) },
      cart: { create: vi.fn().mockResolvedValue({ id: "cart-id" }) },
    };
    const prisma = {
      $transaction: vi.fn((work) => work(tx)),
    };
    const service = new AuthService(prisma as never);

    const session = await service.register({
      name: " BrewLite User ",
      email: "CUSTOMER@example.test",
      password: "a-secure-password",
    });

    const createData = tx.user.create.mock.calls[0]?.[0].data;
    expect(createData.email).toBe("customer@example.test");
    expect(createData.passwordHash).not.toBe("a-secure-password");
    await expect(compare("a-secure-password", createData.passwordHash)).resolves.toBe(
      true,
    );
    expect(createData.role).toBeUndefined();
    expect(tx.cart.create).toHaveBeenCalledWith({
      data: { userId: user.id },
    });
    expect(session.user.role).toBe("CUSTOMER");
    expect(session.accessToken).toEqual(expect.any(String));
  });

  it("rejects inactive users and invalid credentials uniformly", async () => {
    const passwordHash = await hash("right-password", 4);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          email: "customer@example.test",
          name: "Customer",
          role: "CUSTOMER",
          status: "INACTIVE",
          passwordHash,
          pointsBalance: 0,
        }),
      },
    };
    const service = new AuthService(prisma as never);

    await expect(
      service.login({
        email: "customer@example.test",
        password: "right-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
