import type { LoginEvent, User } from '../types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseUsers(raw: unknown): User[] {
  return (Array.isArray(raw) ? raw : [])
    .map((entry): User | null => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      if (typeof item.uuid !== 'string') return null;
      return {
        uuid: item.uuid,
        full_name: asString(item.full_name),
        email_address: asString(item.email_address),
        verified_phone_number: asString(item.verified_phone_number),
      };
    })
    .filter((value): value is User => value !== null);
}

export function parseLoginHistory(raw: unknown): LoginEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Record<string, unknown>;
  const events = Array.isArray(item.login_events) ? item.login_events : [];
  return events
    .map((entry): LoginEvent | null => {
      if (!entry || typeof entry !== 'object') return null;
      const event = entry as Record<string, unknown>;
      const userAgent =
        event.user_agent && typeof event.user_agent === 'object'
          ? (event.user_agent as Record<string, unknown>)
          : {};
      const location =
        event.location_info && typeof event.location_info === 'object'
          ? (event.location_info as Record<string, unknown>)
          : {};
      return {
        account_uuid: asString(event.account_uuid),
        timestamp: asString(event.timestamp),
        ip_address: asString(event.ip_address),
        user_agent: {
          browser_family: asString(userAgent.browser_family),
          browser_version: asString(userAgent.browser_version),
          os_family: asString(userAgent.os_family),
          os_version: asString(userAgent.os_version),
          device_family: asString(userAgent.device_family),
        },
        method: asString(event.method),
        location_info: {
          country: asString(location.country),
          region: typeof location.region === 'string' ? location.region : null,
          city: typeof location.city === 'string' ? location.city : null,
        },
      };
    })
    .filter((value): value is LoginEvent => value !== null);
}
