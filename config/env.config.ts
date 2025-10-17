export const envConfig = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:123@localhost:5432/wsp_automation',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiration: process.env.JWT_EXPIRATION || '1d',
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
};
