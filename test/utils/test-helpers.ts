import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma.service';
import { UserRole, Capability, IpStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export class TestHelpers {
  constructor(
    private app: INestApplication,
    private prisma: PrismaService,
  ) {}

  /**
   * Clean database - removes all data in correct order
   */
  async cleanDatabase() {
    await this.prisma.auditLog.deleteMany();
    await this.prisma.usageLog.deleteMany();
    await this.prisma.payment.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.pppoeChangeRequest.deleteMany();
    await this.prisma.suspensionHistory.deleteMany();
    await this.prisma.subscription.deleteMany();
    await this.prisma.staticIpPool.updateMany({ 
      data: { clientId: null, status: IpStatus.AVAILABLE, assignedAt: null } 
    });
    await this.prisma.staticIpPool.deleteMany();
    await this.prisma.client.deleteMany(); // Delete clients before POS (foreign key constraint)
    await this.prisma.servicePlan.deleteMany();
    await this.prisma.user.deleteMany(); // Delete users before POS (foreign key constraint)
    await this.prisma.pOS.deleteMany();
    await this.prisma.bandwidthPool.deleteMany();
  }

  /**
   * Login user and return access token
   */
  async login(username: string, password: string): Promise<string> {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);

    return response.body.access_token;
  }

  /**
   * Create WSP_ADMIN user
   */
  async createWspAdmin(username: string = 'test_admin', email: string = 'test_admin@test.com') {
    const passwordHash = await bcrypt.hash('password123', 10);
    return this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.WSP_ADMIN,
      },
    });
  }

  /**
   * Create SUB_ADMIN user with specific capabilities
   */
  async createSubAdmin(
    username: string,
    email: string,
    capabilities: Capability[],
  ) {
    const passwordHash = await bcrypt.hash('password123', 10);
    return this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.SUB_ADMIN,
        capabilities,
      },
    });
  }

  /**
   * Create POS_MANAGER user
   */
  async createPosManager(username: string, email: string, posId: string) {
    const passwordHash = await bcrypt.hash('password123', 10);
    return this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.POS_MANAGER,
        posId,
      },
    });
  }

  /**
   * Create CLIENT user
   */
  async createClientUser(username: string, email: string, clientId: string) {
    const passwordHash = await bcrypt.hash('password123', 10);
    return this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.CLIENT,
        clientId,
      },
    });
  }

  /**
   * Create POS
   */
  async createPos(name: string, location: string) {
    return this.prisma.pOS.create({
      data: {
        name,
        location,
        contactPhone: '1234567890',
        allocatedBandwidthMbps: 1000,
        currentUsageMbps: 0,
      },
    });
  }

  /**
   * Create Client
   */
  async createClient(
    posId: string,
    fullName: string,
    email: string,
    connectionType: 'STATIC' | 'DYNAMIC' | 'PPPOE' = 'DYNAMIC',
  ) {
    return this.prisma.client.create({
      data: {
        posId,
        fullName,
        phone: '1234567890',
        email,
        address: 'Test Address',
        connectionType,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Create Service Plan
   */
  async createServicePlan(planName: string, downloadSpeedMbps: number, dataCapacityGb?: number) {
    return this.prisma.servicePlan.create({
      data: {
        planName,
        serviceType: 'POSTPAID',
        durationType: 'MONTHLY',
        durationDays: 30,
        cost: 50.0,
        downloadSpeedMbps,
        uploadSpeedMbps: downloadSpeedMbps / 2,
        dataCapacityGb,
        isActive: true,
        description: 'Test plan',
      },
    });
  }

  /**
   * Create Subscription
   */
  async createSubscription(
    clientId: string,
    planId: string,
    status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' = 'ACTIVE',
  ) {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const plan = await this.prisma.servicePlan.findUnique({ where: { id: planId } });

    return this.prisma.subscription.create({
      data: {
        clientId,
        planId,
        startDate,
        endDate,
        status,
        bandwidthAllocatedMbps: plan!.downloadSpeedMbps,
        originalBandwidthMbps: plan!.downloadSpeedMbps,
      },
    });
  }

/**
 * Get authenticated request with token
 */
getAuthenticatedRequest(token: string) {
  const server = this.app.getHttpServer();
  const auth = { Authorization: `Bearer ${token}` };

  return {
    get: (url: string) => request(server).get(url).set(auth),
    post: (url: string) => request(server).post(url).set(auth),
    put: (url: string) => request(server).put(url).set(auth),
    patch: (url: string) => request(server).patch(url).set(auth),
    delete: (url: string) => request(server).delete(url).set(auth),
  };
}


  /**
   * Wait for async operations (useful for throttling tests)
   */
  async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

