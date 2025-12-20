import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientStatus, IpStatus } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';

describe('Clients Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;
  let wspAdminToken: string;
  let posManagerToken: string;
  let clientToken: string;
  let testPos: any;
  let testClient: any;
  let otherPos: any;

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
    otherPos = await helpers.createPos('Other POS', 'Other Location');
    testClient = await helpers.createClient(testPos.id, 'Test Client', 'test_client@test.com');

    // Create users
    const wspAdmin = await helpers.createWspAdmin('wsp_admin', 'wsp_admin@test.com');
    const posManager = await helpers.createPosManager('pos_manager', 'manager@test.com', testPos.id);
    const clientUser = await helpers.createClientUser('client_user', 'client_user@test.com', testClient.id);

    // Get tokens
    wspAdminToken = await helpers.login('wsp_admin', 'password123');
    posManagerToken = await helpers.login('pos_manager', 'password123');
    clientToken = await helpers.login('client_user', 'password123');
  });

  describe('POST /clients', () => {
    it('should create client (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
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

      expect(response.body).toHaveProperty('id');
      expect(response.body.fullName).toBe('New Client');
      expect(response.body.status).toBe(ClientStatus.ACTIVE);
    });

    it('should create client (POS_MANAGER from same POS)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
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

      expect(response.body).toHaveProperty('id');
    });

    it('should NOT create client (POS_MANAGER from different POS)', async () => {
      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .post('/clients')
        .send({
          posId: otherPos.id, // Different POS
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient3@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(403); // Forbidden - can't create clients for other POS
    });

    it('should NOT create client (CLIENT role)', async () => {
      await helpers
        .getAuthenticatedRequest(clientToken)
        .post('/clients')
        .send({
          posId: testPos.id,
          fullName: 'New Client',
          phone: '1234567890',
          email: 'newclient4@test.com',
          address: 'Test Address',
          connectionType: 'DYNAMIC',
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post('/clients')
        .send({
          fullName: 'New Client',
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('GET /clients', () => {
    it('should get all clients (WSP_ADMIN)', async () => {
      // Create additional clients
      await helpers.createClient(testPos.id, 'Client 2', 'client2@test.com');
      await helpers.createClient(otherPos.id, 'Client 3', 'client3@test.com');

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    it('should get only clients from own POS (POS_MANAGER)', async () => {
      await helpers.createClient(testPos.id, 'Client 2', 'client2@test.com');
      await helpers.createClient(otherPos.id, 'Client 3', 'client3@test.com');

      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get('/clients')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should only see clients from testPos
      response.body.forEach((client: any) => {
        expect(client.posId).toBe(testPos.id);
      });
    });

    it('should paginate results', async () => {
      // Create multiple clients
      for (let i = 0; i < 5; i++) {
        await helpers.createClient(testPos.id, `Client ${i}`, `client${i}@test.com`);
      }

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/clients?page=1&limit=2')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /clients/:id', () => {
    it('should get client by id (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get(`/clients/${testClient.id}`)
        .expect(200);

      expect(response.body.id).toBe(testClient.id);
      expect(response.body.fullName).toBe('Test Client');
    });

    it('should get client from own POS (POS_MANAGER)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get(`/clients/${testClient.id}`)
        .expect(200);

      expect(response.body.id).toBe(testClient.id);
    });

    it('should NOT get client from other POS (POS_MANAGER)', async () => {
      const otherClient = await helpers.createClient(otherPos.id, 'Other Client', 'other@test.com');

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .get(`/clients/${otherClient.id}`)
        .expect(403); // Forbidden - can't access other POS clients
    });

    it('should return 404 for non-existent client', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .get('/clients/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /clients/:id', () => {
    it('should update client (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}`)
        .send({
          fullName: 'Updated Client Name',
          phone: '9876543210',
        })
        .expect(200);

      expect(response.body.fullName).toBe('Updated Client Name');
      expect(response.body.phone).toBe('9876543210');
    });

    it('should update client from own POS (POS_MANAGER)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${testClient.id}`)
        .send({
          fullName: 'Updated by Manager',
        })
        .expect(200);

      expect(response.body.fullName).toBe('Updated by Manager');
    });

    it('should NOT update client from other POS (POS_MANAGER)', async () => {
      const otherClient = await helpers.createClient(otherPos.id, 'Other Client', 'other@test.com');

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${otherClient.id}`)
        .send({
          fullName: 'Should not work',
        })
        .expect(403);
    });
  });

  describe('PATCH /clients/:id/activate', () => {
    it('should activate client (WSP_ADMIN)', async () => {
      // Set client to SUSPENDED first
      await prisma.client.update({
        where: { id: testClient.id },
        data: { status: 'SUSPENDED' },
      });

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/activate`)
        .expect(200);

      expect(response.body.status).toBe(ClientStatus.ACTIVE);

      // Verify in database
      const client = await prisma.client.findUnique({ where: { id: testClient.id } });
      expect(client?.status).toBe(ClientStatus.ACTIVE);
    });

    it('should activate client from own POS (POS_MANAGER)', async () => {
      await prisma.client.update({
        where: { id: testClient.id },
        data: { status: ClientStatus.SUSPENDED },
      });

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${testClient.id}/activate`)
        .expect(200);
    });

    it('should NOT activate client from other POS (POS_MANAGER)', async () => {
      const otherClient = await helpers.createClient(otherPos.id, 'Other Client', 'other@test.com');
      await prisma.client.update({
        where: { id: otherClient.id },
        data: { status: ClientStatus.SUSPENDED },
      });

      await helpers
        .getAuthenticatedRequest(posManagerToken)
        .patch(`/clients/${otherClient.id}/activate`)
        .expect(403);
    });
  });

  describe('PATCH /clients/:id/suspend', () => {
    it('should suspend client (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/suspend`)
        .send({
          reason: 'NON_PAYMENT',
          reasonDetails: 'Payment overdue',
        })
        .expect(200);

      expect(response.body.status).toBe(ClientStatus.SUSPENDED);

      // Verify suspension history created
      const suspensionHistory = await prisma.suspensionHistory.findFirst({
        where: { clientId: testClient.id },
      });
      expect(suspensionHistory).toBeDefined();
      expect(suspensionHistory?.reasonDetails).toBe('Payment overdue');
    });

    it('should require suspension reason', async () => {
      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/suspend`)
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /clients/:id/terminate', () => {
    it('should terminate client (WSP_ADMIN)', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/terminate`)
        .expect(200);

      expect(response.body.status).toBe(ClientStatus.TERMINATED);

      // Verify client is terminated
      const client = await prisma.client.findUnique({ where: { id: testClient.id } });
      expect(client?.status).toBe(ClientStatus.TERMINATED);
    });

    it('should release static IP when terminating client', async () => {
      // Assign static IP first
      const staticIp = await prisma.staticIpPool.create({
        data: {
          posId: testPos.id,
          ipAddress: '192.168.1.100',
          subnetMask: '255.255.255.0',
          gateway: '192.168.1.1',
          status: IpStatus.AVAILABLE,
        },
      });

      await prisma.staticIpPool.update({
        where: { id: staticIp.id },
        data: {
          clientId: testClient.id,
          status: IpStatus.ASSIGNED,
          assignedAt: new Date(),
        },
      });

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/terminate`)
        .expect(200);

      // Verify IP is released
      const updatedIp = await prisma.staticIpPool.findUnique({ where: { id: staticIp.id } });
      expect(updatedIp?.clientId).toBeNull();
      expect(updatedIp?.status).toBe('AVAILABLE');
    });

  });

  describe('PATCH /clients/:id/connection-type', () => {
    it('should update connection type (WSP_ADMIN)', async () => {
      // Create a static IP first
      const staticIp = await prisma.staticIpPool.create({
        data: {
          posId: testPos.id,
          ipAddress: '192.168.1.100',
          subnetMask: '255.255.255.0',
          gateway: '192.168.1.1',
          status: IpStatus.AVAILABLE,
        },
      });

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/connection-type`)
        .send({
          connectionType: 'STATIC',
          staticIpId: staticIp.id,
        })
        .expect(200);

      expect(response.body.connectionType).toBe('STATIC');
    });

    it('should update connection type to PPPOE', async () => {
      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/connection-type`)
        .send({
          connectionType: 'PPPOE',
          pppoeUsername: 'test_user',
          pppoePassword: 'test_password',
        })
        .expect(200);

      expect(response.body.connectionType).toBe('PPPOE');
    });
  });

  describe('POST /clients/:id/static-ip', () => {
    it('should assign static IP to client', async () => {
      const staticIp = await prisma.staticIpPool.create({
        data: {
          posId: testPos.id,
          ipAddress: '192.168.1.200',
          subnetMask: '255.255.255.0',
          gateway: '192.168.1.1',
          status: IpStatus.AVAILABLE,
        },
      });

      // Update client to STATIC connection type
      await prisma.client.update({
        where: { id: testClient.id },
        data: { connectionType: 'STATIC' },
      });

      const response = await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/clients/${testClient.id}/static-ip/assign`)
        .send({
          staticIpId: staticIp.id,
        })
        .expect(200);

      expect(response.body.staticIpId).toBe(staticIp.id);

      // Verify IP is assigned
      const updatedIp = await prisma.staticIpPool.findUnique({ where: { id: staticIp.id } });
      expect(updatedIp?.clientId).toBe(testClient.id);
      expect(updatedIp?.status).toBe(IpStatus.ASSIGNED);
    });

    it('should NOT assign IP if client is not STATIC type', async () => {
      const staticIp = await prisma.staticIpPool.create({
        data: {
          posId: testPos.id,
          ipAddress: '192.168.1.201',
          subnetMask: '255.255.255.0',
          gateway: '192.168.1.1',
          status: IpStatus.AVAILABLE,
        },
      });

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .post(`/clients/${testClient.id}/static-ip/assign`)
        .send({
          staticIpId: staticIp.id,
        })
        .expect(400); // Bad request - client must be STATIC type
    });
  });

  describe('PATCH /clients/:id/static-ip/release', () => {
    it('should release static IP from client', async () => {
      const staticIp = await prisma.staticIpPool.create({
        data: {
          posId: testPos.id,
          ipAddress: '192.168.1.300',
          subnetMask: '255.255.255.0',
          gateway: '192.168.1.1',
          status: IpStatus.ASSIGNED,
          clientId: testClient.id,
          assignedAt: new Date(),
        },
      });

      await helpers
        .getAuthenticatedRequest(wspAdminToken)
        .patch(`/clients/${testClient.id}/static-ip/release`)
        .expect(200);

      // Verify IP is released
      const updatedIp = await prisma.staticIpPool.findUnique({ where: { id: staticIp.id } });
      expect(updatedIp?.clientId).toBeNull();
      expect(updatedIp?.status).toBe('AVAILABLE');
    });
  });
});

