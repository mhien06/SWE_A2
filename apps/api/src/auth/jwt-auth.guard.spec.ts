import { afterEach, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
afterEach(()=>vi.unstubAllEnvs());
it("rejects inactive accounts and uses current database role instead of stale JWT role",async()=>{
 vi.stubEnv("JWT_SECRET","test-secret-at-least-thirty-two-characters");
 const token=await new SignJWT({email:"a@b.test",role:"MANAGER"}).setProtectedHeader({alg:"HS256"}).setSubject("11111111-1111-4111-8111-111111111111").setExpirationTime("5m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
 const request:{headers:{authorization:string};user?:{role:string}}={headers:{authorization:`Bearer ${token}`}};
 const context={switchToHttp:()=>({getRequest:()=>request})} as unknown as ExecutionContext;
 const findUnique=vi.fn().mockResolvedValue({id:"user",email:"a@b.test",role:"CUSTOMER",status:"INACTIVE"});
 const guard=new JwtAuthGuard({user:{findUnique}} as unknown as PrismaService);
 await expect(guard.canActivate(context)).rejects.toThrow("Tài khoản");
 findUnique.mockResolvedValue({id:"user",email:"a@b.test",role:"CUSTOMER",status:"ACTIVE"});
 expect(await guard.canActivate(context)).toBe(true);expect(request.user?.role).toBe("CUSTOMER");
});
