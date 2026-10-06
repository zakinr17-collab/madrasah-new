import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const appStore = pgTable('app_store', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull()
});

export const teachers = pgTable('teachers', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const classes = pgTable('classes', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
