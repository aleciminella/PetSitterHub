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

create table sitter_profiles ( -- un profilo user per i sitter non basta, serve anche questa scheda professionale
  id bigserial primary key,
  user_id bigint not null unique references users(id) on delete cascade, -- se si cancella user viene cancellato anche il sitter
  bio text,
  base_city varchar(100) not null,
  profile_image_url text,
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

create table service_pet_types ( -- indica per quali animali quel servizio esiste
  service_id bigint not null references services(id) on delete cascade,
  pet_type varchar(50) not null,
  primary key (service_id, pet_type)
);

create table sitter_pet_types ( -- indica quali animali accetta il sitter
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  pet_type varchar(50) not null,
  primary key (sitter_id, pet_type)
);

create table sitter_services ( -- servizi offerti dal sitter
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  service_id bigint not null references services(id) on delete cascade,
  pet_type varchar(50) not null,
  price numeric(10, 2) not null check (price >= 0),
  primary key (sitter_id, service_id, pet_type),
  foreign key (service_id, pet_type) references service_pet_types(service_id, pet_type), -- il servizio offerto per l'animale deve esistere in service_pet_types
  foreign key (sitter_id, pet_type) references sitter_pet_types(sitter_id, pet_type) -- l'animale del servizio deve essere accettato dal sittere e quindi essere presente in sitter_pet_types
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
  unique (owner_id, name), -- un proprietario può avere 2 animali con lo stesso nome
  unique (id, owner_id), -- l'animale ha un solo proprietario
  unique (id, species) -- l'animale può appartenere solo ad una specie
);

create table sitter_weekly_availability ( -- orario tipo della settimana
  id bigserial primary key,
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  is_available boolean not null default false, -- indica se in quel giorno della settimana è disponibile
  starts_at time, -- orario inizio
  ends_at time, -- orario fine
  unique (sitter_id, weekday),
  check (
    (is_available = false and starts_at is null and ends_at is null)
    or
    (is_available = true and starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table sitter_availability_exceptions ( -- giorni di apertura/chiusura speciali
  sitter_id bigint not null references sitter_profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  is_available boolean not null default false,
  starts_at time,
  ends_at time,
  note text,
  unique (sitter_id, starts_on, ends_on),
  check (ends_on >= starts_on),
  check (
    (is_available = false and starts_at is null and ends_at is null)
    or
    (is_available = true and starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
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
  foreign key (pet_id, owner_id) references pets(id, owner_id), -- impedisce di prenotare un servizio indicando un animale appartenente a un altro utente
  foreign key (pet_id, pet_type) references pets(id, species), -- assicura che il pet_type salvato nella prenotazione corrisponda alla vera specie dell'animale
  foreign key (sitter_id, service_id, pet_type) references sitter_services(sitter_id, service_id, pet_type), -- verifica che il sitter offra effettivamente quel preciso servizio per quella specifica specie animale.
  check (ends_at > starts_at) -- impedisce date di fine antecedenti all'inizio
);

create table messages (
  id bigserial primary key,
  booking_id bigint not null references bookings(id) on delete cascade,
  sender_id bigint not null references users(id),
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_booking_sent_idx on messages(booking_id, sent_at); -- indice che serve a velocizzare la ricerca della chat

create table notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  booking_id bigint references bookings(id) on delete cascade,
  type varchar(40) not null
    check (type in ('booking_created', 'booking_accepted', 'booking_rejected', 'booking_cancelled', 'payment_required', 'payment_received', 'payment_refunded', 'message_received', 'review_received')),
  title varchar(120) not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on notifications(user_id, created_at desc);

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
  method varchar(30) not null default 'demo_card'
    check (method in ('demo_card', 'bank_transfer')),
  status varchar(30) not null default 'simulated'
    check (status in ('simulated', 'authorized', 'paid', 'refunded', 'failed')),
  provider_reference varchar(120),
  created_at timestamptz not null default now()
);
