import { int, sqliteTable, text, } from 'drizzle-orm/sqlite-core';

export const mods = sqliteTable('mods', {
  id: text('id').primaryKey(),
  modName: text('modName').notNull(),
  version: text('version').notNull(),
  fileHash: text('fileHash').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  filename: text('filename').notNull(),
  uploaded: text('uploaded').notNull(),
  size: int('size').notNull(),
});