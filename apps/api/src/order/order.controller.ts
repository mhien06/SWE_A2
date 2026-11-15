import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  CancelOrderDto,
  OrderQuoteDto,
  StaffOrderStatusDto,
} from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('quote')
  @Roles('CUSTOMER')
  quote(@CurrentUser() user: AuthenticatedUser, @Body() body: OrderQuoteDto) {
    return this.orderService.quote(user.id, body);
  }

  @Post()
  @Roles('CUSTOMER')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: OrderQuoteDto) {
    return this.orderService.createOrder(user.id, body);
  }

  @Get()
  @Roles('CUSTOMER')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orderService.listCustomerOrders(user.id);
  }

  @Get(':id')
  @Roles('CUSTOMER')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.orderService.getCustomerOrder(user.id, id);
  }

  @Post(':id/cancel')
  @Roles('CUSTOMER')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(id, user, body.reason);
  }
}

@Controller('staff/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF')
export class StaffOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  list(@Query('all') all?: string, @Query('review') review?: string) {
    return this.orderService.listStaffOrders(all === 'true', review === 'true');
  }

  @Get(':id/audit')
  audit(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.orderService.audit(id);
  }

  @Post(':id/reconcile')
  reconcile(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe({version:'4'})) id: string) { return this.orderService.retryReconciliation(id,user.id); }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: StaffOrderStatusDto,
  ) {
    return this.orderService.updateStaffStatus(id, body.status, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(id, user, body.reason);
  }
}
