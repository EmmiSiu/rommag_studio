-- Stage 10.1: lightweight musical analysis metadata.
ALTER TABLE "audios"
ADD COLUMN "bpm" DOUBLE PRECISION,
ADD COLUMN "musical_key" TEXT,
ADD COLUMN "energy" DOUBLE PRECISION,
ADD COLUMN "loudness_db" DOUBLE PRECISION,
ADD COLUMN "analyzed_at" TIMESTAMP(3);
