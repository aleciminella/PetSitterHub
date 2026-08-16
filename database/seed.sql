insert into services (name, description) values
  ('Passeggiata', 'Passeggiata per cani di durata concordata.'),
  ('Pet-sitting a domicilio', 'Cura dell animale presso la casa del proprietario.'),
  ('Pensione', 'Ospitalità temporanea presso il sitter.'),
  ('Toelettatura base', 'Servizio base di igiene e cura del pelo.')
on conflict (name) do nothing;
