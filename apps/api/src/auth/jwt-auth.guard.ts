import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import { jwtVerify } from "jose";
import type { Request } from "express";
import type { AuthenticatedUser } from "./auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
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
