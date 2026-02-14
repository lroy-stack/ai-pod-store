-- Trim trailing spaces from document locales
-- Existing documents have locale values like 'en   ' due to previous CHAR(4) type
UPDATE documents SET locale = TRIM(locale) WHERE locale != TRIM(locale);
