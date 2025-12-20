import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { UserRole, Capability, IpStatus } from '@prisma/client';

describe('Other Flows - PPPoE, Service Plans, Static IP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let wspAdminToken: string;
  let posManagerToken: string;
  let testPos: any;
  let testClient: any;
  let clientUser: any;

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
    testClient = await helpers.createClient(testPos.id, 'Test Client', 'test_client@test.com', 'PPPOE');
    clientUser = await helpers.createClientUser('client_user', 'client_user@test.com', testClient.id);

    // Create users
    const wspAdmin = await helpers.createWspAdmin('wsp_admin', 'wsp_admin@test.com');
    const posManager = await helpers.createPosManager('pos_manager', 'manager@test.com', testPos.id);

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    posManagerToken = await helpers.login('pos_manager', 'password123');
  });

  describe('Service Plans', () => {
    describe('POST /service-plans', () => {
      it('should create service plan (WSP_ADMIN)', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .post('/service-plans')
          .send({
            planName: 'Premium Plan',
            serviceType: 'POSTPAID',
            durationType: 'MONTHLY',
            durationDays: 30,
            cost: 100.0,
            downloadSpeedMbps: 200,
            uploadSpeedMbps: 100,
            dataCapacityGb: 2000,
            description: 'Premium internet plan',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.planName).toBe('Premium Plan');
        expect(response.body.downloadSpeedMbps).toBe('200');
      });

      it('should validate required fields', async () => {
        await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .post('/service-plans')
          .send({
            planName: 'Test Plan',
            // Missing required fields
          })
          .expect(400);
      });
    });

    describe('GET /service-plans', () => {
      beforeEach(async () => {
        await helpers.createServicePlan('Plan 1', 100);
        await helpers.createServicePlan('Plan 2', 200);
      });

      it('should get all service plans', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/service-plans')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter active plans', async () => {
        await prisma.servicePlan.create({
          data: {
            planName: 'Inactive Plan',
            serviceType: 'POSTPAID',
            durationType: 'MONTHLY',
            durationDays: 30,
            cost: 50.0,
            downloadSpeedMbps: 50,
            uploadSpeedMbps: 25,
            isActive: false,
            description: 'Inactive plan',
          },
        });

        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/service-plans?isActive=true')
          .expect(200);

        response.body.forEach((plan: any) => {
          expect(plan.isActive).toBe(true);
        });
      });
    });

    describe('GET /service-plans/:id', () => {
      let plan: any;

      beforeEach(async () => {
        plan = await helpers.createServicePlan('Test Plan', 100);
      });

      it('should get service plan by id', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get(`/service-plans/${plan.id}`)
          .expect(200);

        expect(response.body.id).toBe(plan.id);
        expect(response.body.planName).toBe('Test Plan');
      });
    });

    describe('PATCH /service-plans/:id', () => {
      let plan: any;

      beforeEach(async () => {
        plan = await helpers.createServicePlan('Test Plan', 100);
      });

      it('should update service plan', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .patch(`/service-plans/${plan.id}`)
          .send({
            planName: 'Updated Plan Name',
            cost: 150.0,
          })
          .expect(200);

        expect(response.body.planName).toBe('Updated Plan Name');
        expect(response.body.cost).toBe('150');
      });

      it('should deactivate service plan', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .patch(`/service-plans/${plan.id}`)
          .send({
            isActive: false,
          })
          .expect(200);

        expect(response.body.isActive).toBe(false);
      });
    });
  });

  describe('Static IP Management', () => {
    describe('GET /static-ip', () => {
      beforeEach(async () => {
        await prisma.staticIpPool.create({
          data: {
            posId: testPos.id,
            ipAddress: '192.168.1.100',
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
            status: IpStatus.AVAILABLE,
          },
        });

        await prisma.staticIpPool.create({
          data: {
            posId: testPos.id,
            ipAddress: '192.168.1.101',
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
            status: IpStatus.ASSIGNED,
            clientId: testClient.id,
            assignedAt: new Date(),
          },
        });
      });

      it('should get all static IPs', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/static-ip')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by status', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/static-ip?status=AVAILABLE')
          .expect(200);

        response.body.forEach((ip: any) => {
          expect(ip.status).toBe(IpStatus.AVAILABLE);
        });
      });
    });

    describe('POST /static-ip', () => {
      it('should create static IP pool entry', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .post('/static-ip')
          .send({
            posId: testPos.id,
            ipAddress: '192.168.1.200',
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.ipAddress).toBe('192.168.1.200');
        expect(response.body.status).toBe(IpStatus.AVAILABLE);
      });
    });
  });

  describe('PPPoE Change Requests', () => {
    describe('POST /pppoe-requests', () => {
      it('should create PPPoE change request (CLIENT)', async () => {
        const clientToken = await helpers.login('client_user', 'password123');

        const response = await helpers
          .getAuthenticatedRequest(clientToken)
          .post('/pppoe-requests')
          .send({
            clientId: testClient.id,
            newUsername: 'new_username',
            newPassword: 'new_password123',
            reason: 'Change password for security',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.status).toBe('PENDING');
        expect(response.body.newUsername).toBe('new_username');
      });

      it('should NOT create request for non-PPPoE client', async () => {
        const nonPppoeClient = await helpers.createClient(testPos.id, 'Non PPPoE Client', 'nonpppoe@test.com', 'DYNAMIC');
        const nonPppoeUser = await helpers.createClientUser('nonpppoe_user', 'nonpppoe_user@test.com', nonPppoeClient.id);
        const clientToken = await helpers.login('nonpppoe_user', 'password123');

        await helpers
          .getAuthenticatedRequest(clientToken)
          .post('/pppoe-requests')
          .send({
            newUsername: 'new_username',
            newPassword: 'new_password123',
            reason: 'Change request',
          })
          .expect(400); // Bad request - client is not PPPoE
      });
    });

    describe('GET /pppoe-requests', () => {
      beforeEach(async () => {
        // Get client's current PPPoE username
        const client = await prisma.client.findUnique({ where: { id: testClient.id } });
        const currentUsername = client?.pppoeUsername || 'test_pppoe_user';

        await prisma.pppoeChangeRequest.create({
          data: {
            clientId: testClient.id,
            currentUsername: currentUsername,
            newUsername: 'new_user1',
            newPassword: 'new_pass1',
            reason: 'Test reason 1',
            status: 'PENDING',
          },
        });

        await prisma.pppoeChangeRequest.create({
          data: {
            clientId: testClient.id,
            currentUsername: currentUsername,
            newUsername: 'new_user2',
            newPassword: 'new_pass2',
            reason: 'Test reason 2',
            status: 'APPROVED',
          },
        });
      });

      it('should get all PPPoE requests (WSP_ADMIN)', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/pppoe-requests')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by status', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .get('/pppoe-requests?status=PENDING')
          .expect(200);

        response.body.forEach((req: any) => {
          expect(req.status).toBe('PENDING');
        });
      });
    });

    describe('PATCH /pppoe-requests/:id/approve', () => {
      let request: any;

      beforeEach(async () => {
        // Get client's current PPPoE username
        const client = await prisma.client.findUnique({ where: { id: testClient.id } });
        const currentUsername = client?.pppoeUsername || 'test_pppoe_user';

        request = await prisma.pppoeChangeRequest.create({
          data: {
            clientId: testClient.id,
            currentUsername: currentUsername,
            newUsername: 'new_user',
            newPassword: 'new_pass',
            reason: 'Test reason',
            status: 'PENDING',
          },
        });
      });

      it('should approve PPPoE request', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .patch(`/pppoe-requests/${request.id}/approve`)
          .expect(200);

        expect(response.body.status).toBe('APPROVED');

        // Verify client PPPoE credentials are updated
        const updatedClient = await prisma.client.findUnique({
          where: { id: testClient.id },
        });
        expect(updatedClient?.pppoeUsername).toBe('new_user');
      });
    });

    describe('PATCH /pppoe-requests/:id/reject', () => {
      let request: any;

      beforeEach(async () => {
        // Get client's current PPPoE username
        const client = await prisma.client.findUnique({ where: { id: testClient.id } });
        const currentUsername = client?.pppoeUsername || 'test_pppoe_user';

        request = await prisma.pppoeChangeRequest.create({
          data: {
            clientId: testClient.id,
            currentUsername: currentUsername,
            newUsername: 'new_user',
            newPassword: 'new_pass',
            reason: 'Test reason',
            status: 'PENDING',
          },
        });
      });

      it('should reject PPPoE request', async () => {
        const response = await helpers
          .getAuthenticatedRequest(wspAdminToken)
          .patch(`/pppoe-requests/${request.id}/reject`)
          .send({
            rejectionReason: 'Invalid request',
          })
          .expect(200);

        expect(response.body.status).toBe('REJECTED');
        expect(response.body.rejectionReason).toBe('Invalid request');
      });
    });
  });
});

