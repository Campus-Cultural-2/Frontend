import { z } from 'zod';

import { request } from './client';
import {
  campusEventSchema,
  eventCodeSchema,
  EventCreateIn,
  EventUpdateIn,
  participantSchema,
  subscriptionOutSchema,
} from './schemas';

export async function listEvents() {
  return request('/events', undefined, z.array(campusEventSchema));
}

export async function listSubscribedEvents() {
  return request('/events/subscriptions/me', undefined, z.array(campusEventSchema));
}

export async function getEvent(eventId: number) {
  return request(`/events/${eventId}`, undefined, campusEventSchema);
}

export async function subscribeToEvent(eventId: number) {
  return request(
    `/events/${eventId}/subscription`,
    {
      method: 'POST',
    },
    subscriptionOutSchema,
  );
}

export async function unsubscribeFromEvent(eventId: number) {
  return request<void>(`/events/${eventId}/subscription`, {
    method: 'DELETE',
  });
}

export async function createEvent(payload: EventCreateIn) {
  return request(
    '/events',
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
    campusEventSchema,
  );
}

export async function updateEvent(eventId: number, payload: EventUpdateIn) {
  return request(
    `/events/${eventId}`,
    {
      body: JSON.stringify(payload),
      method: 'PUT',
    },
    campusEventSchema,
  );
}

export async function deleteEvent(eventId: number) {
  return request<void>(`/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getMySubscription(eventId: number) {
  return request(`/events/${eventId}/subscription`, undefined, subscriptionOutSchema);
}

// Presenca: professor responsavel ou admin.
export async function listParticipants(eventId: number) {
  return request(`/events/${eventId}/participants`, undefined, z.array(participantSchema));
}

export async function setParticipantAttendance(eventId: number, userId: number, present: boolean) {
  return request(
    `/events/${eventId}/participants/${userId}/attendance`,
    {
      body: JSON.stringify({ present }),
      method: 'PUT',
    },
    participantSchema,
  );
}

// Professor le o QR code (attendance_code) do aluno.
export async function scanStudentCode(eventId: number, code: string) {
  return request(
    `/events/${eventId}/attendance/scan`,
    {
      body: JSON.stringify({ code }),
      method: 'POST',
    },
    participantSchema,
  );
}

// Codigo do evento, para o professor exibir (ou virar QR code).
export async function getEventCode(eventId: number) {
  return request(`/events/${eventId}/attendance/code`, undefined, eventCodeSchema);
}

// Aluno le o codigo do evento para confirmar a propria presenca.
export async function checkInToEvent(eventId: number, code: string) {
  return request(
    `/events/${eventId}/attendance/check-in`,
    {
      body: JSON.stringify({ code }),
      method: 'POST',
    },
    participantSchema,
  );
}
