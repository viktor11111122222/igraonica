import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrate: {
    async onMigrate({ signal }) {},
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
