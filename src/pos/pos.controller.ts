import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { PosService, CreatePosDto, UpdatePosDto } from './pos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN)
  create(@Body() createPosDto: CreatePosDto) {
    return this.posService.create(createPosDto);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  findAll(@Request() req) {
    // POS Manager can only see their own POS
    if (req.user.role === UserRole.POS_MANAGER) {
      return this.posService.findOne(req.user.posId);
    }
    return this.posService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  findOne(@Param('id') id: string, @Request() req) {
    // POS Manager can only access their own POS
    if (req.user.role === UserRole.POS_MANAGER && req.user.posId !== id) {
      throw new Error('Access denied');
    }
    return this.posService.findOne(id);
  }

  @Get(':id/statistics')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  getStatistics(@Param('id') id: string, @Request() req) {
    // POS Manager can only access their own POS statistics
    if (req.user.role === UserRole.POS_MANAGER && req.user.posId !== id) {
      throw new Error('Access denied');
    }
    return this.posService.getStatistics(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN)
  update(@Param('id') id: string, @Body() updatePosDto: UpdatePosDto) {
    return this.posService.update(id, updatePosDto);
  }

  @Delete(':id')
  @Roles(UserRole.WSP_ADMIN)
  remove(@Param('id') id: string) {
    return this.posService.remove(id);
  }
}
