import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "../../apps/api/src/app.controller.js";
import { AppService } from "../../apps/api/src/app.service.js";
import { PrismaService } from "../../apps/api/src/prisma/prisma.service.js";

describe("Task 5.2 health HTTP contract", () => {
  let app: INestApplication;
  const query = vi.fn();
  beforeEach(async () => {
    query.mockReset();
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRawUnsafe: query } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  it("liveness stays up without querying the database", async () => {
    query.mockRejectedValue(new Error("database unavailable"));
    await request(app.getHttpServer())
      .get("/health")
      .expect(200, { status: "ok" });
    expect(query).not.toHaveBeenCalled();
  });
  it("readiness probes PostgreSQL", async () => {
    query.mockResolvedValue([{ "?column?": 1 }]);
    await request(app.getHttpServer())
      .get("/health/ready")
      .expect(200, { status: "ready", database: "up" });
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });
  it("readiness returns 503 without exposing database credentials", async () => {
    query.mockRejectedValue(
      new Error("postgresql://secret:password@private-host/db"),
    );
    const response = await request(app.getHttpServer())
      .get("/health/ready")
      .expect(503);
    expect(response.body.message).toBe("Database is not reachable");
    expect(response.text).not.toContain("password");
    expect(response.text).not.toContain("private-host");
  });
});
