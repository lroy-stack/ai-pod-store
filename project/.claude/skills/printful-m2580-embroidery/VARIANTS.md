# Variants — M2580 Embroidery (Catalog 380)

## Colores Disponibles (EU Latvia)

Solo colores claros para bordado premium. Todos con `EU_LV: in_stock`.

| Color | Hex | Slug |
|---|---|---|
| **White** | `#ffffff` | `white` |
| **Bone** | `#f5e8ce` | `bone` |

---

## Variant IDs por Color × Talla

### White (#ffffff)

| Talla | variant_id | Base Cost |
|---|---|---|
| S | 10774 | $21.25 |
| M | 10775 | $21.25 |
| L | 10776 | $21.25 |
| XL | 10777 | $21.25 |
| 2XL | 10778 | $22.55 |
| 3XL | 13421 | $23.85 |

### Bone (#f5e8ce)

| Talla | variant_id | Base Cost |
|---|---|---|
| S | 20284 | $21.25 |
| M | 20285 | $21.25 |
| L | 20286 | $21.25 |
| XL | 20287 | $21.25 |
| 2XL | 20288 | $22.55 |
| 3XL | 20289 | $23.85 |

---

## Variant IDs (lookup rápido)

```javascript
const VARIANTS = {
  White: {
    S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421,
  },
  Bone: {
    S: 20284, M: 20285, L: 20286, XL: 20287, '2XL': 20288, '3XL': 20289,
  },
};
```

---

## Retail Pricing (EUR)

```javascript
const PRICES = {
  S: '59.99', M: '59.99', L: '59.99', XL: '59.99', '2XL': '64.99', '3XL': '69.99',
};
```

**Con 3 placements (chest_center + wrist_left + wrist_right) — VERIFICADO:**

| Talla | Retail | Cost (base + 3× emb $7.80) | Margin |
|---|---|---|---|
| S | €59.99 | $29.05 | 51.6% |
| M | €59.99 | $29.05 | 51.6% |
| L | €59.99 | $29.05 | 51.6% |
| XL | €59.99 | $29.05 | 51.6% |
| 2XL | €64.99 | $30.35 | 53.3% |
| 3XL | €69.99 | $31.65 | 54.8% |

**Con label_inside adicional (+$0.99):**

| Talla | Retail | Cost | Margin |
|---|---|---|---|
| S-XL | €59.99 | $30.04 | 49.9% |
| 2XL | €64.99 | $31.34 | 51.8% |
| 3XL | €69.99 | $32.64 | 53.4% |

> **NOTA:** chest_center y chest_left son mutuamente excluyentes. Máximo 3 placements bordado + 1 label.

---

## Colores descartados

| Color | Razón |
|---|---|
| Todos los dark (Black, Navy, etc.) | Bordado oscuro sobre garment oscuro = bajo contraste |
| Sky Blue, Dusty Rose | Posibles en futuro, pero el brief actual es White + Bone |
| Oatmeal Heather | No disponible EU |

**Nota**: Si en el futuro se quieren añadir más colores claros con EU, los candidatos son:
- Sky Blue (#B0C4DE) — EU_LV in_stock
- Dusty Rose (#D4A5A5) — EU_LV in_stock
- Team Red (#CC3333) — EU_LV in_stock (color medio)
