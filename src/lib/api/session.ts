import { jwtDecode } from 'jwt-decode';

import { clearAuthToken, getAuthToken, saveAuthToken } from '@/src/lib/auth/token';

import { requestJson } from './core';
import { AuthSessionError, isAuthSessionError } from './errors';
import {
  AuthSession,
  TokenPayload,
  tokenOutSchema,
  tokenPayloadSchema,
} from './schemas';

const TOKEN_REFRESH_THRESHOLD_SECONDS = 5 * 60;

export { AuthSessionError, isAuthSessionError };

export async function hasAuthToken() {
  try {
    await getValidAuthSession();
    return true;
  } catch {
    return false;
  }
}

export async function refreshToken() {
  const authSession = await getStoredAuthSession();

  try {
    assertTokenPayloadIsValid(authSession.payload);
  } catch (error) {
    if (isAuthSessionError(error)) {
      await clearAuthToken();
    }

    throw error;
  }

  const response = await requestJson(
    '/users/refresh-token',
    {
      headers: {
        Authorization: `Bearer ${authSession.token}`,
      },
      method: 'POST',
    },
    tokenOutSchema,
  );
  await saveAuthToken(response.access_token);
  return response;
}

export async function getValidAuthSession(): Promise<AuthSession> {
  const authSession = await getStoredAuthSession();

  if (isTokenExpired(authSession.payload)) {
    await clearAuthToken();
    throw new AuthSessionError();
  }

  if (shouldRefreshToken(authSession.payload)) {
    return refreshAuthSession(authSession.token);
  }

  return authSession;
}

async function getStoredAuthSession(): Promise<AuthSession> {
  const authToken = await getAuthToken();

  if (!authToken) {
    await clearAuthToken();
    throw new AuthSessionError('Faça login para continuar.');
  }

  try {
    return {
      payload: getTokenPayload(authToken),
      token: authToken,
    };
  } catch (error) {
    if (isAuthSessionError(error)) {
      await clearAuthToken();
    }

    throw error;
  }
}

async function refreshAuthSession(authToken: string): Promise<AuthSession> {
  const response = await requestJson(
    '/users/refresh-token',
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      method: 'POST',
    },
    tokenOutSchema,
  );
  await saveAuthToken(response.access_token);
  return {
    payload: getTokenPayload(response.access_token),
    token: response.access_token,
  };
}

function getTokenPayload(authToken: string) {
  try {
    return tokenPayloadSchema.parse(jwtDecode<unknown>(authToken));
  } catch (error) {
    if (isAuthSessionError(error)) {
      throw error;
    }

    throw new AuthSessionError('Sessão inválida. Faça login novamente.');
  }
}

function assertTokenPayloadIsValid(tokenPayload: TokenPayload) {
  if (isTokenExpired(tokenPayload)) {
    throw new AuthSessionError();
  }
}

function isTokenExpired(tokenPayload: TokenPayload) {
  if (typeof tokenPayload.exp !== 'number') {
    return false;
  }

  return tokenPayload.exp <= Math.floor(Date.now() / 1000);
}

function shouldRefreshToken(tokenPayload: TokenPayload) {
  if (typeof tokenPayload.exp !== 'number') {
    return false;
  }

  return tokenPayload.exp - Math.floor(Date.now() / 1000) <= TOKEN_REFRESH_THRESHOLD_SECONDS;
}
