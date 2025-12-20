import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { PaymentMethod, Capability, UserRole } from '@prisma/client';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.PAYMENTS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.create(createPaymentDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.PAYMENTS_READ)
  findAll(@Query() query: any, @Request() req) {
    return this.paymentsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.PAYMENTS_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.paymentsService.findOne(id, req.user);
  }
}

