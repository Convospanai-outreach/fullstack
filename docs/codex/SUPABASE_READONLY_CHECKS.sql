-- CraftMyFunnel Supabase read-only verification checks
-- Project ref expected: izqcycslipmbgdwgajvu
-- Safety: read-only metadata queries only. Do not add DDL or destructive statements here.

select current_database() as database_name, current_schema() as schema_name;

select extname, extversion
from pg_extension
where extname in ('vector', 'pgcrypto', 'uuid-ossp')
order by extname;

select table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
  '_prisma_migrations',
  'Lead',
  'Email',
  'ConnectedMailbox',
  'EmailEvent',
  'TrackedLink',
  'EmailTrackedLink',
  'EmailActivityLog',
  'SuppressionEntry',
  'WaitlistRequest',
  'MailboxHealthSnapshot',
  'MailboxSyncCursor',
  'CampaignSequence',
  'SequenceStep',
  'SequenceEnrollment',
  'SequenceStepRun',
  'LeadChannelStatus',
  'LeadActivity',
  'User',
  'Team',
  'TeamMember',
  'UserInvitation',
  'FeatureFlag',
  'SystemEvent'
)
order by table_name;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'ConnectedMailbox'
order by ordinal_position;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'Email'
order by ordinal_position;

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'Lead'
and column_name = 'embedding';

select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
and table_name = 'SuppressionEntry'
order by ordinal_position;

select migration_name, started_at, finished_at, rolled_back_at
from public._prisma_migrations
order by started_at desc nulls last, finished_at desc nulls last
limit 50;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
and tablename in (
  'User',
  'Team',
  'TeamMember',
  'Lead',
  'Email',
  'ConnectedMailbox',
  'EmailEvent',
  'TrackedLink',
  'SuppressionEntry'
)
order by tablename, policyname;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
and table_name in (
  'Lead',
  'Email',
  'ConnectedMailbox',
  'EmailEvent',
  'TrackedLink',
  'EmailTrackedLink',
  'EmailActivityLog',
  'SuppressionEntry',
  'WaitlistRequest',
  'User',
  'Team',
  'TeamMember',
  'UserInvitation'
)
order by table_name, ordinal_position;
