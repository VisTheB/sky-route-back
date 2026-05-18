import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './firebase-auth.guard';

export const CurrentUserUid = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user.uid;
  },
);
