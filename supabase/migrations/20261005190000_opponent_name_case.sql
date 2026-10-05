-- Capitalise opponent names on save, whichever client sends them (older app builds included).
-- Mirrors formatPersonName in src/lib/types.ts: "john smith" -> "John Smith",
-- "MARY-JANE O'NEIL" -> "Mary-Jane O'Neil"; a mixed-case part like "McDonald" keeps its inner capitals.

create or replace function public.format_person_name(n text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text := '';
  m text[];
  part text;
  rest text;
begin
  if n is null then
    return null;
  end if;
  n := regexp_replace(btrim(n), '\s+', ' ', 'g');
  for m in select regexp_matches(n, '([^\s''-]+|[\s''-]+)', 'g') loop
    part := m[1];
    if part ~ '^[\s''-]+$' then
      result := result || part;
    else
      rest := substr(part, 2);
      if rest = upper(rest) or rest = lower(rest) then
        rest := lower(rest);
      end if;
      result := result || upper(left(part, 1)) || rest;
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.opponents_format_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := public.format_person_name(new.name);
  return new;
end;
$$;

drop trigger if exists opponents_format_name on public.opponents;
create trigger opponents_format_name
  before insert or update of name on public.opponents
  for each row execute function public.opponents_format_name();

-- Tidy names saved before this existed.
update public.opponents
set name = public.format_person_name(name)
where name is distinct from public.format_person_name(name);
