-- RLS on conversations and messages (defense in depth)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_conversations" ON conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_messages" ON messages
  FOR ALL USING (auth.role() = 'service_role');

-- FK behavior for order_items: prevent deleting products with existing orders
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
