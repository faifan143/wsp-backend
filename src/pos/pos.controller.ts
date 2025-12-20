import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePosDto } from './dto/create-pos.dto';
import { UpdatePosDto } from './dto/update-pos.dto';
import { UpdatePosBandwidthDto } from './dto/update-pos-bandwidth.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { Capability, UserRole } from '@prisma/client';

@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPosDto: CreatePosDto, @Request() req) {
    return this.posService.create(createPosDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_READ)
  findAll() {
    return this.posService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_READ)
  findOne(@Param('id') id: string) {
    return this.posService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  update(@Param('id') id: string, @Body() updatePosDto: UpdatePosDto, @Request() req) {
    return this.posService.update(id, updatePosDto, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  activate(@Param('id') id: string, @Request() req) {
    return this.posService.activate(id, req.user);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  deactivate(@Param('id') id: string, @Request() req) {
    return this.posService.deactivate(id, req.user);
  }

  @Patch(':id/bandwidth')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  updateBandwidth(@Param('id') id: string, @Body() updateBandwidthDto: UpdatePosBandwidthDto, @Request() req) {
    return this.posService.updateBandwidth(id, updateBandwidthDto, req.user);
  }

  @Get(':id/clients')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_READ)
  getClients(@Param('id') id: string) {
    return this.posService.getClients(id);
  }

  @Get(':id/managers')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_READ)
  getManagers(@Param('id') id: string) {
    return this.posService.getManagers(id);
  }

  @Post(':id/managers')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  @HttpCode(HttpStatus.OK)
  assignManager(@Param('id') id: string, @Body() assignManagerDto: AssignManagerDto) {
    return this.posService.assignManager(id, assignManagerDto.userId);
  }

  @Delete(':id/managers/:userId')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.POS_UPDATE)
  @HttpCode(HttpStatus.OK)
  removeManager(@Param('id') id: string, @Param('userId') userId: string) {
    return this.posService.removeManager(id, userId);
  }
}

