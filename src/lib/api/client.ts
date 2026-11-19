import { z } from 'zod';

import { requestJson } from './core';
import { getValidAuthSession } from './session';

export async function request<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>) {
  const authSession = await getValidAuthSession();

  return requestJson(
    path,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${authSession.token}`,
        ...init?.headers,
      },
    },
    schema,
  );
}

export async function requestPublic<T>(path: string, init?: RequestInit, schema?: z.ZodType<T>) {
  return requestJson(path, init, schema);
}
