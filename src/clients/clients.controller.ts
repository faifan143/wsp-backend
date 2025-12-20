import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateConnectionTypeDto } from './dto/update-connection-type.dto';
import { SuspendClientDto } from './dto/suspend-client.dto';
import { AssignStaticIpDto } from './dto/assign-static-ip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Roles } from '../users/decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { Capability, UserRole } from '@prisma/client';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    return this.clientsService.create(createClientDto, req.user);
  }
  
  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_READ)
  async findAll(
    @Request() req,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Math.max(parseInt(pageRaw ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10), 1), 100);
    return this.clientsService.findAll({
      page,
      limit,
      user: req.user,
    });
  }


  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_READ)
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_UPDATE)
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @Request() req) {
    return this.clientsService.update(id, updateClientDto, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_ACTIVATE)
  activate(@Param('id') id: string, @Request() req) {
    return this.clientsService.activate(id, req.user);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_SUSPEND)
  suspend(@Param('id') id: string, @Body() suspendClientDto: SuspendClientDto, @Request() req) {
    return this.clientsService.suspend(id, suspendClientDto, req.user);
  }

  @Patch(':id/terminate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_TERMINATE)
  terminate(@Param('id') id: string, @Request() req) {
    return this.clientsService.terminate(id, req.user);
  }

  @Patch(':id/connection-type')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_CONNECTION_TYPE_UPDATE)
  updateConnectionType(
    @Param('id') id: string,
    @Body() updateConnectionTypeDto: UpdateConnectionTypeDto,
    @Request() req,
  ) {
    return this.clientsService.updateConnectionType(id, updateConnectionTypeDto, req.user);
  }

  @Post(':id/static-ip/assign')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_STATIC_IP_ASSIGN)
  @HttpCode(HttpStatus.OK)
  assignStaticIp(@Param('id') id: string, @Body() assignStaticIpDto: AssignStaticIpDto, @Request() req) {
    return this.clientsService.assignStaticIp(id, assignStaticIpDto.staticIpId, req.user);
  }

  @Patch(':id/static-ip/release')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN, UserRole.POS_MANAGER)
  @Capabilities(Capability.CLIENTS_STATIC_IP_RELEASE)
  releaseStaticIp(@Param('id') id: string, @Request() req) {
    return this.clientsService.releaseStaticIp(id, req.user);
  }
}

