import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, UnsupportedMediaTypeException, ParseUUIDPipe } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthRequest, header, Public, requireOrigin } from './auth.guard';
import { MobileAuthService } from './mobile-auth.service';
class EnrollDto {
  @IsString() @Length(1, 64) @Matches(/^[^\x00-\x1f\x7f]+$/) name!: string;
}
class RefreshDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) refreshToken!: string;
}
@Controller('auth/mobile')
export class MobileAuthController {
  constructor(private readonly mobile: MobileAuthService, private readonly auth: AuthService) {}
  private json(request: AuthRequest) {
    requireOrigin(request, this.auth.origin);
    if (!(header(request, 'content-type') ?? '').match(/^application\/json(?:\s*;|$)/i)) throw new UnsupportedMediaTypeException();
  }
  private response(result: { token: string; refreshToken: string; expiresAt: string }) {
    // Only native enrollment/refresh receives tokens. Never used by the WEB login response.
    return { authenticated: true, ...result, csrf: this.auth.csrf(result.token) };
  }
  @Post('enroll') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async enroll(@Req() request: AuthRequest, @Body() body: EnrollDto) {
    this.json(request);
    return this.response(await this.mobile.enroll(request.ownerToken!, body.name));
  }
  @Public() @Post('refresh') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async refresh(@Req() request: AuthRequest, @Body() body: RefreshDto) {
    this.json(request);
    return this.response(await this.mobile.refresh(body.refreshToken));
  }
  @Public() @Post('disconnect') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async disconnect(@Req() request: AuthRequest, @Body() body: RefreshDto) {
    this.json(request);
    await this.mobile.disconnect(body.refreshToken);
    return { authenticated: false };
  }
  @Get('devices') @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.mobile.list(request.ownerToken!); }
  @Post('devices/:id/revoke') @HttpCode(200) @Header('Cache-Control', 'no-store')
  async revoke(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.mobile.revoke(request.ownerToken!, id);
    return { revoked: true };
  }
}
