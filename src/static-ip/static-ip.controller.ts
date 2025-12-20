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
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { IpStatus, Capability, UserRole } from '@prisma/client';

@Controller('static-ip')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class StaticIpController {
  constructor(private readonly staticIpService: StaticIpService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.STATIC_IP_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStaticIpDto: CreateStaticIpDto, @Request() req) {
    return this.staticIpService.create(createStaticIpDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.STATIC_IP_READ)
  findAll(
    @Query('posId') posId?: string,
    @Query('status') status?: IpStatus,
    @Request() req?: any,
  ) {
    return this.staticIpService.findAll(posId, status, req.user);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.STATIC_IP_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.staticIpService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.STATIC_IP_UPDATE)
  update(@Param('id') id: string, @Body() updateStaticIpDto: UpdateStaticIpDto, @Request() req) {
    return this.staticIpService.update(id, updateStaticIpDto, req.user);
  }

  @Patch(':id/release')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.STATIC_IP_UPDATE)
  release(@Param('id') id: string, @Request() req) {
    return this.staticIpService.release(id, req.user);
  }
}

