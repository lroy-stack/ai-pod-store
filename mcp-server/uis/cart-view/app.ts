import { createApp, connectApp, notifyResize } from '../app-init'

const app = createApp('POD Cart')
const content = document.getElementById('content')!
const empty = document.getElementById('empty')!

app.ontoolresult = (result: any) => {
  try {
    const text = result.content?.find((c: any) => c.type === 'text')
    if (!text) return
    const data = JSON.parse(text.text)
    const items = data.items || []
    if (items.length === 0) { empty.style.display = 'block'; notifyResize(app); return }
    render(items, data.cart_total || 0, data.currency || 'EUR')
    notifyResize(app)
  } catch { empty.textContent = 'Error loading cart'; empty.style.display = 'block'; notifyResize(app) }
}

connectApp(app)

function render(items: any[], total: number, currency: string) {
  const sym = currency === 'EUR' ? '\u20AC' : currency === 'USD' ? '$' : currency
  content.innerHTML = `
    <div class="cart-header">
      <h2>\uD83D\uDED2 Your Cart</h2>
      <span class="muted">(${items.length} item${items.length !== 1 ? 's' : ''})</span>
    </div>
    ${items.map((i: any) => {
      const img = i.image_url || i.product_image || ''
      const title = i.product_title || i.title || ''
      const variant = i.variant_name || ''
      const qty = i.quantity || 1
      const price = i.total_price ?? (i.unit_price ? i.unit_price * qty : 0)
      return `<div class="item">
        ${img ? `<img src="${esc(img)}" alt="${esc(title)}" onerror="this.style.display='none'">` : ''}
        <div class="item-info">
          <div class="item-title">${esc(title)}</div>
          ${variant ? `<div class="item-variant muted">${esc(variant)}</div>` : ''}
        </div>
        <div class="item-right">
          <div class="item-qty muted">&times;${qty}</div>
          <div class="item-price">${sym}${Number(price).toFixed(2)}</div>
        </div>
      </div>`
    }).join('')}
    <div class="total">
      <span class="muted">Total</span>
      <span class="total-price">${sym}${Number(total).toFixed(2)}</span>
    </div>`
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
