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
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Roles(UserRole.WSP_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto, @Request() req) {
    return this.settingsService.updateSettings(updateSettingsDto, req.user);
  }
}
