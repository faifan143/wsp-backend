import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { UserRole, Capability } from '@prisma/client';

describe('Invoices & Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let wspAdminToken: string;
  let financeAdminToken: string;
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
    testPlan = await helpers.createServicePlan('Test Plan', 100);
    testSubscription = await helpers.createSubscription(testClient.id, testPlan.id);

    // Create users
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
    const posManager = await helpers.createPosManager('pos_manager', 'manager@test.com', testPos.id);

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    financeAdminToken = await helpers.login('finance_admin', 'password123');
    posManagerToken = await helpers.login('pos_manager', 'password123');
  });

  describe('POST /invoices', () => {
    it('should create invoice (WSP_ADMIN)', async () => {
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          amount: 50.0,
          issueDate: issueDate.toISOString(),
          dueDate: dueDate.toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe('50');
      expect(response.body.clientId).toBe(testClient.id);
    });

    it('should create invoice (Finance Admin with INVOICES_CREATE capability)', async () => {
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          amount: 50.0,
          issueDate: issueDate.toISOString(),
          dueDate: dueDate.toISOString(),
        })
        .expect(201);
    });

    it('should NOT create invoice (POS_MANAGER without capability)', async () => {
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/invoices')
        .send({
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          amount: 50.0,
          issueDate: issueDate.toISOString(),
          dueDate: dueDate.toISOString(),
        })
        .expect(403); // Forbidden - missing capability
    });
  });

  describe('GET /invoices', () => {
    beforeEach(async () => {
      // Create some invoices
      await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}-1`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const client2 = await helpers.createClient(testPos.id, 'Client 2', 'client2@test.com');
      const subscription2 = await helpers.createSubscription(client2.id, testPlan.id);
      await prisma.invoice.create({
        data: {
          clientId: client2.id,
          subscriptionId: subscription2.id,
          invoiceNumber: `INV-${Date.now()}-2`,
          amount: 75.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should get all invoices (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/invoices')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get invoices (filtering by status removed as invoice model no longer has status field)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/invoices')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /invoices/:id', () => {
    let invoice: any;

    beforeEach(async () => {
      invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should get invoice by id (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/invoices/${invoice.id}`)
        .expect(200);

      expect(response.body.id).toBe(invoice.id);
      expect(response.body.amount).toBe('50');
    });
  });

  describe('PATCH /invoices/:id/cancel', () => {
    let invoice: any;

    beforeEach(async () => {
      invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should cancel invoice (Finance Admin with INVOICES_CANCEL capability)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .patch(`/invoices/${invoice.id}/cancel`)
        .expect(200);

      // Invoice cancellation adds [CANCELLED] to notes and returns calculated status
      expect(response.body).toBeDefined();
      expect(response.body.notes).toContain('[CANCELLED]');
    });
  });

  describe('POST /payments', () => {
    let invoice: any;

    beforeEach(async () => {
      invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should create payment (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'CASH',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amountPaid).toBe('50');
      expect(response.body.paymentMethod).toBe('CASH');
      expect(response.body.invoiceId).toBe(invoice.id);

      // Verify payment was created (invoice doesn't have status field, status is calculated from payments)
      const payment = await prisma.payment.findFirst({
        where: { invoiceId: invoice.id },
      });
      expect(payment).toBeDefined();
      expect(payment?.amountPaid.toString()).toBe('50'); // Prisma Decimal needs toString()
    });

    it('should create partial payment', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: 30.0, // Partial payment
          paymentMethod: 'CASH',
        })
        .expect(201);

      expect(response.body.amountPaid).toBe('30');

      // Verify partial payment was created (invoice doesn't have status field, status is calculated from payments)
      const payment = await prisma.payment.findFirst({
        where: { invoiceId: invoice.id },
      });
      expect(payment).toBeDefined();
      expect(payment?.amountPaid.toString()).toBe('30'); // Prisma Decimal needs toString()
    });

    it('should create payment (Finance Admin with PAYMENTS_CREATE capability)', async () => {
      await helpers
        .getAuthenticatedRequest(financeAdminToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'BANK_TRANSFER',
        })
        .expect(201);
    });

    it('should NOT create payment (POS_MANAGER without capability)', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'CASH',
        })
        .expect(403); // Forbidden - missing capability
    });

    it('should validate payment amount', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/payments')
        .send({
          invoiceId: invoice.id,
          amountPaid: -10.0, // Invalid negative amount
          paymentMethod: 'CASH',
        })
        .expect(400);
    });
  });

  describe('GET /payments', () => {
    let invoice: any;

    beforeEach(async () => {
      invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Create some payments
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'CASH',
          paymentDate: new Date(),
        },
      });
    });

    it('should get all payments (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/payments')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter payments by payment method', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/payments?paymentMethod=CASH')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((payment: any) => {
        expect(payment.paymentMethod).toBe('CASH');
      });
    });
  });

  describe('GET /payments/:id', () => {
    let invoice: any;
    let payment: any;

    beforeEach(async () => {
      invoice = await prisma.invoice.create({
        data: {
          clientId: testClient.id,
          subscriptionId: testSubscription.id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountPaid: 50.0,
          paymentMethod: 'CASH',
          paymentDate: new Date(),
        },
      });
    });

    it('should get payment by id (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/payments/${payment.id}`)
        .expect(200);

      expect(response.body.id).toBe(payment.id);
      expect(response.body.amountPaid).toBe('50');
    });
  });
});

