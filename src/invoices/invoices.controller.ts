import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createInvoiceDto: CreateInvoiceDto, @Request() req) {
    return this.invoicesService.create(createInvoiceDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(@Query() query: any, @Request() req) {
    return this.invoicesService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.invoicesService.findOne(id, req.user);
  }

  @Patch(':id/cancel')
  @Roles('WSP_ADMIN')
  cancel(@Param('id') id: string, @Request() req) {
    return this.invoicesService.cancel(id, req.user);
  }
}

