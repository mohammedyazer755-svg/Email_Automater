import { z } from 'zod';
import { isValidEmail } from '@/lib/spreadsheet/validator';
export const uuid = z.string().uuid();
export const ids = z.array(uuid).min(1).max(10000);
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .refine((e) => isValidEmail(e, false), 'Enter a valid email.');
export const status = z.enum(['active', 'unsubscribed', 'bounced']);
export const contactInput = z.object({
  email,
  name: z.string().trim().max(200).default(''),
  group_id: uuid.optional(),
});
export const templateInput = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(['confirmation', 'reminder', 'announcement', 'update', 'certificate', 'custom']),
  subject: z.string().max(500),
  body_html: z.string().max(200000),
  body_text: z.string().max(200000).default(''),
});
export const attachment = z.object({
  filename: z.string().min(1).max(200),
  path: z.string().min(1).max(500),
  size: z.number().int().positive().max(10485760),
  mime: z.string(),
});
export const campaignInput = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().max(500),
  from_name: z.string().trim().max(200),
  reply_to: z.union([email, z.literal('')]).default(''),
  body_html: z.string().max(200000),
  body_text: z.string().max(200000).default(''),
  sender_id: uuid.nullable(),
  contact_ids: z.array(uuid).max(10000).default([]),
  attachments: z.array(attachment).max(10).default([]),
});
export const step = z.discriminatedUnion('step_type', [
  z.object({
    step_type: z.literal('send_email'),
    config: z.object({ template_id: uuid, subject_override: z.string().max(500).optional() }),
  }),
  z.object({
    step_type: z.literal('wait'),
    config: z.object({ duration_hours: z.number().min(0.001).max(8760) }),
  }),
  z.object({
    step_type: z.literal('condition'),
    config: z.object({ status, operator: z.enum(['equals', 'not_equals']).default('equals') }),
  }),
]);
export const automationInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(''),
  trigger_type: z.enum(['manual', 'contact_imported', 'scheduled']),
  trigger_config: z.object({
    group_id: uuid.optional(),
    schedule_cron: z.string().max(100).optional(),
    timezone: z.string().max(100).default('UTC'),
  }),
  sender_id: uuid,
  steps: z.array(step).min(1).max(50),
});
