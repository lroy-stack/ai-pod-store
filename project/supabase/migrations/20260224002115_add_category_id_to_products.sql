-- Add category_id column to products table with FK to categories
-- This replaces the VARCHAR category field with a proper relational FK

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
