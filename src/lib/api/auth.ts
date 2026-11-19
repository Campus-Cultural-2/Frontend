import { saveAuthToken } from '@/src/lib/auth/token';

import { requestPublic } from './client';
import {
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
