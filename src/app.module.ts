import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PosModule } from './pos/pos.module';
import { ClientsModule } from './clients/clients.module';
import { StaticIpModule } from './static-ip/static-ip.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    PosModule,
    ClientsModule,
    StaticIpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
