import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async getReadiness() {
    if (!this.prisma) {
      throw new ServiceUnavailableException('Database client is not configured');
    }
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'ready', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database is not reachable');
    }
  }
}
