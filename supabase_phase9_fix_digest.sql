-- Add email column to profiles if it doesn't exist
alter table profiles
add column if not exists email text;

-- Update the daily digest function needs this to send emails.
comment on column profiles.email is 'Cached email address for notifications (synced from auth or user input).';
