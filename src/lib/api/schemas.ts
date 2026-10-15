import { z } from 'zod';

export const userRoleSchema = z.enum(['student', 'professor', 'admin']);

export const campusUserSchema = z.object({
  birth_date: z.string().nullable(),
  email: z.string(),
  id: z.number(),
  is_active: z.boolean(),
  last_name: z.string(),
  name: z.string(),
  // Link da foto no Cloudinary. Opcional para o app continuar funcionando
  // com uma versão da API que ainda não devolve este campo.
  profile_picture_url: z.string().nullable().optional(),
  ra: z.string().nullable(),
  role: userRoleSchema,
});

export const campusEventSchema = z.object({
  created_at: z.string(),
  description: z.string(),
  event_datetime: z.string(),
  event_location: z.string(),
  id: z.number(),
  image: z.string().nullable(),
  name: z.string(),
  user_id: z.number().optional(),
});

export const subscriptionOutSchema = z.object({
  created_at: z.string(),
  event_id: z.number(),
  id: z.number(),
  user_id: z.number(),
});

export const healthOutSchema = z.object({
  status: z.literal('ok'),
});

export const tokenOutSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
});

export const tokenPayloadSchema = z.object({
  exp: z.number().optional(),
  role: userRoleSchema,
  sub: z.string(),
});

export type UserRole = z.infer<typeof userRoleSchema>;

export type CampusUser = z.infer<typeof campusUserSchema>;

export type CurrentUser = CampusUser;

export type CampusEvent = z.infer<typeof campusEventSchema>;

export type SubscriptionOut = z.infer<typeof subscriptionOutSchema>;

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

export type AuthSession = {
  payload: TokenPayload;
  token: string;
};

export type EventCreateIn = {
  image?: string | null;
  name: string;
  event_datetime: string;
  event_location: string;
  description: string;
};

export type EventUpdateIn = Partial<EventCreateIn>;

export type UserCreateIn = {
  role: UserRole;
  email: string;
  name: string;
  last_name: string;
  birth_date: string | null;
  is_active: boolean;
  ra: string | null;
  password: string;
};

export type UserUpdateIn = UserCreateIn;

export type UserLoginIn = {
  email: string;
  password: string;
};

export type TokenOut = z.infer<typeof tokenOutSchema>;

export type HealthOut = z.infer<typeof healthOutSchema>;
