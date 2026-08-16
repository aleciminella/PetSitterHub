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
