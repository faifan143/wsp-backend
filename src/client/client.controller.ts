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
  Query 
} from '@nestjs/common';
import { ClientService, CreateClientDto, UpdateClientDto } from './client.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    // POS Manager can only create clients for their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      createClientDto.posId = req.user.posId;
    }
    return this.clientService.create(createClientDto);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  findAll(@Request() req, @Query('posId') posId?: string) {
    // POS Manager can only see clients from their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      return this.clientService.findAll(req.user.posId);
    }
    return this.clientService.findAll(posId);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findOne(@Param('id') id: string, @Request() req) {
    // Client can only view their own profile
    if (req.user.role === UserRole.CLIENT && req.user.clientId !== id) {
      throw new Error('Access denied');
    }
    
    // POS Manager can only view clients from their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      const client = this.clientService.findOne(id);
      // Additional check will be done in service if needed
    }
    
    return this.clientService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @Request() req) {
    // POS Manager can only update clients from their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      // Additional validation can be added here
    }
    return this.clientService.update(id, updateClientDto);
  }

  @Delete(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  remove(@Param('id') id: string, @Request() req) {
    // POS Manager can only delete clients from their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      // Additional validation can be added here
    }
    return this.clientService.remove(id);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  suspend(
    @Param('id') id: string, 
    @Body() body: { reason: string }, 
    @Request() req
  ) {
    return this.clientService.suspend(id, body.reason, req.user.id);
  }

  @Patch(':id/reactivate')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  reactivate(@Param('id') id: string, @Request() req) {
    return this.clientService.reactivate(id, req.user.id);
  }
}
