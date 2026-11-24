import { z } from 'zod';

import { clearAuthToken } from '@/src/lib/auth/token';
import { env } from '@/src/lib/config/env';

import {
  ApiError,
  AuthSessionError,
  getFriendlyApiMessage,
  parseApiErrorBody,
} from './errors';

export const API_BASE_URL = env.apiBaseUrl;

export async function requestJson<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
  }

  if (!response.ok) {
    if (response.status === 401 && path === '/users/login') {
      throw new Error('E-mail ou senha inválidos.');
    }

    if (response.status === 401) {
      await clearAuthToken();
      throw new AuthSessionError();
    }

    const responseText = await response.text();
    const errorBody = parseApiErrorBody(responseText);

    if (typeof errorBody?.code === 'string') {
      const details =
        errorBody.details && typeof errorBody.details === 'object'
          ? (errorBody.details as Record<string, unknown>)
          : undefined;
      const friendlyMessage = getFriendlyApiMessage(errorBody.code, path, details);

      if (friendlyMessage) {
        throw new ApiError(friendlyMessage, {
          code: errorBody.code,
          details,
          status: response.status,
        });
      }
    }

    if (response.status === 409 && path.endsWith('/subscription')) {
      throw new Error('Você já está inscrito neste evento.');
    }

    if (response.status === 404 && path.endsWith('/subscription')) {
      throw new Error('Você não está inscrito neste evento.');
    }

    if (response.status === 403) {
      const friendlyMessage = getFriendlyApiMessage('permission_denied', path);
      throw new ApiError(friendlyMessage ?? 'Você não tem permissão para realizar esta ação.', {
        code: 'permission_denied',
        status: response.status,
      });
    }

    if (response.status === 404 && /\/events\/\d+\/(subscribers|participants)$/.test(path)) {
      throw new Error('Não foi possível carregar os participantes deste evento. Tente novamente mais tarde.');
    }

    if (response.status === 404 && path.startsWith('/events/')) {
      throw new Error('Não encontramos este evento. Atualize a tela e tente novamente.');
    }

    throw new Error(getSafeErrorMessage(response.status, path));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error(getInvalidApiResponseMessage(path));
  }

  if (!schema) {
    return responseBody as T;
  }

  try {
    return schema.parse(responseBody);
  } catch {
    throw new Error(getInvalidApiResponseMessage(path));
  }
}

function getSafeErrorMessage(status: number, path: string) {
  if (status >= 500) {
    return 'O serviço está indisponível no momento. Tente novamente mais tarde.';
  }

  if (status === 400 || status === 422) {
    return path.startsWith('/events')
      ? 'Confira as informações do evento e tente novamente.'
      : 'Confira os dados informados e tente novamente.';
  }

  return getFallbackErrorMessage(path);
}

function getFallbackErrorMessage(path: string) {
  if (path === '/users/register') {
    return 'Não foi possível concluir o cadastro. Revise os dados e tente novamente.';
  }

  if (path.startsWith('/events')) {
    return 'Não foi possível concluir esta ação no evento. Tente novamente.';
  }

  return 'Não foi possível concluir a solicitação. Tente novamente.';
}

function getInvalidApiResponseMessage(path: string) {
  if (path.startsWith('/events')) {
    return 'Não foi possível carregar os dados deste evento. Tente novamente.';
  }

  if (path.startsWith('/users')) {
    return 'Não foi possível carregar os dados da sua conta. Tente novamente.';
  }

  return 'Não foi possível carregar os dados. Tente novamente.';
}
