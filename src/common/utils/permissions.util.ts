import { Capability } from '@prisma/client';

export class PermissionsUtil {
  /**
   * Check if user has all required capabilities
   */
  static hasCapabilities(user: any, ...requiredCapabilities: Capability[]): boolean {
    // WSP_ADMIN has all capabilities
    if (user?.role === 'WSP_ADMIN') {
      return true;
    }

    // SUB_ADMIN needs to have all required capabilities
    if (user?.role === 'SUB_ADMIN') {
      const userCapabilities = user.capabilities || [];
      return requiredCapabilities.every((cap) => userCapabilities.includes(cap));
    }

    return false;
  }

  /**
   * Check if user has any of the required capabilities
   */
  static hasAnyCapability(user: any, ...capabilities: Capability[]): boolean {
    if (user?.role === 'WSP_ADMIN') {
      return true;
    }

    if (user?.role === 'SUB_ADMIN') {
      const userCapabilities = user.capabilities || [];
      return capabilities.some((cap) => userCapabilities.includes(cap));
    }

    return false;
  }

  /**
   * Check if user has a specific capability
   */
  static hasCapability(user: any, capability: Capability): boolean {
    if (user?.role === 'WSP_ADMIN') {
      return true;
    }

    if (user?.role === 'SUB_ADMIN') {
      const userCapabilities = user.capabilities || [];
      return userCapabilities.includes(capability);
    }

    return false;
  }

  /**
   * Check if user can manage another user (based on roles and capabilities)
   */
  static canManageUser(currentUser: any, targetUserRole: string): boolean {
    // WSP_ADMIN can manage anyone
    if (currentUser?.role === 'WSP_ADMIN') {
      return true;
    }

    // SUB_ADMIN can manage POS_MANAGER and CLIENT users, but not WSP_ADMIN or SUB_ADMIN
    if (currentUser?.role === 'SUB_ADMIN') {
      return targetUserRole !== 'WSP_ADMIN' && targetUserRole !== 'SUB_ADMIN';
    }

    return false;
  }
}

