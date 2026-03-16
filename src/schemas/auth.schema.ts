import { z } from 'zod';
import { ROLES } from '../constants/roles';
import { POSTS } from '../constants/posts';

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "L'identifiant doit contenir au moins 3 caracteres")
  .max(50, "L'identifiant doit contenir au maximum 50 caracteres");
const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caracteres')
  .max(72, 'Le mot de passe doit contenir au maximum 72 caracteres')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre');

export const registerSchema = z.object({
  body: z.object({
    username,
    password,
    role: z.enum(ROLES),
    post: z.enum(POSTS)
  })
});

export const loginSchema = z.object({
  body: z.object({
    username,
    password
  })
});

export const refreshSchema = z.object({
  body: z
    .object({
      refreshToken: z
        .string()
        .min(10, 'Le jeton de rafraichissement est requis')
        .optional()
    })
    .optional()
});

export const logoutSchema = z.object({
  body: z.object({}).optional()
});

export const listUsersSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    role: z.enum(ROLES).optional(),
    post: z.enum(POSTS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
  })
});
