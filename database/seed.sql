-- ============================================================
-- POD Platform — Base Seed Data
-- ============================================================
--
-- Contains:
--   1. Default tenant (required — categories reference it)
--   2. Categories (61 product categories, multi-language)
--   3. Shipping zones (14 zones: EU, US, CA, AU, JP, GB)
--
-- Legal settings are NOT seeded — configure them in the
-- Admin Panel → Settings → Legal after first login.
--
-- Apply AFTER schema.sql:
--   psql -U postgres -d postgres -f supabase/seed.sql
--
-- NOTE: The default tenant UUID (f1c548a3-b69d-4328-a372-c4924a660044)
-- is used by categories. Do not change it without updating category rows.
-- ============================================================

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SELECT pg_catalog.set_config('search_path', '', false);
SET row_security = off;

-- ──────────────────────────────────────────────────────────────
-- 1. Default Tenant
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.tenants (id, name, domain, plan, created_at, updated_at)
VALUES (
  'f1c548a3-b69d-4328-a372-c4924a660044',
  'Default Store',
  NULL,
  'free',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- 2. Categories & Shipping Zones
-- ──────────────────────────────────────────────────────────────

-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, slug, parent_id, name_en, name_es, name_de, icon, image_url, sort_order, is_active, created_at, updated_at, tenant_id) FROM stdin;
62426f61-11fe-49de-8c4b-9d573aceff3a	phone-cases	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Phone Cases	Fundas de Teléfono	Handyhüllen	smartphone	\N	23	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
db5877e3-8110-4c86-ac49-1aad162a59cd	stickers	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Stickers	Pegatinas	Aufkleber	star	\N	24	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
592f3d1f-1260-47f0-9505-90b1f4f5287f	mugs	0385e2d2-60c1-4a40-8a9e-3966b3829179	Mugs	Tazas	Tassen	coffee	\N	31	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
0385e2d2-60c1-4a40-8a9e-3966b3829179	drinkware	\N	Drinkware	Tazas y Botellas	Trinkgeschirr	coffee	\N	30	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
2057480e-21a9-4545-943a-78a2c3ce3dac	kids-tshirts	94348716-65f7-4d60-af45-130345f12ed1	Kids T-Shirts	Camisetas Niños	Kinder T-Shirts	baby	\N	61	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
c309a282-e305-43cb-bc27-b0df4496639f	kids-sweatshirts	94348716-65f7-4d60-af45-130345f12ed1	Kids Sweatshirts	Sudaderas Niños	Kinder Sweatshirts	baby	\N	62	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
a5f33845-5fb5-439b-a5be-a2bbea23c2db	baby-clothing	94348716-65f7-4d60-af45-130345f12ed1	Baby Clothing	Ropa de Bebé	Babybekleidung	baby	\N	63	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
8d6712fe-d634-4ad7-89f5-f458299d32ae	socks	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Socks	Calcetines	Socken	footprints	\N	26	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
72536522-6de6-40da-be64-ca6909d88e82	mouse-pads	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Mouse Pads	Alfombrillas de Ratón	Mauspads	mouse	\N	27	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
82a9ba74-fd9b-4854-8c45-729544ff8094	hoodies-sweatshirts	\N	Hoodies & Sweatshirts	Sudaderas	Kapuzenpullover & Sweatshirts	shirt	\N	12	t	2026-02-28 10:37:39.673358+00	2026-02-28 10:37:39.673358+00	f1c548a3-b69d-4328-a372-c4924a660044
5f8211d9-cd92-4a39-a785-dffbbc690dd0	headwear	\N	Headwear	Gorras y Gorros	Kopfbedeckungen	crown	\N	14	t	2026-02-28 10:37:39.673358+00	2026-02-28 10:37:39.673358+00	f1c548a3-b69d-4328-a372-c4924a660044
8a143376-d1f5-4568-88ff-20c2296420c5	t-shirts	\N	T-Shirts	Camisetas	T-Shirts	shirt	\N	10	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
6e7032d0-0bc7-4604-b572-f14a423fd5c0	long-sleeves	\N	Long Sleeves	Camisetas Manga Larga	Langarmshirts	shirt	\N	13	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	accessories	\N	Accessories	Accesorios	Zubehör	shopping-bag	\N	40	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
cc59f09e-3391-4672-8bea-805fb0628a47	pullover-hoodies	82a9ba74-fd9b-4854-8c45-729544ff8094	Pullover Hoodies	Sudaderas con Capucha	Kapuzenpullover	shirt	\N	1	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
232655f9-eea7-4d81-9521-4b57995d1993	zip-hoodies	82a9ba74-fd9b-4854-8c45-729544ff8094	Zip-Up Hoodies	Sudaderas con Cremallera	Zip-Kapuzenpullover	shirt	\N	2	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
3213a34b-0eeb-4195-8531-29e65f442384	crewnecks	82a9ba74-fd9b-4854-8c45-729544ff8094	Crewneck Sweatshirts	Sudaderas Cuello Redondo	Rundhals-Sweatshirts	shirt	\N	3	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
a40c8229-18b5-44b0-9eab-65a4c61b35c7	caps	5f8211d9-cd92-4a39-a785-dffbbc690dd0	Caps	Gorras	Kappen	crown	\N	1	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
9be37580-97d1-4ef9-b362-f51302aa07ad	snapbacks	5f8211d9-cd92-4a39-a785-dffbbc690dd0	Snapbacks	Snapbacks	Snapbacks	crown	\N	2	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
d2b666e5-35ce-4910-9a83-b8e24e29d716	dad-hats	5f8211d9-cd92-4a39-a785-dffbbc690dd0	Dad Hats	Gorras Dad	Dad Hats	crown	\N	3	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
26404019-fc0c-4e79-84ec-cc806c2f66de	shoes	\N	Shoes	Zapatillas	Schuhe	footprints	\N	80	t	2026-02-28 10:37:39.673358+00	2026-02-28 10:37:39.673358+00	f1c548a3-b69d-4328-a372-c4924a660044
94348716-65f7-4d60-af45-130345f12ed1	kids	\N	Kids	Niños	Kinder	baby	\N	70	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
47357c83-26cd-4e67-9316-402177873cb4	5-panel-caps	5f8211d9-cd92-4a39-a785-dffbbc690dd0	5-Panel Caps	Gorras 5 Paneles	5-Panel-Kappen	crown	\N	4	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
9b8b4d18-b077-48e7-8101-1af537a71664	beanies	5f8211d9-cd92-4a39-a785-dffbbc690dd0	Beanies	Gorros	Mützen	crown	\N	5	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
04a786e2-2457-439c-a6e1-bd52d5b85d37	bucket-hats	5f8211d9-cd92-4a39-a785-dffbbc690dd0	Bucket Hats	Sombreros de Pescador	Fischerhüte	crown	\N	6	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
e8a19199-5853-4e9b-ae81-96cdbab46341	bottles	0385e2d2-60c1-4a40-8a9e-3966b3829179	Bottles	Botellas	Flaschen	cup-soda	\N	31	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
fa425e3f-8b1f-4428-9182-aa96bf75e02e	tumblers	0385e2d2-60c1-4a40-8a9e-3966b3829179	Tumblers	Vasos Térmicos	Thermobecher	cup-soda	\N	32	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
14b08d25-b6c0-4fc0-952f-abe3c4df24bb	desk-mats	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Desk Mats	Alfombrillas Gaming	Schreibtischmatten	monitor	\N	28	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
628f2c40-e91a-4f77-a1bd-2585a05ee81c	laptop-sleeves	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Laptop Sleeves	Fundas de Portátil	Laptophüllen	laptop	\N	29	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
90a124e1-41e9-474d-ae17-22cfa1060c5d	home-decor	\N	Home Decor	Decoración del Hogar	Wohndeko	home	\N	40	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
3f0d9a63-c90b-49fc-9355-93e8325308f5	kitchen	\N	Kitchen	Cocina	Küche	utensils	\N	50	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
b9c4226e-17df-40fe-a4df-c692d17ad77e	sweatshirts	7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	Sweatshirts	Sudaderas	Sweatshirts	shirt	\N	13	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
a6620c64-28c9-456a-a581-181c3148fd38	bags	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Bags	Bolsas	Taschen	shopping-bag	\N	21	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
33a33d9d-2f98-40fc-a6f9-7ea42a58dca8	hats	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Hats	Sombreros	Hüte	crown	\N	22	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
f93e20f0-0790-4366-ad26-66ccafeb4eab	posters	90a124e1-41e9-474d-ae17-22cfa1060c5d	Posters	Pósteres	Poster	image	\N	41	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
61f217f5-93ea-4bc0-9f4b-5514da098f08	wall-art	90a124e1-41e9-474d-ae17-22cfa1060c5d	Wall Art	Arte de Pared	Wandkunst	palette	\N	42	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
3b7d44c3-7ebd-4f1b-a42e-af47671ec51c	games	\N	Games	Juegos	Spiele	gamepad	\N	70	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
26ae02a6-a89d-48b6-8705-53ea31abe579	stationery	\N	Stationery	Papelería	Schreibwaren	pencil	\N	80	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
fe190b02-cd9e-40db-bfb5-3e022adbba1d	sportswear	\N	Sportswear	Ropa Deportiva	Sportbekleidung	dumbbell	\N	45	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
7e3ec2af-23f2-46c2-82d5-e1b0e92e3805	outerwear	7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	Outerwear	Abrigos	Oberbekleidung	shirt	\N	16	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
447b60f4-bb66-4614-b9cc-17d60da14282	bottoms	7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	Bottoms	Pantalones	Hosen	shirt	\N	17	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
4e5e614e-4b23-44ce-b01c-39fbe739856f	activewear	fe190b02-cd9e-40db-bfb5-3e022adbba1d	Activewear	Ropa Activa	Aktivbekleidung	dumbbell	\N	46	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
4b2902b7-8216-4a5b-bf5d-b5208b4dfda5	swimwear	fe190b02-cd9e-40db-bfb5-3e022adbba1d	Swimwear	Bañadores	Badebekleidung	waves	\N	47	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
9e4c4360-7798-44b5-9512-536cbb5d0090	jewelry	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Jewelry	Joyería	Schmuck	gem	\N	25	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
1915c359-a0d9-4d80-b1b7-8cc0f0214447	tech-accessories	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Tech Accessories	Accesorios Tech	Tech-Zubehör	smartphone	\N	28	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
3088b8e3-e2ff-4c07-b11a-26917f1eb50e	canvas	90a124e1-41e9-474d-ae17-22cfa1060c5d	Canvas	Lienzos	Leinwände	image	\N	43	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
96760d62-465f-4d76-8556-3dc4e04ff80a	blankets	90a124e1-41e9-474d-ae17-22cfa1060c5d	Blankets	Mantas	Decken	bed	\N	44	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
c4823b06-38a3-4f3a-99ba-0bece951df4b	pillows	90a124e1-41e9-474d-ae17-22cfa1060c5d	Pillows	Cojines	Kissen	bed	\N	45	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
37b0d748-691a-4144-bd6d-b177584aff47	rugs	90a124e1-41e9-474d-ae17-22cfa1060c5d	Rugs & Mats	Alfombras	Teppiche	grid	\N	46	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
a280e17d-9140-4b9a-b251-8a7e069bca36	bottles-tumblers	0385e2d2-60c1-4a40-8a9e-3966b3829179	Bottles & Tumblers	Botellas y Vasos	Flaschen & Becher	cup-soda	\N	32	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
3017978e-65e4-4ba1-a54c-ec4790953aaf	glassware	0385e2d2-60c1-4a40-8a9e-3966b3829179	Glassware	Cristalería	Glaswaren	wine	\N	33	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
2b43a08d-8279-4ee6-adce-5df570b5c981	kitchen-towels	3f0d9a63-c90b-49fc-9355-93e8325308f5	Kitchen Towels	Paños de Cocina	Geschirrtücher	utensils	\N	51	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
18108df7-4ed9-4076-a6c0-5b33e6751f61	journals	26ae02a6-a89d-48b6-8705-53ea31abe579	Journals	Diarios	Tagebücher	book	\N	81	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
7f821c5e-6ed5-4ba3-9e84-be49e0f0281b	notebooks	26ae02a6-a89d-48b6-8705-53ea31abe579	Notebooks	Cuadernos	Notizbücher	book-open	\N	82	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
648c9594-3081-48bd-9ebf-8116b5f6a38f	postcards	26ae02a6-a89d-48b6-8705-53ea31abe579	Postcards	Postales	Postkarten	mail	\N	83	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
99c642e0-4310-42c7-bd97-65c115a648c4	puzzles	3b7d44c3-7ebd-4f1b-a42e-af47671ec51c	Puzzles	Puzzles	Puzzles	puzzle	\N	71	f	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
f9e9eb54-3cb1-4f26-b7cf-8ac29d78ee28	sneakers	26404019-fc0c-4e79-84ec-cc806c2f66de	Sneakers	Sneakers	Sneakers	footprints	\N	1	t	2026-02-28 10:37:39.821314+00	2026-02-28 10:37:39.821314+00	f1c548a3-b69d-4328-a372-c4924a660044
7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	apparel	\N	Clothing	Ropa	Kleidung	shirt	\N	10	t	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
c096c24b-6a5c-4f34-906c-e97eca769fd6	tote-bags	8b4bfb91-2ce8-4610-8ebe-7b3131f280d1	Tote Bags	Bolsas Tote	Tragetaschen	\N	\N	30	t	2026-02-28 20:00:05.362794+00	2026-02-28 20:00:05.362794+00	f1c548a3-b69d-4328-a372-c4924a660044
0f6b1443-6793-4495-b93c-6b44b1b91923	tank-tops	7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	Tank Tops	Camisetas sin Mangas	Tanktops	shirt	\N	15	t	2026-02-24 22:09:55.152793+00	2026-02-24 22:09:55.152793+00	f1c548a3-b69d-4328-a372-c4924a660044
e93249f6-7911-4f08-ae00-a3e4fa633e6b	hoodies	7ca8c4d1-9ccc-447d-b132-3647e0a5cb0b	Hoodies	Sudaderas con Capucha	Kapuzenpullover	shirt	\N	12	f	2026-02-23 23:37:40.003707+00	2026-02-23 23:37:40.003707+00	f1c548a3-b69d-4328-a372-c4924a660044
\.


