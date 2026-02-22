/**
 * Test API to create RFM-personalized newsletter campaigns
 * POST /api/newsletter/test-rfm - Creates sample campaigns for testing
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    const supabase = supabaseAdmin;

    // Create sample campaigns for different RFM segments
    const campaigns = [
      {
        campaign_name: 'Champions Exclusive Preview - Feb 2026',
        segment: 'champions',
        locale: 'en',
        subject_a: '✨ VIP Preview: New Collection Just for You',
        subject_b: 'You\'re invited: Exclusive early access inside',
        preview_text: 'As one of our top customers, get first dibs on our newest designs',
        body_html: `<html><body>
          <h1>Hi {{first_name}},</h1>
          <p>As a valued VIP customer, we're giving you exclusive early access to our Spring Collection.</p>
          <p>Your loyalty means everything to us. Shop the collection 48 hours before anyone else.</p>
          <a href="https://podai.com/en/collection/spring-preview">Browse Exclusive Preview</a>
          <p><strong>Plus: Free shipping on your next order!</strong></p>
        </body></html>`,
        cta_a: 'Shop VIP Preview',
        cta_b: 'View Collection',
        drip_sequence: null,
        drip_step: null,
        status: 'draft'
      },
      {
        campaign_name: 'At-Risk Re-Engagement - Feb 2026',
        segment: 'at_risk',
        locale: 'en',
        subject_a: 'We miss you! Here\'s 20% off to come back 💙',
        subject_b: '{{first_name}}, your designs are waiting...',
        preview_text: 'It\'s been a while! Special offer just for you',
        body_html: `<html><body>
          <h1>Hey {{first_name}},</h1>
          <p>We noticed it's been a while since your last visit. We miss you!</p>
          <p>Here's a special 20% discount code just for you: <strong>COMEBACK20</strong></p>
          <p>Valid for the next 7 days on your favorite designs.</p>
          <a href="https://podai.com/en/shop">Rediscover Your Style</a>
          <p>❤️ The POD AI Team</p>
        </body></html>`,
        cta_a: 'Shop Now with 20% Off',
        cta_b: 'Browse New Designs',
        drip_sequence: 'win_back',
        drip_step: 1,
        status: 'draft'
      },
      {
        campaign_name: 'New Customer Welcome - Day 1',
        segment: 'new_customers',
        locale: 'en',
        subject_a: 'Welcome to POD AI! Here\'s 10% off 🎉',
        subject_b: 'Start your style journey with 10% off',
        preview_text: 'Welcome! Discover unique designs that express who you are',
        body_html: `<html><body>
          <h1>Welcome, {{first_name}}! 👋</h1>
          <p>We're thrilled to have you here. At POD AI, every design tells a story - yours.</p>
          <p>Get started with <strong>10% off</strong> your first order: <strong>FIRSTORDER</strong></p>
          <a href="https://podai.com/en/shop">Start Shopping</a>
          <p>Our most popular designs this week:</p>
          <ul>
            <li>Classic Cat T-Shirt</li>
            <li>Minimalist Phone Case</li>
            <li>Custom Mug Collection</li>
          </ul>
        </body></html>`,
        cta_a: 'Shop Bestsellers',
        cta_b: 'Explore Designs',
        drip_sequence: 'welcome',
        drip_step: 1,
        status: 'draft'
      }
    ];

    const { data, error } = await supabase
      .from('newsletter_campaigns')
      .insert(campaigns)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaigns_created: data?.length || 0,
      campaigns: data,
      message: 'RFM-personalized campaigns created successfully'
    });
  } catch (error) {
    console.error('Test RFM campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
