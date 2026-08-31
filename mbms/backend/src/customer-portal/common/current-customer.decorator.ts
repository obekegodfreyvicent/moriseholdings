import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedCustomer } from './customer-auth.types';

export const CurrentCustomer = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
