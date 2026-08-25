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
  description text,
  price_unit varchar(20) not null default 'hourly'
    check (price_unit in ('hourly', 'daily', 'fixed')),
  availability_mode varchar(30) not null default 'hourly_slot'
    check (availability_mode in ('hourly_slot', 'fixed_slot', 'daily_exclusive', 'daily_non_exclusive'))
);

create table service_pet_types (
  service_id bigint not null references services(id) on delete cascade,
  pet_type varchar(50) not null,
  primary key (service_id, pet_type)
);

create table sitter_pet_types (
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  pet_type varchar(50) not null,
  primary key (sitter_id, pet_type)
);

create table sitter_services (
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  service_id bigint not null references services(id) on delete cascade,
  pet_type varchar(50) not null,
  price numeric(10, 2) not null check (price >= 0),
  primary key (sitter_id, service_id, pet_type),
  foreign key (service_id, pet_type) references service_pet_types(service_id, pet_type),
  foreign key (sitter_id, pet_type) references sitter_pet_types(sitter_id, pet_type)
);

create table pets (
  id bigserial primary key,
  owner_id bigint not null references users(id) on delete cascade,
  name varchar(100) not null,
  species varchar(50) not null,
  breed varchar(100),
  age integer check (age >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id),
  unique (id, species)
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
  pet_id bigint not null,
  pet_type varchar(50) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status varchar(30) not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  total_price numeric(10, 2) not null check (total_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, owner_id) references pets(id, owner_id),
  foreign key (pet_id, pet_type) references pets(id, species),
  foreign key (sitter_id, service_id, pet_type) references sitter_services(sitter_id, service_id, pet_type),
  check (ends_at > starts_at)
);

create table messages (
  id bigserial primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  sender_id bigint not null references users(id),
  body text not null,
  sent_at timestamptz not null default now()
);

create table reviews (
  id bigserial primary key,
  booking_id bigint not null unique references bookings(id) on delete cascade,
  owner_id bigint not null references users(id),
  sitter_id bigint not null references sitter_profiles(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table payments (
  id bigserial primary key,
  booking_id bigint not null unique references bookings(id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  status varchar(30) not null default 'simulated'
    check (status in ('simulated', 'authorized', 'paid', 'refunded', 'failed')),
  provider_reference varchar(120),
  created_at timestamptz not null default now()
);