--
-- Data for Name: shipping_zones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shipping_zones (id, country_code, zip_pattern, state_code, base_rate, per_item_rate, free_shipping_threshold, estimated_days_min, estimated_days_max, active, created_at, updated_at) FROM stdin;
af87f819-98c2-4873-bcce-84e49ec1547d	US	%	\N	5.99	1.50	50.00	5	7	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
a3d9b567-01f7-4eba-a093-1d992b499bec	US	995%	AK	12.99	3.50	100.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
d8789723-107e-4848-987f-40982947abc5	US	996%	HI	12.99	3.50	100.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
53e7d2d4-ce3d-405f-b237-5d47049d9d70	CA	\N	\N	8.99	2.50	60.00	5	10	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
da2c5fb4-a94d-4338-8391-2670c9e1d13c	AU	\N	\N	14.99	4.00	100.00	10	21	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
af74570f-009c-4adf-a8a9-8de711040b7e	JP	\N	\N	14.99	4.00	100.00	10	21	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
ff7cf250-9173-432c-9842-c6df99079bd9	US	100%	NY	7.99	2.00	50.00	2	4	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
cf1cc2b3-5522-4a7f-836b-2fc5c37fc3f7	US	900%	CA	7.99	2.00	50.00	2	4	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
2e76ad2f-3ea2-48d1-a11d-2ae9eacb4b2f	US	600%	IL	7.99	2.00	50.00	2	4	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
04d270f6-4a60-455b-b375-5ad9de4e69c1	GB	\N	\N	9.99	3.00	50.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
dc2adf05-8b58-4ecc-83ac-8432e6788f3c	DE	\N	\N	9.99	3.00	50.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
856a9894-72fc-4487-bfc8-f0809d3bbd77	FR	\N	\N	9.99	3.00	50.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
03980574-dc5d-46df-b8c6-53ba4be26804	ES	\N	\N	9.99	3.00	50.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
5a4faaa5-a1db-414f-a752-33036d8fc6e7	IT	\N	\N	9.99	3.00	50.00	7	14	t	2026-02-14 01:28:55.305469+00	2026-02-14 01:28:55.305469+00
\.


--


