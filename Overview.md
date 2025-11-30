# 📘 WSP System — API Modules, Endpoints & DTOs Documentation

**Version:** 1.0  
**Author:** Faisal Fansa  
**System:** Wireless Service Provider Management System (WSPMS)

## 🏛️ Overview

This document lists the bare-minimum, state-of-the-art NestJS modules, their required endpoints, and the DTO structures necessary to fully implement the WSP system according to the business rules and specifications.

This list is complete, production-ready, and maps exactly to the system scenarios.

## 📂 Modules List

- `auth/`
- `users/`
- `pos/`
- `clients/`
- `static-ip/`
- `service-plans/`
- `subscriptions/`
- `usage-logs/`
- `invoices/`
- `payments/`
- `bandwidth-pool/`
- `pppoe-requests/`
- `suspension/`
- `audit/`
- `common/`
- `database/`

## 🧩 MODULES + ENDPOINTS + DTOS

### 1️⃣ AUTH MODULE

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Authenticate user |
| POST | `/auth/logout` | Logout user |
| POST | `/auth/refresh` | Refresh access token |

#### DTOs

**LoginDto**

```typescript
{
  username: string;
  password: string;
}
```

**RefreshDto**

```typescript
{
  refreshToken: string;
}
```

### 2️⃣ USERS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/users` |
| GET | `/users` |
| GET | `/users/:id` |
| PATCH | `/users/:id` |
| PATCH | `/users/:id/activate` |
| PATCH | `/users/:id/deactivate` |

#### DTOs

**CreateUserDto**

```typescript
{
  username: string;
  email: string;
  password: string;
  role: 'WSP_ADMIN' | 'POS_MANAGER' | 'CLIENT';
  posId?: string;
  clientId?: string;
}
```

**UpdateUserDto**

```typescript
{
  email?: string;
  password?: string;
  posId?: string;
  clientId?: string;
}
```

### 3️⃣ POS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/pos` |
| GET | `/pos` |
| GET | `/pos/:id` |
| PATCH | `/pos/:id` |
| PATCH | `/pos/:id/activate` |
| PATCH | `/pos/:id/deactivate` |
| PATCH | `/pos/:id/bandwidth` |
| GET | `/pos/:id/clients` |
| GET | `/pos/:id/managers` |
| POST | `/pos/:id/managers` |
| DELETE | `/pos/:id/managers/:userId` |

#### DTOs

**CreatePosDto**

```typescript
{
  name: string;
  location: string;
  contactPhone?: string;
  allocatedBandwidthMbps: number;
}
```

**UpdatePosDto**

```typescript
{
  name?: string;
  location?: string;
  contactPhone?: string;
}
```

**UpdatePosBandwidthDto**

```typescript
{
  allocatedBandwidthMbps: number;
}
```

**AssignManagerDto**

```typescript
{
  userId: string;
}
```

### 4️⃣ CLIENTS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/clients` |
| GET | `/clients` |
| GET | `/clients/:id` |
| PATCH | `/clients/:id` |
| PATCH | `/clients/:id/activate` |
| PATCH | `/clients/:id/suspend` |
| PATCH | `/clients/:id/terminate` |
| PATCH | `/clients/:id/connection-type` |
| POST | `/clients/:id/static-ip/assign` |
| PATCH | `/clients/:id/static-ip/release` |

#### DTOs

**CreateClientDto**

```typescript
{
  fullName: string;
  phone: string;
  email: string;
  address: string;
  nationalId?: string;
  posId: string;
  connectionType: 'STATIC' | 'DYNAMIC' | 'PPPOE';
  staticIpId?: string;
  pppoeUsername?: string;
  pppoePassword?: string;
}
```

**UpdateClientDto**

```typescript
{
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  connectionType?: string;
}
```

**UpdateConnectionTypeDto**

```typescript
{
  connectionType: 'STATIC' | 'DYNAMIC' | 'PPPOE';
  staticIpId?: string;
  pppoeUsername?: string;
  pppoePassword?: string;
}
```

**AssignStaticIpDto**

```typescript
{
  ipId: string;
}
```

