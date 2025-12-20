import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from '../decorators/capabilities.decorator';
import { Capability } from '@prisma/client';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredCapabilities = this.reflector.getAllAndOverride<Capability[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no capabilities required, allow access (delegate to RolesGuard)
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // WSP_ADMIN has all capabilities
    if (user.role === 'WSP_ADMIN') {
      return true;
    }

    // For SUB_ADMIN, check if they have all required capabilities
    if (user.role === 'SUB_ADMIN') {
      const userCapabilities = user.capabilities || [];
      const hasAllCapabilities = requiredCapabilities.every((cap) =>
        userCapabilities.includes(cap),
      );

      if (!hasAllCapabilities) {
        throw new ForbiddenException(
          `Missing required capabilities: ${requiredCapabilities.join(', ')}`,
        );
      }

      return true;
    }

    // For POS_MANAGER, they have implicit capabilities based on their role
    // POS scope enforcement happens at the service level
    // However, for certain operations (like payments), they need explicit capabilities
    if (user.role === 'POS_MANAGER') {
      // Check if this is a payment-related capability that requires explicit permission
      const paymentCapabilities = [
        Capability.PAYMENTS_CREATE,
        Capability.PAYMENTS_READ,
      ];
      const requiresExplicitCapability = requiredCapabilities.some((cap) =>
        paymentCapabilities.includes(cap),
      );

      if (requiresExplicitCapability) {
        // For payment operations, POS_MANAGER needs explicit capability
        const userCapabilities = user.capabilities || [];
        const hasAllCapabilities = requiredCapabilities.every((cap) =>
          userCapabilities.includes(cap),
        );

        if (!hasAllCapabilities) {
          throw new ForbiddenException(
            `Missing required capabilities: ${requiredCapabilities.join(', ')}`,
          );
        }
      }
      // For other operations, POS_MANAGER has implicit access (POS scope enforced at service level)
      return true;
    }

    // For CLIENT and other roles, capabilities guard doesn't apply
    // They are handled by RolesGuard
    return true;
  }
}

