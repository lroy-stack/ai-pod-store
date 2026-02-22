import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Get recent orders
const { data: orders } = await supabase
  .from('orders')
  .select('id, customer_email, payment_method')
  .order('created_at', { ascending: false })
  .limit(3)

console.log('Recent orders:', orders?.length || 0)

if (orders && orders.length > 0) {
  const orderId = orders[0].id
  console.log('Updating order:', orderId.substring(0, 8))
  
  const { data: updated } = await supabase
    .from('orders')
    .update({ payment_method: 'card' })
    .eq('id', orderId)
    .select()
    .single()
  
  console.log('✅ Updated! Payment method:', updated?.payment_method)
  console.log('Test URL: http://localhost:3000/en/orders/' + orderId)
}
