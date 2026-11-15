import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { LoyaltyService } from "./loyalty.service.js";

@Controller("loyalty")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get()
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.loyaltyService.getSummary(user.id);
  }
}
