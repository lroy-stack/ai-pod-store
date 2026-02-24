/**
 * Test Newsletter Locale-Aware Campaigns
 * POST /api/newsletter/test-locale - Create sample campaigns in EN/ES/DE
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    const supabase = supabaseAdmin;

    // Sample campaigns in all 3 locales for the Welcome Series
    const campaigns = [
      // English
      {
        campaign_name: 'Welcome Series - Day 1 (EN)',
        segment: 'new_customers',
        locale: 'en',
        subject_a: 'Welcome to Skapara! Here\'s 10% off 🎉',
        subject_b: 'Start your style journey with 10% off',
        preview_text: 'Welcome! Discover unique designs',
        body_html: `<html><body>
          <h1>Welcome!</h1>
          <p>We're thrilled to have you here at Skapara.</p>
          <p>Use code <strong>FIRSTORDER</strong> for 10% off your first purchase.</p>
          <a href="https://podai.com/en/shop">Start Shopping</a>
          <p>Best regards,<br>The Skapara Team</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlin, Germany<br>
            <a href="https://podai.com/en/unsubscribe">Unsubscribe</a>
          </p>
        </body></html>`,
        cta_a: 'Shop Bestsellers',
        cta_b: 'Explore Designs',
        status: 'draft',
        drip_sequence: 'welcome',
        drip_step: 1,
      },
      // Spanish
      {
        campaign_name: 'Welcome Series - Day 1 (ES)',
        segment: 'new_customers',
        locale: 'es',
        subject_a: '¡Bienvenido a Skapara! 10% de descuento 🎉',
        subject_b: 'Comienza tu viaje de estilo con 10% de descuento',
        preview_text: '¡Bienvenido! Descubre diseños únicos',
        body_html: `<html><body>
          <h1>¡Bienvenido!</h1>
          <p>Estamos encantados de tenerte aquí en Skapara.</p>
          <p>Usa el código <strong>FIRSTORDER</strong> para obtener un 10% de descuento en tu primera compra.</p>
          <a href="https://podai.com/es/shop">Comenzar a Comprar</a>
          <p>Saludos cordiales,<br>El Equipo de Skapara</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlín, Alemania<br>
            <a href="https://podai.com/es/unsubscribe">Darse de baja</a>
          </p>
        </body></html>`,
        cta_a: 'Ver Más Vendidos',
        cta_b: 'Explorar Diseños',
        status: 'draft',
        drip_sequence: 'welcome',
        drip_step: 1,
      },
      // German
      {
        campaign_name: 'Welcome Series - Day 1 (DE)',
        segment: 'new_customers',
        locale: 'de',
        subject_a: 'Willkommen bei Skapara! 10% Rabatt 🎉',
        subject_b: 'Beginne deine Stil-Reise mit 10% Rabatt',
        preview_text: 'Willkommen! Entdecke einzigartige Designs',
        body_html: `<html><body>
          <h1>Willkommen!</h1>
          <p>Wir freuen uns, dich bei Skapara zu haben.</p>
          <p>Verwende den Code <strong>FIRSTORDER</strong> für 10% Rabatt auf deinen ersten Einkauf.</p>
          <a href="https://podai.com/de/shop">Jetzt Einkaufen</a>
          <p>Mit freundlichen Grüßen,<br>Das Skapara Team</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlin, Deutschland<br>
            <a href="https://podai.com/de/unsubscribe">Abmelden</a>
          </p>
        </body></html>`,
        cta_a: 'Bestseller Ansehen',
        cta_b: 'Designs Entdecken',
        status: 'draft',
        drip_sequence: 'welcome',
        drip_step: 1,
      },
      // At-Risk Re-engagement in all 3 locales
      {
        campaign_name: 'At-Risk Re-Engagement (EN)',
        segment: 'at_risk',
        locale: 'en',
        subject_a: 'We miss you! Here\'s 20% off 💙',
        subject_b: '{{first_name}}, your designs are waiting...',
        preview_text: 'It\'s been a while! Special offer just for you',
        body_html: `<html><body>
          <h1>Hey {{first_name}},</h1>
          <p>We noticed it's been a while since your last visit. We miss you!</p>
          <p>Here's a special <strong>20% discount</strong> code just for you: <strong>COMEBACK20</strong></p>
          <p>Valid for the next 7 days.</p>
          <a href="https://podai.com/en/shop">Rediscover Your Style</a>
          <p>❤️ The Skapara Team</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlin, Germany<br>
            <a href="https://podai.com/en/unsubscribe">Unsubscribe</a>
          </p>
        </body></html>`,
        cta_a: 'Shop Now with 20% Off',
        cta_b: 'Browse New Designs',
        status: 'draft',
        drip_sequence: 'win_back',
        drip_step: 1,
      },
      {
        campaign_name: 'At-Risk Re-Engagement (ES)',
        segment: 'at_risk',
        locale: 'es',
        subject_a: '¡Te extrañamos! 20% de descuento 💙',
        subject_b: '{{first_name}}, tus diseños te están esperando...',
        preview_text: '¡Ha pasado tiempo! Oferta especial solo para ti',
        body_html: `<html><body>
          <h1>Hola {{first_name}},</h1>
          <p>Notamos que ha pasado un tiempo desde tu última visita. ¡Te extrañamos!</p>
          <p>Aquí tienes un código de <strong>20% de descuento</strong> especial solo para ti: <strong>COMEBACK20</strong></p>
          <p>Válido por los próximos 7 días.</p>
          <a href="https://podai.com/es/shop">Redescubre Tu Estilo</a>
          <p>❤️ El Equipo de Skapara</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlín, Alemania<br>
            <a href="https://podai.com/es/unsubscribe">Darse de baja</a>
          </p>
        </body></html>`,
        cta_a: 'Comprar con 20% de Descuento',
        cta_b: 'Ver Nuevos Diseños',
        status: 'draft',
        drip_sequence: 'win_back',
        drip_step: 1,
      },
      {
        campaign_name: 'At-Risk Re-Engagement (DE)',
        segment: 'at_risk',
        locale: 'de',
        subject_a: 'Wir vermissen dich! 20% Rabatt 💙',
        subject_b: '{{first_name}}, deine Designs warten...',
        preview_text: 'Es ist eine Weile her! Sonderangebot nur für dich',
        body_html: `<html><body>
          <h1>Hey {{first_name}},</h1>
          <p>Wir haben bemerkt, dass es eine Weile her ist seit deinem letzten Besuch. Wir vermissen dich!</p>
          <p>Hier ist ein spezieller <strong>20% Rabattcode</strong> nur für dich: <strong>COMEBACK20</strong></p>
          <p>Gültig für die nächsten 7 Tage.</p>
          <a href="https://podai.com/de/shop">Entdecke Deinen Stil Neu</a>
          <p>❤️ Das Skapara Team</p>
          <hr>
          <p style="font-size:12px;color:#666;">
            Skapara Store, Friedrichstraße 123, 10117 Berlin, Deutschland<br>
            <a href="https://podai.com/de/unsubscribe">Abmelden</a>
          </p>
        </body></html>`,
        cta_a: 'Mit 20% Rabatt Einkaufen',
        cta_b: 'Neue Designs Ansehen',
        status: 'draft',
        drip_sequence: 'win_back',
        drip_step: 1,
      },
    ];

    // Insert all campaigns
    const { data, error } = await supabase
      .from('newsletter_campaigns')
      .insert(campaigns)
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Created locale-aware campaigns in EN, ES, and DE',
      campaigns: data,
      locales: {
        en: data?.filter(c => c.locale === 'en').length || 0,
        es: data?.filter(c => c.locale === 'es').length || 0,
        de: data?.filter(c => c.locale === 'de').length || 0,
      },
    });
  } catch (error) {
    console.error('Test locale campaigns API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
