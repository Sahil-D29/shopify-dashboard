/** Prisma config (plain JS for Render – no @prisma/config). */
require('dotenv').config();

module.exports = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
};
