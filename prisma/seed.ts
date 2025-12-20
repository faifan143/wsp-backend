import { PrismaClient, UserRole, IpStatus, ConnectionType, ClientStatus, SubscriptionStatus, RequestStatus, SuspensionReason, PaymentMethod, Capability } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // Clear existing data (in reverse order of dependencies to respect foreign keys)
  console.log('🗑️  Clearing existing data...');
  await prisma.usageLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.pppoeChangeRequest.deleteMany();
  await prisma.suspensionHistory.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.staticIpPool.deleteMany(); // Delete static IPs before clients and POS
  await prisma.client.deleteMany();
  await prisma.servicePlan.deleteMany();
  await prisma.auditLog.deleteMany(); // Delete audit logs before users (foreign key constraint)
  await prisma.user.deleteMany();
  await prisma.pOS.deleteMany();
  await prisma.bandwidthPool.deleteMany();
  console.log('✅ Cleared existing data\n');

  // ============================================
  // 1. WSP ADMIN
  // ============================================
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

  // ============================================
  // 2. SUB_ADMIN USERS (with different capabilities)
  // ============================================
  const financeAdminPassword = await bcrypt.hash('finance123', 10);
  const financeAdmin = await prisma.user.create({
    data: {
      username: 'finance_admin',
      email: 'finance@wsp.com',
      passwordHash: financeAdminPassword,
      role: UserRole.SUB_ADMIN,
      capabilities: [
        Capability.CLIENTS_READ,
        Capability.SUBSCRIPTIONS_READ,
        Capability.INVOICES_CREATE,
        Capability.INVOICES_READ,
        Capability.INVOICES_CANCEL,
        Capability.PAYMENTS_CREATE,
        Capability.PAYMENTS_READ,
        Capability.SERVICE_PLANS_READ,
      ],
    }
  });
  console.log('✅ Created Finance SUB_ADMIN:', financeAdmin.username, `(${financeAdmin.capabilities.length} capabilities)`);

  const operationsAdminPassword = await bcrypt.hash('operations123', 10);
  const operationsAdmin = await prisma.user.create({
    data: {
      username: 'operations_admin',
      email: 'operations@wsp.com',
      passwordHash: operationsAdminPassword,
      role: UserRole.SUB_ADMIN,
      capabilities: [
        Capability.POS_READ,
        Capability.CLIENTS_CREATE,
        Capability.CLIENTS_READ,
        Capability.CLIENTS_UPDATE,
        Capability.CLIENTS_ACTIVATE,
        Capability.CLIENTS_SUSPEND,
        Capability.SUBSCRIPTIONS_CREATE,
        Capability.SUBSCRIPTIONS_READ,
        Capability.SUBSCRIPTIONS_RENEW,
        Capability.SUBSCRIPTIONS_UPGRADE,
        Capability.USAGE_LOGS_CREATE,
        Capability.USAGE_LOGS_READ,
        Capability.SERVICE_PLANS_READ,
        Capability.STATIC_IP_READ,
        Capability.STATIC_IP_UPDATE,
      ],
    }
  });
  console.log('✅ Created Operations SUB_ADMIN:', operationsAdmin.username, `(${operationsAdmin.capabilities.length} capabilities)`);

  const readOnlyAdminPassword = await bcrypt.hash('readonly123', 10);
  const readOnlyAdmin = await prisma.user.create({
    data: {
      username: 'readonly_admin',
      email: 'readonly@wsp.com',
      passwordHash: readOnlyAdminPassword,
      role: UserRole.SUB_ADMIN,
      capabilities: [
        Capability.POS_READ,
        Capability.CLIENTS_READ,
        Capability.SUBSCRIPTIONS_READ,
        Capability.USAGE_LOGS_READ,
        Capability.INVOICES_READ,
        Capability.PAYMENTS_READ,
        Capability.SERVICE_PLANS_READ,
        Capability.STATIC_IP_READ,
        Capability.AUDIT_LOGS_READ,
        Capability.SUSPENSION_HISTORY_READ,
      ],
    }
  });
  console.log('✅ Created Read-Only SUB_ADMIN:', readOnlyAdmin.username, `(${readOnlyAdmin.capabilities.length} capabilities)`);

  // ============================================
  // 3. BANDWIDTH POOL
  // ============================================
  const bandwidthPool = await prisma.bandwidthPool.create({
    data: {
      totalWspBandwidthMbps: 10000, // 10 Gbps
      allocatedBandwidthMbps: 0,
      availableBandwidthMbps: 10000,
      usagePercentage: 0,
    }
  });
  console.log('✅ Created Bandwidth Pool:', bandwidthPool.totalWspBandwidthMbps, 'Mbps');

  // ============================================
  // 4. POS LOCATIONS
  // ============================================
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

  // ============================================
  // 5. POS MANAGERS
  // ============================================
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

  // ============================================
  // 6. SERVICE PLANS (Expanded)
  // ============================================
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
      },
      {
        planName: 'Family 25MB - Quarterly',
        serviceType: 'POSTPAID',
        durationType: 'QUARTERLY',
        durationDays: 90,
        cost: 200.00,
        downloadSpeedMbps: 25,
        uploadSpeedMbps: 12,
        dataCapacityGb: null,
        isActive: true,
        description: 'Quarterly plan for families'
      },
      {
        planName: 'Enterprise 200MB - Annual',
        serviceType: 'POSTPAID',
        durationType: 'ANNUAL',
        durationDays: 365,
        cost: 1500.00,
        downloadSpeedMbps: 200,
        uploadSpeedMbps: 100,
        dataCapacityGb: null,
        isActive: true,
        description: 'Annual enterprise plan with discount'
      },
      {
        planName: 'Prepaid 5MB - Daily',
        serviceType: 'PREPAID',
        durationType: 'HALF_MONTHLY',
        durationDays: 1,
        cost: 2.00,
        downloadSpeedMbps: 5,
        uploadSpeedMbps: 2,
        dataCapacityGb: 5,
        isActive: true,
        description: 'Daily prepaid plan'
      },
      {
        planName: 'Legacy 15MB - Monthly (Inactive)',
        serviceType: 'POSTPAID',
        durationType: 'MONTHLY',
        durationDays: 30,
        cost: 40.00,
        downloadSpeedMbps: 15,
        uploadSpeedMbps: 7,
        dataCapacityGb: null,
        isActive: false,
        description: 'Legacy plan no longer available for new subscriptions'
      }
    ]
  });
  const allPlans = await prisma.servicePlan.findMany();
  console.log('✅ Created Service Plans:', allPlans.length, 'plans');

  const planBasic10 = allPlans.find(p => p.planName.includes('Basic 10MB'));
  const planPremium50 = allPlans.find(p => p.planName.includes('Premium 50MB'));
  const planPrepaid20 = allPlans.find(p => p.planName.includes('Prepaid 20MB'));
  const planBusiness100 = allPlans.find(p => p.planName.includes('Business 100MB'));
  const planFamily25 = allPlans.find(p => p.planName.includes('Family 25MB'));

  // ============================================
  // 7. STATIC IP POOLS (with some assignments)
  // ============================================
  const staticIps1: any[] = [];
  for (let i = 10; i <= 50; i++) {
    staticIps1.push({
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
    data: staticIps1
  });
  const pos1Ips = await prisma.staticIpPool.findMany({ where: { posId: pos1.id } });
  console.log('✅ Created Static IP Pool for POS 1:', pos1Ips.length, 'IPs');

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
  const pos2Ips = await prisma.staticIpPool.findMany({ where: { posId: pos2.id } });
  console.log('✅ Created Static IP Pool for POS 2:', pos2Ips.length, 'IPs');

  // ============================================
  // 8. CLIENTS (with different statuses and connection types)
  // ============================================
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Client 1: ACTIVE with STATIC IP (will exceed data cap - throttling demo)
  const client1 = await prisma.client.create({
    data: {
      posId: pos1.id,
      fullName: 'Ahmed Hassan',
      phone: '07701111111',
      email: 'ahmed.hassan@email.com',
      address: '123 Main Street, Downtown',
      nationalId: '1234567890',
      connectionType: ConnectionType.STATIC,
      status: ClientStatus.ACTIVE,
      accountBalance: 150.00,
      autoRenewEnabled: true,
      createdAt: threeMonthsAgo,
    }
  });
  console.log('✅ Created Client 1 (ACTIVE, STATIC):', client1.fullName);

  // Assign static IP to client 1
  const staticIp1 = pos1Ips.find(ip => ip.ipAddress === '192.168.1.10');
  if (staticIp1) {
    await prisma.staticIpPool.update({
      where: { id: staticIp1.id },
      data: {
        clientId: client1.id,
        status: IpStatus.ASSIGNED,
        assignedAt: client1.createdAt,
      }
    });
  }

  // Client 2: ACTIVE with DYNAMIC
  const client2 = await prisma.client.create({
    data: {
      posId: pos1.id,
      fullName: 'Fatima Ali',
      phone: '07702222222',
      email: 'fatima.ali@email.com',
      address: '456 Oak Avenue, Downtown',
      nationalId: '0987654321',
      connectionType: ConnectionType.DYNAMIC,
      status: ClientStatus.ACTIVE,
      accountBalance: 80.00,
      autoRenewEnabled: true,
      createdAt: oneMonthAgo,
    }
  });
  console.log('✅ Created Client 2 (ACTIVE, DYNAMIC):', client2.fullName);

  // Client 3: ACTIVE with PPPOE
  const client3 = await prisma.client.create({
    data: {
      posId: pos1.id,
      fullName: 'Mohammed Khalil',
      phone: '07703333333',
      email: 'mohammed.khalil@email.com',
      address: '789 Pine Road, Downtown',
      pppoeUsername: 'client3_pppoe',
      pppoePassword: 'pppoe123',
      connectionType: ConnectionType.PPPOE,
      status: ClientStatus.ACTIVE,
      accountBalance: 200.00,
      autoRenewEnabled: false,
      createdAt: oneMonthAgo,
    }
  });
  console.log('✅ Created Client 3 (ACTIVE, PPPOE):', client3.fullName);

  // Client 4: SUSPENDED
  const client4 = await prisma.client.create({
    data: {
      posId: pos1.id,
      fullName: 'Sara Ibrahim',
      phone: '07704444444',
      email: 'sara.ibrahim@email.com',
      address: '321 Elm Street, Downtown',
      connectionType: ConnectionType.DYNAMIC,
      status: ClientStatus.SUSPENDED,
      accountBalance: -50.00, // Negative balance
      autoRenewEnabled: true,
      createdAt: threeMonthsAgo,
    }
  });
  console.log('✅ Created Client 4 (SUSPENDED):', client4.fullName);

  // Client 5: ACTIVE with STATIC IP (POS 2)
  const client5 = await prisma.client.create({
    data: {
      posId: pos2.id,
      fullName: 'Omar Farid',
      phone: '07705555555',
      email: 'omar.farid@email.com',
      address: '654 Maple Drive, North Branch',
      connectionType: ConnectionType.STATIC,
      status: ClientStatus.ACTIVE,
      accountBalance: 100.00,
      autoRenewEnabled: true,
      createdAt: oneMonthAgo,
    }
  });
  console.log('✅ Created Client 5 (ACTIVE, STATIC, POS2):', client5.fullName);

  // Assign static IP to client 5
  const staticIp5 = pos2Ips.find(ip => ip.ipAddress === '192.168.2.10');
  if (staticIp5) {
    await prisma.staticIpPool.update({
      where: { id: staticIp5.id },
      data: {
        clientId: client5.id,
        status: IpStatus.ASSIGNED,
        assignedAt: client5.createdAt,
      }
    });
  }

  // Client 6: ACTIVE with DYNAMIC (POS 2)
  const client6 = await prisma.client.create({
    data: {
      posId: pos2.id,
      fullName: 'Layla Mansour',
      phone: '07706666666',
      email: 'layla.mansour@email.com',
      address: '987 Cedar Lane, North Branch',
      connectionType: ConnectionType.DYNAMIC,
      status: ClientStatus.ACTIVE,
      accountBalance: 60.00,
      autoRenewEnabled: true,
      createdAt: oneMonthAgo,
    }
  });
  console.log('✅ Created Client 6 (ACTIVE, DYNAMIC, POS2):', client6.fullName);

  // Client 7: TERMINATED
  const client7 = await prisma.client.create({
    data: {
      posId: pos2.id,
      fullName: 'Youssef Nour',
      phone: '07707777777',
      email: 'youssef.nour@email.com',
      address: '147 Birch Way, North Branch',
      connectionType: ConnectionType.PPPOE,
      status: ClientStatus.TERMINATED,
      accountBalance: 0.00,
      autoRenewEnabled: false,
      createdAt: threeMonthsAgo,
    }
  });
  console.log('✅ Created Client 7 (TERMINATED):', client7.fullName);

  // Client 8: ACTIVE with PPPOE (will have pending request)
  const client8 = await prisma.client.create({
    data: {
      posId: pos2.id,
      fullName: 'Nour Hamdi',
      phone: '07708888888',
      email: 'nour.hamdi@email.com',
      address: '258 Spruce Court, North Branch',
      pppoeUsername: 'client8_pppoe',
      pppoePassword: 'pppoe456',
      connectionType: ConnectionType.PPPOE,
      status: ClientStatus.ACTIVE,
      accountBalance: 120.00,
      autoRenewEnabled: true,
      createdAt: oneMonthAgo,
    }
  });
  console.log('✅ Created Client 8 (ACTIVE, PPPOE, POS2):', client8.fullName);

  // Create CLIENT users for some clients (need these for PPPoE requests)
  const client1UserPassword = await bcrypt.hash('client123', 10);
  const client1User = await prisma.user.create({
    data: {
      username: 'client_ahmed',
      email: client1.email,
      passwordHash: client1UserPassword,
      role: UserRole.CLIENT,
      clientId: client1.id,
    }
  });

  const client3UserPassword = await bcrypt.hash('client123', 10);
  const client3User = await prisma.user.create({
    data: {
      username: 'client_mohammed',
      email: client3.email,
      passwordHash: client3UserPassword,
      role: UserRole.CLIENT,
      clientId: client3.id,
    }
  });

  const client5UserPassword = await bcrypt.hash('client123', 10);
  const client5User = await prisma.user.create({
    data: {
      username: 'client_omar',
      email: client5.email,
      passwordHash: client5UserPassword,
      role: UserRole.CLIENT,
      clientId: client5.id,
    }
  });

  const client6UserPassword = await bcrypt.hash('client123', 10);
  const client6User = await prisma.user.create({
    data: {
      username: 'client_layla',
      email: client6.email,
      passwordHash: client6UserPassword,
      role: UserRole.CLIENT,
      clientId: client6.id,
    }
  });

  const client8UserPassword = await bcrypt.hash('client123', 10);
  const client8User = await prisma.user.create({
    data: {
      username: 'client_nour',
      email: client8.email,
      passwordHash: client8UserPassword,
      role: UserRole.CLIENT,
      clientId: client8.id,
    }
  });
  console.log('✅ Created CLIENT users for 5 clients');

  // ============================================
  // 9. SUBSCRIPTIONS (various statuses)
  // ============================================
  const subscription1Start = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000); // 25 days ago
  const subscription1End = new Date(subscription1Start.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later
  const subscription1 = await prisma.subscription.create({
    data: {
      clientId: client1.id,
      planId: planPremium50!.id,
      startDate: subscription1Start,
      endDate: subscription1End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: true,
      bandwidthAllocatedMbps: planPremium50!.downloadSpeedMbps,
      originalBandwidthMbps: planPremium50!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 1 (ACTIVE, Premium 50MB, Client 1 - will exceed cap)');

  const subscription2Start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const subscription2End = new Date(subscription2Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription2 = await prisma.subscription.create({
    data: {
      clientId: client2.id,
      planId: planBasic10!.id,
      startDate: subscription2Start,
      endDate: subscription2End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: true,
      bandwidthAllocatedMbps: planBasic10!.downloadSpeedMbps,
      originalBandwidthMbps: planBasic10!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 2 (ACTIVE, Basic 10MB, Client 2)');

  const subscription3Start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const subscription3End = new Date(subscription3Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription3 = await prisma.subscription.create({
    data: {
      clientId: client3.id,
      planId: planPrepaid20!.id,
      startDate: subscription3Start,
      endDate: subscription3End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: false,
      bandwidthAllocatedMbps: planPrepaid20!.downloadSpeedMbps,
      originalBandwidthMbps: planPrepaid20!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 3 (ACTIVE, Prepaid 20MB, Client 3)');

  // Expired subscription
  const subscription4Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
  const subscription4End = new Date(subscription4Start.getTime() + 30 * 24 * 60 * 60 * 1000); // Expired 30 days ago
  const subscription4 = await prisma.subscription.create({
    data: {
      clientId: client4.id,
      planId: planBasic10!.id,
      startDate: subscription4Start,
      endDate: subscription4End,
      status: SubscriptionStatus.EXPIRED,
      isAutoRenewed: false,
      bandwidthAllocatedMbps: planBasic10!.downloadSpeedMbps,
      originalBandwidthMbps: planBasic10!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 4 (EXPIRED, Client 4)');

  const subscription5Start = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const subscription5End = new Date(subscription5Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription5 = await prisma.subscription.create({
    data: {
      clientId: client5.id,
      planId: planBusiness100!.id,
      startDate: subscription5Start,
      endDate: subscription5End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: true,
      bandwidthAllocatedMbps: planBusiness100!.downloadSpeedMbps,
      originalBandwidthMbps: planBusiness100!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 5 (ACTIVE, Business 100MB, Client 5)');

  const subscription6Start = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const subscription6End = new Date(subscription6Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription6 = await prisma.subscription.create({
    data: {
      clientId: client6.id,
      planId: planBasic10!.id,
      startDate: subscription6Start,
      endDate: subscription6End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: true,
      bandwidthAllocatedMbps: planBasic10!.downloadSpeedMbps,
      originalBandwidthMbps: planBasic10!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 6 (ACTIVE, Basic 10MB, Client 6)');

  // Terminated subscription
  const subscription7Start = new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000);
  const subscription7End = new Date(subscription7Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const subscription7 = await prisma.subscription.create({
    data: {
      clientId: client7.id,
      planId: planBasic10!.id,
      startDate: subscription7Start,
      endDate: subscription7End,
      status: SubscriptionStatus.TERMINATED,
      isAutoRenewed: false,
      bandwidthAllocatedMbps: planBasic10!.downloadSpeedMbps,
      originalBandwidthMbps: planBasic10!.downloadSpeedMbps,
    }
  });
  console.log('✅ Created Subscription 7 (TERMINATED, Client 7)');

  // Upgraded subscription (subscription was upgraded)
  // Old subscription (Basic) was upgraded TO new subscription (Premium)
  // So old subscription has upgradedToSubscriptionId pointing to new subscription
  const subscription8Start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const subscription8End = new Date(subscription8Start.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // Create new subscription first
  const subscription8New = await prisma.subscription.create({
    data: {
      clientId: client8.id,
      planId: planPremium50!.id,
      startDate: subscription8Start,
      endDate: subscription8End,
      status: SubscriptionStatus.ACTIVE,
      isAutoRenewed: true,
      bandwidthAllocatedMbps: planPremium50!.downloadSpeedMbps,
      originalBandwidthMbps: planPremium50!.downloadSpeedMbps,
    }
  });

  // Create old subscription with reference to new one
  const subscription8Old = await prisma.subscription.create({
    data: {
      clientId: client8.id,
      planId: planBasic10!.id,
      startDate: subscription8Start,
      endDate: subscription8End,
      status: SubscriptionStatus.TERMINATED,
      isAutoRenewed: false,
      bandwidthAllocatedMbps: planBasic10!.downloadSpeedMbps,
      originalBandwidthMbps: planBasic10!.downloadSpeedMbps,
      upgradedToSubscriptionId: subscription8New.id, // Old subscription upgraded TO new subscription
    }
  });
  console.log('✅ Created Subscription 8 (UPGRADED from Basic to Premium, Client 8)');

  // ============================================
  // 10. USAGE LOGS (demonstrate throttling for client 1)
  // ============================================
  // Client 1 (Premium 50MB plan - unlimited) - for throttling demo, we'll use Prepaid plan logic
  // Note: Premium plan has unlimited data, but we'll simulate high usage for demo purposes
  // In real scenario, throttling only applies to prepaid plans with dataCapacityGb limits
  const subscription1PeriodStart = subscription1Start;
  const daysSinceStart = Math.floor((now.getTime() - subscription1PeriodStart.getTime()) / (24 * 60 * 60 * 1000));
  
  // Create usage logs - total ~110GB over 25 days (average 4.4GB/day)
  for (let i = 0; i < daysSinceStart; i++) {
    const logDate = new Date(subscription1PeriodStart.getTime() + i * 24 * 60 * 60 * 1000);
    const downloadMb = 3500 + Math.random() * 1500; // 3.5-5GB per day
    const uploadMb = downloadMb * 0.2; // 20% of download
    await prisma.usageLog.create({
      data: {
        subscriptionId: subscription1.id,
        downloadMb: downloadMb,
        uploadMb: uploadMb,
        logDate: logDate,
      }
    });
  }
  console.log(`✅ Created ${daysSinceStart} Usage Logs for Subscription 1 (exceeded data cap - throttled)`);

  // Normal usage for other active subscriptions
  for (let i = 0; i < 10; i++) {
    const logDate = new Date(subscription2Start.getTime() + i * 24 * 60 * 60 * 1000);
    await prisma.usageLog.create({
      data: {
        subscriptionId: subscription2.id,
        downloadMb: 800 + Math.random() * 400, // 0.8-1.2GB per day
        uploadMb: 150 + Math.random() * 100,
        logDate: logDate,
      }
    });
  }

  for (let i = 0; i < 15; i++) {
    const logDate = new Date(subscription3Start.getTime() + i * 24 * 60 * 60 * 1000);
    await prisma.usageLog.create({
      data: {
        subscriptionId: subscription3.id,
        downloadMb: 2000 + Math.random() * 1000, // 2-3GB per day
        uploadMb: 400 + Math.random() * 200,
        logDate: logDate,
      }
    });
  }

  for (let i = 0; i < 20; i++) {
    const logDate = new Date(subscription5Start.getTime() + i * 24 * 60 * 60 * 1000);
    await prisma.usageLog.create({
      data: {
        subscriptionId: subscription5.id,
        downloadMb: 5000 + Math.random() * 2000, // 5-7GB per day
        uploadMb: 1000 + Math.random() * 500,
        logDate: logDate,
      }
    });
  }
  console.log('✅ Created Usage Logs for other subscriptions');

  // ============================================
  // 11. INVOICES (various statuses)
  // ============================================
  // Paid invoices
  // Use timestamp to ensure unique invoice numbers
  const baseTimestamp = Date.now();
  const invoice1 = await prisma.invoice.create({
    data: {
      clientId: client1.id,
      subscriptionId: subscription1.id,
      invoiceNumber: `INV-${baseTimestamp}-001`,
      amount: planPremium50!.cost,
      issueDate: subscription1Start,
      dueDate: new Date(subscription1Start.getTime() + 15 * 24 * 60 * 60 * 1000),
      notes: 'Monthly subscription invoice',
    }
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      clientId: client2.id,
      subscriptionId: subscription2.id,
      invoiceNumber: `INV-${baseTimestamp}-002`,
      amount: planBasic10!.cost,
      issueDate: subscription2Start,
      dueDate: new Date(subscription2Start.getTime() + 15 * 24 * 60 * 60 * 1000),
    }
  });

  const invoice3 = await prisma.invoice.create({
    data: {
      clientId: client5.id,
      subscriptionId: subscription5.id,
      invoiceNumber: `INV-${baseTimestamp}-003`,
      amount: planBusiness100!.cost,
      issueDate: subscription5Start,
      dueDate: new Date(subscription5Start.getTime() + 15 * 24 * 60 * 60 * 1000),
    }
  });

  // Unpaid invoice
  const invoice4 = await prisma.invoice.create({
    data: {
      clientId: client3.id,
      subscriptionId: subscription3.id,
      invoiceNumber: `INV-${baseTimestamp}-004`,
      amount: planPrepaid20!.cost,
      issueDate: subscription3Start,
      dueDate: new Date(subscription3Start.getTime() + 7 * 24 * 60 * 60 * 1000),
    }
  });

  // Overdue invoice
  const invoice5 = await prisma.invoice.create({
    data: {
      clientId: client4.id,
      subscriptionId: subscription4.id,
      invoiceNumber: `INV-${baseTimestamp}-005`,
      amount: planBasic10!.cost,
      issueDate: subscription4Start,
      dueDate: new Date(subscription4Start.getTime() + 15 * 24 * 60 * 60 * 1000), // Overdue
    }
  });

  // Additional invoices
  const invoice6 = await prisma.invoice.create({
    data: {
      clientId: client6.id,
      subscriptionId: subscription6.id,
      invoiceNumber: `INV-${baseTimestamp}-006`,
      amount: planBasic10!.cost,
      issueDate: subscription6Start,
      dueDate: new Date(subscription6Start.getTime() + 15 * 24 * 60 * 60 * 1000),
    }
  });

  const invoice7 = await prisma.invoice.create({
    data: {
      clientId: client8.id,
      subscriptionId: subscription8New.id,
      invoiceNumber: `INV-${baseTimestamp}-007`,
      amount: planPremium50!.cost,
      issueDate: subscription8Start,
      dueDate: new Date(subscription8Start.getTime() + 15 * 24 * 60 * 60 * 1000),
    }
  });

  // Past paid invoices
  const invoice8 = await prisma.invoice.create({
    data: {
      clientId: client1.id,
      invoiceNumber: `INV-${baseTimestamp}-008`,
      amount: 50.00,
      issueDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      notes: 'Additional service charge',
    }
  });

  const invoice9 = await prisma.invoice.create({
    data: {
      clientId: client5.id,
      invoiceNumber: `INV-${baseTimestamp}-009`,
      amount: 25.00,
      issueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      notes: 'Installation fee',
    }
  });
  console.log('✅ Created 9 Invoices (paid, unpaid, overdue)');

  // ============================================
  // 12. PAYMENTS (various methods)
  // ============================================
  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      paymentReference: 'PAY-001',
      amountPaid: planPremium50!.cost,
      extraAmount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDate: new Date(subscription1Start.getTime() + 2 * 24 * 60 * 60 * 1000),
      receivedBy: admin.id,
      notes: 'Full payment via bank transfer',
    }
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice2.id,
      paymentReference: 'PAY-002',
      amountPaid: planBasic10!.cost,
      extraAmount: 0,
      paymentMethod: PaymentMethod.CASH,
      paymentDate: new Date(subscription2Start.getTime() + 1 * 24 * 60 * 60 * 1000),
      receivedBy: posManager1.id,
      notes: 'Cash payment at POS',
    }
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice3.id,
      paymentReference: 'PAY-003',
      amountPaid: planBusiness100!.cost,
      extraAmount: 0,
      paymentMethod: PaymentMethod.CARD,
      paymentDate: new Date(subscription5Start.getTime() + 3 * 24 * 60 * 60 * 1000),
      receivedBy: financeAdmin.id,
      notes: 'Card payment processed',
    }
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice6.id,
      paymentReference: 'PAY-004',
      amountPaid: planBasic10!.cost,
      extraAmount: 0,
      paymentMethod: PaymentMethod.ONLINE,
      paymentDate: new Date(subscription6Start.getTime() + 1 * 24 * 60 * 60 * 1000),
      receivedBy: admin.id,
    }
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice7.id,
      paymentReference: 'PAY-005',
      amountPaid: planPremium50!.cost,
      extraAmount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDate: new Date(subscription8Start.getTime() + 2 * 24 * 60 * 60 * 1000),
      receivedBy: posManager2.id,
    }
  });

  // Partial payment with extra amount
  await prisma.payment.create({
    data: {
      invoiceId: invoice8.id,
      paymentReference: 'PAY-006',
      amountPaid: 50.00,
      extraAmount: 10.00,
      paymentMethod: PaymentMethod.CASH,
      paymentDate: new Date(now.getTime() - 58 * 24 * 60 * 60 * 1000),
      receivedBy: posManager1.id,
      notes: 'Partial payment with extra amount (credit balance)',
    }
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice9.id,
      paymentReference: 'PAY-007',
      amountPaid: 25.00,
      extraAmount: 0,
      paymentMethod: PaymentMethod.CARD,
      paymentDate: new Date(now.getTime() - 43 * 24 * 60 * 60 * 1000),
      receivedBy: financeAdmin.id,
    }
  });

  // Multiple payments for one invoice (installment)
  await prisma.payment.create({
    data: {
      invoiceId: invoice3.id,
      paymentReference: 'PAY-008',
      amountPaid: 75.00,
      extraAmount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDate: new Date(subscription5Start.getTime() + 5 * 24 * 60 * 60 * 1000),
      receivedBy: admin.id,
      notes: 'First installment',
    }
  });
  console.log('✅ Created 8 Payments (various methods and scenarios)');

  // ============================================
  // 13. PPPOE CHANGE REQUESTS (all statuses)
  // Only create for clients with PPPOE connection type
  // ============================================
  const pppoeRequest1 = await prisma.pppoeChangeRequest.create({
    data: {
      clientId: client8.id,
      currentUsername: 'client8_pppoe',
      newUsername: 'client8_new_pppoe',
      newPassword: 'newpass123',
      status: RequestStatus.PENDING,
      reason: 'Client requested username change',
      requestedBy: client8User.id, // User ID, not client ID
      requestedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('✅ Created PPPoE Request 1 (PENDING, Client 8)');

  const pppoeRequest2 = await prisma.pppoeChangeRequest.create({
    data: {
      clientId: client3.id,
      currentUsername: 'client3_pppoe',
      newUsername: 'client3_new_pppoe',
      newPassword: 'newpass456',
      status: RequestStatus.APPROVED,
      reason: 'Approved username change',
      requestedBy: client3User.id, // User ID
      approvedBy: posManager1.id,
      requestedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      processedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('✅ Created PPPoE Request 2 (APPROVED, Client 3)');

  // Create additional PPPoE requests for client 3 (historical)
  const pppoeRequest3 = await prisma.pppoeChangeRequest.create({
    data: {
      clientId: client3.id,
      currentUsername: 'client3_pppoe',
      newUsername: 'client3_another',
      newPassword: 'newpass789',
      status: RequestStatus.REJECTED,
      reason: 'Invalid username format',
      requestedBy: client3User.id,
      approvedBy: admin.id,
      requestedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      processedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('✅ Created PPPoE Request 3 (REJECTED, Client 3)');

  const pppoeRequest4 = await prisma.pppoeChangeRequest.create({
    data: {
      clientId: client8.id,
      currentUsername: 'client8_pppoe',
      newUsername: 'client8_completed',
      newPassword: 'newpass999',
      status: RequestStatus.COMPLETED,
      reason: 'Completed successfully',
      requestedBy: client8User.id,
      approvedBy: operationsAdmin.id,
      requestedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      processedAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('✅ Created PPPoE Request 4 (COMPLETED, Client 8)');

  const pppoeRequest5 = await prisma.pppoeChangeRequest.create({
    data: {
      clientId: client8.id,
      currentUsername: 'client8_pppoe',
      newUsername: 'client8_pending2',
      newPassword: 'newpass111',
      status: RequestStatus.PENDING,
      reason: 'Client requested password reset',
      requestedBy: client8User.id,
      requestedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('✅ Created PPPoE Request 5 (PENDING, Client 8)');

  // ============================================
  // 14. SUSPENSION HISTORY
  // ============================================
  // Client 4 was suspended and reactivated
  const suspension1 = await prisma.suspensionHistory.create({
    data: {
      clientId: client4.id,
      suspensionReason: SuspensionReason.NON_PAYMENT,
      reasonDetails: 'Overdue invoice payment',
      suspendedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      reactivatedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      suspendedBy: admin.id,
      reactivatedBy: admin.id,
    }
  });
  console.log('✅ Created Suspension History 1 (suspended & reactivated - NON_PAYMENT)');

  // Client 4 suspended again (currently suspended)
  const suspension2 = await prisma.suspensionHistory.create({
    data: {
      clientId: client4.id,
      suspensionReason: SuspensionReason.NON_PAYMENT,
      reasonDetails: 'Multiple overdue invoices',
      suspendedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      suspendedBy: financeAdmin.id,
      // Not reactivated yet
    }
  });
  console.log('✅ Created Suspension History 2 (currently suspended - NON_PAYMENT)');

  // Client 1 was suspended for violation but reactivated
  const suspension3 = await prisma.suspensionHistory.create({
    data: {
      clientId: client1.id,
      suspensionReason: SuspensionReason.VIOLATION,
      reasonDetails: 'Temporary suspension due to terms violation',
      suspendedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      reactivatedAt: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000),
      suspendedBy: operationsAdmin.id,
      reactivatedBy: admin.id,
    }
  });
  console.log('✅ Created Suspension History 3 (suspended & reactivated - VIOLATION)');

  // Client 5 was suspended for maintenance
  const suspension4 = await prisma.suspensionHistory.create({
    data: {
      clientId: client5.id,
      suspensionReason: SuspensionReason.MAINTENANCE,
      reasonDetails: 'Scheduled network maintenance',
      suspendedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      reactivatedAt: new Date(now.getTime() - 44 * 24 * 60 * 60 * 1000),
      suspendedBy: operationsAdmin.id,
      reactivatedBy: operationsAdmin.id,
    }
  });
  console.log('✅ Created Suspension History 4 (suspended & reactivated - MAINTENANCE)');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Comprehensive database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('\n👤 Admin Users:');
  console.log('  WSP Admin:');
  console.log('    Username: admin');
  console.log('    Password: admin123');
  console.log('\n  Finance SUB_ADMIN:');
  console.log('    Username: finance_admin');
  console.log('    Password: finance123');
  console.log('    Capabilities: Financial management (invoices, payments)');
  console.log('\n  Operations SUB_ADMIN:');
  console.log('    Username: operations_admin');
  console.log('    Password: operations123');
  console.log('    Capabilities: Clients, subscriptions, operations');
  console.log('\n  Read-Only SUB_ADMIN:');
  console.log('    Username: readonly_admin');
  console.log('    Password: readonly123');
  console.log('    Capabilities: Read-only access');
  console.log('\n👥 POS Managers:');
  console.log('  POS Manager 1 (Downtown):');
  console.log('    Username: pos_manager_1');
  console.log('    Password: manager123');
  console.log('\n  POS Manager 2 (North Branch):');
  console.log('    Username: pos_manager_2');
  console.log('    Password: manager123');
  console.log('\n👤 Client Users:');
  console.log('  Client Ahmed:');
  console.log('    Username: client_ahmed');
  console.log('    Password: client123');
  console.log('    Note: This client has exceeded data cap (throttled)');
  console.log('\n  Client Mohammed:');
  console.log('    Username: client_mohammed');
  console.log('    Password: client123');
  console.log('\n  Client Omar:');
  console.log('    Username: client_omar');
  console.log('    Password: client123');
  console.log('\n  Client Layla:');
  console.log('    Username: client_layla');
  console.log('    Password: client123');
  console.log('\n  Client Nour:');
  console.log('    Username: client_nour');
  console.log('    Password: client123');
  console.log('\n📊 Data Summary:');
  console.log(`  - Users: ${await prisma.user.count()}`);
  console.log(`  - POS Locations: ${await prisma.pOS.count()}`);
  console.log(`  - Clients: ${await prisma.client.count()}`);
  console.log(`  - Service Plans: ${await prisma.servicePlan.count()}`);
  console.log(`  - Subscriptions: ${await prisma.subscription.count()}`);
  console.log(`  - Static IPs: ${await prisma.staticIpPool.count()}`);
  console.log(`  - Usage Logs: ${await prisma.usageLog.count()}`);
  console.log(`  - Invoices: ${await prisma.invoice.count()}`);
  console.log(`  - Payments: ${await prisma.payment.count()}`);
  console.log(`  - PPPoE Requests: ${await prisma.pppoeChangeRequest.count()}`);
  console.log(`  - Suspension History: ${await prisma.suspensionHistory.count()}`);
  console.log('\n✨ Key Features Demonstrated:');
  console.log('  ✅ SUB_ADMIN with different capability sets');
  console.log('  ✅ Client with throttling (exceeded data cap)');
  console.log('  ✅ Various subscription statuses (ACTIVE, EXPIRED, TERMINATED)');
  console.log('  ✅ Upgraded subscription relationship');
  console.log('  ✅ All invoice statuses (paid, unpaid, overdue)');
  console.log('  ✅ Multiple payment methods');
  console.log('  ✅ All PPPoE request statuses');
  console.log('  ✅ Suspension history with different reasons');
  console.log('  ✅ Static IP assignments');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
