-- =====================================================================
-- Salles, marques et machines
-- Une salle déclare ses marques ; chaque machine est rattachée à une marque
-- de sa salle. La création de séance propose les exercices sans machine et
-- ceux des machines de la salle de la séance.
-- Remplace la marque libre par exercice programmé (20261122020000).
-- =====================================================================

create table public.gym_brands (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index gym_brands_name_key on public.gym_brands (gym_id, lower(name));

alter table public.equipment
  add column brand_id uuid references public.gym_brands (id) on delete set null;
create index equipment_brand_idx on public.equipment (brand_id);

-- Reprise des marques déjà saisies sur les machines
insert into public.gym_brands (gym_id, name)
select distinct on (gym_id, lower(trim(brand))) gym_id, trim(brand)
from public.equipment
where nullif(trim(brand), '') is not null
order by gym_id, lower(trim(brand)), trim(brand) collate "C";

update public.equipment e
set brand_id = b.id, brand = b.name
from public.gym_brands b
where b.gym_id = e.gym_id and lower(b.name) = lower(trim(e.brand));

-- equipment.brand devient une copie du nom de la marque (lecture simple).
-- Une marque saisie en texte est rattachée (ou ajoutée) aux marques de la salle.
create function public.sync_equipment_brand()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.brand_id is null and nullif(trim(new.brand), '') is not null
     and (tg_op = 'INSERT' or new.brand is distinct from old.brand) then
    insert into public.gym_brands (gym_id, name) values (new.gym_id, trim(new.brand))
      on conflict (gym_id, lower(name)) do nothing;
    select b.id into new.brand_id from public.gym_brands b
      where b.gym_id = new.gym_id and lower(b.name) = lower(trim(new.brand));
  end if;
  if new.brand_id is null then
    new.brand := null;
  else
    select b.name into new.brand from public.gym_brands b
      where b.id = new.brand_id and b.gym_id = new.gym_id;
    if not found then
      raise exception 'La marque doit appartenir à la salle de la machine';
    end if;
  end if;
  return new;
end;
$$;

create trigger equipment_sync_brand
  before insert or update on public.equipment
  for each row execute function public.sync_equipment_brand();

-- Renommer une marque met à jour ses machines
create function public.propagate_brand_name()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.equipment set brand = new.name where brand_id = new.id;
  return new;
end;
$$;

create trigger gym_brands_propagate_name
  after update of name on public.gym_brands
  for each row execute function public.propagate_brand_name();

revoke execute on function public.sync_equipment_brand(), public.propagate_brand_name() from public, anon, authenticated;

-- Sécurité : lecture pour tous les connectés, écriture pour le staff
alter table public.gym_brands enable row level security;
create policy gym_brands_read on public.gym_brands for select to authenticated using (true);
create policy gym_brands_write on public.gym_brands for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
grant select, insert, update, delete on public.gym_brands to authenticated;
grant all on public.gym_brands to service_role;

-- Fin de la marque libre par exercice : la marque vient de la machine choisie
alter table public.workout_exercises drop column if exists equipment_brand;
alter table public.session_sets drop column if exists equipment_brand;
