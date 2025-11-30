import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PosModule } from './pos/pos.module';
import { ClientsModule } from './clients/clients.module';
import { StaticIpModule } from './static-ip/static-ip.module';
import { ServicePlansModule } from './service-plans/service-plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { PppoeRequestsModule } from './pppoe-requests/pppoe-requests.module';
import { BandwidthPoolModule } from './bandwidth-pool/bandwidth-pool.module';

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
    ServicePlansModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    PppoeRequestsModule,
    BandwidthPoolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
