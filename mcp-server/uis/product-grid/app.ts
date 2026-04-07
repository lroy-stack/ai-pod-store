import { createApp, connectApp, notifyResize } from '../app-init'

const app = createApp('POD Products')
const grid = document.getElementById('grid')!
const empty = document.getElementById('empty')!

app.ontoolresult = (result: any) => {
  try {
    const text = result.content?.find((c: any) => c.type === 'text')
    if (!text) return
    const data = JSON.parse(text.text)
    const items = data.products || data.recommendations || data.items || []
    if (items.length === 0) {
      empty.style.display = 'block'
      grid.style.display = 'none'
      return
    }
    renderGrid(items)
    notifyResize(app)
  } catch {
    empty.textContent = 'Error loading products'
    empty.style.display = 'block'
  }
}

connectApp(app)

function renderGrid(items: any[]) {
  grid.innerHTML = items.map((p: any) => {
    const img = p.image || p.product_image || p.image_url || ''
    const title = p.title || p.product_name || ''
    const price = p.price ?? p.unit_price ?? p.product_price ?? null
    const cat = p.category || ''
    const rating = p.rating || 0
    const id = p.id || p.product_id || ''
    return `<div class="card" data-id="${esc(id)}" data-title="${esc(title)}">
      ${img
        ? `<img src="${esc(img)}" alt="${esc(title)}" loading="lazy" onerror="this.outerHTML='<div class=no-img>No image</div>'">`
        : '<div class="no-img">No image</div>'}
      <div class="info">
        <div class="title">${esc(title)}</div>
        ${price !== null ? `<div class="price">&euro;${Number(price).toFixed(2)}</div>` : ''}
        <div class="meta">
          ${cat ? `<span class="badge">${esc(cat)}</span>` : ''}
          ${rating > 0 ? `<span class="star">${'\u2605'.repeat(Math.round(rating))}${'\u2606'.repeat(5 - Math.round(rating))}</span>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  grid.querySelectorAll('.card[data-id]').forEach(card => {
    card.addEventListener('click', async () => {
      const title = (card as HTMLElement).dataset.title || ''
      try {
        await app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: `Show me details for "${title}"` }],
        })
      } catch (err) {
        console.error('Failed to send message:', err)
      }
    })
  })
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
