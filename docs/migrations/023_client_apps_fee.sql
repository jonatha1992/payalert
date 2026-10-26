alter table client_apps add column if not exists fee_type text not null default 'fixed';
DO 1572 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_apps_fee_type_check') THEN ALTER TABLE client_apps ADD CONSTRAINT client_apps_fee_type_check CHECK (fee_type IN ('fixed', 'percent')); END IF; END 1572;
alter table client_apps add column if not exists fee_value numeric(12,2) not null default 1;
DO 1572 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_apps_fee_value_check') THEN ALTER TABLE client_apps ADD CONSTRAINT client_apps_fee_value_check CHECK (fee_value >= 0); END IF; END 1572;
alter table hub_charges add column if not exists fee_amount numeric(12,2);
