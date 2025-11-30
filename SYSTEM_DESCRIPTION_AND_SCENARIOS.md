# Wireless Service Provider Management System
## Complete System Description and All Possible Scenarios

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose
The Wireless Service Provider (WSP) Management System is a comprehensive operational framework designed to manage all aspects of internet service delivery through a distributed network of Point-of-Sale (POS) locations. The system handles client onboarding, subscription management, billing operations, network resource allocation, and service administration across multiple connection types.

### 1.2 Organizational Structure
The system operates on a three-tier organizational hierarchy:

1. **WSP Administration Level** - Central oversight and system-wide management
2. **Point-of-Sale (POS) Level** - Regional/distributed service delivery points
3. **Client Level** - End-user customers receiving internet services

### 1.3 Core Entities

**Organizational Entities:**
- **User** - System users with different roles and access levels
- **POS** - Point-of-sale locations managing regional operations
- **Client** - End customers receiving internet services

**Service Entities:**
- **ServicePlan** - Available service packages with pricing and specifications
- **Subscription** - Active service agreements between clients and service plans
- **UsageLog** - Network usage tracking and consumption records

**Financial Entities:**
- **Invoice** - Billing documents issued to clients
- **Payment** - Financial transactions recording payments received

**Network Resource Entities:**
- **StaticIpPool** - IP address allocation and management
- **BandwidthPool** - System-wide bandwidth capacity tracking
- **PppoeChangeRequest** - Credential change management for PPPoE connections

**Administrative Entities:**
- **SuspensionHistory** - Service suspension and reactivation records
- **AuditLog** - Comprehensive activity tracking and compliance records

---

## 2. USER ROLES AND CAPABILITIES

### 2.1 WSP_ADMIN
**Capabilities:**
- Full system access and oversight
- Create and manage POS locations
- Create and manage all user accounts
- Configure bandwidth pool and allocations
- View system-wide reports and statistics
- Manage service plans
- Access all client information across all POS locations
- Approve or reject PPPoE change requests
- Suspend or reactivate any client
- View all audit logs

**Constraints:**
- Cannot be assigned to a specific POS
- Cannot be linked to a specific client

### 2.2 POS_MANAGER
**Capabilities:**
- Manage clients within their assigned POS location
- Create new client accounts
- View and manage subscriptions for their POS clients
- Generate invoices for their clients
- Record payments received from clients
- Request static IP allocations for clients
- View usage statistics for their POS
- Suspend or reactivate clients within their POS
- Approve PPPoE change requests for their clients
- View audit logs for their POS operations

**Constraints:**
- Limited to operations within their assigned POS
- Cannot access other POS locations' data
- Cannot create new POS locations
- Cannot modify service plans
- Cannot modify bandwidth pool

### 2.3 CLIENT
**Capabilities:**
- View own account information
- View own subscription details
- View own invoices and payment history
- View own usage statistics
- Request PPPoE credential changes
- View account balance

**Constraints:**
- Limited to own account information only
- Cannot modify any account details
- Cannot create invoices or payments
- Cannot access other clients' information

---

## 3. COMPLETE BUSINESS SCENARIOS

### 3.1 POS MANAGEMENT SCENARIOS

#### Scenario 1.1: Create New POS Location
**Actor:** WSP_ADMIN
**Process:**
1. System validates total bandwidth pool availability
2. WSP_ADMIN creates new POS with:
   - Name and location
   - Contact phone number
   - Allocated bandwidth amount
3. System checks if allocated bandwidth exceeds available pool bandwidth
4. If sufficient, POS is created with initial usage set to zero
5. POS status set to active
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: POS created, bandwidth allocated
- ❌ Failure: Insufficient bandwidth in pool

#### Scenario 1.2: Update POS Bandwidth Allocation
**Actor:** WSP_ADMIN
**Process:**
1. System retrieves current POS allocation
2. WSP_ADMIN requests new bandwidth amount
3. System calculates: (current total allocation - current POS allocation + new amount)
4. System validates against total bandwidth pool
5. If valid, POS bandwidth updated
6. Current usage recalculated based on active subscriptions
7. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Bandwidth updated, usage recalculated
- ❌ Failure: New total would exceed pool capacity

