# WSP Backend - Complete Use Cases Flow

## Table of Contents
1. [User Roles Overview](#user-roles-overview)
2. [WSP_ADMIN Use Cases](#wsp_admin-use-cases)
3. [SUB_ADMIN Use Cases](#sub_admin-use-cases)
4. [POS_MANAGER Use Cases](#pos_manager-use-cases)
5. [CLIENT Use Cases](#client-use-cases)
6. [Complete Day-to-Day Flows](#complete-day-to-day-flows)
7. [Connection Type Specific Flows](#connection-type-specific-flows)

---

## User Roles Overview

### Role Hierarchy
```
WSP_ADMIN (Full System Access)
    ↓
SUB_ADMIN (Capability-Based Access)
    ↓
POS_MANAGER (POS-Scoped Access)
    ↓
CLIENT (Self-Service Access)
```

### Role Capabilities Matrix

| Capability | WSP_ADMIN | SUB_ADMIN | POS_MANAGER | CLIENT |
|------------|-----------|-----------|-------------|--------|
| POS Management | ✅ Full | ✅ If granted | ❌ | ❌ |
| Client Management | ✅ All POS | ✅ If granted | ✅ Own POS | ❌ |
| Subscription Management | ✅ All | ✅ If granted | ✅ Own POS | ❌ |
| Invoice Management | ✅ All | ✅ If granted | ❌ | ❌ |
| Payment Management | ✅ All | ✅ If granted | ✅ Own POS | ❌ |
| Usage Logs | ✅ All | ✅ If granted | ✅ Own POS | ❌ |
| Service Plans | ✅ Full | ✅ If granted | ❌ | ❌ |
| Static IP Management | ✅ All | ✅ If granted | ✅ Own POS | ❌ |
| Bandwidth Pool | ✅ Full | ✅ If granted | ❌ | ❌ |
| User Management | ✅ Full | ✅ If granted | ❌ | ❌ |
| PPPoE Requests | ✅ All | ✅ If granted | ✅ Own POS | ✅ Own |
| Audit Logs | ✅ All | ✅ If granted | ✅ Own POS | ❌ |
| View Own Data | ✅ | ✅ | ✅ | ✅ |

---

## WSP_ADMIN Use Cases

### UC-1: System Initialization

#### UC-1.1: Create POS Location
**Actor:** WSP_ADMIN  
**Preconditions:** 
- User logged in as WSP_ADMIN
- Bandwidth pool exists

**Flow:**
1. WSP_ADMIN navigates to POS management
2. Creates new POS with:
   - Name, location, contact phone
   - Allocated bandwidth (validated against pool)
3. System validates bandwidth availability
4. POS created and activated
5. Audit log created

**Postconditions:**
- POS created and active
- Bandwidth allocated
- Audit log recorded

**Exception Flows:**
- E1: Insufficient bandwidth → Error: "Bandwidth pool insufficient"
- E2: Invalid data → Validation error

---

#### UC-1.2: Create Service Plan
**Actor:** WSP_ADMIN  
**Preconditions:** User logged in as WSP_ADMIN

**Flow:**
1. WSP_ADMIN creates service plan with:
   - Plan name, description
   - Service type: PREPAID (enforced)
   - Duration type (MONTHLY, QUARTERLY, etc.)
   - Cost, speeds, data capacity
2. System validates all fields
3. Service plan created and activated
4. Audit log created

**Postconditions:**
- Service plan available for subscriptions
- Audit log recorded

---

#### UC-1.3: Create Static IP Pool
**Actor:** WSP_ADMIN  
**Preconditions:** POS exists

**Flow:**
1. WSP_ADMIN selects POS
2. Creates static IP entries with:
   - IP address, subnet mask, gateway
   - DNS servers
   - Status: AVAILABLE
3. System validates IP uniqueness
4. Static IPs added to pool
5. Audit log created

**Postconditions:**
- Static IPs available for assignment
- Audit log recorded

---

#### UC-1.4: Configure Bandwidth Pool
**Actor:** WSP_ADMIN  
**Preconditions:** User logged in as WSP_ADMIN

**Flow:**
1. WSP_ADMIN views current bandwidth pool
2. Updates total bandwidth capacity
3. System recalculates:
   - Allocated bandwidth
   - Available bandwidth
   - Usage percentage
4. Bandwidth pool updated
5. Audit log created

**Postconditions:**
- Bandwidth pool updated
- All calculations refreshed

---

#### UC-1.5: Create User Account
**Actor:** WSP_ADMIN  
**Preconditions:** User logged in as WSP_ADMIN

**Flow:**
1. WSP_ADMIN creates user with:
   - Username, email, password
   - Role (WSP_ADMIN, SUB_ADMIN, POS_MANAGER, CLIENT)
   - Capabilities (for SUB_ADMIN)
   - POS assignment (for POS_MANAGER)
   - Client assignment (for CLIENT)
2. System validates:
   - Username/email uniqueness
   - Role constraints
   - POS/Client assignments
3. User account created
4. Audit log created

**Postconditions:**
- User account active
- User can log in
- Audit log recorded

**Exception Flows:**
- E1: WSP_ADMIN assigned to POS → Error: "WSP_ADMIN cannot be assigned to POS"
- E2: Duplicate username/email → Error: "Username/email already exists"

---

### UC-2: System-Wide Management

#### UC-2.1: View All Clients
**Actor:** WSP_ADMIN  
**Preconditions:** User logged in as WSP_ADMIN

**Flow:**
1. WSP_ADMIN views client list
2. Can filter by:
   - POS location
   - Connection type (STATIC/DYNAMIC/PPPOE)
   - Status (ACTIVE/SUSPENDED/TERMINATED)
3. Views client details:
   - Personal information
   - Connection type and details
   - Active subscriptions
   - Payment history
   - Usage statistics

**Postconditions:**
- Client information displayed

---

#### UC-2.2: Suspend Any Client
**Actor:** WSP_ADMIN  
**Preconditions:** Client exists and is ACTIVE

**Flow:**
1. WSP_ADMIN selects client
2. Provides suspension reason:
   - NON_PAYMENT
   - VIOLATION
   - MAINTENANCE
   - OTHER
3. System:
   - Updates client status to SUSPENDED
   - Creates suspension history record
   - Blocks usage logging
4. Audit log created

**Postconditions:**
- Client suspended
- Service disconnected
- Suspension history recorded

---

#### UC-2.3: View System-Wide Reports
**Actor:** WSP_ADMIN  
**Preconditions:** User logged in as WSP_ADMIN

**Flow:**
1. WSP_ADMIN accesses reports section
2. Views:
   - Total clients by POS
   - Active subscriptions count
   - Revenue by POS/period
   - Bandwidth utilization
   - Connection type distribution
   - Payment statistics
3. Can export reports

**Postconditions:**
- Reports displayed/exported

---

## SUB_ADMIN Use Cases

### UC-3: Delegated Administration

#### UC-3.1: Manage Clients (If Granted)
**Actor:** SUB_ADMIN  
**Preconditions:** 
- User logged in as SUB_ADMIN
- Has CLIENTS_CREATE capability

**Flow:**
1. SUB_ADMIN creates/updates clients
2. Same flow as POS_MANAGER but across all POS
3. System validates capabilities
4. Audit log created

**Postconditions:**
- Client managed
- Audit log recorded

---

#### UC-3.2: Manage Subscriptions (If Granted)
**Actor:** SUB_ADMIN  
**Preconditions:** 
- User logged in as SUB_ADMIN
- Has SUBSCRIPTIONS_CREATE capability

**Flow:**
1. SUB_ADMIN creates subscriptions for any client
2. Same flow as POS_MANAGER but across all POS
3. System validates capabilities
4. Invoice auto-generated
5. Audit log created

**Postconditions:**
- Subscription created
- Invoice generated
- Audit log recorded

---

## POS_MANAGER Use Cases

### UC-4: Client Management

#### UC-4.1: Create STATIC Client
**Actor:** POS_MANAGER  
**Preconditions:** 
- User logged in as POS_MANAGER
- Static IP available in POS pool

**Flow:**
1. Client visits booth
2. POS_MANAGER collects client information:
   - Full name, phone, email, address
   - National ID (optional)
3. POS_MANAGER selects:
   - Connection type: STATIC
   - Static IP from available pool
4. System validates:
   - Email uniqueness
   - Static IP availability
   - Static IP belongs to POS
5. Client created with:
   - connectionType: STATIC
   - staticIp assigned
   - status: ACTIVE
6. Audit log created

**Postconditions:**
- STATIC client created
- Static IP assigned and marked ASSIGNED
- Client ready for subscription

**Exception Flows:**
- E1: No static IP available → Error: "No static IPs available in this POS"
- E2: Email exists → Error: "Email already exists"
- E3: Static IP not in POS → Error: "Static IP must belong to your POS"

---

#### UC-4.2: Create DYNAMIC Client
**Actor:** POS_MANAGER  
**Preconditions:** User logged in as POS_MANAGER

**Flow:**
1. Client visits booth
2. POS_MANAGER collects client information
3. POS_MANAGER selects:
   - Connection type: DYNAMIC
4. System validates:
   - Email uniqueness
   - No special requirements for DYNAMIC
5. Client created with:
   - connectionType: DYNAMIC
   - status: ACTIVE
6. Audit log created

**Postconditions:**
- DYNAMIC client created
- Client ready for subscription

---

#### UC-4.3: Create PPPOE Client
**Actor:** POS_MANAGER  
**Preconditions:** User logged in as POS_MANAGER

**Flow:**
1. Client visits booth
2. POS_MANAGER collects client information
3. POS_MANAGER selects:
   - Connection type: PPPOE
   - PPPoE username
   - PPPoE password
4. System validates:
   - Email uniqueness
   - PPPoE username uniqueness
   - Credentials provided
5. Client created with:
   - connectionType: PPPOE
   - pppoeUsername and pppoePassword set
   - status: ACTIVE
6. Audit log created

**Postconditions:**
- PPPOE client created
- Credentials stored
- Client ready for subscription

**Exception Flows:**
- E1: PPPoE username exists → Error: "PPPoE username already exists"
- E2: Missing credentials → Error: "PPPoE credentials required"

---

#### UC-4.4: Update Client Information
**Actor:** POS_MANAGER  
**Preconditions:** Client exists in POS_MANAGER's POS

**Flow:**
1. POS_MANAGER selects client
2. Updates information:
   - Personal details
   - Contact information
   - Auto-renewal preference
3. System validates:
   - Email uniqueness (if changed)
   - POS scope (can only update own POS clients)
4. Client updated
5. Audit log created

**Postconditions:**
- Client information updated
- Audit log recorded

---

#### UC-4.5: Suspend Client
**Actor:** POS_MANAGER  
**Preconditions:** 
- Client exists in POS_MANAGER's POS
- Client is ACTIVE

**Flow:**
1. POS_MANAGER selects client
2. Provides suspension reason
3. System:
   - Updates client status to SUSPENDED
   - Creates suspension history
   - Blocks usage logging
4. Audit log created

**Postconditions:**
- Client suspended
- Service disconnected
- Usage blocked

---

### UC-5: Subscription Management

#### UC-5.1: Create Subscription for STATIC/DYNAMIC Client
**Actor:** POS_MANAGER  
**Preconditions:** 
- Client exists (STATIC/DYNAMIC/PPPOE)
- Service plan exists (PREPAID)
- Client has no active subscription

**Flow:**
1. Client requests subscription at booth
2. POS_MANAGER selects:
   - Client
   - Service plan (PREPAID only)
   - Start date (optional, defaults to today)
   - Auto-renewal preference
3. System validates:
   - Client connection type requirements:
     - STATIC: Static IP assigned ✅
     - DYNAMIC: No requirements ✅
     - PPPOE: Credentials exist ✅
   - Service plan is PREPAID
   - No existing active subscription
   - POS scope (own POS clients only)
4. System creates subscription:
   - Status: ACTIVE
   - Start/end dates calculated
   - Bandwidth allocated
5. System auto-generates invoice:
   - Linked to subscription
   - Amount: Service plan cost
   - Issue date: Subscription start date
   - Due date: Issue date + 30 days
   - Notes include:
     - Connection Type (STATIC/DYNAMIC/PPPOE)
     - Plan name
     - Subscription period
     - Connection details (IP or username)
6. Transaction ensures atomicity (if invoice fails, subscription rolled back)
7. Audit logs created for both

**Postconditions:**
- Subscription created (ACTIVE)
- Invoice generated (UNPAID)
- Service NOT usable yet (payment-gated)
- Audit logs recorded

**Exception Flows:**
- E1: STATIC client without IP → Error: "STATIC client requires static IP"
- E2: POSTPAID plan selected → Error: "Only PREPAID plans allowed"
- E3: Active subscription exists → Error: "Client already has active subscription"
- E4: Invoice generation fails → Subscription creation rolled back

---

#### UC-5.2: Process Payment and Activate Service
**Actor:** POS_MANAGER  
**Preconditions:** 
- Invoice exists and is UNPAID
- Client pays exact invoice amount

**Flow:**
1. Client pays invoice at booth
2. POS_MANAGER records payment:
   - Invoice ID
   - Amount (must exactly match invoice)
   - Payment method (CASH/BANK_TRANSFER/CARD/ONLINE)
   - Payment reference (optional)
3. System validates:
   - Invoice exists
   - Invoice has no existing payment (single payment enforced)
   - Payment amount exactly matches invoice amount
   - POS scope (own POS clients only)
4. System creates payment
5. System activates subscription:
   - If subscription linked, ensures status is ACTIVE
6. Audit log created

**Postconditions:**
- Payment recorded
- Invoice status: PAID (calculated)
- Subscription activated
- Service now usable
- Audit log recorded

**Exception Flows:**
- E1: Invoice already paid → Error: "Invoice already has a payment"
- E2: Amount mismatch → Error: "Payment must exactly match invoice amount"
- E3: Multiple payments attempted → Error: "Only one payment per invoice allowed"

---

#### UC-5.3: Track Usage
**Actor:** POS_MANAGER  
**Preconditions:** 
- Subscription exists and is ACTIVE
- Invoice is paid
- Client is not suspended

**Flow:**
1. System/Manager creates usage log:
   - Subscription ID
   - Download MB
   - Upload MB
   - Log date
2. System validates:
   - Subscription exists and is ACTIVE
   - Subscription not EXPIRED
   - Client not SUSPENDED
   - Invoice is paid (payment-gated)
   - Log date within subscription period
   - Log date not in future
   - POS scope (own POS clients only)
3. System creates usage log
4. System checks data capacity:
   - If exceeded → Throttles bandwidth to 25%
   - Stores original bandwidth
5. Audit log created

**Postconditions:**
- Usage logged
- Bandwidth throttled if cap exceeded
- Audit log recorded

**Exception Flows:**
- E1: Invoice unpaid → Error: "Service not active. Payment required"
- E2: Client suspended → Error: "Cannot log usage for suspended client"
- E3: Subscription expired → Error: "Cannot log usage for expired subscription"
- E4: Date outside period → Error: "Usage date outside subscription period"

---

#### UC-5.4: Renew Subscription
**Actor:** POS_MANAGER  
**Preconditions:** 
- Subscription exists (ACTIVE or EXPIRED)
- Current invoice is PAID
- Client not terminated

**Flow:**
1. Client requests renewal at booth
2. POS_MANAGER selects subscription
3. System validates:
   - Current invoice is paid
   - Client not terminated
   - Connection type requirements still met
   - Service plan is PREPAID
   - POS scope
4. System renews subscription:
   - Updates start/end dates
   - Resets bandwidth to original
   - Status: ACTIVE
5. System auto-generates new invoice:
   - Linked to subscription
   - Amount: Plan cost
   - Due date: Issue date + 30 days
   - Notes include connection type
6. Transaction ensures atomicity
7. Audit logs created

**Postconditions:**
- Subscription renewed
- New invoice generated (UNPAID)
- Service requires new payment
- Audit logs recorded

**Exception Flows:**
- E1: Current invoice unpaid → Error: "Cannot renew. Current invoice unpaid"
- E2: Client terminated → Error: "Cannot renew for terminated client"

---

#### UC-5.5: Upgrade Subscription
**Actor:** POS_MANAGER  
**Preconditions:** 
- Subscription exists and is EXPIRED (endDate passed)
- New service plan exists (PREPAID)

**Flow:**
1. Client requests upgrade
2. POS_MANAGER selects:
   - Current subscription
   - New service plan
   - Effective date (must be after current endDate)
3. System validates:
   - Subscription is not terminated
   - Current subscription has ended (endDate < now)
   - Effective date >= current endDate
   - New plan is PREPAID
   - Connection type requirements met
   - POS scope
4. System upgrades:
   - Terminates old subscription
   - Creates new subscription
   - Links old → new (upgrade tracking)
5. System auto-generates invoice for new subscription
6. Transaction ensures atomicity
7. Audit logs created

**Postconditions:**
- Old subscription: TERMINATED
- New subscription: ACTIVE
- New invoice generated (UNPAID)
- Upgrade link established
- Audit logs recorded

**Exception Flows:**
- E1: Subscription not expired → Error: "Cannot upgrade before subscription ends"
- E2: Effective date before endDate → Error: "Effective date must be after current end date"

---

#### UC-5.6: Terminate Subscription
**Actor:** POS_MANAGER  
**Preconditions:** Subscription exists and is ACTIVE

**Flow:**
1. POS_MANAGER selects subscription
2. System validates POS scope
3. System terminates subscription:
   - Status: TERMINATED
4. Audit log created

**Postconditions:**
- Subscription terminated
- Service disconnected
- Audit log recorded

---

### UC-6: Financial Management

#### UC-6.1: View Invoices
**Actor:** POS_MANAGER  
**Preconditions:** User logged in as POS_MANAGER

**Flow:**
1. POS_MANAGER views invoices
2. Filtered to own POS clients only
3. Can filter by:
   - Client
   - Subscription
   - Status (UNPAID/PAID/OVERDUE)
4. Views invoice details:
   - Invoice number
   - Amount, dates
   - Payment status (calculated)
   - Notes (includes connection type)
   - Payment history

**Postconditions:**
- Invoices displayed

---

#### UC-6.2: View Payments
**Actor:** POS_MANAGER  
**Preconditions:** User logged in as POS_MANAGER

**Flow:**
1. POS_MANAGER views payments
2. Filtered to own POS clients only
3. Can filter by:
   - Invoice
   - Payment method
   - Date range
4. Views payment details:
   - Amount paid
   - Payment method
   - Date, reference
   - Linked invoice
   - Received by user

**Postconditions:**
- Payments displayed

---

### UC-7: Static IP Management

#### UC-7.1: Assign Static IP to Client
**Actor:** POS_MANAGER  
**Preconditions:** 
- Client exists with STATIC connection type
- Static IP available in POS

**Flow:**
1. POS_MANAGER selects client (STATIC)
2. Selects available static IP from POS pool
3. System validates:
   - Client connection type is STATIC
   - Static IP is AVAILABLE
   - Static IP belongs to POS
4. System assigns:
   - Static IP status: ASSIGNED
   - Static IP linked to client
   - Assignment date recorded
5. Audit log created

**Postconditions:**
- Static IP assigned
- Client has static IP
- Audit log recorded

---

#### UC-7.2: Release Static IP
**Actor:** POS_MANAGER  
**Preconditions:** Client has assigned static IP

**Flow:**
1. POS_MANAGER selects client
2. Releases static IP
3. System:
   - Unlinks static IP from client
   - Status: AVAILABLE
   - Clears assignment date
4. Audit log created

**Postconditions:**
- Static IP released
- Available for reassignment
- Audit log recorded

---

### UC-8: PPPoE Request Management

#### UC-8.1: Create PPPoE Change Request
**Actor:** POS_MANAGER or CLIENT  
**Preconditions:** Client has PPPOE connection type

**Flow:**
1. User requests PPPoE credential change
2. Provides:
   - Current username
   - New username
   - New password
   - Reason (optional)
3. System validates:
   - Current username matches
   - New username is unique
   - Client has PPPOE connection type
4. System creates request:
   - Status: PENDING
5. Audit log created

**Postconditions:**
- PPPoE change request created
- Status: PENDING
- Audit log recorded

---

#### UC-8.2: Approve PPPoE Change Request
**Actor:** POS_MANAGER or WSP_ADMIN  
**Preconditions:** PPPoE change request exists and is PENDING

**Flow:**
1. Manager reviews request
2. Approves request
3. System:
   - Updates client PPPoE credentials
   - Request status: APPROVED → COMPLETED
   - Records approval user and date
4. Audit log created

**Postconditions:**
- Credentials updated
- Request completed
- Audit log recorded

---

## CLIENT Use Cases

### UC-9: Self-Service

#### UC-9.1: View Own Account
**Actor:** CLIENT  
**Preconditions:** User logged in as CLIENT

**Flow:**
1. CLIENT views own account
2. Sees:
   - Personal information
   - Connection type
   - Static IP (if STATIC)
   - Account status
   - Auto-renewal preference

**Postconditions:**
- Account information displayed

---

#### UC-9.2: View Own Subscriptions
**Actor:** CLIENT  
**Preconditions:** User logged in as CLIENT

**Flow:**
1. CLIENT views subscriptions
2. Sees:
   - Active subscription details
   - Subscription period
   - Plan information
   - Bandwidth allocated
   - Status

**Postconditions:**
- Subscription information displayed

---

#### UC-9.3: View Own Invoices
**Actor:** CLIENT  
**Preconditions:** User logged in as CLIENT

**Flow:**
1. CLIENT views invoices
2. Sees:
   - Invoice number
   - Amount, dates
   - Payment status
   - Notes (connection type included)
   - Payment history

**Postconditions:**
- Invoice information displayed

---

#### UC-9.4: View Own Usage
**Actor:** CLIENT  
**Preconditions:** User logged in as CLIENT

**Flow:**
1. CLIENT views usage logs
2. Sees:
   - Daily usage (download/upload)
   - Total usage for period
   - Data capacity (if applicable)
   - Throttling status

**Postconditions:**
- Usage information displayed

---

#### UC-9.5: Request PPPoE Credential Change
**Actor:** CLIENT  
**Preconditions:** 
- User logged in as CLIENT
- Client has PPPOE connection type

**Flow:**
1. CLIENT requests credential change
2. Provides new username/password
3. System creates request (PENDING)
4. Manager approval required

**Postconditions:**
- Request created
- Awaiting approval

---

## Complete Day-to-Day Flows

### Flow-1: New STATIC Client Onboarding

```
Day 1: Client Registration
├── Step 1: Client visits booth
├── Step 2: POS_MANAGER creates STATIC client
│   ├── Collects personal information
│   ├── Selects STATIC connection type
│   └── Assigns static IP from pool
├── Step 3: Client created (status: ACTIVE)
│
Day 1: Subscription Setup
├── Step 4: Client requests subscription
├── Step 5: POS_MANAGER creates subscription
│   ├── Validates static IP assigned ✅
│   ├── Selects PREPAID service plan
│   ├── Subscription created (status: ACTIVE)
│   └── Invoice auto-generated (status: UNPAID)
│       └── Notes: "Connection Type: STATIC, Static IP: 192.168.1.100"
│
Day 1: Payment
├── Step 6: Client pays invoice
├── Step 7: POS_MANAGER records payment
│   ├── Payment amount = Invoice amount (exact)
│   ├── Single payment enforced
│   └── Subscription activated
│
Day 1+: Service Active
├── Step 8: Usage tracking begins
│   ├── Usage logs created (payment-gated ✅)
│   ├── Data cap monitoring
│   └── Throttling if exceeded
│
Day 30: Subscription Expires
├── Step 9: Subscription marked EXPIRED
├── Step 10: Service suspended
└── Step 11: Client must renew (payment required)
```

---

### Flow-2: New DYNAMIC Client Onboarding

```
Day 1: Client Registration
├── Step 1: Client visits booth
├── Step 2: POS_MANAGER creates DYNAMIC client
│   ├── Collects personal information
│   ├── Selects DYNAMIC connection type
│   └── No special requirements
├── Step 3: Client created (status: ACTIVE)
│
Day 1: Subscription Setup
├── Step 4: Client requests subscription
├── Step 5: POS_MANAGER creates subscription
│   ├── No connection type validation needed ✅
│   ├── Selects PREPAID service plan
│   ├── Subscription created (status: ACTIVE)
│   └── Invoice auto-generated (status: UNPAID)
│       └── Notes: "Connection Type: DYNAMIC"
│
Day 1: Payment
├── Step 6: Client pays invoice
├── Step 7: POS_MANAGER records payment
│   └── Subscription activated
│
Day 1+: Service Active
└── Step 8: Usage tracking (same as STATIC)
```

---

### Flow-3: Subscription Lifecycle (STATIC/DYNAMIC)

```
Period 1: Active Subscription
├── Subscription: ACTIVE
├── Invoice: PAID
├── Client: ACTIVE
├── Usage: Tracked daily
├── Data Cap: Monitored
└── Throttling: Applied if exceeded

Period 2: Near Expiration
├── Subscription: ACTIVE (endDate approaching)
├── Invoice: PAID
└── Client: Can renew early

Period 3: Expiration
├── Subscription: EXPIRED (endDate passed)
├── Service: Disconnected
└── Client: Must renew

Period 4: Renewal
├── Check: Current invoice paid ✅
├── Renew subscription
├── New invoice generated (UNPAID)
├── Client pays new invoice
└── Service reactivated
```

---

### Flow-4: Payment and Service Activation

```
State 1: Subscription Created
├── Subscription: ACTIVE
├── Invoice: UNPAID
└── Service: NOT USABLE (payment-gated)

State 2: Payment Received
├── Payment: Recorded (exact amount)
├── Invoice: PAID (calculated)
├── Subscription: Activated
└── Service: USABLE ✅

State 3: Usage Tracking
├── Usage logs: Can be created
├── Validates: Invoice paid ✅
├── Validates: Client not suspended ✅
└── Validates: Within subscription period ✅
```

---

### Flow-5: Data Cap and Throttling

```
Normal Usage
├── Usage < Data Capacity
├── Bandwidth: Full speed
└── No throttling

Cap Exceeded
├── Usage > Data Capacity
├── System: Throttles to 25%
├── Original bandwidth: Stored
└── Client: Experiences slow speeds

On Renewal
├── New subscription period
├── Bandwidth: Restored to original
├── Usage counter: Reset
└── Throttling: Cleared
```

---

### Flow-6: Client Suspension During Subscription

```
Normal State
├── Client: ACTIVE
├── Subscription: ACTIVE
├── Invoice: PAID
└── Usage: Tracked ✅

Suspension
├── Client: SUSPENDED
├── Subscription: ACTIVE (continues)
├── Service: Disconnected
└── Usage: BLOCKED ❌

Reactivation
├── Client: ACTIVE
├── Subscription: Still ACTIVE
├── Service: Reconnected
└── Usage: Resumes ✅
```

---

### Flow-7: Subscription Upgrade

```
Current State
├── Subscription: EXPIRED (endDate passed)
├── Invoice: PAID
└── Service: Disconnected

Upgrade Request
├── Check: Subscription expired ✅
├── Check: Connection type requirements ✅
├── Select: New service plan
└── Effective date: After current endDate

Upgrade Process
├── Old subscription: TERMINATED
├── New subscription: ACTIVE
├── New invoice: Generated (UNPAID)
└── Upgrade link: Established

Activation
├── Client pays new invoice
└── New service activated
```

---

## Connection Type Specific Flows

### STATIC Connection Flow

```
1. Client Creation
   ├── connectionType: STATIC
   ├── staticIpId: Required
   └── Validation: Static IP must be assigned

2. Subscription Creation
   ├── Validates: Static IP assigned ✅
   ├── Invoice notes: "Connection Type: STATIC, Static IP: X.X.X.X"
   └── All other flows same as DYNAMIC

3. Usage Tracking
   ├── Validates: Invoice paid
   ├── Validates: Client not suspended
   └── Tracks usage normally
```

---

### DYNAMIC Connection Flow

```
1. Client Creation
   ├── connectionType: DYNAMIC
   └── No special requirements

2. Subscription Creation
   ├── No connection type validation needed
   ├── Invoice notes: "Connection Type: DYNAMIC"
   └── All flows proceed normally

3. Usage Tracking
   └── Same as STATIC (payment-gated)
```

---

### PPPOE Connection Flow

```
1. Client Creation
   ├── connectionType: PPPOE
   ├── pppoeUsername: Required
   ├── pppoePassword: Required
   └── Validation: Credentials must be unique

2. Subscription Creation
   ├── Validates: Credentials exist ✅
   ├── Invoice notes: "Connection Type: PPPOE, Username: XXX"
   └── All other flows same

3. Credential Changes
   ├── Request created (PENDING)
   ├── Manager approves
   └── Credentials updated
```

---

## Business Rules Summary

### Payment Rules
1. ✅ **Single Payment**: Only one payment per invoice
2. ✅ **Exact Amount**: Payment must exactly match invoice amount
3. ✅ **Payment-Gated**: Service only active after payment
4. ✅ **30-Day Terms**: Invoice due date = issue date + 30 days

### Subscription Rules
1. ✅ **PREPAID Only**: All subscriptions must use PREPAID plans
2. ✅ **One Active**: Only one active subscription per client
3. ✅ **Connection Validation**: STATIC needs IP, PPPOE needs credentials
4. ✅ **Auto-Invoice**: Invoice auto-generated on create/renew/upgrade
5. ✅ **Upgrade Restriction**: Upgrades only after subscription ends
6. ✅ **Renewal Payment Check**: Renewal requires current invoice paid

### Usage Rules
1. ✅ **Payment-Gated**: Usage logs only if invoice paid
2. ✅ **Suspension Block**: Usage blocked if client suspended
3. ✅ **Period Validation**: Usage must be within subscription period
4. ✅ **Throttling**: 25% bandwidth if data cap exceeded

### Connection Type Rules
1. ✅ **STATIC**: Must have static IP assigned
2. ✅ **DYNAMIC**: No special requirements
3. ✅ **PPPOE**: Must have username/password

---

## Error Handling Scenarios

### E-1: Payment Before Service
- **Scenario**: Client tries to use service before payment
- **Result**: Usage log creation blocked
- **Message**: "Service is not active. Payment is required before service can be used."

### E-2: Multiple Payments
- **Scenario**: Attempt to create second payment for invoice
- **Result**: Payment creation blocked
- **Message**: "Invoice already has a payment. Only one payment per invoice is allowed."

### E-3: Upgrade Before Expiration
- **Scenario**: Attempt to upgrade active subscription
- **Result**: Upgrade blocked
- **Message**: "Cannot upgrade subscription before it ends."

### E-4: Renewal Without Payment
- **Scenario**: Attempt to renew with unpaid invoice
- **Result**: Renewal blocked
- **Message**: "Cannot renew subscription. Current invoice is unpaid."

### E-5: Usage Without Payment
- **Scenario**: Attempt to log usage for unpaid subscription
- **Result**: Usage log blocked
- **Message**: "Service is not active. Payment is required."

---

## Audit Trail

All operations create audit logs with:
- User ID and role
- Action type (CREATE/UPDATE/DELETE/PAYMENT/etc.)
- Entity type and ID
- Old and new values
- Timestamp
- IP address and user agent (if available)

---

## Summary

This document covers all use cases for all user types in the WSP Backend system, including:
- ✅ Complete user role capabilities
- ✅ All CRUD operations
- ✅ Complete day-to-day flows
- ✅ Connection type specific flows (STATIC/DYNAMIC/PPPOE)
- ✅ Payment and subscription lifecycle
- ✅ Error handling
- ✅ Business rules enforcement

All flows ensure proper linkage between clients, subscriptions, invoices, payments, and usage logs for STATIC and DYNAMIC connection types.


