import { createApp, connectApp, notifyResize } from '../app-init'

const app = createApp('POD Product Detail')
const content = document.getElementById('content')!
const empty = document.getElementById('empty')!

let allImages: string[] = []

app.ontoolresult = (result: any) => {
  try {
    const text = result.content?.find((c: any) => c.type === 'text')
    if (!text) return
    const data = JSON.parse(text.text)
    const p = data.product
    if (!p) { empty.style.display = 'block'; notifyResize(app); return }
    render(p)
    notifyResize(app)
  } catch { empty.textContent = 'Error loading product'; empty.style.display = 'block'; notifyResize(app) }
}

connectApp(app)

function render(p: any) {
  const images: any[] = p.images || []
  allImages = images.map((i: any) => typeof i === 'string' ? i : (i.src || i.url || '')).filter(Boolean)
  const sizes: string[] = p.variants?.sizes || []
  const colors: string[] = p.variants?.colors || []
  const colorImages: Record<string, string> = p.variants?.colorImages || {}
  const rating = p.rating || 0
  const reviewCount = p.review_count || 0
  const pd = p.product_details || {}
  const selectedColor = colors.length > 0 ? colors[0] : ''
  const displayImages = filterByColor(allImages, selectedColor)
  const mainImg = displayImages[0] || ''

  content.innerHTML = `
    <div class="layout">
      <div class="gallery">
        <img class="main" id="main-img" src="${esc(mainImg)}" alt="${esc(p.title)}" onerror="this.style.display='none'">
        ${displayImages.length > 1 ? `<div class="thumbs" id="thumbs">
          ${displayImages.map((src: string, i: number) =>
            `<img src="${esc(src)}" class="${i === 0 ? 'active' : ''}" onerror="this.style.display='none'">`
          ).join('')}
        </div>` : ''}
      </div>
      <div class="details">
        <h1>${esc(p.title)}</h1>
        ${p.category ? `<span class="badge">${esc(p.category)}</span>` : ''}
        ${rating > 0 ? `<div class="rating"><span class="star">${'\u2605'.repeat(Math.round(rating))}${'\u2606'.repeat(5 - Math.round(rating))}</span> <span class="muted">(${reviewCount})</span></div>` : ''}
        <div class="price">&euro;${Number(p.base_price).toFixed(2)} <span class="muted price-note">IVA incl.</span></div>
        <div class="shipping muted">\u{1F4E6} Free shipping from \u20AC50 \u00B7 EU delivery 3\u20135 days</div>

        ${colors.length > 0 ? `
          <div class="section">Color <span class="muted" id="color-label">\u2014 ${esc(selectedColor)}</span></div>
          <div class="dots" id="color-dots">
            ${colors.map((c: string) => {
              const ci = colorImages[c]
              return `<div class="dot${c === selectedColor ? ' active' : ''}" data-color="${esc(c)}" style="${ci ? `background-image:url(${esc(ci)})` : `background:var(--color-background-tertiary)`}" title="${esc(c)}"></div>`
            }).join('')}
          </div>` : ''}

        ${sizes.length > 0 ? `
          <div class="section">Size</div>
          <div class="variants" id="size-btns">
            ${sizes.map((s: string) => `<button class="btn" data-size="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>` : ''}

        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}

        ${hasSpecs(pd) ? `
          <details open>
            <summary class="section clickable">Specifications \u25BE</summary>
            <div class="specs">
              ${pd.material ? `<div><strong>Material:</strong> ${esc(pd.material)}</div>` : ''}
              ${pd.print_technique ? `<div><strong>Print:</strong> ${esc(pd.print_technique)}</div>` : ''}
              ${pd.manufacturing_country ? `<div><strong>Made in:</strong> ${esc(pd.manufacturing_country)}</div>` : ''}
              ${pd.care_instructions ? `<div><strong>Care:</strong> ${esc(pd.care_instructions)}</div>` : ''}
              ${pd.brand ? `<div><strong>Brand:</strong> ${esc(pd.brand)}</div>` : ''}
            </div>
          </details>` : ''}

        ${pd.safety_information ? `
          <details>
            <summary class="section clickable">GPSR / Safety \u25BE</summary>
            <div class="safety">${sanitizeHtml(pd.safety_information)}</div>
          </details>` : ''}
      </div>
    </div>`

  bindEvents(colors, colorImages)
}

function bindEvents(colors: string[], colorImages: Record<string, string>) {
  content.querySelectorAll('#thumbs img').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const mainImg = document.getElementById('main-img') as HTMLImageElement
      if (mainImg) mainImg.src = (thumb as HTMLImageElement).src
      content.querySelectorAll('#thumbs img').forEach(t => t.classList.remove('active'))
      thumb.classList.add('active')
    })
  })

  content.querySelectorAll('#color-dots .dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = (dot as HTMLElement).dataset.color || ''
      content.querySelectorAll('#color-dots .dot').forEach(d => d.classList.remove('active'))
      dot.classList.add('active')

      const filtered = filterByColor(allImages, color)
      const mainImg = document.getElementById('main-img') as HTMLImageElement
      if (mainImg && filtered[0]) mainImg.src = filtered[0]

      const thumbs = document.getElementById('thumbs')
      if (thumbs) {
        thumbs.innerHTML = filtered.map((src: string, i: number) =>
          `<img src="${esc(src)}" class="${i === 0 ? 'active' : ''}" onerror="this.style.display='none'">`
        ).join('')
        thumbs.querySelectorAll('img').forEach(thumb => {
          thumb.addEventListener('click', () => {
            if (mainImg) mainImg.src = (thumb as HTMLImageElement).src
            thumbs.querySelectorAll('img').forEach(t => t.classList.remove('active'))
            thumb.classList.add('active')
          })
        })
      }

      const label = document.getElementById('color-label')
      if (label) label.textContent = `\u2014 ${color}`
      notifyResize(app)
    })
  })

  content.querySelectorAll('#size-btns .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wasActive = btn.classList.contains('active')
      content.querySelectorAll('#size-btns .btn').forEach(b => b.classList.remove('active'))
      if (!wasActive) btn.classList.add('active')
    })
  })
}

function filterByColor(images: string[], color: string): string[] {
  if (!color || images.length <= 1) return images
  const slug = color.toLowerCase().replace(/\s+/g, '-')
  const re = new RegExp(`/${slug}[-.]`)
  const filtered = images.filter(url => re.test(url.toLowerCase()))
  return filtered.length > 0 ? filtered : images.slice(0, 1)
}

function hasSpecs(d: any): boolean {
  return !!(d?.material || d?.print_technique || d?.manufacturing_country || d?.care_instructions || d?.brand)
}

/** Sanitize HTML — allow only safe tags (p, strong, br, ul, li, em) */
function sanitizeHtml(html: string): string {
  const allowed = ['p', 'strong', 'b', 'em', 'i', 'br', 'ul', 'ol', 'li', 'span']
  const div = document.createElement('div')
  div.innerHTML = html
  sanitizeNode(div, allowed)
  return div.innerHTML
}

function sanitizeNode(node: Node, allowed: string[]) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      if (!allowed.includes(el.tagName.toLowerCase())) {
        // Replace disallowed element with its text content
        const text = document.createTextNode(el.textContent || '')
        node.replaceChild(text, child)
      } else {
        // Remove all attributes (prevent event handlers)
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name)
        }
        sanitizeNode(el, allowed)
      }
    }
  }
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
