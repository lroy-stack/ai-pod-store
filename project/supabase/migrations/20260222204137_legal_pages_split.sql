-- Create legal_pages table for multi-locale legal content
CREATE TABLE IF NOT EXISTS public.legal_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  title_de TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_es TEXT NOT NULL,
  content_de TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create legal_page_versions table for audit trail
CREATE TABLE IF NOT EXISTS public.legal_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_page_id UUID NOT NULL REFERENCES public.legal_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  title_de TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_es TEXT NOT NULL,
  content_de TEXT NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(legal_page_id, version_number)
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_legal_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER legal_pages_updated_at
  BEFORE UPDATE ON public.legal_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_pages_updated_at();

-- Enable RLS
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_page_versions ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read active legal pages"
  ON public.legal_pages FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read legal page versions"
  ON public.legal_page_versions FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can manage legal pages"
  ON public.legal_pages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins can create legal page versions"
  ON public.legal_page_versions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Seed legal pages with placeholder content (split into separate statements)
-- Privacy Policy
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('privacy', 'Privacy Policy', 'Política de Privacidad', 'Datenschutzerklärung',
  $$# Privacy Policy

Last updated: {{current_date}}

## Data Controller
**{{company_name}}**
{{company_address}}
Email: {{company_email}}
Data Protection Officer: {{dpo_name}} ({{dpo_email}})

## Data We Collect
- Account information (name, email, password hash)
- Order history and purchase data
- Payment information (processed by Stripe)
- Usage analytics (anonymized)

## Your Rights (GDPR)
Under GDPR, you have the right to access, rectify, delete, and port your data. Contact {{dpo_email}} to exercise these rights.

## Data Retention
- Account data: Until account deletion
- Order history: 7 years (tax compliance)
- Analytics: 24 months

## Contact
For privacy questions: {{dpo_email}}$$,
  $$# Política de Privacidad

Última actualización: {{current_date}}

## Responsable
**{{company_name}}**
{{company_address}}
Correo: {{company_email}}
DPO: {{dpo_name}} ({{dpo_email}})

## Datos que Recopilamos
- Información de cuenta
- Historial de pedidos
- Información de pago (Stripe)
- Análisis de uso

## Sus Derechos (RGPD)
Tiene derecho a acceder, rectificar, eliminar y portar sus datos. Contacte {{dpo_email}}.

## Contacto
{{dpo_email}}$$,
  $$# Datenschutzerklärung

Letzte Aktualisierung: {{current_date}}

## Verantwortlicher
**{{company_name}}**
{{company_address}}
E-Mail: {{company_email}}
Datenschutzbeauftragter: {{dpo_name}} ({{dpo_email}})

## Erhobene Daten
- Kontoinformationen
- Bestellhistorie
- Zahlungsinformationen (Stripe)
- Nutzungsanalysen

## Ihre Rechte (DSGVO)
Sie haben das Recht auf Zugang, Berichtigung, Löschung und Datenübertragbarkeit. Kontakt: {{dpo_email}}.

## Kontakt
{{dpo_email}}$$
);

-- Terms of Service
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('terms', 'Terms of Service', 'Términos de Servicio', 'Nutzungsbedingungen',
  $$# Terms of Service

Last updated: {{current_date}}

By using {{company_name}}, you agree to these terms.

## Services
Print-on-demand e-commerce platform powered by AI.

## User Accounts
- Provide accurate information
- Responsible for account security
- One account per person

## Orders & Payment
- Prices in EUR
- Payment via Stripe
- Fulfillment by Printify

## Prohibited Uses
- Illegal content
- Hate speech
- Copyright infringement
- Spam or fraud

## Contact
{{company_email}}$$,
  $$# Términos de Servicio

Última actualización: {{current_date}}

Al usar {{company_name}}, acepta estos términos.

## Servicios
Plataforma de impresión bajo demanda con IA.

## Cuentas
- Información precisa
- Seguridad de cuenta
- Una cuenta por persona

## Usos Prohibidos
- Contenido ilegal
- Discurso de odio
- Infracción de derechos de autor

## Contacto
{{company_email}}$$,
  $$# Nutzungsbedingungen

Letzte Aktualisierung: {{current_date}}

Mit der Nutzung von {{company_name}} stimmen Sie diesen Bedingungen zu.

## Dienstleistungen
KI-gestützte Print-on-Demand-Plattform.

## Benutzerkonten
- Genaue Informationen
- Kontosicherheit
- Ein Konto pro Person

## Verbotene Nutzung
- Illegale Inhalte
- Hassrede
- Urheberrechtsverletzung

## Kontakt
{{company_email}}$$
);

