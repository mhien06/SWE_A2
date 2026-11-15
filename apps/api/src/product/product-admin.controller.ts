import {
  Body,
  Get,
  Post,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SetProductAvailabilityDto } from './dto/set-product-availability.dto.js';
import { ProductService } from './product.service.js';
import { ManageProductDto } from './dto/manage-product.dto.js';

@Controller('manager/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
export class ProductAdminController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list() {
    return this.productService.findAll();
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ManageProductDto,
  ) {
    return this.productService.saveProduct(null, user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ManageProductDto,
  ) {
    return this.productService.saveProduct(id, user.id, body);
  }

  @Get(':id/history')
  history(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productService.history(id);
  }

  @Patch(':id/availability')
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: SetProductAvailabilityDto,
  ) {
    return this.productService.setAvailability(
      id,
      user.id,
      body.isAvailable,
      body.reason,
    );
  }
}