#### Scenario 1.3: Deactivate POS Location
**Actor:** WSP_ADMIN
**Process:**
1. System checks for active clients in POS
2. If active clients exist, operation blocked
3. If no active clients, POS marked as inactive
4. All managers remain linked but cannot perform operations
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: POS deactivated
- ❌ Failure: Active clients prevent deactivation

---

### 3.2 USER MANAGEMENT SCENARIOS

#### Scenario 2.1: Create WSP Admin User
**Actor:** WSP_ADMIN
**Process:**
1. WSP_ADMIN provides username, email, password
2. System validates username and email uniqueness
3. Password is hashed and stored
4. User created with WSP_ADMIN role
5. No POS or client assignment
6. User status set to active
7. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Admin user created
- ❌ Failure: Username or email already exists

#### Scenario 2.2: Create POS Manager User
**Actor:** WSP_ADMIN
**Process:**
1. WSP_ADMIN selects target POS location
2. WSP_ADMIN provides username, email, password
3. System validates username and email uniqueness
4. User created with POS_MANAGER role
5. User linked to specified POS
6. User status set to active
7. Audit log entry created

**Possible Outcomes:**
- ✅ Success: POS Manager created and assigned
- ❌ Failure: Username/email exists, or POS not found

#### Scenario 2.3: Create Client User Account
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Client account must already exist
2. User created with CLIENT role
3. User linked to specific client account
4. One-to-one relationship enforced
5. User status set to active
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client user account created
- ❌ Failure: Client already has user account, or client not found

#### Scenario 2.4: User Login
**Actor:** Any User
**Process:**
1. User provides username and password
2. System validates credentials
3. System checks if user is active
4. If valid, login timestamp updated
5. User role and permissions loaded
6. Audit log entry created with LOGIN action

**Possible Outcomes:**
- ✅ Success: User logged in, session established
- ❌ Failure: Invalid credentials or inactive account

#### Scenario 2.5: Deactivate User Account
**Actor:** WSP_ADMIN
**Process:**
1. System identifies user role
2. If POS_MANAGER: Check if POS has other managers
3. If CLIENT: Client account remains active, only user access disabled
4. User status set to inactive
5. User cannot login but data remains
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: User deactivated
- ❌ Failure: Last manager for POS (if applicable)

---

### 3.3 CLIENT MANAGEMENT SCENARIOS

#### Scenario 3.1: Register New Client - Static IP Connection
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER provides client information:
   - Full name, phone, email, address
   - National ID (optional)
   - Connection type: STATIC
2. System validates email uniqueness
3. System checks for available static IP in POS IP pool
4. If IP available:
   - Client account created
   - Static IP assigned from pool
   - IP status changed to ASSIGNED
   - Client status set to ACTIVE
   - Assignment timestamp recorded
5. Client linked to POS
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client created with static IP assigned
- ❌ Failure: Email exists, or no available IPs in POS pool

#### Scenario 3.2: Register New Client - PPPoE Connection
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER provides client information
2. Connection type: PPPOE specified
3. System validates email uniqueness
4. System generates unique PPPoE username (based on name and POS)
5. System generates secure password
6. Password is hashed and stored
7. Client account created with:
   - PPPoE username (unique)
   - Hashed PPPoE password
   - Client status set to ACTIVE
8. Plain password returned once (for initial client communication)
9. Client linked to POS
10. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client created with PPPoE credentials
- ❌ Failure: Email exists, or username collision

#### Scenario 3.3: Register New Client - Dynamic IP Connection
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER provides client information
2. Connection type: DYNAMIC specified
3. System validates email uniqueness
4. Client account created
5. No IP assignment or credentials needed
6. Client status set to ACTIVE
7. Client linked to POS
8. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client created
- ❌ Failure: Email exists

#### Scenario 3.4: Update Client Information
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System retrieves existing client record
2. Updates provided for modifiable fields:
   - Contact information (phone, address)
   - Auto-renewal preferences
   - Account balance adjustments
3. System validates email uniqueness if changed
4. Client record updated
5. Audit log entry created with old and new values

**Possible Outcomes:**
- ✅ Success: Client information updated
- ❌ Failure: New email conflicts with existing client

