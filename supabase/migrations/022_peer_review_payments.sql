-- Create peer_reviews table
create table if not exists peer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  project_name text not null,
  survey_type text not null,
  description text not null,
  country text not null,
  submitter_name text not null,
  submitter_contact text not null,
  attachment_note text,
  status text not null default 'open',
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  payment_amount_kes integer not null default 2500,
  stripe_payment_intent_id text,
  reviewer_payout_kes integer not null default 2000,
  posted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_peer_reviews_user_id on peer_reviews(user_id);

alter table peer_reviews enable row level security;

create policy "Users can view all peer_reviews"
on peer_reviews for select
using (true);

create policy "Users can insert their own peer_reviews"
on peer_reviews for insert
with check (user_id = auth.uid() or user_id is null);

create policy "Users can update their own peer_reviews"
on peer_reviews for update
using (user_id = auth.uid() or user_id is null);

-- Create peer_review_comments table
create table if not exists peer_review_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references peer_reviews(id) on delete cascade,
  reviewer_name text not null,
  reviewer_title text,
  comment text not null,
  category text not null,
  rating integer not null,
  posted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_peer_review_comments_request_id on peer_review_comments(request_id);

alter table peer_review_comments enable row level security;

create policy "Users can view all peer_review_comments"
on peer_review_comments for select
using (true);

create policy "Users can insert peer_review_comments"
on peer_review_comments for insert
with check (true);

