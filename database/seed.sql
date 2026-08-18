insert into services (name, description) values
  ('Passeggiata', 'Passeggiata per cani di durata concordata.'),
  ('Pet-sitting a domicilio', 'Cura dell animale presso la casa del proprietario.'),
  ('Pensione', 'Ospitalità temporanea presso il sitter.'),
  ('Toelettatura base', 'Servizio base di igiene e cura del pelo.')
on conflict (name) do nothing;

insert into users (email, password_hash, first_name, last_name, role, phone, city) values
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

insert into sitter_services (sitter_id, service_id, price)
select sp.id, s.id, 12.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Passeggiata'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id) do nothing;

insert into sitter_services (sitter_id, service_id, price)
select sp.id, s.id, 25.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Pet-sitting a domicilio'
where u.email = 'giulia.sitter@example.com'
on conflict (sitter_id, service_id) do nothing;

insert into sitter_services (sitter_id, service_id, price)
select sp.id, s.id, 10.00
from sitter_profiles sp
join users u on u.id = sp.user_id
join services s on s.name = 'Passeggiata'
where u.email = 'luca.sitter@example.com'
on conflict (sitter_id, service_id) do nothing;
