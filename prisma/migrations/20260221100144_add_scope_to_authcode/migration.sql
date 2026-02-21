-- AlterTable
ALTER TABLE "AuthCode" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'openid';
