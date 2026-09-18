import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ok } from '../../common/http/api-response';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return ok(result);
  }

  // Refresh Token으로 재발급 — access token이 없는(만료된) 상태에서 호출하는 경로라 Public이다.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return ok(result);
  }

  // Refresh Token revoke만으로 충분 — access token은 어차피 최대 30분 뒤 자연 만료된다.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    this.authService.logout(dto.refreshToken);
    return ok({ loggedOut: true });
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return ok(user);
  }

  @Patch('password')
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: RequestUser) {
    await this.authService.changePassword(user.accountId, dto.currentPassword, dto.newPassword);
    return ok({ updated: true });
  }
}
