import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountPath && !serviceAccountJson) {
      this.logger.warn('Firebase credentials not configured, Firebase notifications disabled');
      return;
    }

    try {
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else if (serviceAccountPath) {
        const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
        const serviceAccount = require(absolutePath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      this.initialized = true;
      this.logger.log('Firebase initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: data ? this.stringifyData(data) : undefined,
        android: {
          priority: 'high',
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      };

      await admin.messaging().send(message);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Firebase notification: ${error.message}`);
      return false;
    }
  }

  private stringifyData(data: any): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
      }
    }
    return result;
  }
}
