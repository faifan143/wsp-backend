import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Subscriptions Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let wspAdminToken: string;
  let posManagerToken: string;
  let testPos: any;
  let testClient: any;
  let testPlan: any;
  let testSubscription: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    helpers = new TestHelpers(app, prisma);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await helpers.cleanDatabase();

    // Create test data
    testPos = await helpers.createPos('Test POS', 'Test Location');
    testClient = await helpers.createClient(testPos.id, 'Test Client', 'test_client@test.com');
    testPlan = await helpers.createServicePlan('Test Plan', 100, 1000); // 100 Mbps, 1TB data cap

    // Create users
    const wspAdmin = await helpers.createWspAdmin('wsp_admin', 'wsp_admin@test.com');
    const posManager = await helpers.createPosManager('pos_manager', 'manager@test.com', testPos.id);

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    posManagerToken = await helpers.login('pos_manager', 'password123');
  });

  describe('POST /subscriptions', () => {
    it('should create subscription (WSP_ADMIN)', async () => {
      const startDate = new Date();

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/subscriptions')
        .send({
          clientId: testClient.id,
          planId: testPlan.id,
          startDate: startDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.clientId).toBe(testClient.id);
      expect(response.body.planId).toBe(testPlan.id);
    });

    it('should set originalBandwidthMbps on creation', async () => {
      const startDate = new Date();

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/subscriptions')
        .send({
          clientId: testClient.id,
          planId: testPlan.id,
          startDate: startDate.toISOString(),
        })
        .expect(201);

      // Verify originalBandwidthMbps is set
      const subscription = await prisma.subscription.findUnique({
        where: { id: response.body.id },
      });
      expect(subscription?.originalBandwidthMbps?.toNumber()).toBe(100); // 100 Mbps
      expect(subscription?.bandwidthAllocatedMbps.toNumber()).toBe(100);
    });

    it('should create subscription (POS_MANAGER from same POS)', async () => {
      const startDate = new Date();

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/subscriptions')
        .send({
          clientId: testClient.id,
          planId: testPlan.id,
          startDate: startDate.toISOString(),
        })
        .expect(201);
    });
  });

  describe('GET /subscriptions', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should get all subscriptions (WSP_ADMIN)', async () => {
      // Create additional subscription
      const client2 = await helpers.createClient(testPos.id, 'Client 2', 'client2@test.com');
      await helpers.createSubscription(client2.id, testPlan.id);

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/subscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get only subscriptions from own POS (POS_MANAGER)', async () => {
      const otherPos = await helpers.createPos('Other POS', 'Other Location');
      const otherClient = await helpers.createClient(otherPos.id, 'Other Client', 'other@test.com');
      await helpers.createSubscription(otherClient.id, testPlan.id);

      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get('/subscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should only see subscriptions from testPos
      response.body.forEach((sub: any) => {
        expect(sub.client.posId).toBe(testPos.id);
      });
    });
  });

  describe('GET /subscriptions/:id', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should get subscription by id (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/subscriptions/${testSubscription.id}`)
        .expect(200);

      expect(response.body.id).toBe(testSubscription.id);
    });
  });

  describe('POST /subscriptions/:id/renew', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should renew subscription', async () => {
      // Set subscription to EXPIRED
      await prisma.subscription.update({
        where: { id: testSubscription.id },
        data: {
          status: 'EXPIRED',
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      });

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/renew`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('ACTIVE');
      expect(new Date(response.body.endDate).getTime()).toBeGreaterThan(new Date().getTime());

      // Verify bandwidth is restored if it was throttled
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      const originalBandwidth = subscription?.originalBandwidthMbps || subscription?.bandwidthAllocatedMbps;
      expect(subscription?.bandwidthAllocatedMbps.toNumber()).toBe(originalBandwidth?.toNumber());
    });
  });

  describe('POST /subscriptions/:id/upgrade', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should upgrade subscription to higher plan', async () => {
      const higherPlan = await helpers.createServicePlan('Higher Plan', 200, 2000); // 200 Mbps

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/upgrade`)
        .send({
          newPlanId: higherPlan.id,
        })
        .expect(200);

      expect(response.body.planId).toBe(higherPlan.id);
      expect(response.body.bandwidthAllocatedMbps).toBe('200');

      // Verify old subscription has upgradedToSubscriptionId
      const oldSubscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      expect(oldSubscription?.upgradedToSubscriptionId).toBe(response.body.id);
      expect(oldSubscription?.status).toBe('TERMINATED');
    });
  });

  describe('PATCH /subscriptions/:id/terminate', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should terminate subscription', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/subscriptions/${testSubscription.id}/terminate`)
        .expect(200);

      expect(response.body.status).toBe('TERMINATED');

      // Verify in database
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      expect(subscription?.status).toBe('TERMINATED');
    });
  });

  describe('POST /subscriptions/:id/usage-log (Throttling)', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should create usage log successfully', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/usage-log`)
        .send({
          downloadMb: 1, // 1 MB
          uploadMb: 0.5, // 0.5 MB
          logDate: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.downloadMb).toBe('1'); // Prisma Decimal returns as string
    });

    it('should automatically throttle when data cap is exceeded', async () => {
      // Plan has 1000 GB data capacity = 1,000,000 MB
      // We need to create usage logs that exceed this cap within the subscription period
      const dataCapMb = 1000 * 1024; // 1000 GB = 1,024,000 MB
      const currentDate = new Date();

      // Create usage log that exceeds the cap (simulate high usage)
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/usage-log`)
        .send({
          downloadMb: dataCapMb + 1000, // Exceed by 1 GB (1000 MB)
          uploadMb: 0,
          logDate: currentDate.toISOString(),
        })
        .expect(201);

      // Wait a bit for async processing
      await helpers.wait(100);

      // Verify subscription is throttled (bandwidth reduced to 25%)
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });

      const originalBandwidth = subscription?.originalBandwidthMbps?.toNumber() || 100;
      const expectedThrottledBandwidth = originalBandwidth * 0.25;

      expect(subscription?.bandwidthAllocatedMbps.toNumber()).toBe(expectedThrottledBandwidth);
      expect(subscription?.originalBandwidthMbps?.toNumber()).toBe(originalBandwidth);
    });

    it('should NOT throttle if already throttled', async () => {
      // First, throttle the subscription manually
      await prisma.subscription.update({
        where: { id: testSubscription.id },
        data: {
          bandwidthAllocatedMbps: new Decimal(25), // Already throttled to 25% (25 Mbps)
          originalBandwidthMbps: new Decimal(100),
        },
      });

      const dataCapMb = 1000 * 1024; // 1,024,000 MB

      // Try to create usage log that exceeds cap again
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/usage-log`)
        .send({
          downloadMb: dataCapMb + 1000,
          uploadMb: 0,
          logDate: new Date().toISOString(),
        })
        .expect(201);

      await helpers.wait(100);

      // Verify bandwidth is still 25 Mbps (not throttled further)
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      expect(subscription?.bandwidthAllocatedMbps.toNumber()).toBe(25);
    });

    it('should restore bandwidth on renewal after throttling', async () => {
      // First, throttle the subscription
      await prisma.subscription.update({
        where: { id: testSubscription.id },
        data: {
          bandwidthAllocatedMbps: new Decimal(25),
          originalBandwidthMbps: new Decimal(100),
          status: 'EXPIRED',
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      // Renew the subscription (renewalDate defaults to subscription.endDate if not provided)
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/renew`)
        .send({})
        .expect(200);

      // Verify bandwidth is restored
      const subscription = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      expect(subscription?.bandwidthAllocatedMbps.toNumber()).toBe(100); // Restored to original
    });
  });

  describe('GET /subscriptions/:id/usage-log', () => {
    beforeEach(async () => {
      testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);
    });

    it('should get usage logs for subscription', async () => {
      // Create some usage logs
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/usage-log`)
        .send({
          downloadMb: 100,
          uploadMb: 50,
          logDate: new Date().toISOString(),
        });

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/subscriptions/${testSubscription.id}/usage-log`)
        .send({
          downloadMb: 200,
          uploadMb: 100,
          logDate: new Date().toISOString(),
        });

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/subscriptions/${testSubscription.id}/usage-log`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });
});

