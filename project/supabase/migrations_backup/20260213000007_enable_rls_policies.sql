-- Migration: Enable Row-Level Security Policies
-- Description: Enable RLS on user-facing tables and create security policies
-- Date: 2026-02-13

-- =============================================
-- ENABLE RLS ON USER-FACING TABLES
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: USERS
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- RLS POLICIES: SHIPPING ADDRESSES
-- =============================================

-- Users can view their own shipping addresses
CREATE POLICY "Users can view own shipping addresses" ON shipping_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own shipping addresses
CREATE POLICY "Users can insert own shipping addresses" ON shipping_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own shipping addresses
CREATE POLICY "Users can update own shipping addresses" ON shipping_addresses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own shipping addresses
CREATE POLICY "Users can delete own shipping addresses" ON shipping_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: ORDERS
-- =============================================

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own orders (during checkout)
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =============================================
-- RLS POLICIES: ORDER ITEMS
-- =============================================

-- Users can view their own order items
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- =============================================
-- RLS POLICIES: CONVERSATIONS
-- =============================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: MESSAGES
-- =============================================

-- Users can view messages in their own conversations
CREATE POLICY "Users can view own conversation messages" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_id = auth.uid() OR conversations.user_id IS NULL)
    )
  );

-- Users can insert messages in their own conversations
CREATE POLICY "Users can insert own conversation messages" ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_id = auth.uid() OR conversations.user_id IS NULL)
    )
  );

-- =============================================
-- RLS POLICIES: CART ITEMS
-- =============================================

-- Users can view their own cart items (by user_id or session_id)
CREATE POLICY "Users can view own cart items" ON cart_items
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own cart items
CREATE POLICY "Users can insert own cart items" ON cart_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own cart items
CREATE POLICY "Users can update own cart items" ON cart_items
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own cart items
CREATE POLICY "Users can delete own cart items" ON cart_items
  FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- =============================================
-- RLS POLICIES: WISHLISTS
-- =============================================

-- Users can view their own wishlists
CREATE POLICY "Users can view own wishlists" ON wishlists
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Users can insert their own wishlists
CREATE POLICY "Users can insert own wishlists" ON wishlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own wishlists
CREATE POLICY "Users can update own wishlists" ON wishlists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own wishlists
CREATE POLICY "Users can delete own wishlists" ON wishlists
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: WISHLIST ITEMS
-- =============================================

-- Users can view items in their own wishlists
CREATE POLICY "Users can view own wishlist items" ON wishlist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
      AND (wishlists.user_id = auth.uid() OR wishlists.is_public = true)
    )
  );

-- Users can insert items into their own wishlists
CREATE POLICY "Users can insert own wishlist items" ON wishlist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
      AND wishlists.user_id = auth.uid()
    )
  );

-- Users can delete items from their own wishlists
CREATE POLICY "Users can delete own wishlist items" ON wishlist_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
      AND wishlists.user_id = auth.uid()
    )
  );

-- =============================================
-- RLS POLICIES: PRODUCT REVIEWS
-- =============================================

-- Anyone can view approved product reviews
CREATE POLICY "Anyone can view product reviews" ON product_reviews
  FOR SELECT
  USING (true);

-- Users can insert their own product reviews
CREATE POLICY "Users can insert own product reviews" ON product_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own product reviews
CREATE POLICY "Users can update own product reviews" ON product_reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own product reviews
CREATE POLICY "Users can delete own product reviews" ON product_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: NOTIFICATIONS
-- =============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: DESIGNS
-- =============================================

-- Anyone can view approved designs
CREATE POLICY "Anyone can view approved designs" ON designs
  FOR SELECT
  USING (moderation_status = 'approved' OR user_id = auth.uid());

-- Users can insert their own designs
CREATE POLICY "Users can insert own designs" ON designs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own designs
CREATE POLICY "Users can update own designs" ON designs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: CUSTOMER SEGMENTS
-- =============================================

-- Users can view their own customer segment data
CREATE POLICY "Users can view own customer segment" ON customer_segments
  FOR SELECT
  USING (auth.uid() = customer_id);

-- =============================================
-- PUBLIC ACCESS: Products, Product Variants, Translations
-- =============================================

-- Products and variants are publicly readable (no RLS needed)
-- Translations are publicly readable (no RLS needed)
-- Documents are publicly readable (no RLS needed)
-- Audit log, agent tables, and analytics tables require service role access (no RLS policies)
