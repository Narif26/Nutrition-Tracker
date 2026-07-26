import { PrismaClient } from "@prisma/client";

declare global {
  var __nutrichatPrisma__: PrismaClient | undefined;
}

export const db =
  global.__nutrichatPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__nutrichatPrisma__ = db;
}
