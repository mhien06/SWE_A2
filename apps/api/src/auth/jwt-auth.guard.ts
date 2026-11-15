import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { jwtVerify } from "jose";
import type { Request } from "express";
import type { AuthenticatedUser } from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) {
      throw new UnauthorizedException("Bearer token required");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
      );
      if (
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        !isUserRole(payload.role)
      ) {
        throw new UnauthorizedException("Invalid access token");
      }

      const user = await this.prisma.user.findUnique({where:{id:payload.sub},select:{id:true,email:true,role:true,status:true}});
      if (!user || user.status !== "ACTIVE") throw new UnauthorizedException("Tài khoản không còn hoạt động.");
      request.user = {id:user.id,email:user.email,role:user.role};
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}

function isUserRole(value: unknown): value is AuthenticatedUser["role"] {
  return value === "CUSTOMER" || value === "STAFF" || value === "MANAGER";
}
