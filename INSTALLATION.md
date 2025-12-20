# Installation Guide - WSP Backend

This guide will help you set up the Wireless Service Provider Management System backend on your local machine.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Development Commands](#development-commands)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org)
- **npm** (comes with Node.js) or **yarn**
- **Git** (for version control)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Code Editor** - VSCode recommended

---

## Installation

### Step 1: Clone the Repository (if not already done)

```bash
git clone <repository-url>
cd wsp-backend
```

### Step 2: Install PostgreSQL

**Windows:**
1. Download installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer
3. During installation:
   - Set password for `postgres` user (remember this!)
   - Default port: `5432` (recommended)
   - Install pgAdmin 4 (optional GUI tool)

**macOS:**
```bash
# Using Homebrew
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Step 3: Create Database

**Windows (Command Prompt or PowerShell):**
```bash
# Login to PostgreSQL
psql -U postgres

# In psql shell, create database:
CREATE DATABASE wsp_automation;

# Exit psql
\q
```

**macOS/Linux:**
```bash
# Switch to postgres user (Linux)
sudo -u postgres psql

# Or directly (macOS)
psql postgres

# Create database
CREATE DATABASE wsp_automation;

# Exit
\q
```

### Step 4: Install Node Dependencies

```bash
npm install
```

### Step 5: Continue to [Environment Configuration](#environment-configuration)

---

## Environment Configuration

The project uses a `.env` file for configuration. A sample file is already present in the repository.

### Check/Update Environment Variables

Open the `.env` file and verify the settings:

```env
# Database Connection
DATABASE_URL="postgresql://postgres:123@localhost:5432/wsp_automation"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRATION="1d"

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN="http://localhost:3001"
```

### Important: Update Database Password

If you set a different password during PostgreSQL installation, update the `DATABASE_URL`:

```env
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/wsp_automation"
```

**Example:**
- If your password is `mypassword123`:
  ```env
  DATABASE_URL="postgresql://postgres:mypassword123@localhost:5432/wsp_automation"
  ```

---

## Database Setup

Now that PostgreSQL is running and configured, set up the database schema.

### Step 1: Generate Prisma Client

```bash
npm run prisma:generate
```

This generates the Prisma Client based on your schema, allowing your application to interact with the database.

### Step 2: Run Database Migrations

```bash
npm run prisma:migrate
```

This will:
- Create all database tables
- Set up relationships and constraints
- Apply the schema defined in `prisma/schema.prisma`

You should see output like:
```
✔ Generated Prisma Client
✔ Applied migration(s)
```

### Step 3: Seed the Database (Recommended for Development)

The seed script populates the database with comprehensive test data for development and testing:

```bash
npm run prisma:seed
```

#### What Gets Created

The seed script creates a complete test environment with:

**Users:**
- **WSP_ADMIN**: `admin` / `admin123` - Full system access
- **SUB_ADMIN (Finance)**: `finance_admin` / `finance123` - Finance capabilities (invoices, payments)
- **SUB_ADMIN (Operations)**: `operations_admin` / `operations123` - Operations capabilities (clients, subscriptions)
- **SUB_ADMIN (Read-Only)**: `readonly_admin` / `readonly123` - Read-only access to all resources
- **POS_MANAGER**: `pos_manager_1` / `manager123` - Manages POS location 1
- **CLIENT**: `client_ahmed` / `client123` - Regular client user

**Infrastructure:**
- 3 POS locations with allocated bandwidth
- Bandwidth pool with total capacity
- Multiple service plans (POSTPAID and PREPAID)
- Static IP pool with available and assigned IPs

**Business Data:**
- Multiple clients with different connection types (DYNAMIC, STATIC, PPPOE)
- Active subscriptions linked to clients and service plans
- Invoices (paid, unpaid, overdue)
- Payment records
- PPPoE change requests (various statuses)
- Suspension history records
- Usage logs for subscriptions

#### Default Test Credentials

After seeding, you can use these credentials to test the API:

| Role | Username | Password | Capabilities |
|------|----------|----------|--------------|
| WSP Admin | `admin` | `admin123` | All capabilities |
| Finance Admin | `finance_admin` | `finance123` | INVOICES_*, PAYMENTS_* |
| Operations Admin | `operations_admin` | `operations123` | CLIENTS_*, SUBSCRIPTIONS_* |
| Read-Only Admin | `readonly_admin` | `readonly123` | All READ capabilities |
| POS Manager | `pos_manager_1` | `manager123` | POS-scoped access |
| Client | `client_ahmed` | `client123` | Read-only own data |

**⚠️ Security Note:** These are default test credentials. **NEVER use these in production!** Always change passwords and create new users for production environments.

#### Seed Script Features

- **Automatic cleanup**: Clears existing data before seeding
- **Foreign key aware**: Deletes data in correct order to respect constraints
- **Comprehensive coverage**: Creates data for all major entities and relationships
- **Realistic scenarios**: Includes various statuses, connection types, and business states

#### Re-seeding the Database

If you need to reset and re-seed:

```bash
# Option 1: Reset migrations and re-seed (WARNING: Deletes all data)
npm run prisma:migrate reset
# This will automatically run the seed script after reset

# Option 2: Manual re-seed (if data structure hasn't changed)
npm run prisma:seed
```

**Note:** The seed script automatically clears existing data before creating new records, so you can safely run it multiple times.

---

## Running the Application

### Development Mode (with hot-reload)

```bash
npm run start:dev
```

The server will start at: **http://localhost:3000**

You should see output like:
```
[Nest] 12345  - Application is running on: http://localhost:3000
```

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### Standard Mode

```bash
npm start
```

---

## Verification

### 1. Check Server Health

Open your browser or use curl:

```bash
curl http://localhost:3000
```

You should receive a response from the server.

### 2. Check Database Connection

```bash
# Open Prisma Studio - a visual database browser
npx prisma studio
```

This opens a GUI at **http://localhost:5555** where you can view and edit your database tables.

### 3. Test API Endpoints

Try accessing the API documentation (if Swagger is configured) or test a simple endpoint:

```bash
# Example: Check if auth endpoint is accessible
curl http://localhost:3000/auth/login
```

### 4. Test Authentication

After seeding, test login with default credentials:

```bash
# Test admin login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

You should receive a JWT access token in the response.

### 5. Check PostgreSQL Service

**Windows:**
```bash
# Check service status
sc query postgresql-x64-14
```

**macOS:**
```bash
brew services list | grep postgresql
```

**Linux:**
```bash
sudo systemctl status postgresql
```

---

## Troubleshooting

### Problem: "Port 3000 is already in use"

**Solution:**
```bash
# Option 1: Change port in .env file
PORT=3001

# Option 2: Find and kill the process using port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Problem: "Cannot connect to database"

**Solution:**

1. **Check PostgreSQL is running:**
   - Check service status (see Verification section)

2. **Verify DATABASE_URL in .env:**
   - Check username, password, host, port, database name
   - Ensure no extra spaces or quotes

3. **Test connection manually:**
   ```bash
   psql -U postgres -d wsp_automation
   ```

4. **Check firewall settings** (native PostgreSQL only)

### Problem: "Prisma Client not generated"

**Solution:**
```bash
npm run prisma:generate
```

### Problem: "Migration failed"

**Solution:**
```bash
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Or manually reset
psql -U postgres -d wsp_automation -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run prisma:migrate
```

### Problem: "Module not found" errors

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Or use cache clean
npm cache clean --force
npm install
```

---

## Development Commands

### Database Management

```bash
# Generate Prisma Client
npm run prisma:generate

# Create a new migration
npm run prisma:migrate dev --name your_migration_name

# Apply migrations
npm run prisma:migrate

# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Seed database
npm run prisma:seed

# Open Prisma Studio (GUI)
npx prisma studio

# View current schema
npx prisma db pull
```

### Application Commands

```bash
# Development mode (hot-reload)
npm run start:dev

# Production build
npm run build

# Production mode
npm run start:prod

# Run unit tests
npm run test

# Run e2e tests (requires database and server running)
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

---

## Testing

The project includes comprehensive end-to-end (e2e) tests that verify all API endpoints and business logic.

### Prerequisites for Testing

Before running tests, ensure:

1. **Database is set up and migrated:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

2. **Server is NOT running** (tests start their own instance)

3. **Test database is available** (tests use the same database as development)

### Running E2E Tests

```bash
# Run all e2e tests
npm run test:e2e
```

This will:
- Start the NestJS application
- Run all test suites
- Clean up test data after each test
- Shut down the application

### Test Coverage

The e2e tests cover:

1. **Authentication (`auth.e2e-spec.ts`)**
   - Login with valid/invalid credentials
   - Logout functionality
   - Token refresh

2. **Users (`capabilities.e2e-spec.ts`)**
   - User creation with different roles
   - Capability assignment for SUB_ADMIN
   - User activation/deactivation

3. **Clients (`clients.e2e-spec.ts`)**
   - Client CRUD operations
   - Connection type management (DYNAMIC, STATIC, PPPOE)
   - Client suspension and activation
   - Static IP assignment/release

4. **Subscriptions (`subscriptions.e2e-spec.ts`)**
   - Subscription creation
   - Renewal and upgrade
   - Termination
   - Usage log creation

5. **Invoices & Payments (`invoices-payments.e2e-spec.ts`)**
   - Invoice creation and cancellation
   - Payment processing (full, partial, with extra amount)
   - Invoice status calculation

6. **Other Flows (`other-flows.e2e-spec.ts`)**
   - Service plan management
   - PPPoE request workflow (create, approve, reject, complete)
   - POS management

7. **Scope Restrictions (`scope-restrictions.e2e-spec.ts`)**
   - POS_MANAGER access limitations
   - CLIENT access restrictions
   - Capability-based access control

### Test Structure

Tests are organized in `test/e2e/` directory:

```
test/
├── e2e/
│   ├── auth.e2e-spec.ts
│   ├── capabilities.e2e-spec.ts
│   ├── clients.e2e-spec.ts
│   ├── invoices-payments.e2e-spec.ts
│   ├── other-flows.e2e-spec.ts
│   ├── scope-restrictions.e2e-spec.ts
│   └── subscriptions.e2e-spec.ts
├── utils/
│   ├── test-helpers.ts      # Helper functions for tests
│   └── test-setup.ts        # Test configuration
└── jest-e2e.json           # Jest e2e configuration
```

### Test Helpers

The `TestHelpers` class provides utilities for:

- **Database cleanup**: `cleanDatabase()` - Removes all test data
- **Authentication**: `login()` - Get access tokens for test users
- **User creation**: `createWspAdmin()`, `createSubAdmin()`, etc.
- **Resource creation**: `createPos()`, `createClient()`, `createServicePlan()`, etc.

### Running Specific Test Suites

```bash
# Run only authentication tests
npm run test:e2e -- auth.e2e-spec

# Run only client tests
npm run test:e2e -- clients.e2e-spec

# Run tests matching a pattern
npm run test:e2e -- --testNamePattern="should create client"
```

### Test Database

**Important:** E2E tests use the same database as development. Tests automatically clean up data after each test suite, but:

- Tests run in sequence (not parallel) to avoid conflicts
- Each test suite cleans up its own data
- The database should be seeded before running tests for consistent results

### Debugging Tests

```bash
# Run tests in debug mode
npm run test:debug

# Run with verbose output
npm run test:e2e -- --verbose

# Run a single test file
npm run test:e2e -- clients.e2e-spec.ts
```

### Test Best Practices

1. **Always seed before testing** to ensure consistent test data
2. **Don't run tests while server is running** - tests start their own instance
3. **Check test output** for detailed error messages
4. **Review test helpers** in `test/utils/test-helpers.ts` for reusable functions

### Troubleshooting Tests

**Problem: "Cannot connect to database"**
- Ensure database is running and accessible
- Check DATABASE_URL in environment
- Run migrations: `npm run prisma:migrate`

**Problem: "Port 3000 already in use"**
- Stop any running development server
- Tests need to start their own server instance

**Problem: "Test data conflicts"**
- Run `npm run prisma:seed` to reset test data
- Or manually clean database: `npm run prisma:migrate reset`

---

## Next Steps

After successful installation:

1. **Review Documentation:**
   - [Overview.md](docs/Overview.md) - API endpoints and DTOs
   - [SYSTEM_DESCRIPTION_AND_SCENARIOS.md](docs/SYSTEM_DESCRIPTION_AND_SCENARIOS.md) - Business logic

2. **Explore the API:**
   - Import the Postman collection: `postman/WSP_Backend_API_Complete.postman_collection.json`
   - Test authentication endpoints with seeded credentials
   - Explore all 80+ endpoints organized by module

3. **Run Tests:**
   - Execute e2e tests: `npm run test:e2e`
   - Verify all endpoints work correctly
   - Check test coverage: `npm run test:cov`

3. **Connect Frontend:**
   - Update CORS_ORIGIN in .env if needed
   - Point your frontend to http://localhost:3000

4. **Configure for Production:**
   - Change JWT_SECRET to a secure random string
   - Update database credentials
   - Set NODE_ENV=production
   - Configure proper CORS settings

---

## System Requirements

### Minimum Requirements
- **RAM:** 4GB
- **Storage:** 2GB free space
- **OS:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)

### Recommended Requirements
- **RAM:** 8GB or more
- **Storage:** 5GB free space
- **OS:** Latest stable version

---

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/your-repo/wsp-backend/issues)
2. Review error logs in console
3. Check PostgreSQL logs
4. Consult the official documentation:
   - [NestJS Documentation](https://docs.nestjs.com)
   - [Prisma Documentation](https://www.prisma.io/docs)
   - [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

## Quick Reference

### Essential Commands

```bash
# Install dependencies
npm install

# Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Start development server
npm run start:dev

# View database
npx prisma studio
```

### Default Credentials (after seeding)

After running `npm run prisma:seed`, you can use these credentials:

| Role | Username | Password | Email |
|------|----------|----------|-------|
| WSP Admin | `admin` | `admin123` | admin@wsp.com |
| Finance Admin | `finance_admin` | `finance123` | finance@wsp.com |
| Operations Admin | `operations_admin` | `operations123` | operations@wsp.com |
| Read-Only Admin | `readonly_admin` | `readonly123` | readonly@wsp.com |
| POS Manager | `pos_manager_1` | `manager123` | pos_manager_1@wsp.com |
| Client | `client_ahmed` | `client123` | ahmed@client.com |

**⚠️ Important:** These are test credentials only. **NEVER use these in production!** Always create new users with strong passwords for production environments.

### Postman Collection

A complete Postman collection is available at:
- `postman/WSP_Backend_API_Complete.postman_collection.json`

This collection includes:
- All 80+ API endpoints
- Organized by 13 modules
- Pre-configured authentication
- Example request bodies
- Environment variables setup

**To use:**
1. Import the collection into Postman
2. Set `base_url` environment variable to `http://localhost:3000`
3. Use the Login request to get an access token
4. Token is automatically saved to `access_token` environment variable

---

## License

[Your License Here]

## Contributors

[Your Team/Contributors]

---

**Happy Coding! 🚀**
