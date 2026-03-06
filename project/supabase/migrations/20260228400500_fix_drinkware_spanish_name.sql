-- Fix Spanish name for drinkware: "Vajilla" → "Tazas y Botellas" (vajilla means tableware, not drinkware)
UPDATE public.categories
SET name_es = 'Tazas y Botellas'
WHERE slug = 'drinkware';
