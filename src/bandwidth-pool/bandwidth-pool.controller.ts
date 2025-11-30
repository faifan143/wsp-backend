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
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bandwidth-pool')
export class BandwidthPoolController {
  constructor(private readonly bandwidthPoolService: BandwidthPoolService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  getSummary() {
    return this.bandwidthPoolService.getSummary();
  }

  @Patch()
  @Roles(UserRole.WSP_ADMIN)
  @HttpCode(HttpStatus.OK)
  update(@Body() updateBandwidthPoolDto: UpdateBandwidthPoolDto, @Request() req) {
    return this.bandwidthPoolService.update(updateBandwidthPoolDto, req.user);
  }
}

