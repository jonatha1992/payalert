-- 016: secretBox (PAY-15) escribe 'enc:v2:<keyId>:...' pero 005 solo aceptaba 'enc:v1:%',
-- por lo que guardar una conexion fallaba (23514). Se aceptan v1 y v2. Rerunnable.
alter table public.payment_connections drop constraint if exists payment_connections_credentials_encrypted_check;
alter table public.payment_connections drop constraint if exists payment_connections_webhook_secret_encrypted_check;
alter table public.payment_connections add constraint payment_connections_credentials_encrypted_check
  check (credentials_encrypted ~ '^enc:v[12]:');
alter table public.payment_connections add constraint payment_connections_webhook_secret_encrypted_check
  check (webhook_secret_encrypted is null or webhook_secret_encrypted ~ '^enc:v[12]:');
