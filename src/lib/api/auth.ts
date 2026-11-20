import { saveAuthToken } from '@/src/lib/auth/token';

import { requestPublic } from './client';
import {
  EmailVerificationConfirmIn,
  EmailVerificationRequestIn,
  PasswordResetConfirmIn,
  PasswordResetRequestIn,
  tokenOutSchema,
  UserLoginIn,
} from './schemas';

export async function login(payload: UserLoginIn) {
  const response = await requestPublic(
    '/users/login',
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
    tokenOutSchema,
  );
  await saveAuthToken(response.access_token);
  return response;
}

// A API responde igual para e-mail cadastrado ou nao, de proposito, para nao
// revelar quem tem conta. Por isso nao ha retorno util aqui: o app so pode
// dizer que, se houver conta, o codigo foi enviado.
export async function requestPasswordReset(payload: PasswordResetRequestIn) {
  await requestPublic('/users/password-reset/request', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function confirmPasswordReset(payload: PasswordResetConfirmIn) {
  await requestPublic('/users/password-reset/confirm', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

// Reenvia o codigo de confirmacao do e-mail. Como na recuperacao de senha, a
// API responde igual para qualquer e-mail.
export async function requestEmailVerification(payload: EmailVerificationRequestIn) {
  await requestPublic('/users/verify-email/request', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function confirmEmailVerification(payload: EmailVerificationConfirmIn) {
  await requestPublic('/users/verify-email/confirm', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

