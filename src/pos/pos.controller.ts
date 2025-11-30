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

@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPosDto: CreatePosDto, @Request() req) {
    return this.posService.create(createPosDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN')
  findAll() {
    return this.posService.findAll();
  }

  @Get(':id')
  @Roles('WSP_ADMIN')
  findOne(@Param('id') id: string) {
    return this.posService.findOne(id);
  }

  @Patch(':id')
  @Roles('WSP_ADMIN')
  update(@Param('id') id: string, @Body() updatePosDto: UpdatePosDto, @Request() req) {
    return this.posService.update(id, updatePosDto, req.user);
  }

  @Patch(':id/activate')
  @Roles('WSP_ADMIN')
  activate(@Param('id') id: string, @Request() req) {
    return this.posService.activate(id, req.user);
  }

  @Patch(':id/deactivate')
  @Roles('WSP_ADMIN')
  deactivate(@Param('id') id: string, @Request() req) {
    return this.posService.deactivate(id, req.user);
  }

  @Patch(':id/bandwidth')
  @Roles('WSP_ADMIN')
  updateBandwidth(@Param('id') id: string, @Body() updateBandwidthDto: UpdatePosBandwidthDto, @Request() req) {
    return this.posService.updateBandwidth(id, updateBandwidthDto, req.user);
  }

  @Get(':id/clients')
  @Roles('WSP_ADMIN')
  getClients(@Param('id') id: string) {
    return this.posService.getClients(id);
  }

  @Get(':id/managers')
  @Roles('WSP_ADMIN')
  getManagers(@Param('id') id: string) {
    return this.posService.getManagers(id);
  }

  @Post(':id/managers')
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.OK)
  assignManager(@Param('id') id: string, @Body() assignManagerDto: AssignManagerDto) {
    return this.posService.assignManager(id, assignManagerDto.userId);
  }

  @Delete(':id/managers/:userId')
  @Roles('WSP_ADMIN')
  @HttpCode(HttpStatus.OK)
  removeManager(@Param('id') id: string, @Param('userId') userId: string) {
    return this.posService.removeManager(id, userId);
  }
}

