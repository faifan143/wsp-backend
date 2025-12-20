import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { Capability } from '@prisma/client';

describe('SUB_ADMIN Capabilities (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let financeAdminToken: string;
  let operationsAdminToken: string;
  let readOnlyAdminToken: string;
  let wspAdminToken: string;
  let testPos: any;
  let testClient: any;

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

    // Create test users
    const wspAdmin = await helpers.createWspAdmin('wsp_admin', 'wsp_admin@test.com');
    const financeAdmin = await helpers.createSubAdmin(
      'finance_admin',
      'finance_admin@test.com',
      [
        Capability.CLIENTS_READ,
        Capability.SUBSCRIPTIONS_READ,
        Capability.INVOICES_CREATE,
        Capability.INVOICES_READ,
        Capability.INVOICES_CANCEL,
        Capability.PAYMENTS_CREATE,
        Capability.PAYMENTS_READ,
      ],
    );
    const operationsAdmin = await helpers.createSubAdmin(
      'operations_admin',
      'operations_admin@test.com',
      [
        Capability.CLIENTS_CREATE,
        Capability.CLIENTS_READ,
        Capability.CLIENTS_UPDATE,
        Capability.SUBSCRIPTIONS_CREATE,
        Capability.SUBSCRIPTIONS_READ,
        Capability.SUBSCRIPTIONS_RENEW,
      ],
    );
    const readOnlyAdmin = await helpers.createSubAdmin(
      'readonly_admin',
      'readonly_admin@test.com',
      [Capability.CLIENTS_READ, Capability.INVOICES_READ, Capability.PAYMENTS_READ],
    );

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    financeAdminToken = await helpers.login('finance_admin', 'password123');
    operationsAdminToken = await helpers.login('operations_admin', 'password123');
    readOnlyAdminToken = await helpers.login('readonly_admin', 'password123');

    // Create test data
    testPos = await helpers.createPos('Test POS', 'Test Location');
    testClient = await helpers.createClient(testPos.id, 'Test Client', 'test_client@test.com');
  });

  describe('Finance Admin Capabilities', () => {
    it('should read clients (has CLIENTS_READ)', async () => {
      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .get('/clients')
        .expect(200);
    });

    it('should NOT create clients (missing CLIENTS_CREATE)', async () => {
      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .post('/clients')
        .send({
          posId: testPos.id,
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(403); // Forbidden - missing capability
    });

    it('should create invoices (has INVOICES_CREATE)', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 10);
      const subscription = await helpers.createSubscription(testClient.id, plan.id);

      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: subscription.id,
          amount: 50.0,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);
    });

    it('should read invoices (has INVOICES_READ)', async () => {
      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .get('/invoices')
        .expect(200);
    });

    it('should create payments (has PAYMENTS_CREATE)', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 10);
      const subscription = await helpers.createSubscription(testClient.id, plan.id);
      const invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: subscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'CASH',
        })
        .expect(201);
    });
  });

  describe('Operations Admin Capabilities', () => {
    it('should create clients (has CLIENTS_CREATE)', async () => {
      await helpers
        .getAuthenticatedRequest(operationsAdminToken)
        .post('/clients')
        .send({
          posId: testPos.id,
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(201);
    });

    it('should update clients (has CLIENTS_UPDATE)', async () => {
      await helpers
        .getAuthenticatedRequest(operationsAdminToken)
        .patch(`/clients/${testClient.id}`)
        .send({
          fullName: 'Updated Client Name',
        })
        .expect(200);
    });

    it('should create subscriptions (has SUBSCRIPTIONS_CREATE)', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 10);

      await helpers
        .getAuthenticatedRequest(operationsAdminToken)
        .post('/subscriptions')
        .send({
          clientId: testClient.id,
          planId: plan.id,
          startDate: new Date().toISOString(),
        })
        .expect(201);
    });

    it('should NOT create invoices (missing INVOICES_CREATE)', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 10);
      const subscription = await helpers.createSubscription(testClient.id, plan.id);

      await helpers
        .getAuthenticatedRequest(operationsAdminToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: subscription.id,
          amount: 50.0,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(403); // Forbidden - missing capability
    });
  });

  describe('Read-Only Admin Capabilities', () => {
    it('should read clients (has CLIENTS_READ)', async () => {
      await helpers
        .getAuthenticatedRequest(readOnlyAdminToken)
        .get('/clients')
        .expect(200);
    });

    it('should NOT create clients (missing CLIENTS_CREATE)', async () => {
      await helpers
        .getAuthenticatedRequest(readOnlyAdminToken)
        .post('/clients')
        .send({
          posId: testPos.id,
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(403);
    });

    it('should NOT update clients (missing CLIENTS_UPDATE)', async () => {
      await helpers
        .getAuthenticatedRequest(readOnlyAdminToken)
        .patch(`/clients/${testClient.id}`)
        .send({
          fullName: 'Updated Name',
        })
        .expect(403);
    });

    it('should read invoices (has INVOICES_READ)', async () => {
      await helpers
        .getAuthenticatedRequest(readOnlyAdminToken)
        .get('/invoices')
        .expect(200);
    });
  });

  describe('WSP_ADMIN (should have all capabilities)', () => {
    it('should have full access to all endpoints', async () => {
      // Test multiple capabilities that SUB_ADMIN might not have
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/clients')
        .send({
          posId: testPos.id,
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient2@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(201);

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/pos')
        .send({
          name: 'New POS',
          location: 'New Location',
          contactPhone: '1234567890',
          allocatedBandwidthMbps: 1000,
        })
        .expect(201);

      const plan = await helpers.createServicePlan('Test Plan', 10);
      const subscription = await helpers.createSubscription(testClient.id, plan.id);

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: subscription.id,
          amount: 50.0,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);
    });
  });
});

