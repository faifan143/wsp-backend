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
import { UserService, CreateUserDto, UpdateUserDto } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.WSP_ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.WSP_ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Get('role/:role')
  @Roles(UserRole.WSP_ADMIN)
  findByRole(@Param('role') role: UserRole) {
    return this.userService.findByRole(role);
  }

  @Get('pos/:posId')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER)
  findByPos(@Param('posId') posId: string, @Request() req) {
    // POS Manager can only see users from their own POS
    if (req.user.role === UserRole.POS_MANAGER && req.user.posId !== posId) {
      throw new Error('Access denied');
    }
    return this.userService.findByPos(posId);
  }

  @Get(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  findOne(@Param('id') id: string, @Request() req) {
    // Users can only view their own profile unless they're WSP Admin
    if (req.user.role !== UserRole.WSP_ADMIN && req.user.id !== id) {
      throw new Error('Access denied');
    }
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.WSP_ADMIN, UserRole.POS_MANAGER, UserRole.CLIENT)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    // Users can only update their own profile unless they're WSP Admin
    if (req.user.role !== UserRole.WSP_ADMIN && req.user.id !== id) {
      throw new Error('Access denied');
    }
    
    // Only WSP Admin can change role, posId, or clientId
    if (req.user.role !== UserRole.WSP_ADMIN) {
      delete updateUserDto.role;
      delete updateUserDto.posId;
      delete updateUserDto.clientId;
    }
    
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.WSP_ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
