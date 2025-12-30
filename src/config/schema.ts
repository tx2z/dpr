import { z } from 'zod';

import {
  DEFAULT_COLORS,
  DEFAULT_LOGS_DIR,
  DEFAULT_READY_DELAY,
  MAX_SERVICES,
  MIN_SERVICES,
} from './types.js';

import type { ServiceColor } from './types.js';

const serviceColorSchema = z.enum(['green', 'blue', 'yellow', 'magenta', 'cyan', 'red']);

const envSchema = z.record(z.string(), z.string()).default({});

const serviceSchema = z.object({
  id: z
    .string()
    .min(1, 'Service ID is required')
    .regex(
      /^[\w-]+$/,
      'Service ID must contain only alphanumeric characters, underscores, or hyphens',
    ),
  name: z.string().optional(),
  dir: z.string().optional(),
  start: z.string().min(1, 'Start command is required'),
  stop: z.string().optional(),
  autostart: z.boolean().default(false),
  color: serviceColorSchema.optional(),
  logs: z.boolean().optional(),
  env: envSchema,
  dependsOn: z.array(z.string()).default([]),
  readyPattern: z.string().optional(),
  readyDelay: z.number().positive().default(DEFAULT_READY_DELAY),
  runOnce: z.boolean().default(false),
  keepRunning: z.boolean().default(false),
});

const columnsSchema = z.union([z.number().int().positive().max(MAX_SERVICES), z.literal('auto')]);

const configSchema = z
  .object({
    name: z.string().optional(),
    columns: columnsSchema.default('auto'),
    logs: z.boolean().default(false),
    logsDir: z.string().default(DEFAULT_LOGS_DIR),
    services: z.array(serviceSchema),
  })
  .superRefine((data, ctx) => {
    // Validate service count
    if (data.services.length < MIN_SERVICES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At least ${String(MIN_SERVICES)} services are required`,
        path: ['services'],
      });
    }

    if (data.services.length > MAX_SERVICES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Maximum ${String(MAX_SERVICES)} services are allowed`,
        path: ['services'],
      });
    }

    // Validate unique IDs
    const ids = data.services.map((s) => s.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate service IDs: ${[...new Set(duplicateIds)].join(', ')}`,
        path: ['services'],
      });
    }

    // Validate dependsOn references
    const idSet = new Set(ids);
    for (const [index, service] of data.services.entries()) {
      for (const dep of service.dependsOn) {
        if (!idSet.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Service "${service.id}" depends on unknown service "${dep}"`,
            path: ['services', index, 'dependsOn'],
          });
        }
        if (dep === service.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Service "${service.id}" cannot depend on itself`,
            path: ['services', index, 'dependsOn'],
          });
        }
      }
    }
  });

export type RawServiceConfig = z.infer<typeof serviceSchema>;
export type RawConfig = z.infer<typeof configSchema>;

export function parseConfig(data: unknown): RawConfig {
  return configSchema.parse(data);
}

export function assignDefaultColors(services: readonly RawServiceConfig[]): ServiceColor[] {
  return services.map((service, index) => {
    if (service.color !== undefined) {
      return service.color;
    }
    const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    if (color === undefined) {
      return 'green';
    }
    return color;
  });
}
