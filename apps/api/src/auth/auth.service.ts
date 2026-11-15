import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { SignJWT } from "jose";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthenticatedUser } from "./auth.types.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    if (Buffer.byteLength(input.password, "utf8") > 72) {
      throw new BadRequestException("Password must not exceed 72 UTF-8 bytes");
    }
    const passwordHash = await hash(input.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            passwordHash,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            pointsBalance: true,
          },
        });
        await tx.cart.create({ data: { userId: created.id } });
        return created;
      });

      return this.toSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    if (Buffer.byteLength(input.password, "utf8") > 72) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await compare(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.toSession(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pointsBalance: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException("User account is unavailable");
    }
    return user;
  }

  private async toSession(user: {
    id: string;
    name: string;
    email: string;
    role: AuthenticatedUser["role"];
    pointsBalance: number;
  }) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }

    const accessToken = await new SignJWT({
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "1d")
      .sign(new TextEncoder().encode(secret));

    return {
      accessToken,
      tokenType: "Bearer",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        pointsBalance: user.pointsBalance,
      },
    };
  }
}
