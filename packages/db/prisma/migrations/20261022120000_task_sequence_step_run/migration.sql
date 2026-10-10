-- A task that a sequence step handed to a person (LinkedIn step, WhatsApp sent by hand) remembers
-- the step run it came from, so marking the task done can resume the sequence. Older tasks keep NULL.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sequenceStepRunId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_sequenceStepRunId_idx" ON "Task"("sequenceStepRunId");
