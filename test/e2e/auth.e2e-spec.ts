import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from '../utils/test-helpers';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let helpers: TestHelpers;

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
  });

  describe('POST /auth/login', () => {
    it('should login WSP_ADMIN successfully', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'admin_test',
          email: 'admin_test@test.com',
          passwordHash,
          role: UserRole.WSP_ADMIN,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin_test',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(typeof response.body.access_token).toBe('string');
    });

    it('should login SUB_ADMIN successfully', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'subadmin_test',
          email: 'subadmin_test@test.com',
          passwordHash,
          role: UserRole.SUB_ADMIN,
          capabilities: [],
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'subadmin_test',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
    });

    it('should login POS_MANAGER successfully', async () => {
      const pos = await helpers.createPos('Test POS', 'Test Location');
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'manager_test',
          email: 'manager_test@test.com',
          passwordHash,
          role: UserRole.POS_MANAGER,
          posId: pos.id,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'manager_test',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
    });

    it('should login CLIENT successfully', async () => {
      const pos = await helpers.createPos('Test POS', 'Test Location');
      const client = await helpers.createClient(pos.id, 'Test Client', 'client_test@test.com');
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'client_test',
          email: 'client_test@test.com',
          passwordHash,
          role: UserRole.CLIENT,
          clientId: client.id,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'client_test',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
    });

    it('should reject invalid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'admin_test',
          email: 'admin_test@test.com',
          passwordHash,
          role: UserRole.WSP_ADMIN,
        },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'admin_test',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })
        .expect(401);
    });

    it('should reject inactive user', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'inactive_admin',
          email: 'inactive_admin@test.com',
          passwordHash,
          role: UserRole.WSP_ADMIN,
          isActive: false,
        },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'inactive_admin',
          password: 'password123',
        })
        .expect(401);
    });
  });

  describe('JWT Token Validation', () => {
    let adminToken: string;

    beforeEach(async () => {
      const admin = await helpers.createWspAdmin('test_admin', 'test_admin@test.com');
      adminToken = await helpers.login('test_admin', 'password123');
    });

    it('should access protected route with valid token', async () => {
      await helpers
        .getAuthenticatedRequest(adminToken)
        .get('/users')
        .expect(200);
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await helpers
        .getAuthenticatedRequest('invalid_token')
        .get('/users')
        .expect(401);
    });

    it('should include user capabilities in token for SUB_ADMIN', async () => {
      const subAdmin = await helpers.createSubAdmin(
        'subadmin_caps',
        'subadmin_caps@test.com',
        ['CLIENTS_READ', 'INVOICES_READ'],
      );
      const token = await helpers.login('subadmin_caps', 'password123');

      // Token should contain capabilities (verified by accessing endpoints)
      const response = await helpers
        .getAuthenticatedRequest(token)
        .get('/clients')
        .expect(200);

      // If we can access, capabilities are working
      expect(response.body).toBeDefined();
    });
  });
});

