-- Auric Iron Matrix seed. Generated from seed_data.json by scripts/gen-seed-sql.ts.
-- Paste into the Supabase SQL editor after 0001_init.sql. Idempotent on class slug.
begin;

-- Assumptions (single shared row).
insert into assumptions (fx_rate, fx_date, olv_ratio, flv_ratio, ask_to_fmv, auction_to_fmv, recency_horizon_months, singleton)
values (1.385, '2026-06-03', 0.7, 0.55, 0.85, 1.43, 36, true)
on conflict (singleton) do update set fx_rate = excluded.fx_rate, fx_date = excluded.fx_date, olv_ratio = excluded.olv_ratio, flv_ratio = excluded.flv_ratio, ask_to_fmv = excluded.ask_to_fmv, auction_to_fmv = excluded.auction_to_fmv, recency_horizon_months = excluded.recency_horizon_months, updated_at = now();

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_gen_g3512', 0, 'Oil & Gas', 'Power generation', 'CAT G3512 gas genset', 'kW', 600, '{"hours":"5to20k","cond":"running","encl":"skid"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_gen_g3516', 1, 'Oil & Gas', 'Power generation', 'CAT G3516 gas genset', 'kW', 1000, '{"hours":"5to20k","cond":"running","encl":"skid"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 80000, 'USD', 'asking', 1000, '20to40k', 'running', 'skid', 'complete', '2026-05-01', 'PowerSystemsToday avg'
from equipment_class where slug = 'og_gen_g3516'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'PowerSystemsToday avg');
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 65000, 'USD', 'asking', 1000, 'gt60k', 'running', 'skid', 'complete', '2026-05-01', 'PowerSystemsToday low'
from equipment_class where slug = 'og_gen_g3516'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'PowerSystemsToday low');
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 233807, 'USD', 'asking', 1000, 'lt5k', 'rebuilt', 'enclosed', 'complete', '2026-05-01', 'PowerSystemsToday high'
from equipment_class where slug = 'og_gen_g3516'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'PowerSystemsToday high');
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 350000, 'USD', 'asking', 1000, 'lt5k', 'rebuilt', 'enclosed', 'complete', '2026-05-01', 'MachineryTrader rebuilt 1340HP'
from equipment_class where slug = 'og_gen_g3516'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'MachineryTrader rebuilt 1340HP');

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_gen_g3520', 2, 'Oil & Gas', 'Power generation', 'CAT G3520 gas genset', 'kW', 2000, '{"hours":"5to20k","cond":"running","encl":"enclosed"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_gen_whp', 3, 'Oil & Gas', 'Power generation', 'Waukesha VHP gas genset', 'kW', 1000, '{"hours":"5to20k","cond":"running","encl":"skid"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_comp_recip', 4, 'Oil & Gas', 'Compression', 'Recip gas compression package', 'HP', 1000, '{"hours":"5to20k","cond":"running","encl":"skid"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_pump_inj', 5, 'Oil & Gas', 'Pumps', 'Multistage injection pump', 'HP', 2500, '{"hours":"5to20k","cond":"running","encl":"skid"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_proc_teg', 6, 'Oil & Gas', 'Process', 'TEG dehydration unit', 'MMcf/d', 20, '{"hours":"na","cond":"idle","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_proc_amine', 7, 'Oil & Gas', 'Process', 'Amine sweetening unit', 'MMcf/d', 20, '{"hours":"na","cond":"idle","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_proc_sep', 8, 'Oil & Gas', 'Process', 'Separator / line heater', 'each', 1, '{"hours":"na","cond":"idle","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('og_proc_tank', 9, 'Oil & Gas', 'Process', 'Production tank', 'bbl', 400, '{"hours":"na","cond":"idle","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_truck_785', 10, 'Mining', 'Mobile fleet', 'Haul truck CAT 785 class', 'each', 1, '{"hours":"20to40k","cond":"running","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_truck_793', 11, 'Mining', 'Mobile fleet', 'Haul truck CAT 793 class', 'each', 1, '{"hours":"20to40k","cond":"running","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 594150, 'USD', 'asking', 1, '20to40k', 'running', 'na', 'complete', '2026-05-01', 'MachineryTrader low'
from equipment_class where slug = 'mn_truck_793'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'MachineryTrader low');
insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
select id, 2150000, 'USD', 'asking', 1, 'lt5k', 'rebuilt', 'na', 'complete', '2026-05-01', 'MachineryTrader high'
from equipment_class where slug = 'mn_truck_793'
and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = 'MachineryTrader high');

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_exc_lg', 12, 'Mining', 'Mobile fleet', 'Large hydraulic excavator', 'each', 1, '{"hours":"20to40k","cond":"running","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_loader_lg', 13, 'Mining', 'Mobile fleet', 'Large wheel loader', 'each', 1, '{"hours":"20to40k","cond":"running","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_crush_cone', 14, 'Mining', 'Fixed plant', 'Cone crusher', 'each', 1, '{"hours":"na","cond":"running","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
values ('mn_mill_ball', 15, 'Mining', 'Fixed plant', 'Ball mill', 'each', 1, '{"hours":"na","cond":"idle","encl":"na"}'::jsonb)
on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;

commit;
