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
import { PaymentMethod } from '@prisma/client';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.create(createPaymentDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(@Query() query: any, @Request() req) {
    return this.paymentsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.paymentsService.findOne(id, req.user);
  }
}

