ALTER TABLE expenses ADD COLUMN spent_on DATE;
UPDATE expenses SET spent_on = (created_at AT TIME ZONE 'Europe/Berlin')::date;
ALTER TABLE expenses ALTER COLUMN spent_on SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN spent_on SET DEFAULT ((NOW() AT TIME ZONE 'Europe/Berlin')::date);
