-- Create compound indexes for frequent queries
-- These indexes optimize common query patterns across the application

-- Orders: status + created_at (for order listing/filtering by status)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Orders: user_id + created_at (for user order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Documents: Full-text search GIN index on content
CREATE INDEX IF NOT EXISTS idx_documents_content_fts ON documents USING GIN (to_tsvector('english', content));

-- Agent events: agent_name + created_at (for agent activity timeline)
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_created ON agent_events(agent_name, created_at DESC);

-- Messages: conversation_id + created_at (for conversation message history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Product reviews: product_id + created_at (for product review listing)
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created ON product_reviews(product_id, created_at DESC);

-- Designs: user_id + created_at (for user design gallery)
CREATE INDEX IF NOT EXISTS idx_designs_user_created ON designs(user_id, created_at DESC);

-- Audit log: created_at + actor (for recent activity by actor)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_actor ON audit_log(created_at DESC, actor_type, actor_id);

-- Notifications: user_id + created_at + is_read (for user notification feed)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_read ON notifications(user_id, created_at DESC, is_read);

-- Cart items: user_id + created_at (for user cart history)
CREATE INDEX IF NOT EXISTS idx_cart_items_user_created ON cart_items(user_id, created_at DESC);

-- Conversations: user_id + created_at (for user conversation history)
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