#### Scenario 3.5: Suspend Client Service
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System checks current client status
2. If already suspended, operation blocked
3. If active:
   - Client status changed to SUSPENDED
   - Suspension record created with:
     - Reason (NON_PAYMENT, VIOLATION, MAINTENANCE, OTHER)
     - Detailed reason description
     - Suspension timestamp
     - User who performed suspension
4. All active subscriptions remain but service disabled
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client suspended, suspension history recorded
- ❌ Failure: Client already suspended

#### Scenario 3.6: Reactivate Client Service
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System checks client status (must be SUSPENDED)
2. If suspended:
   - Client status changed to ACTIVE
   - Most recent suspension record updated with:
     - Reactivation timestamp
     - User who performed reactivation
3. Service restored for active subscriptions
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client reactivated
- ❌ Failure: Client not currently suspended

#### Scenario 3.7: Terminate Client Account
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System checks for active subscriptions
2. If active subscriptions exist, termination blocked
3. If no active subscriptions:
   - If static IP assigned: IP released back to pool (status: AVAILABLE)
   - Client status changed to TERMINATED
   - All subscriptions remain for historical records
   - Client account preserved for audit purposes
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client terminated, resources released
- ❌ Failure: Active subscriptions prevent termination

---

### 3.4 SERVICE PLAN MANAGEMENT SCENARIOS

#### Scenario 4.1: Create New Service Plan
**Actor:** WSP_ADMIN
**Process:**
1. WSP_ADMIN defines plan specifications:
   - Plan name and description
   - Service type: PREPAID or POSTPAID
   - Duration type: HALF_MONTHLY, MONTHLY, QUARTERLY, HALF_ANNUAL, ANNUAL
   - Duration in days
   - Cost per period
   - Download speed (Mbps)
   - Upload speed (Mbps)
   - Data capacity (optional, null for unlimited)
2. Plan created with active status
3. Plan available for subscription creation
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Service plan created and available

#### Scenario 4.2: Deactivate Service Plan
**Actor:** WSP_ADMIN
**Process:**
1. Plan status changed to inactive
2. Plan no longer available for new subscriptions
3. Existing active subscriptions continue unaffected
4. Historical subscriptions remain linked
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Plan deactivated, existing subscriptions unaffected

#### Scenario 4.3: Update Service Plan Pricing
**Actor:** WSP_ADMIN
**Process:**
1. Plan pricing or specifications updated
2. Changes affect only new subscriptions
3. Existing subscriptions retain original plan specifications
4. Audit log entry created with old and new values

**Possible Outcomes:**
- ✅ Success: Plan updated, existing subscriptions unchanged

---

### 3.5 SUBSCRIPTION MANAGEMENT SCENARIOS

#### Scenario 5.1: Create New Subscription - Postpaid Plan
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER selects client and service plan
2. System validates:
   - Client is active
   - Plan is active
   - Client has no conflicting active subscriptions (optional business rule)
3. Subscription created with:
   - Start date (typically current date)
   - End date (start date + plan duration days)
   - Status: ACTIVE
   - Bandwidth allocated (from plan specifications)
   - Auto-renewal preference (from client setting)
4. Initial invoice generated (if postpaid)
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Subscription created, invoice generated
- ❌ Failure: Client inactive, plan inactive, or validation failure

#### Scenario 5.2: Create New Subscription - Prepaid Plan
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER selects client and prepaid service plan
2. System validates client and plan
3. Subscription created with:
   - Start date
   - End date (based on plan duration)
   - Status: ACTIVE
   - Bandwidth allocated
4. Payment required upfront (handled separately)
5. Invoice may be generated for prepayment
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Prepaid subscription created

#### Scenario 5.3: Subscription Expiration
**Actor:** System (Automated) or Manual
**Process:**
1. System checks subscriptions where endDate < current date
2. For each expired subscription:
   - Status changed to EXPIRED
   - If auto-renewal enabled:
     - New subscription created with same plan
     - New invoice generated
     - Status set to ACTIVE
   - If auto-renewal disabled:
     - Service remains expired
     - Client may manually renew
3. Audit log entries created

