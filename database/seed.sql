insert into services (name, description, price_unit, availability_mode) values
  ('Passeggiata', 'Uscita con il cane per una durata concordata.', 'hourly', 'hourly_slot'),
  ('Pet-sitting a domicilio', 'Assistenza dell''animale presso la casa del proprietario.', 'daily', 'daily_non_exclusive'),
  ('Pensione', 'Ospitalità temporanea dell''animale presso il sitter.', 'daily', 'daily_exclusive'),
  ('Somministrazione acqua e cibo', 'Gestione quotidiana di acqua, cibo e piccole attenzioni.', 'daily', 'daily_non_exclusive'),
  ('Pulizia ambiente', 'Pulizia dello spazio usato dall''animale.', 'daily', 'daily_non_exclusive'),
  ('Toelettatura base', 'Igiene leggera e cura semplice del pelo.', 'fixed', 'fixed_slot')
on conflict (name) do update set
  description = excluded.description,
  price_unit = excluded.price_unit,
  availability_mode = excluded.availability_mode;

insert into service_pet_types (service_id, pet_type)
select s.id, supported_pet.pet_type
from services s
join (
  values
    ('Passeggiata', 'cane'),
    ('Pet-sitting a domicilio', 'cane'),
    ('Pet-sitting a domicilio', 'gatto'),
    ('Pet-sitting a domicilio', 'uccello'),
    ('Pet-sitting a domicilio', 'roditore'),
    ('Pet-sitting a domicilio', 'rettile'),
    ('Pensione', 'cane'),
    ('Pensione', 'gatto'),
    ('Pensione', 'uccello'),
    ('Pensione', 'roditore'),
    ('Pensione', 'rettile'),
    ('Somministrazione acqua e cibo', 'cane'),
    ('Somministrazione acqua e cibo', 'gatto'),
    ('Somministrazione acqua e cibo', 'uccello'),
    ('Somministrazione acqua e cibo', 'roditore'),
    ('Somministrazione acqua e cibo', 'rettile'),
    ('Pulizia ambiente', 'gatto'),
    ('Pulizia ambiente', 'uccello'),
    ('Pulizia ambiente', 'roditore'),
    ('Pulizia ambiente', 'rettile'),
    ('Toelettatura base', 'cane'),
    ('Toelettatura base', 'gatto')
) as supported_pet(service_name, pet_type) on supported_pet.service_name = s.name
on conflict (service_id, pet_type) do nothing;

insert into users (email, password_hash, first_name, last_name, role, phone, city) values
  ('admin@petsitterhub.it', '$2b$10$QXOEWxkfdWlYokay5yfmDuF9USNe2MH0dztAudU8pMWlmfcBp.1cu', 'Admin', 'PetSitterHub', 'admin', null, null),
  ('mario.owner@example.com', '$2b$10$QXOEWxkfdWlYokay5yfmDuF9USNe2MH0dztAudU8pMWlmfcBp.1cu', 'Mario', 'Rossi', 'owner', '3331234567', 'Roma'),
  ('giulia.sitter@example.com', '$2b$10$QXOEWxkfdWlYokay5yfmDuF9USNe2MH0dztAudU8pMWlmfcBp.1cu', 'Giulia', 'Bianchi', 'sitter', '3331112222', 'Roma'),
  ('luca.sitter@example.com', '$2b$10$QXOEWxkfdWlYokay5yfmDuF9USNe2MH0dztAudU8pMWlmfcBp.1cu', 'Luca', 'Verdi', 'sitter', '3334445555', 'Milano')
on conflict (email) do update set
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  phone = excluded.phone,
  city = excluded.city;

insert into pets (owner_id, name, species, breed, age, notes)
select id, 'Luna', 'cane', 'Labrador', 4, 'Ama le passeggiate lunghe.'
from users
where email = 'mario.owner@example.com'
on conflict (owner_id, name) do update set
  species = excluded.species,
  breed = excluded.breed,
  age = excluded.age,
  notes = excluded.notes;

insert into pets (owner_id, name, species, breed, age, notes)
select id, 'Milo', 'gatto', 'Europeo', 2, 'Diffidente con persone nuove.'
from users
where email = 'mario.owner@example.com'
on conflict (owner_id, name) do update set
  species = excluded.species,
  breed = excluded.breed,
  age = excluded.age,
  notes = excluded.notes;

