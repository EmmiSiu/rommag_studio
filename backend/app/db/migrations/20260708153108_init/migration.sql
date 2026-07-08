-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'ENHANCING', 'SPATIALIZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('YOUTUBE', 'UPLOAD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "password_reset_token" TEXT,
    "password_reset_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audios" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_url" TEXT,
    "status" "AudioStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "original_key" TEXT,
    "enhanced_key" TEXT,
    "spatial_key" TEXT,
    "ambisonics_key" TEXT,
    "stems_keys" JSONB,
    "duration_seconds" DOUBLE PRECISION,
    "sample_rate" INTEGER,
    "format" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "audios_owner_id_idx" ON "audios"("owner_id");

-- CreateIndex
CREATE INDEX "audios_visibility_is_approved_idx" ON "audios"("visibility", "is_approved");

-- CreateIndex
CREATE INDEX "audios_status_idx" ON "audios"("status");

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