### 5️⃣ STATIC IP MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/static-ip` |
| GET | `/static-ip` |
| GET | `/static-ip/:id` |
| PATCH | `/static-ip/:id` |
| PATCH | `/static-ip/:id/release` |

#### DTOs

**CreateStaticIpDto**

```typescript
{
  posId: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsPrimary?: string;
  dnsSecondary?: string;
}
```

### 6️⃣ SERVICE PLANS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/service-plans` |
| GET | `/service-plans` |
| GET | `/service-plans/:id` |
| PATCH | `/service-plans/:id` |
| PATCH | `/service-plans/:id/activate` |
| PATCH | `/service-plans/:id/deactivate` |

#### DTOs

**CreateServicePlanDto**

```typescript
{
  planName: string;
  serviceType: 'PREPAID' | 'POSTPAID';
  durationType: string;
  durationDays: number;
  cost: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  dataCapacityGb?: number;
}
```

**UpdateServicePlanDto**

```typescript
{
  planName?: string;
  cost?: number;
  downloadSpeedMbps?: number;
  uploadSpeedMbps?: number;
  dataCapacityGb?: number;
}
```

### 7️⃣ SUBSCRIPTIONS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/subscriptions` |
| POST | `/subscriptions/:id/renew` |
| POST | `/subscriptions/:id/upgrade` |
| GET | `/subscriptions` |
| GET | `/subscriptions/:id` |
| PATCH | `/subscriptions/:id/terminate` |
| POST | `/subscriptions/:id/usage-log` |
| GET | `/subscriptions/:id/usage-log` |

#### DTOs

**CreateSubscriptionDto**

```typescript
{
  clientId: string;
  planId: string;
  startDate: string;
}
```

**RenewSubscriptionDto**

```typescript
{
  renewalDate: string;
}
```

**UpgradeSubscriptionDto**

```typescript
{
  newPlanId: string;
}
```

**CreateUsageLogDto**

```typescript
{
  downloadMb: number;
  uploadMb: number;
  logDate: string;
}
```

### 8️⃣ USAGE LOGS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/usage-logs` |
| GET | `/usage-logs` |

#### DTOs

Same as `CreateUsageLogDto`.

### 9️⃣ INVOICES MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/invoices` |
| GET | `/invoices` |
| GET | `/invoices/:id` |
| PATCH | `/invoices/:id/cancel` |

#### DTOs

**CreateInvoiceDto**

```typescript
{
  clientId: string;
  subscriptionId?: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  notes?: string;
}
```

### 🔟 PAYMENTS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/payments` |
| GET | `/payments` |
| GET | `/payments/:id` |

#### DTOs

**CreatePaymentDto**

```typescript
{
  invoiceId: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE';
  paymentReference?: string;
  notes?: string;
}
```

### 1️⃣1️⃣ BANDWIDTH POOL MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| GET | `/bandwidth-pool` |
| PATCH | `/bandwidth-pool` |

#### DTOs

**UpdateBandwidthPoolDto**

```typescript
{
  totalWspBandwidthMbps: number;
}
```

### 1️⃣2️⃣ PPPOE REQUESTS MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| POST | `/pppoe-requests` |
| GET | `/pppoe-requests` |
| GET | `/pppoe-requests/:id` |
| PATCH | `/pppoe-requests/:id/approve` |
| PATCH | `/pppoe-requests/:id/reject` |
| PATCH | `/pppoe-requests/:id/complete` |

#### DTOs

**CreatePppoeRequestDto**

```typescript
{
  clientId: string;
  newUsername: string;
  newPassword: string;
  reason?: string;
}
```

**ApprovalDto**

```typescript
{
  approvedBy: string;
}
```

### 1️⃣3️⃣ SUSPENSION MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| GET | `/suspension` |
| GET | `/suspension/:id` |

#### DTOs

Automatically generated from client suspend/reactivate actions.

### 1️⃣4️⃣ AUDIT LOG MODULE

#### Endpoints

| Method | Endpoint |
|--------|----------|
| GET | `/audit` |
| GET | `/audit/:id` |

#### DTOs

No DTOs required (read-only).
