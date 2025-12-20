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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { Capabilities } from '../common/decorators/capabilities.decorator';
import { Capability, UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, CapabilitiesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create(createUserDto, req.user);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_READ)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_UPDATE)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, updateUserDto, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_ACTIVATE)
  activate(@Param('id') id: string, @Request() req) {
    return this.usersService.activate(id, req.user);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.WSP_ADMIN, UserRole.SUB_ADMIN)
  @Capabilities(Capability.USERS_DEACTIVATE)
  deactivate(@Param('id') id: string, @Request() req) {
    return this.usersService.deactivate(id, req.user);
  }
}

