import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UnsupportedMediaTypeException } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthRequest, header, Public, requireOrigin } from './auth.guard';
import { COOKIE, MAX_MS } from './crypto';

class LoginDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9._-]{2,63}$/) login!: string;
  @IsString() @Length(1, 128) password!: string;
  @IsString() @Matches(/^(?:\d{6}|[a-f0-9]{32})$/) code!: string;
}
type CookieResponse = { setHeader(name: string, value: string): void };
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async login(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse, @Body() body: LoginDto) {
    requireOrigin(request, this.auth.origin);
    if (!(header(request, 'content-type') ?? '').match(/^application\/json(?:\s*;|$)/i)) throw new UnsupportedMediaTypeException();
    const result = await this.auth.login(body.login, body.password, body.code);
    response.setHeader('Set-Cookie', `${COOKIE}=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_MS / 1000}`);
    return { authenticated: true, csrf: result.csrf };
  }
  @Get('session') @Header('Cache-Control', 'no-store')
  session(@Req() request: AuthRequest) { return { authenticated: true, csrf: this.auth.csrf(request.ownerToken!) }; }
  @Post('logout') @HttpCode(200)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    await this.auth.logout(request.ownerToken!);
    response.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return { authenticated: false };
  }
}
