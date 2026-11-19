import { z } from 'zod';

import { request, requestPublic } from './client';
import { requestJson } from './core';
import { getValidAuthSession } from './session';
import {
  campusUserSchema,
  UserCreateIn,
  UserUpdateIn,
} from './schemas';

export async function registerUser(payload: UserCreateIn) {
  return requestPublic(
    '/users/register',
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
    campusUserSchema,
  );
}

export async function listUsers() {
  return request('/users', undefined, z.array(campusUserSchema));
}

export async function getUser(userId: number) {
  return request(`/users/${userId}`, undefined, campusUserSchema);
}

export async function getCurrentUser() {
  const authSession = await getValidAuthSession();

  return requestJson(
    `/users/${Number(authSession.payload.sub)}`,
    {
      headers: {
        Authorization: `Bearer ${authSession.token}`,
      },
    },
    campusUserSchema,
  );
}

export async function updateUser(userId: number, payload: UserUpdateIn) {
  return request(
    `/users/${userId}`,
    {
      body: JSON.stringify(payload),
      method: 'PUT',
    },
    campusUserSchema,
  );
}

export async function deleteUser(userId: number) {
  return request<void>(`/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateProfilePicture(userId: number, imageUri: string) {
  const imageBlob = await uriToBlob(imageUri);

  return request(
    `/users/${userId}/profile-picture`,
    {
      body: imageBlob,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      method: 'POST',
    },
    campusUserSchema,
  );
}

// Remove a foto do perfil. O backend também apaga a imagem do Cloudinary.
export async function deleteProfilePicture(userId: number) {
  return request<void>(`/users/${userId}/profile-picture`, {
    method: 'DELETE',
  });
}

async function uriToBlob(uri: string) {
  const response = await fetch(uri);
  return response.blob();
}
