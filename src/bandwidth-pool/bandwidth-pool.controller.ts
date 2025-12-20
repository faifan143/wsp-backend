import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BandwidthPoolService } from './bandwidth-pool.service';
import { UpdateBandwidthPoolDto } from './dto/update-bandwidth-pool.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { UserRole, Capability } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
@Controller('bandwidth-pool')
export class BandwidthPoolController {
  constructor(private readonly bandwidthPoolService: BandwidthPoolService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.BANDWIDTH_POOL_READ)
  getSummary() {
    return this.bandwidthPoolService.getSummary();
  }

  @Patch()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.BANDWIDTH_POOL_UPDATE)
  @HttpCode(HttpStatus.OK)
  update(@Body() updateBandwidthPoolDto: UpdateBandwidthPoolDto, @Request() req) {
    return this.bandwidthPoolService.update(updateBandwidthPoolDto, req.user);
  }
}

