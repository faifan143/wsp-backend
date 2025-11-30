import { PrismaClient, UserRole, IpStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create WSP Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@wsp.com',
      passwordHash: adminPassword,
      role: UserRole.WSP_ADMIN,
    }
  });
  console.log('✅ Created WSP Admin:', admin.username);

  // Create Bandwidth Pool
  const bandwidthPool = await prisma.bandwidthPool.create({
    data: {
      totalWspBandwidthMbps: 10000, // 10 Gbps
      allocatedBandwidthMbps: 0,
      availableBandwidthMbps: 10000,
      usagePercentage: 0,
    }
  });
  console.log('✅ Created Bandwidth Pool:', bandwidthPool.totalWspBandwidthMbps, 'Mbps');

  // Create Sample POS
  const pos1 = await prisma.pOS.create({
    data: {
      name: 'POS Downtown',
      location: 'Main Street, City Center',
      contactPhone: '07701234567',
      allocatedBandwidthMbps: 2000,
      currentUsageMbps: 0,
    }
  });
  console.log('✅ Created POS:', pos1.name);

  const pos2 = await prisma.pOS.create({
    data: {
      name: 'POS North Branch',
      location: 'North Avenue, Business District',
      contactPhone: '07701234568',
      allocatedBandwidthMbps: 1500,
      currentUsageMbps: 0,
    }
  });
  console.log('✅ Created POS:', pos2.name);

  // Create POS Managers
  const posManager1Password = await bcrypt.hash('manager123', 10);
  const posManager1 = await prisma.user.create({
    data: {
      username: 'pos_manager_1',
      email: 'manager1@wsp.com',
      passwordHash: posManager1Password,
      role: UserRole.POS_MANAGER,
      posId: pos1.id,
    }
  });
  console.log('✅ Created POS Manager 1:', posManager1.username);

  const posManager2Password = await bcrypt.hash('manager123', 10);
  const posManager2 = await prisma.user.create({
    data: {
      username: 'pos_manager_2',
      email: 'manager2@wsp.com',
      passwordHash: posManager2Password,
      role: UserRole.POS_MANAGER,
      posId: pos2.id,
    }
  });
  console.log('✅ Created POS Manager 2:', posManager2.username);

  // Create Sample Service Plans
  const servicePlans = await prisma.servicePlan.createMany({
    data: [
      {
        planName: 'Basic 10MB - Monthly',
        serviceType: 'POSTPAID',
        durationType: 'MONTHLY',
        durationDays: 30,
        cost: 30.00,
        downloadSpeedMbps: 10,
        uploadSpeedMbps: 5,
        dataCapacityGb: null, // unlimited
        isActive: true,
        description: 'Basic internet plan for light usage'
      },
      {
        planName: 'Premium 50MB - Monthly',
        serviceType: 'POSTPAID',
        durationType: 'MONTHLY',
        durationDays: 30,
        cost: 80.00,
        downloadSpeedMbps: 50,
        uploadSpeedMbps: 25,
        dataCapacityGb: null,
        isActive: true,
        description: 'Premium internet plan for heavy usage'
      },
      {
        planName: 'Prepaid 20MB - Weekly',
        serviceType: 'PREPAID',
        durationType: 'HALF_MONTHLY',
        durationDays: 7,
        cost: 15.00,
        downloadSpeedMbps: 20,
        uploadSpeedMbps: 10,
        dataCapacityGb: 100,
        isActive: true,
        description: 'Prepaid plan for short-term usage'
      },
      {
        planName: 'Business 100MB - Monthly',
        serviceType: 'POSTPAID',
        durationType: 'MONTHLY',
        durationDays: 30,
        cost: 150.00,
        downloadSpeedMbps: 100,
        uploadSpeedMbps: 50,
        dataCapacityGb: null,
        isActive: true,
        description: 'Business plan for high-speed requirements'
      }
    ]
  });
  console.log('✅ Created Service Plans:', servicePlans.count);

  // Create Static IP Pool for POS 1
  const staticIps: any[] = [];
  for (let i = 10; i <= 50; i++) {
    staticIps.push({
      posId: pos1.id,
      ipAddress: `192.168.1.${i}`,
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      dnsPrimary: '8.8.8.8',
      dnsSecondary: '8.8.4.4',
      status: IpStatus.AVAILABLE,
    });
  }
  await prisma.staticIpPool.createMany({
    data: staticIps
  });
  console.log('✅ Created Static IP Pool for POS 1:', staticIps.length, 'IPs');

  // Create Static IP Pool for POS 2
  const staticIps2: any[] = [];
  for (let i = 10; i <= 30; i++) {
    staticIps2.push({
      posId: pos2.id,
      ipAddress: `192.168.2.${i}`,
      subnetMask: '255.255.255.0',
      gateway: '192.168.2.1',
      dnsPrimary: '8.8.8.8',
      dnsSecondary: '8.8.4.4',
      status: IpStatus.AVAILABLE,
    });
  }
  await prisma.staticIpPool.createMany({
    data: staticIps2
  });
  console.log('✅ Created Static IP Pool for POS 2:', staticIps2.length, 'IPs');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('WSP Admin:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('\nPOS Manager 1 (Downtown):');
  console.log('  Username: pos_manager_1');
  console.log('  Password: manager123');
  console.log('\nPOS Manager 2 (North Branch):');
  console.log('  Username: pos_manager_2');
  console.log('  Password: manager123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