**Possible Outcomes:**
- ✅ Auto-renewal: New subscription created
- ✅ Manual renewal: Subscription expired, awaiting renewal
- ✅ Termination: Subscription expired and not renewed

#### Scenario 5.4: Manual Subscription Renewal
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System identifies expired subscription
2. POS_MANAGER selects renewal plan (same or different)
3. New subscription created:
   - Links to previous subscription (upgrade tracking)
   - New start and end dates
   - Status: ACTIVE
4. Invoice generated for renewal period
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Subscription renewed

#### Scenario 5.5: Upgrade Subscription
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. POS_MANAGER identifies active subscription
2. POS_MANAGER selects higher-tier service plan
3. System creates new subscription:
   - Links to original subscription (upgrade relationship)
   - New bandwidth allocation
   - New start and end dates
   - Status: ACTIVE
4. Original subscription may be terminated or kept for history
5. Invoice generated for upgrade
6. Audit log entry created with UPGRADE action

**Possible Outcomes:**
- ✅ Success: Subscription upgraded, new subscription active
- ❌ Failure: Circular upgrade chain detected

#### Scenario 5.6: Terminate Subscription
**Actor:** POS_MANAGER, WSP_ADMIN, or Client
**Process:**
1. System identifies active subscription
2. Subscription status changed to TERMINATED
3. End date may be adjusted to termination date
4. Outstanding invoices remain
5. Usage logs preserved for historical records
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Subscription terminated

---

### 3.6 INVOICING SCENARIOS

#### Scenario 6.1: Generate Subscription Invoice
**Actor:** System (Automated) or POS_MANAGER
**Process:**
1. System identifies subscription requiring invoicing:
   - New subscription created
   - Subscription renewal period
   - Upgrade to new plan
2. Invoice created with:
   - Unique invoice number
   - Client linked
   - Subscription linked
   - Amount (from service plan cost)
   - Issue date (current date)
   - Due date (issue date + payment terms)
   - Status: UNPAID (calculated from payments)
3. Invoice linked to subscription
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Invoice generated

#### Scenario 6.2: Generate One-Time Charge Invoice
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. POS_MANAGER creates invoice for:
   - Installation fees
   - Equipment charges
   - Late payment penalties
   - Other service charges
2. Invoice created with:
   - Client linked
   - No subscription linked (optional)
   - Custom amount
   - Issue and due dates
3. Invoice stands alone (not tied to subscription)
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: One-time invoice created

#### Scenario 6.3: Invoice Payment Status Calculation
**Actor:** System (Automated)
**Process:**
1. System calculates total payments for invoice
2. Status determination:
   - If sum(payments) >= invoice amount: Status = PAID
   - If sum(payments) < invoice amount AND dueDate < current date: Status = OVERDUE
   - If sum(payments) < invoice amount AND dueDate >= current date: Status = UNPAID
3. Status updated dynamically
4. No manual status field (calculated)

**Possible Outcomes:**
- ✅ Status accurately reflects payment state

---

### 3.7 PAYMENT PROCESSING SCENARIOS

#### Scenario 7.1: Record Full Payment
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER selects invoice
2. Payment details provided:
   - Amount paid (matches invoice amount)
   - Payment method (CASH, BANK_TRANSFER, CARD, ONLINE)
   - Payment reference (optional)
   - Received by (user who processed payment)
3. Payment record created:
   - Linked to invoice
   - Payment date recorded
   - Extra amount = 0 (if exact payment)
4. Invoice payment status recalculated (becomes PAID)
5. Client account balance updated (if applicable)
6. Audit log entry created with PAYMENT action

**Possible Outcomes:**
- ✅ Success: Payment recorded, invoice marked as paid

#### Scenario 7.2: Record Partial Payment
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER selects invoice
2. Payment amount less than invoice amount
3. Payment record created:
   - Amount paid recorded
   - Extra amount = 0
   - Linked to invoice
4. Invoice payment status recalculated (remains UNPAID or becomes OVERDUE)
5. Multiple partial payments allowed per invoice
6. Client account balance updated
7. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Partial payment recorded, invoice remains unpaid

