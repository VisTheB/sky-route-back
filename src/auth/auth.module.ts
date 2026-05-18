import { Global, Module } from '@nestjs/common';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { BookingOwnerGuard } from './booking-owner.guard';

@Global()
@Module({
  providers: [FirebaseAuthService, FirebaseAuthGuard, BookingOwnerGuard],
  exports: [FirebaseAuthService, FirebaseAuthGuard, BookingOwnerGuard],
})
export class AuthModule {}
