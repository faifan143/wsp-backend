import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { UserRole, Capability } from '@prisma/client';

describe('Scope Restrictions - POS Scoping (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let posManagerToken: string;
  let subAdminToken: string;
  let wspAdminToken: string;
  let pos1: any;
  let pos2: any;
  let client1Pos1: any;
  let client2Pos1: any;
  let client3Pos2: any;

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

    // Create POS locations
    pos1 = await helpers.createPos('POS 1', 'Location 1');
    pos2 = await helpers.createPos('POS 2', 'Location 2');

    // Create clients in different POS
    client1Pos1 = await helpers.createClient(pos1.id, 'Client 1 POS1', 'client1pos1@test.com');
    client2Pos1 = await helpers.createClient(pos1.id, 'Client 2 POS1', 'client2pos1@test.com');
    client3Pos2 = await helpers.createClient(pos2.id, 'Client 3 POS2', 'client3pos2@test.com');

    // Create users
    const wspAdmin = await helpers.createWspAdmin('wsp_admin', 'wsp_admin@test.com');
    const subAdmin = await helpers.createSubAdmin(
      'subadmin',
      'subadmin@test.com',
      [
        Capability.CLIENTS_READ,
        Capability.CLIENTS_CREATE,
        Capability.CLIENTS_UPDATE,
        Capability.SUBSCRIPTIONS_READ,
        Capability.SUBSCRIPTIONS_CREATE,
        Capability.INVOICES_READ,
      ],
    );
    const posManager = await helpers.createPosManager('pos_manager', 'manager@test.com', pos1.id);

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    subAdminToken = await helpers.login('subadmin', 'password123');
    posManagerToken = await helpers.login('pos_manager', 'password123');
  });

  describe('POS_MANAGER Scope Restrictions', () => {
    it('should only see clients from own POS', async () => {
      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get('/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should only see clients from pos1
      response.body.forEach((client: any) => {
        expect(client.posId).toBe(pos1.id);
      });
      // Should not see client3Pos2 (from pos2)
      const hasClient3 = response.body.some((client: any) => client.id === client3Pos2.id);
      expect(hasClient3).toBe(false);
    });

    it('should access client from own POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get(`/clients/${client1Pos1.id}`)
        .expect(200);
    });

    it('should NOT access client from other POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get(`/clients/${client3Pos2.id}`)
        .expect(403); // Forbidden
    });

    it('should create client in own POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/clients')
        .send({
          posId: pos1.id,
          fullName: 'New Client POS1',
          phone: '1234567890',
          email: 'newclientpos1@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(201);
    });

    it('should NOT create client in other POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/clients')
        .send({
          posId: pos2.id, // Different POS
          fullName: 'New Client POS2',
          phone: '1234567890',
          email: 'newclientpos2@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(403); // Forbidden - can't create clients for other POS
    });

    it('should update client from own POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${client1Pos1.id}`)
        .send({
          fullName: 'Updated Client',
        })
        .expect(200);
    });

    it('should NOT update client from other POS', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${client3Pos2.id}`)
        .send({
          fullName: 'Should not work',
        })
        .expect(403); // Forbidden
    });

    it('should only see subscriptions from own POS clients', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 100);
      await helpers.createSubscription(client1Pos1.id, plan.id);
      await helpers.createSubscription(client3Pos2.id, plan.id);

      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get('/subscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All subscriptions should be from pos1 clients
      response.body.forEach((sub: any) => {
        expect(sub.client.posId).toBe(pos1.id);
      });
    });

    it('should only see invoices from own POS clients', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 100);
      const sub1 = await helpers.createSubscription(client1Pos1.id, plan.id);
      const sub2 = await helpers.createSubscription(client3Pos2.id, plan.id);

      await prisma.invoice.create({
        data: {
          clientId: client1Pos1.id,
          subscriptionId: sub1.id,
          invoiceNumber: `INV-${Date.now()}-1`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.invoice.create({
        data: {
          clientId: client3Pos2.id,
          subscriptionId: sub2.id,
          invoiceNumber: `INV-${Date.now()}-2`,
          amount: 50.0,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get('/invoices')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All invoices should be from pos1 clients
      response.body.forEach((invoice: any) => {
        expect(invoice.client.posId).toBe(pos1.id);
      });
    });
  });

  describe('SUB_ADMIN Scope - No POS Restrictions', () => {
    it('should see ALL clients regardless of POS', async () => {
      const response = await helpers
        .getAuthenticatedRequest(subAdminToken)
        .get('/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should see clients from both POS
      const pos1Clients = response.body.filter((c: any) => c.posId === pos1.id);
      const pos2Clients = response.body.filter((c: any) => c.posId === pos2.id);
      expect(pos1Clients.length).toBeGreaterThan(0);
      expect(pos2Clients.length).toBeGreaterThan(0);
    });

    it('should access client from any POS', async () => {
      await helpers
        .getAuthenticatedRequest(subAdminToken)
        .get(`/clients/${client1Pos1.id}`)
        .expect(200);

      await helpers
        .getAuthenticatedRequest(subAdminToken)
        .get(`/clients/${client3Pos2.id}`)
        .expect(200);
    });

    it('should create client in any POS', async () => {
      await helpers
        .getAuthenticatedRequest(subAdminToken)
        .post('/clients')
        .send({
          posId: pos2.id,
          fullName: 'New Client POS2 by SubAdmin',
          phone: '1234567890',
          email: 'newclientpos2subadmin@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(201);
    });

    it('should see ALL subscriptions regardless of POS', async () => {
      const plan = await helpers.createServicePlan('Test Plan', 100);
      await helpers.createSubscription(client1Pos1.id, plan.id);
      await helpers.createSubscription(client3Pos2.id, plan.id);

      const response = await helpers
        .getAuthenticatedRequest(subAdminToken)
        .get('/subscriptions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should see subscriptions from both POS
      const pos1Subs = response.body.filter((s: any) => s.client.posId === pos1.id);
      const pos2Subs = response.body.filter((s: any) => s.client.posId === pos2.id);
      expect(pos1Subs.length).toBeGreaterThan(0);
      expect(pos2Subs.length).toBeGreaterThan(0);
    });
  });

  describe('WSP_ADMIN Scope - Full Access', () => {
    it('should see ALL clients', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const pos1Clients = response.body.filter((c: any) => c.posId === pos1.id);
      const pos2Clients = response.body.filter((c: any) => c.posId === pos2.id);
      expect(pos1Clients.length).toBeGreaterThan(0);
      expect(pos2Clients.length).toBeGreaterThan(0);
    });

    it('should access clients from any POS', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/clients/${client1Pos1.id}`)
        .expect(200);

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/clients/${client3Pos2.id}`)
        .expect(200);
    });

    it('should create clients in any POS', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/clients')
        .send({
          posId: pos2.id,
          fullName: 'New Client by WSP Admin',
          phone: '1234567890',
          email: 'newclientwsp@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(201);
    });
  });
});

