import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/policies
 *
 * Returns store policies (shipping, returns, privacy, terms of service)
 * Supports locale parameter for i18n
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';

    // Store policies (multi-language support)
    const policies = {
      en: {
        shipping: {
          title: 'Shipping Policy',
          content: 'We ship worldwide. Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. Free shipping on orders over €50 within Europe.',
          rates: {
            standard: 'Standard: €5.99 (5-7 days)',
            express: 'Express: €12.99 (2-3 days)',
            free: 'Free shipping over €50 (Europe only)',
          },
        },
        returns: {
          title: 'Returns & Refunds',
          content: 'We accept returns within 30 days of delivery. Items must be unworn and unwashed. Refunds are processed within 5-7 business days after we receive the return.',
          policy: '30-day return policy. Items must be in original condition.',
        },
        privacy: {
          title: 'Privacy Policy',
          content: 'We respect your privacy. We collect minimal personal data necessary for order processing. We never sell your data to third parties. All data is stored securely and encrypted.',
          summary: 'Your data is safe with us. We never sell or share your information.',
        },
        terms: {
          title: 'Terms of Service',
          content: 'By using our store, you agree to our terms. All products are print-on-demand and created after order. Colors may vary slightly from images. We are not responsible for delays caused by customs.',
          summary: 'Print-on-demand products. No refunds after production starts.',
        },
      },
      es: {
        shipping: {
          title: 'Política de Envío',
          content: 'Enviamos a todo el mundo. El envío estándar tarda de 5 a 7 días hábiles. El envío exprés tarda de 2 a 3 días hábiles. Envío gratis en pedidos superiores a 50€ dentro de Europa.',
          rates: {
            standard: 'Estándar: 5,99€ (5-7 días)',
            express: 'Exprés: 12,99€ (2-3 días)',
            free: 'Envío gratis en pedidos de más de 50€ (solo Europa)',
          },
        },
        returns: {
          title: 'Devoluciones y Reembolsos',
          content: 'Aceptamos devoluciones dentro de los 30 días posteriores a la entrega. Los artículos deben estar sin usar y sin lavar. Los reembolsos se procesan dentro de 5-7 días hábiles después de recibir la devolución.',
          policy: 'Política de devolución de 30 días. Los artículos deben estar en condiciones originales.',
        },
        privacy: {
          title: 'Política de Privacidad',
          content: 'Respetamos su privacidad. Recopilamos datos personales mínimos necesarios para procesar pedidos. Nunca vendemos sus datos a terceros. Todos los datos se almacenan de forma segura y cifrada.',
          summary: 'Sus datos están seguros con nosotros. Nunca vendemos ni compartimos su información.',
        },
        terms: {
          title: 'Términos de Servicio',
          content: 'Al usar nuestra tienda, acepta nuestros términos. Todos los productos son de impresión bajo demanda y se crean después del pedido. Los colores pueden variar ligeramente de las imágenes. No somos responsables de retrasos causados por aduanas.',
          summary: 'Productos de impresión bajo demanda. Sin reembolsos después de comenzar la producción.',
        },
      },
      de: {
        shipping: {
          title: 'Versandrichtlinie',
          content: 'Wir versenden weltweit. Standardversand dauert 5-7 Werktage. Expressversand dauert 2-3 Werktage. Kostenloser Versand bei Bestellungen über 50€ innerhalb Europas.',
          rates: {
            standard: 'Standard: 5,99€ (5-7 Tage)',
            express: 'Express: 12,99€ (2-3 Tage)',
            free: 'Kostenloser Versand ab 50€ (nur Europa)',
          },
        },
        returns: {
          title: 'Rückgabe & Erstattung',
          content: 'Wir akzeptieren Rücksendungen innerhalb von 30 Tagen nach Lieferung. Artikel müssen ungetragen und ungewaschen sein. Rückerstattungen werden innerhalb von 5-7 Werktagen nach Erhalt der Rücksendung bearbeitet.',
          policy: '30-Tage-Rückgaberecht. Artikel müssen im Originalzustand sein.',
        },
        privacy: {
          title: 'Datenschutzrichtlinie',
          content: 'Wir respektieren Ihre Privatsphäre. Wir sammeln nur die minimal erforderlichen persönlichen Daten für die Auftragsabwicklung. Wir verkaufen Ihre Daten niemals an Dritte. Alle Daten werden sicher und verschlüsselt gespeichert.',
          summary: 'Ihre Daten sind bei uns sicher. Wir verkaufen oder teilen Ihre Informationen niemals.',
        },
        terms: {
          title: 'Nutzungsbedingungen',
          content: 'Durch die Nutzung unseres Shops stimmen Sie unseren Bedingungen zu. Alle Produkte sind Print-on-Demand und werden nach Bestellung erstellt. Farben können von den Bildern leicht abweichen. Wir sind nicht verantwortlich für Verzögerungen durch den Zoll.',
          summary: 'Print-on-Demand-Produkte. Keine Rückerstattung nach Produktionsbeginn.',
        },
      },
    };

    const localePolicies = policies[locale as keyof typeof policies] || policies.en;

    return NextResponse.json({
      success: true,
      locale,
      policies: localePolicies,
    });
  } catch (error) {
    console.error('Policies API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
