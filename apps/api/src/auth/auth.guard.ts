import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { same, sessionCookie } from './crypto';

const PUBLIC = 'pnet:public';
export const Public = () => SetMetadata(PUBLIC, true);
export type AuthRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ownerToken?: string;
};
export function header(request: AuthRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}
export function requireOrigin(request: AuthRequest, origin: string) {
  if (header(request, 'origin') !== origin || header(request, 'sec-fetch-site') === 'cross-site') {
    throw new ForbiddenException('Request origin rejected');
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.get<boolean>(PUBLIC, context.getHandler())) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = sessionCookie(header(request, 'cookie'));
    if (!token) throw new UnauthorizedException('Authentication required');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      requireOrigin(request, this.auth.origin);
      const csrf = header(request, 'x-pnet-csrf') ?? '';
      if (!same(csrf, this.auth.csrf(token))) throw new ForbiddenException('CSRF validation failed');
    }
    await this.auth.authenticate(token);
    request.ownerToken = token;
    return true;
  }
}
