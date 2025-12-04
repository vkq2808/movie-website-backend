import { Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

/**
 * Sanitize HTML characters from strings
 */
function sanitizeString(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeString(item));
  }

  if (typeof value === 'object' && value !== null) {
    const sanitized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeString(value[key]);
      }
    }
    return sanitized;
  }

  return value;
}

@Injectable()
export class SanitizationPipe implements PipeTransform {
  async transform(value: any): Promise<any> {
    return sanitizeString(value);
  }
}
