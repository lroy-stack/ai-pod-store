-- Insert default settings row
INSERT INTO public.admin_settings (id, settings)
VALUES (1, '{
  "podclawEnabled": true,
  "podclawBridgeUrl": "http://localhost:8000",
  "storeName": "POD AI",
  "storeEmail": "support@podai.com",
  "defaultCurrency": "EUR",
  "defaultLocale": "en",
  "maintenanceMode": false,
  "registrationEnabled": true,
  "guestCheckoutEnabled": true,
  "reviewsEnabled": true,
  "wishlistsEnabled": true,
  "orderConfirmationEmails": true,
  "shippingNotificationEmails": true,
  "marketingEmails": false
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
