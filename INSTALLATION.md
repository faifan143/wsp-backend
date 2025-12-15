# Installation Guide - WSP Backend

This guide will help you set up the Wireless Service Provider Management System backend on your local machine.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation Options](#installation-options)
  - [Option 1: Using Docker (Recommended)](#option-1-using-docker-recommended)
  - [Option 2: Native PostgreSQL](#option-2-native-postgresql)
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
- **Code Editor** - VSCode recommended

### Additional Requirements by Installation Method:

**For Docker Installation:**
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop)

**For Native PostgreSQL Installation:**
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)

---

## Installation Options

### Option 1: Using Docker (Recommended)

Docker provides an isolated, consistent environment and is the easiest way to get started.

#### Step 1: Clone the Repository (if not already done)

```bash
git clone <repository-url>
cd wsp-backend
```

#### Step 2: Install Node Dependencies

```bash
npm install
```

#### Step 3: Start PostgreSQL with Docker

```bash
# Start PostgreSQL container in detached mode
docker-compose up -d

# Verify container is running
docker ps
```

You should see a container named `wsp-postgres` running.

#### Step 4: Wait for Database Initialization

```bash
# Wait 10-15 seconds for PostgreSQL to fully initialize
# Check logs to ensure it's ready
docker logs wsp-postgres
```

Look for a message like: `database system is ready to accept connections`

#### Step 5: Continue to [Database Setup](#database-setup)

---

### Option 2: Native PostgreSQL

If you prefer not to use Docker or need to run PostgreSQL natively.

#### Step 1: Install PostgreSQL

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

#### Step 2: Create Database

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

#### Step 3: Install Node Dependencies

```bash
cd wsp-backend
npm install
```

#### Step 4: Continue to [Environment Configuration](#environment-configuration)

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

### Step 3: Seed the Database (Optional)

Add sample data for testing and development:

```bash
npm run prisma:seed
```

This creates:
- Sample users (WSP_ADMIN, POS_MANAGER, CLIENT)
- Sample POS locations
- Sample service plans
- Sample clients and subscriptions

**Note:** You can skip this step if you want to start with a clean database.

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

### 4. Check PostgreSQL Service

**Docker:**
```bash
docker ps
# Should show wsp-postgres container running
```

**Native PostgreSQL:**

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
   ```bash
   # Docker
   docker ps
   docker logs wsp-postgres

   # Native
   # Check service status (see Verification section)
   ```

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

### Problem: Docker container won't start

**Solution:**
```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: Deletes database data)
docker-compose down -v

# Restart
docker-compose up -d

# Check logs
docker logs wsp-postgres
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

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format
```

### Docker Commands

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker logs wsp-postgres
docker logs -f wsp-postgres  # Follow logs

# Restart containers
docker-compose restart

# Remove containers and volumes
docker-compose down -v

# Access PostgreSQL shell
docker exec -it wsp-postgres psql -U postgres -d wsp_automation
```

---

## Next Steps

After successful installation:

1. **Review Documentation:**
   - [Overview.md](docs/Overview.md) - API endpoints and DTOs
   - [SYSTEM_DESCRIPTION_AND_SCENARIOS.md](docs/SYSTEM_DESCRIPTION_AND_SCENARIOS.md) - Business logic

2. **Explore the API:**
   - Use Postman or similar tool
   - Test authentication endpoints
   - Create sample data

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
3. Check Docker/PostgreSQL logs
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

Check your seed script at `prisma/seed.ts` for default user credentials.

**Common defaults:**
- Admin: `admin@wsp.com` / `admin123`
- POS Manager: `manager@pos.com` / `manager123`
- Client: `client@example.com` / `client123`

**⚠️ Important:** Change these in production!

---

## License

[Your License Here]

## Contributors

[Your Team/Contributors]

---

**Happy Coding! 🚀**
