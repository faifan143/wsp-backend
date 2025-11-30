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
import { StaticIpService } from './static-ip.service';
import { CreateStaticIpDto } from './dto/create-static-ip.dto';
import { UpdateStaticIpDto } from './dto/update-static-ip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { IpStatus } from '@prisma/client';

@Controller('static-ip')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaticIpController {
  constructor(private readonly staticIpService: StaticIpService) {}

  @Post()
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStaticIpDto: CreateStaticIpDto, @Request() req) {
    return this.staticIpService.create(createStaticIpDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(
    @Query('posId') posId?: string,
    @Query('status') status?: IpStatus,
    @Request() req?: any,
  ) {
    return this.staticIpService.findAll(posId, status, req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.staticIpService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('WSP_ADMIN')
  update(@Param('id') id: string, @Body() updateStaticIpDto: UpdateStaticIpDto, @Request() req) {
    return this.staticIpService.update(id, updateStaticIpDto, req.user);
  }

  @Patch(':id/release')
  @Roles('WSP_ADMIN')
  release(@Param('id') id: string, @Request() req) {
    return this.staticIpService.release(id, req.user);
  }
}

