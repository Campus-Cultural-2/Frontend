import { z } from 'zod';

import { request } from './client';
import {
  campusEventSchema,
  EventCreateIn,
  EventUpdateIn,
  eventSubscriberSchema,
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

export async function listEventSubscribers(eventId: number) {
  return request(
    `/events/${eventId}/subscribers`,
    undefined,
    z.array(eventSubscriberSchema),
  );
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
