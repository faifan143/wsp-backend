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

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    return this.clientsService.create(createClientDto, req.user);
  }

  @Get()
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findAll(@Request() req) {
    return this.clientsService.findAll(req.user);
  }

  @Get(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.clientsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @Request() req) {
    return this.clientsService.update(id, updateClientDto, req.user);
  }

  @Patch(':id/activate')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  activate(@Param('id') id: string, @Request() req) {
    return this.clientsService.activate(id, req.user);
  }

  @Patch(':id/suspend')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  suspend(@Param('id') id: string, @Body() suspendClientDto: SuspendClientDto, @Request() req) {
    return this.clientsService.suspend(id, suspendClientDto, req.user);
  }

  @Patch(':id/terminate')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  terminate(@Param('id') id: string, @Request() req) {
    return this.clientsService.terminate(id, req.user);
  }

  @Patch(':id/connection-type')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  updateConnectionType(
    @Param('id') id: string,
    @Body() updateConnectionTypeDto: UpdateConnectionTypeDto,
    @Request() req,
  ) {
    return this.clientsService.updateConnectionType(id, updateConnectionTypeDto, req.user);
  }

  @Post(':id/static-ip/assign')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  @HttpCode(HttpStatus.OK)
  assignStaticIp(@Param('id') id: string, @Body() assignStaticIpDto: AssignStaticIpDto, @Request() req) {
    return this.clientsService.assignStaticIp(id, assignStaticIpDto.staticIpId, req.user);
  }

  @Patch(':id/static-ip/release')
  @Roles('WSP_ADMIN', 'POS_MANAGER')
  releaseStaticIp(@Param('id') id: string, @Request() req) {
    return this.clientsService.releaseStaticIp(id, req.user);
  }
}

