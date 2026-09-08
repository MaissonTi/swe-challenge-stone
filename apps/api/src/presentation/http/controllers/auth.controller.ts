import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserNotFoundError } from '../../../domain/errors/user-not-found.error';
import { VerifiedTokenPayload } from '../../../domain/protocols/cryptography/encrypter.interface';
import {
  ILoginUseCase,
  LOGIN_USE_CASE,
} from '../../../domain/usecases/authenticate/login.usecase';
import {
  ILogoutUseCase,
  LOGOUT_USE_CASE,
} from '../../../domain/usecases/authenticate/logout.usecase';
import {
  IRefreshTokenUseCase,
  REFRESH_TOKEN_USE_CASE,
} from '../../../domain/usecases/authenticate/refresh-token.usecase';
import {
  IRegisterUserUseCase,
  REGISTER_USER_USE_CASE,
} from '../../../domain/usecases/user/register-user.usecase';
import {
  GET_PROFILE_USE_CASE,
  IGetProfileUseCase,
} from '../../../domain/usecases/user/get-profile.usecase';
import { CurrentUser } from '../../../infra/auth/current-user.decorator';
import { Public } from '../../../infra/auth/public.decorator';
import { TraceRoot } from '../../../observability/trace-root.decorator';
import { RateLimit } from '../../../infra/rate-limit/rate-limit.decorator';
import {
  ApiBearerProtected,
  ApiRateLimited,
} from '../../../infra/swagger/api-common-responses.decorator';
import { ErrorResponseDto } from '../dtos/common/error-response.dto';
import { LoginDto } from '../dtos/auth/login.dto';
import { LogoutDto } from '../dtos/auth/logout.dto';
import { ProfileResponseDto } from '../dtos/auth/profile-response.dto';
import { RefreshDto } from '../dtos/auth/refresh.dto';
import { RegisterDto } from '../dtos/auth/register.dto';
import { TokenResponseDto } from '../dtos/auth/token-response.dto';

// JWT-shaped strings, deliberately fake, just to illustrate the
// response shape in Swagger.
const EXAMPLE_ACCESS_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhY2Nlc3MtZXhhbXBsZSIsInR5cGUiOiJhY2Nlc3MifQ.SIGNATURE';
const EXAMPLE_REFRESH_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoLWV4YW1wbGUiLCJ0eXBlIjoicmVmcmVzaCJ9.SIGNATURE';
const EXAMPLE_TOKEN_PAIR = {
  accessToken: EXAMPLE_ACCESS_TOKEN,
  refreshToken: EXAMPLE_REFRESH_TOKEN,
};

@ApiTags('auth')
@ApiRateLimited()
@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USER_USE_CASE)
    private readonly registerUserUseCase: IRegisterUserUseCase,
    @Inject(LOGIN_USE_CASE) private readonly loginUseCase: ILoginUseCase,
    @Inject(REFRESH_TOKEN_USE_CASE)
    private readonly refreshTokenUseCase: IRefreshTokenUseCase,
    @Inject(LOGOUT_USE_CASE) private readonly logoutUseCase: ILogoutUseCase,
    @Inject(GET_PROFILE_USE_CASE)
    private readonly getProfileUseCase: IGetProfileUseCase,
  ) {}

  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Always responds 204, even if the e-mail is already registered - the ' +
      'response never reveals whether an account already exists. Rate limit ' +
      'on this route is 10 requests/minute per client IP.',
  })
  @ApiNoContentResponse({ description: 'Registration accepted' })
  @ApiBadRequestResponse({
    description: 'Password does not meet the policy',
    type: ErrorResponseDto,
  })
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 60 })
  @Post('register')
  @HttpCode(HttpStatus.NO_CONTENT)
  @TraceRoot()
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.registerUserUseCase.execute(dto);
  }

  @ApiOperation({
    summary: 'Log in with e-mail and password',
    description:
      'Issues an access token (15 min) and a refresh token (7 days). Rate ' +
      'limit on this route is 5 requests/minute per client IP - stricter ' +
      'than the default, since login is the classic brute-force target.',
  })
  @ApiOkResponse({
    description: 'Authenticated',
    type: TokenResponseDto,
    example: EXAMPLE_TOKEN_PAIR,
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid credentials (same message for wrong e-mail or password)',
    type: ErrorResponseDto,
  })
  // Stricter than the default: login is the classic brute-force target.
  @Public()
  @RateLimit({ limit: 5, windowSeconds: 60 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @TraceRoot()
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    const { accessToken, refreshToken } = await this.loginUseCase.execute(dto);
    return { accessToken, refreshToken };
  }

  @ApiOperation({
    summary: 'Rotate a refresh token',
    description:
      'Single-use: the presented refresh token is invalidated and a new ' +
      'access/refresh pair is issued. Reusing an already-rotated refresh ' +
      'token is treated as theft and revokes the whole token family.',
  })
  @ApiOkResponse({
    description: 'New token pair issued',
    type: TokenResponseDto,
    example: EXAMPLE_TOKEN_PAIR,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or reused refresh token',
    type: ErrorResponseDto,
  })
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @TraceRoot()
  async refresh(@Body() dto: RefreshDto): Promise<TokenResponseDto> {
    const { accessToken, refreshToken } =
      await this.refreshTokenUseCase.execute(dto);
    return { accessToken, refreshToken };
  }

  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the current access token and, if provided, the refresh token.',
  })
  @ApiNoContentResponse({ description: 'Logged out' })
  @ApiBearerProtected()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @TraceRoot((args) => (args[0] as VerifiedTokenPayload | undefined)?.sub)
  async logout(
    @CurrentUser() user: VerifiedTokenPayload,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    await this.logoutUseCase.execute({
      accessJti: user.jti,
      accessExp: user.exp,
      refreshToken: dto.refreshToken,
    });
  }

  @ApiOperation({
    summary: 'Get the current authenticated user',
    description: 'Returns the profile of the user the access token belongs to.',
  })
  @ApiOkResponse({
    description: 'Current user profile',
    type: ProfileResponseDto,
    example: {
      userId: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      email: 'demo@stone.com.br',
      createdAt: '2026-01-15T12:34:56.000Z',
    },
  })
  @ApiBearerProtected()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @TraceRoot((args) => (args[0] as VerifiedTokenPayload | undefined)?.sub)
  async me(
    @CurrentUser() user: VerifiedTokenPayload,
  ): Promise<ProfileResponseDto> {
    try {
      return await this.getProfileUseCase.execute({ userId: user.sub });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new UnauthorizedException('Invalid session');
      }
      throw err;
    }
  }
}
