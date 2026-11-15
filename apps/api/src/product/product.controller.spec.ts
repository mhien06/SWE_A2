import { INestApplication, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductController } from "./product.controller.js";
import { ProductService } from "./product.service.js";

describe("ProductController", () => {
  let app: INestApplication;
  const service = {
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it("GET /products returns the menu", async () => {
    service.findAll.mockResolvedValue([{ id: "product-1" }]);

    const response = await request(app.getHttpServer()).get("/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "product-1" }]);
  });

  it("GET /products/:id validates UUID parameters", async () => {
    const response = await request(app.getHttpServer()).get("/products/not-a-uuid");

    expect(response.status).toBe(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it("GET /products/:id returns 404 for a missing product", async () => {
    service.findOne.mockRejectedValue(new NotFoundException("Product not found"));

    const response = await request(app.getHttpServer()).get(
      "/products/99999999-9999-4999-8999-999999999999",
    );

    expect(response.status).toBe(404);
  });
});