insert into sitter_profiles (user_id, bio, base_city, verified)
select id, 'Mi occupo di cani e gatti con esperienza e attenzione.', city, true
from users
where email = 'giulia.sitter@example.com'
on conflict (user_id) do nothing;

insert into sitter_profiles (user_id, bio, base_city, verified)
select id, 'Disponibile per passeggiate e pet-sitting nel weekend.', city, false
from users
where email = 'luca.sitter@example.com'
on conflict (user_id) do nothing;

insert into sitter_weekly_availability (sitter_id, weekday, is_available, starts_at, ends_at)
select sp.id, weekly_availability.weekday, weekly_availability.is_available, weekly_availability.starts_at::time, weekly_availability.ends_at::time
from sitter_profiles sp
join users u on u.id = sp.user_id
join (
  values
    ('giulia.sitter@example.com', 0, false, null, null),
    ('giulia.sitter@example.com', 1, true, '08:00', '20:00'),
    ('giulia.sitter@example.com', 2, true, '07:00', '13:00'),
    ('giulia.sitter@example.com', 3, true, '07:00', '13:00'),
    ('giulia.sitter@example.com', 4, true, '07:00', '13:00'),
    ('giulia.sitter@example.com', 5, true, '07:00', '13:00'),
    ('giulia.sitter@example.com', 6, false, null, null),
    ('luca.sitter@example.com', 0, false, null, null),
    ('luca.sitter@example.com', 1, true, '09:00', '18:00'),
    ('luca.sitter@example.com', 2, true, '09:00', '18:00'),
    ('luca.sitter@example.com', 3, true, '09:00', '18:00'),
    ('luca.sitter@example.com', 4, true, '09:00', '18:00'),
    ('luca.sitter@example.com', 5, true, '09:00', '18:00'),
    ('luca.sitter@example.com', 6, true, '10:00', '13:00')
) as weekly_availability(email, weekday, is_available, starts_at, ends_at) on weekly_availability.email = u.email
on conflict (sitter_id, weekday) do update set
  is_available = excluded.is_available,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

insert into sitter_availability_exceptions (sitter_id, starts_on, ends_on, is_available, starts_at, ends_at, note)
select sp.id, availability_exception.starts_on::date, availability_exception.ends_on::date, availability_exception.is_available, availability_exception.starts_at::time, availability_exception.ends_at::time, availability_exception.note
from sitter_profiles sp
join users u on u.id = sp.user_id
join (
  values
    ('giulia.sitter@example.com', '2026-09-10', '2026-09-12', false, null, null, 'Ferie'),
    ('luca.sitter@example.com', '2026-09-25', '2026-09-25', true, '10:00', '16:00', 'Orario speciale')
) as availability_exception(email, starts_on, ends_on, is_available, starts_at, ends_at, note) on availability_exception.email = u.email
on conflict (sitter_id, starts_on, ends_on) do update set
  is_available = excluded.is_available,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  note = excluded.note;

insert into sitter_pet_types (sitter_id, pet_type)
select sp.id, accepted_pet.pet_type
from sitter_profiles sp
join users u on u.id = sp.user_id
join (
  values
    ('giulia.sitter@example.com', 'cane'),
    ('giulia.sitter@example.com', 'gatto'),
    ('luca.sitter@example.com', 'cane')
) as accepted_pet(email, pet_type) on accepted_pet.email = u.email
on conflict (sitter_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'cane', 12.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Passeggiata'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'cane', 25.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pet-sitting a domicilio'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'gatto', 22.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pet-sitting a domicilio'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'cane', 35.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pensione'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'gatto', 30.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pensione'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'gatto', 15.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Somministrazione acqua e cibo'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'gatto', 18.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pulizia ambiente'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'cane', 28.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Toelettatura base'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;

insert into sitter_services (sitter_id, service_id, pet_type, price)
select sp.id, s.id, 'cane', 10.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Passeggiata'
where u.email = 'luca.sitter@example.com'
on conflict (sitter_id, service_id, pet_type) do nothing;
