-- SKAPARA Category Restructuring Phase D: Archive poster products
-- User explicitly does not want to sell posters

UPDATE public.products SET status = 'archived'
WHERE blueprint_id IN (97, 1130) AND status != 'deleted';
