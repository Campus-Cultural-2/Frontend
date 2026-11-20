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

    if (response.status === 403 && /\/events\/\d+\/subscribers$/.test(path)) {
      throw new Error('403: Somente o professor que organizou este evento ou um administrador pode consultar os participantes.');
    }

    if (response.status === 404 && /\/events\/\d+\/subscribers$/.test(path)) {
      throw new Error('A rota de participantes não está disponível na API publicada. O backend precisa estar atualizado com a branch feat/lista-de-inscritos-do-evento e essa versão precisa ter sido implantada no servidor.');
    }

    if (response.status === 404 && path.startsWith('/events/')) {
      throw new Error('Evento não encontrado ou você não tem permissão para alterá-lo.');
    }

    throw new Error(getSafeErrorMessage(responseText, response.status, path));
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

function getSafeErrorMessage(responseText: string, status: number, path: string) {
  const fallbackMessage = getFallbackErrorMessage(path);

  if (!__DEV__) {
    return fallbackMessage;
  }

  return responseText || `${fallbackMessage} Status: ${status}.`;
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
