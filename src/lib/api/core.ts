import { z } from 'zod';

import { clearAuthToken } from '@/src/lib/auth/token';
import { env } from '@/src/lib/config/env';

import { AuthSessionError } from './errors';

export const API_BASE_URL = env.apiBaseUrl;

export async function requestJson<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && path === '/users/login') {
      throw new Error('E-mail ou senha inválidos.');
    }

    if (response.status === 401) {
      await clearAuthToken();
      throw new AuthSessionError();
    }

    if (response.status === 409 && path.endsWith('/subscription')) {
      throw new Error('Você já está inscrito neste evento.');
    }

    if (response.status === 404 && path.endsWith('/subscription')) {
      throw new Error('Você não está inscrito neste evento.');
    }

    if (response.status === 404 && path.startsWith('/events/')) {
      throw new Error('Evento não encontrado ou você não tem permissão para alterá-lo.');
    }

    throw new Error(await getSafeErrorMessage(response, path));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseBody = await response.json();

  if (!schema) {
    return responseBody as T;
  }

  try {
    return schema.parse(responseBody);
  } catch {
    throw new Error(getInvalidApiResponseMessage(path));
  }
}

async function getSafeErrorMessage(response: Response, path: string) {
  const fallbackMessage = getFallbackErrorMessage(path);

  if (!__DEV__) {
    return fallbackMessage;
  }

  const responseText = await response.text();
  return responseText || `${fallbackMessage} Status: ${response.status}.`;
}

function getFallbackErrorMessage(path: string) {
  if (path === '/users/register') {
    return 'Não foi possível concluir o cadastro. Revise os dados e tente novamente.';
  }

  if (path.startsWith('/events')) {
    return 'Não foi possível carregar ou salvar eventos. Tente novamente.';
  }

  return 'Não foi possível concluir a solicitação. Tente novamente.';
}

function getInvalidApiResponseMessage(path: string) {
  if (path.startsWith('/events')) {
    return 'O backend retornou eventos em um formato inesperado.';
  }

  if (path.startsWith('/users')) {
    return 'O backend retornou dados de usuário em um formato inesperado.';
  }

  return 'O backend retornou dados em um formato inesperado.';
}