#### Scenario 7.3: Record Overpayment
**Actor:** POS_MANAGER
**Process:**
1. POS_MANAGER records payment exceeding invoice amount
2. Payment record created:
   - Amount paid = invoice amount
   - Extra amount = overpayment amount
3. Extra amount may be:
   - Applied to other invoices
   - Added to client account balance
   - Refunded
4. Invoice marked as PAID
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Payment recorded with extra amount tracked

#### Scenario 7.4: Multiple Payments for Single Invoice
**Actor:** POS_MANAGER
**Process:**
1. Client makes first partial payment
2. Payment record #1 created
3. Later, client makes second partial payment
4. Payment record #2 created (same invoice)
5. System calculates total: payment1 + payment2
6. If total >= invoice amount: Invoice becomes PAID
7. All payment records linked to same invoice
8. Payment history fully tracked

**Possible Outcomes:**
- ✅ Success: Multiple payments recorded, invoice eventually paid

#### Scenario 7.5: Payment Refund Processing
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Refund treated as negative payment or separate record
2. Payment record created with negative amount or refund flag
3. Invoice payment status recalculated
4. Client account balance adjusted
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Refund processed and recorded

---

### 3.8 STATIC IP MANAGEMENT SCENARIOS

#### Scenario 8.1: Allocate Static IP to Client
**Actor:** System (Automated) or POS_MANAGER
**Process:**
1. Client created with STATIC connection type
2. System searches POS IP pool for AVAILABLE IP
3. If found:
   - IP status changed to ASSIGNED
   - IP linked to client (unique constraint)
   - Assignment timestamp recorded
   - Client linked to IP
4. If not found: Operation fails

**Possible Outcomes:**
- ✅ Success: IP assigned to client
- ❌ Failure: No available IPs in POS pool

#### Scenario 8.2: Release Static IP from Client
**Actor:** System (Automated) or POS_MANAGER
**Process:**
1. Client terminated or connection type changed
2. System identifies assigned static IP
3. IP status changed to AVAILABLE
4. IP unlinked from client (clientId set to null)
5. Assignment timestamp cleared
6. IP available for new assignments

**Possible Outcomes:**
- ✅ Success: IP released and available

#### Scenario 8.3: Reserve Static IP
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. IP status changed to RESERVED
2. IP not available for assignment
3. Reserved for special purposes or future use
4. Can be changed back to AVAILABLE when needed

**Possible Outcomes:**
- ✅ Success: IP reserved

#### Scenario 8.4: Add New IPs to Pool
**Actor:** WSP_ADMIN or POS_MANAGER
**Process:**
1. New IP addresses added to POS pool
2. Each IP created with:
   - IP address (unique)
   - Subnet mask
   - Gateway
   - DNS servers (primary and secondary)
   - Status: AVAILABLE
3. IPs ready for client assignment

**Possible Outcomes:**
- ✅ Success: New IPs added to pool

---

### 3.9 PPPOE CREDENTIAL MANAGEMENT SCENARIOS