-- Shipping Policy
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('shipping', 'Shipping Policy', 'Política de Envío', 'Versandrichtlinie',
  $$# Shipping Policy

## Processing Time
- Design creation: 1-2 business days
- Production (Printify): 2-5 business days
- Shipping: 3-10 business days

## Shipping Costs
Calculated at checkout based on destination and weight.

## International Shipping
We ship worldwide. Import duties are buyer's responsibility.

## Tracking
Tracking numbers provided via email.

## Contact
{{company_email}}$$,
  $$# Política de Envío

## Tiempo de Procesamiento
- Diseño: 1-2 días hábiles
- Producción: 2-5 días hábiles
- Envío: 3-10 días hábiles

## Costos
Calculados al finalizar compra.

## Envío Internacional
Enviamos mundialmente. Aranceles son responsabilidad del comprador.

## Contacto
{{company_email}}$$,
  $$# Versandrichtlinie

## Bearbeitungszeit
- Design: 1-2 Werktage
- Produktion: 2-5 Werktage
- Versand: 3-10 Werktage

## Versandkosten
Beim Checkout berechnet.

## Internationaler Versand
Weltweiter Versand. Zölle Käuferverantwortung.

## Kontakt
{{company_email}}$$
);

-- Returns Policy
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('returns', 'Returns Policy', 'Política de Devoluciones', 'Rückgaberichtlinie',
  $$# Returns Policy

## Return Window
30 days from delivery.

## Eligible Returns
- Defective products
- Wrong item received
- Damaged during shipping

## Non-Returnable
- Custom/personalized items (unless defective)

## Process
1. Contact {{company_email}} with order number and photos
2. Receive return authorization
3. Ship item back
4. Refund within 5-7 business days

## Contact
{{company_email}}$$,
  $$# Política de Devoluciones

## Plazo
30 días desde entrega.

## Elegibles
- Productos defectuosos
- Artículo incorrecto
- Dañado en envío

## Proceso
1. Contacte {{company_email}}
2. Autorización
3. Envíe artículo
4. Reembolso 5-7 días

## Contacto
{{company_email}}$$,
  $$# Rückgaberichtlinie

## Frist
30 Tage ab Lieferung.

## Berechtigt
- Defekte Produkte
- Falscher Artikel
- Versandschäden

## Prozess
1. Kontakt {{company_email}}
2. Genehmigung
3. Rücksendung
4. Rückerstattung 5-7 Tage

## Kontakt
{{company_email}}$$
);

-- Cookie Policy
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('cookies', 'Cookie Policy', 'Política de Cookies', 'Cookie-Richtlinie',
  $$# Cookie Policy

Last updated: {{current_date}}

## Essential Cookies (Required)
- Authentication session
- Cart persistence
- Security (CSRF protection)

## Analytics Cookies (Optional)
- Anonymous usage statistics
- Performance monitoring

## Your Choices
Disable optional cookies in browser settings.

## Contact
{{company_email}}$$,
  $$# Política de Cookies

Última actualización: {{current_date}}

## Cookies Esenciales
- Sesión de autenticación
- Carrito
- Seguridad

## Cookies Analíticas (Opcionales)
- Estadísticas anónimas
- Rendimiento

## Contacto
{{company_email}}$$,
  $$# Cookie-Richtlinie

Letzte Aktualisierung: {{current_date}}

## Essenzielle Cookies
- Authentifizierung
- Warenkorb
- Sicherheit

## Analyse-Cookies (Optional)
- Anonyme Statistiken
- Leistung

## Kontakt
{{company_email}}$$
);

-- Imprint (required in EU/Germany)
INSERT INTO public.legal_pages (slug, title_en, title_es, title_de, content_en, content_es, content_de) VALUES
('imprint', 'Imprint', 'Aviso Legal', 'Impressum',
  $$# Imprint

## Company Information
**{{company_name}}**
{{company_address}}

Email: {{company_email}}
Tax ID: {{tax_id}}

## Data Protection Officer
{{dpo_name}}
{{dpo_email}}

## Online Dispute Resolution
EU ODR platform: https://ec.europa.eu/consumers/odr$$,
  $$# Aviso Legal

## Información
**{{company_name}}**
{{company_address}}

Correo: {{company_email}}
ID Fiscal: {{tax_id}}

## DPO
{{dpo_name}}
{{dpo_email}}

## ODR
https://ec.europa.eu/consumers/odr$$,
  $$# Impressum

## Unternehmensangaben
**{{company_name}}**
{{company_address}}

E-Mail: {{company_email}}
Steuernummer: {{tax_id}}

## Datenschutzbeauftragter
{{dpo_name}}
{{dpo_email}}

## OS-Plattform
https://ec.europa.eu/consumers/odr$$
);

-- Add comments
COMMENT ON TABLE public.legal_pages IS 'Legal page content in multiple locales with markdown and placeholder variables';
COMMENT ON TABLE public.legal_page_versions IS 'Audit trail for legal page changes';
COMMENT ON COLUMN public.legal_pages.content_en IS 'Markdown content with {{placeholder}} variables';
