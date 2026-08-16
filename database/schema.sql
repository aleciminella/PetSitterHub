create table users (
  id bigserial primary key,
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  role varchar(20) not null check (role in ('owner', 'sitter', 'admin')),
  phone varchar(30),
  city varchar(100),
  created_at timestamptz not null default now()
);

create table sitter_profiles (
  id bigserial primary key,
  user_id bigint not null unique references users(id) on delete cascade,
  bio text,
  base_city varchar(100) not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table services (
  id bigserial primary key,
  name varchar(100) not null unique,
  description text
);

create table sitter_services (
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  service_id bigint not null references services(id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  primary key (sitter_id, service_id)
);

create table availability_slots (
  id bigserial primary key,
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null default true,
  check (ends_at > starts_at)
);

create table bookings (
  id bigserial primary key,
  owner_id bigint not null references users(id),
  sitter_id bigint not null references sitter_profiles(id),
  service_id bigint not null references services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status varchar(30) not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  total_price numeric(10, 2) not null check (total_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
