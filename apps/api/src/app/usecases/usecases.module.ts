import { Module } from '@nestjs/common';
import { InfraModule } from '../../infra/infra.module';
import { LOGIN_USE_CASE } from '../../domain/usecases/authenticate/login.usecase';
import { LOGOUT_USE_CASE } from '../../domain/usecases/authenticate/logout.usecase';
import { REFRESH_TOKEN_USE_CASE } from '../../domain/usecases/authenticate/refresh-token.usecase';
import { REGISTER_USER_USE_CASE } from '../../domain/usecases/user/register-user.usecase';
import { GET_PROFILE_USE_CASE } from '../../domain/usecases/user/get-profile.usecase';
import { CREATE_PRODUCT_USE_CASE } from '../../domain/usecases/products/create-product.usecase';
import { UPDATE_PRODUCT_USE_CASE } from '../../domain/usecases/products/update-product.usecase';
import { DELETE_PRODUCT_USE_CASE } from '../../domain/usecases/products/delete-product.usecase';
import { LIST_PRODUCTS_USE_CASE } from '../../domain/usecases/products/list-products.usecase';
import { LoginUseCase } from './authenticate/login.usecase';
import { LogoutUseCase } from './authenticate/logout.usecase';
import { RefreshTokenUseCase } from './authenticate/refresh-token.usecase';
import { RegisterUserUseCase } from './user/register-user.usecase';
import { GetProfileUseCase } from './user/get-profile.usecase';
import { CreateProductUseCase } from './products/create-product.usecase';
import { UpdateProductUseCase } from './products/update-product.usecase';
import { DeleteProductUseCase } from './products/delete-product.usecase';
import { ListProductsUseCase } from './products/list-products.usecase';

@Module({
  imports: [InfraModule],
  providers: [
    { provide: LOGIN_USE_CASE, useClass: LoginUseCase },
    { provide: REFRESH_TOKEN_USE_CASE, useClass: RefreshTokenUseCase },
    { provide: LOGOUT_USE_CASE, useClass: LogoutUseCase },
    { provide: REGISTER_USER_USE_CASE, useClass: RegisterUserUseCase },
    { provide: GET_PROFILE_USE_CASE, useClass: GetProfileUseCase },
    { provide: CREATE_PRODUCT_USE_CASE, useClass: CreateProductUseCase },
    { provide: UPDATE_PRODUCT_USE_CASE, useClass: UpdateProductUseCase },
    { provide: DELETE_PRODUCT_USE_CASE, useClass: DeleteProductUseCase },
    { provide: LIST_PRODUCTS_USE_CASE, useClass: ListProductsUseCase },
  ],
  exports: [
    LOGIN_USE_CASE,
    REFRESH_TOKEN_USE_CASE,
    LOGOUT_USE_CASE,
    REGISTER_USER_USE_CASE,
    GET_PROFILE_USE_CASE,
    CREATE_PRODUCT_USE_CASE,
    UPDATE_PRODUCT_USE_CASE,
    DELETE_PRODUCT_USE_CASE,
    LIST_PRODUCTS_USE_CASE,
  ],
})
export class UseCasesModule {}
