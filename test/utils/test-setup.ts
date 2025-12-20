import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma.service';
import { TestHelpers } from './test-helpers';

let app: INestApplication;
let prisma: PrismaService;
let testHelpers: TestHelpers;

export async function setupTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  helpers: TestHelpers;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  
  // Apply global validation pipe (same as main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);
  testHelpers = new TestHelpers(app, prisma);

  return { app, prisma, helpers: testHelpers };
}

export async function teardownTestApp() {
  if (app) {
    await app.close();
  }
}

export { app, prisma, testHelpers };