#### Scenario 9.1: Request PPPoE Credential Change
**Actor:** CLIENT or POS_MANAGER
**Process:**
1. Requestor provides:
   - Current username (must match client's current username)
   - New username
   - New password
   - Reason for change (optional)
2. Change request created with:
   - Status: PENDING
   - Requested by (user who made request)
   - Request timestamp
3. Request awaits approval
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Change request created, pending approval
- ❌ Failure: Current username doesn't match client's username

#### Scenario 9.2: Approve PPPoE Credential Change
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System retrieves pending change request
2. Approver reviews request
3. If approved:
   - Request status changed to APPROVED
   - Client's PPPoE username updated to new username
   - Client's PPPoE password updated (hashed)
   - Approved by recorded
   - Processed timestamp recorded
   - Status may change to COMPLETED
4. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Credentials updated, request approved
- ❌ Failure: Request already processed

#### Scenario 9.3: Reject PPPoE Credential Change
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Approver reviews change request
2. Request status changed to REJECTED
3. Processed timestamp recorded
4. Client credentials remain unchanged
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Request rejected, credentials unchanged

#### Scenario 9.4: Complete PPPoE Credential Change
**Actor:** System (Automated)
**Process:**
1. After approval and credential update
2. Request status changed to COMPLETED
3. Change fully processed
4. Historical record maintained

**Possible Outcomes:**
- ✅ Success: Change request completed

---

### 3.10 USAGE TRACKING SCENARIOS

#### Scenario 10.1: Record Daily Usage
**Actor:** System (Automated)
**Process:**
1. System collects usage data for each active subscription
2. Usage log created with:
   - Subscription linked
   - Download amount (MB)
   - Upload amount (MB)
   - Total usage (calculated: download + upload)
   - Log date
3. Usage tracked per subscription
4. Historical usage data maintained

**Possible Outcomes:**
- ✅ Success: Usage recorded

#### Scenario 10.2: Monitor Data Capacity Limits
**Actor:** System (Automated)
**Process:**
1. System checks subscription's service plan
2. If plan has data capacity limit:
   - System calculates total usage for current period
   - If limit exceeded:
     - Client notified
     - Service may be throttled or suspended
     - Additional charges may apply
3. Usage logs used for capacity monitoring

**Possible Outcomes:**
- ✅ Within limit: Service continues
- ⚠️ Limit exceeded: Actions taken per business rules

#### Scenario 10.3: Generate Usage Reports
**Actor:** POS_MANAGER, WSP_ADMIN, or CLIENT
**Process:**
1. System aggregates usage logs for:
   - Specific subscription
   - All client subscriptions
   - All POS subscriptions
   - System-wide usage
2. Reports generated showing:
   - Daily/weekly/monthly usage
   - Download vs upload breakdown
   - Trends over time
3. Data retrieved from usage log records

**Possible Outcomes:**
- ✅ Success: Usage reports generated

---

### 3.11 BANDWIDTH MANAGEMENT SCENARIOS

#### Scenario 11.1: Configure Total Bandwidth Pool
**Actor:** WSP_ADMIN
**Process:**
1. WSP_ADMIN sets total WSP bandwidth capacity
2. System initializes bandwidth pool with:
   - Total bandwidth
   - Allocated bandwidth (sum of all POS allocations)
   - Available bandwidth (total - allocated)
   - Usage percentage
3. Pool serves as capacity constraint

**Possible Outcomes:**
- ✅ Success: Bandwidth pool configured

#### Scenario 11.2: Allocate Bandwidth to POS
**Actor:** WSP_ADMIN
**Process:**
1. WSP_ADMIN allocates bandwidth to POS
2. System validates:
   - New allocation + existing allocations <= total pool
3. If valid:
   - POS allocated bandwidth updated
   - Pool allocated bandwidth updated
   - Pool available bandwidth recalculated
   - Usage percentage recalculated
4. If invalid: Operation blocked

**Possible Outcomes:**
- ✅ Success: Bandwidth allocated
- ❌ Failure: Insufficient pool capacity

#### Scenario 11.3: Monitor Bandwidth Usage
**Actor:** System (Automated) or WSP_ADMIN
**Process:**
1. System calculates current usage:
   - Sum of all active subscription bandwidth allocations
   - Per POS and system-wide
2. Usage compared to allocations
3. Alerts generated if usage approaches limits
4. Statistics updated in bandwidth pool

**Possible Outcomes:**
- ✅ Normal: Usage within limits
- ⚠️ Warning: Usage approaching limits
- ❌ Critical: Usage exceeds allocations

---

### 3.12 SUSPENSION MANAGEMENT SCENARIOS

#### Scenario 12.1: Suspend for Non-Payment
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. System identifies overdue invoices
2. POS_MANAGER initiates suspension
3. Suspension record created:
   - Reason: NON_PAYMENT
   - Details: Invoice numbers and amounts
   - Suspended by: User who performed action
   - Suspension timestamp
4. Client status changed to SUSPENDED
5. Service disabled
6. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client suspended for non-payment

#### Scenario 12.2: Suspend for Policy Violation
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Violation identified (e.g., excessive usage, abuse)
2. Suspension record created:
   - Reason: VIOLATION
   - Details: Description of violation
   - Suspended by: User
   - Suspension timestamp
3. Client status changed to SUSPENDED
4. Service disabled
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client suspended for violation

#### Scenario 12.3: Suspend for Maintenance
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Maintenance required on client connection
2. Suspension record created:
   - Reason: MAINTENANCE
   - Details: Maintenance description
   - Suspended by: User
   - Suspension timestamp
3. Client status changed to SUSPENDED
4. Service temporarily disabled
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client suspended for maintenance

#### Scenario 12.4: Reactivate After Payment
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Client makes payment for overdue invoices
2. POS_MANAGER verifies payment
3. Suspension record updated:
   - Reactivation timestamp
   - Reactivated by: User
4. Client status changed to ACTIVE
5. Service restored
6. Audit log entry created with REACTIVATE action

**Possible Outcomes:**
- ✅ Success: Client reactivated after payment

#### Scenario 12.5: Reactivate After Violation Resolution
**Actor:** POS_MANAGER or WSP_ADMIN
**Process:**
1. Violation issue resolved
2. Suspension record updated with reactivation details
3. Client status changed to ACTIVE
4. Service restored
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Client reactivated

---

### 3.13 AUDIT AND COMPLIANCE SCENARIOS

#### Scenario 13.1: Track User Actions
**Actor:** System (Automated)
**Process:**
1. User performs any significant action:
   - Create, update, delete operations
   - Login/logout
   - Suspend/reactivate clients
   - Process payments
   - Approve requests
2. Audit log entry created with:
   - User who performed action
   - User role at time of action
   - Entity type affected
   - Entity ID affected
   - Action type
   - Old values (for updates)
   - New values (for updates)
   - IP address
   - User agent
   - Description
   - Timestamp
3. Complete audit trail maintained

**Possible Outcomes:**
- ✅ Success: All actions logged

#### Scenario 13.2: Generate Compliance Reports
**Actor:** WSP_ADMIN
**Process:**
1. System retrieves audit logs filtered by:
   - Date range
   - User
   - Entity type
   - Action type
2. Reports generated showing:
   - All system changes
   - User activity
   - Financial transactions
   - Client status changes
3. Reports used for compliance and auditing

**Possible Outcomes:**
- ✅ Success: Compliance reports generated

---

### 3.14 ACCOUNT BALANCE MANAGEMENT SCENARIOS

#### Scenario 14.1: Prepaid Balance Addition
**Actor:** POS_MANAGER
**Process:**
1. Client makes prepayment
2. Payment recorded
3. Client account balance increased
4. Balance available for future service charges
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Account balance increased

#### Scenario 14.2: Balance Deduction for Service
**Actor:** System (Automated)
**Process:**
1. Invoice generated for prepaid client
2. System checks account balance
3. If sufficient balance:
   - Balance deducted
   - Invoice marked as paid
4. If insufficient:
   - Invoice remains unpaid
   - Client notified
5. Audit log entry created

**Possible Outcomes:**
- ✅ Success: Balance deducted, invoice paid
- ❌ Failure: Insufficient balance

#### Scenario 14.3: Balance Calculation from Transactions
**Actor:** System (Automated)
**Process:**
1. System calculates balance as:
   - Sum of all payments
   - Minus sum of all invoices
   - Plus any manual adjustments
2. Balance maintained and updated
3. Used for prepaid service management

**Possible Outcomes:**
- ✅ Success: Balance accurately calculated

---

## 4. STATE TRANSITIONS

### 4.1 Client Status Transitions
```
ACTIVE → SUSPENDED (via suspension action)
SUSPENDED → ACTIVE (via reactivation action)
ACTIVE → TERMINATED (via termination, no active subscriptions)
SUSPENDED → TERMINATED (via termination, no active subscriptions)
TERMINATED → (final state, no transitions out)
```

### 4.2 Subscription Status Transitions
```
ACTIVE → EXPIRED (end date reached, auto-renewal disabled)
ACTIVE → TERMINATED (manual termination)
EXPIRED → ACTIVE (via renewal)
EXPIRED → TERMINATED (not renewed)
TERMINATED → (final state)
```

### 4.3 Invoice Payment Status Transitions (Calculated)
```
UNPAID → UNPAID (partial payment, not past due)
UNPAID → OVERDUE (past due date, not fully paid)
UNPAID → PAID (full payment received)
OVERDUE → PAID (full payment received)
PAID → (final state)
```

### 4.4 Static IP Status Transitions
```
AVAILABLE → ASSIGNED (assigned to client)
ASSIGNED → AVAILABLE (released from client)
AVAILABLE → RESERVED (manually reserved)
RESERVED → AVAILABLE (released from reservation)
```

### 4.5 PPPoE Change Request Status Transitions
```
PENDING → APPROVED (approved by manager)
PENDING → REJECTED (rejected by manager)
APPROVED → COMPLETED (credentials updated)
REJECTED → (final state)
COMPLETED → (final state)
```

---

## 5. BUSINESS RULES AND CONSTRAINTS

### 5.1 User Role Constraints
- WSP_ADMIN: Cannot be assigned to POS or Client
- POS_MANAGER: Must be assigned to exactly one POS
- CLIENT: Must be assigned to exactly one Client (one-to-one)

### 5.2 Connection Type Rules
- STATIC: Client must have assigned static IP
- PPPOE: Client must have PPPoE username and password
- DYNAMIC: Client needs no special configuration

### 5.3 Subscription Rules
- Client can have multiple subscriptions (historical)
- Only one subscription can be ACTIVE per client (business rule to enforce)
- Subscription upgrade creates new subscription, links to old
- Subscription cannot upgrade to itself (cycle prevention)

### 5.4 Payment Rules
- Multiple payments allowed per invoice
- Payment amount can be less than, equal to, or greater than invoice amount
- Invoice status calculated from sum of payments
- Payment must reference valid invoice

### 5.5 Bandwidth Rules
- Total POS allocations cannot exceed bandwidth pool capacity
- POS current usage calculated from active subscriptions
- Bandwidth pool tracks system-wide capacity

### 5.6 IP Pool Rules
- One client can have maximum one static IP (unique constraint)
- IP status must match assignment state
- IPs belong to specific POS locations

---

## 6. INTEGRATION SCENARIOS

### 6.1 Subscription-to-Invoice Flow
1. Subscription created → Invoice generated
2. Subscription renewed → New invoice generated
3. Subscription upgraded → New invoice for upgrade
4. Multiple invoices can link to same subscription (renewals)

### 6.2 Invoice-to-Payment Flow
1. Invoice created → Status: UNPAID
2. Payment recorded → Status recalculated
3. Multiple payments → Status updates with each payment
4. Full payment → Status: PAID

### 6.3 Client-to-Subscription Flow
1. Client created → No subscription yet
2. Subscription created → Client has active service
3. Multiple subscriptions → Historical record maintained
4. Client terminated → Subscriptions preserved for history

### 6.4 Usage-to-Subscription Flow
1. Subscription active → Usage logs recorded
2. Usage tracked per subscription
3. Usage data used for capacity monitoring
4. Historical usage maintained after subscription ends

---

## 7. ERROR AND EDGE CASE SCENARIOS

### 7.1 Insufficient Resources
- **Scenario:** No available static IPs in POS pool
- **Handling:** Client creation blocked, manager notified

### 7.2 Bandwidth Exhaustion
- **Scenario:** Total bandwidth pool fully allocated
- **Handling:** New POS creation or allocation increase blocked

### 7.3 Payment Discrepancies
- **Scenario:** Payment amount doesn't match invoice
- **Handling:** Partial payments or overpayments tracked, status calculated

### 7.4 Concurrent Updates
- **Scenario:** Multiple users updating same entity
- **Handling:** Timestamp tracking, last update wins (standard approach)

### 7.5 Data Integrity
- **Scenario:** Orphaned records or broken references
- **Handling:** Foreign key constraints prevent orphaned records

---

## 8. REPORTING AND ANALYTICS SCENARIOS

### 8.1 Financial Reports
- Total revenue per POS
- Outstanding invoices
- Payment collection rates
- Account balances

### 8.2 Operational Reports
- Active clients per POS
- Subscription statistics
- Service plan popularity
- Bandwidth utilization

### 8.3 Client Reports
- Individual client history
- Payment history
- Usage statistics
- Service status

---

This comprehensive documentation covers all entities, relationships, workflows, and scenarios in the WSP Management System.

