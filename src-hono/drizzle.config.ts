import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  out: 'drizzle',
  schema: './src/db/schema.ts'
});