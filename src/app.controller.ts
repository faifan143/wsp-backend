import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {

  @Get("/health")
  healthCheck(): { status: string; timestamp: string; version: string } {
    return {
      status: "Healthy",
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || "1.0.0",
    };
  }
}
