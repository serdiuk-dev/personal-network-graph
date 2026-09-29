import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '../prisma.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { SafeErrorsFilter } from './safe-errors.filter';
import { AuthService } from './auth.service';
@Module({
  imports: [PrismaModule], controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }, { provide: APP_FILTER, useClass: SafeErrorsFilter }],
})
export class AuthModule {}
