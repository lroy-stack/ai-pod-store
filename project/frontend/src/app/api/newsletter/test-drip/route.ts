/**
 * Test API to create drip sequence campaigns
 * POST /api/newsletter/test-drip - Creates all drip sequence steps
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';


export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    const supabase = supabaseAdmin;

    // Create all drip sequence campaigns
    const campaigns = [
      // Welcome Series (3 emails)
      {
        campaign_name: 'Welcome Series - Day 1',
        segment: 'new_customers',
        locale: 'en',
        subject_a: 'Welcome to Skapara! Here\'s 10% off 🎉',
        subject_b: 'Start your style journey with 10% off',
        preview_text: 'Welcome! Discover unique designs',
        body_html: '<html><body><h1>Welcome, {{first_name}}! 👋</h1><p>Use code FIRSTORDER for 10% off</p></body></html>',
        cta_a: 'Shop Bestsellers',
        cta_b: 'Explore Designs',
        drip_sequence: 'welcome',
        drip_step: 1,
        status: 'draft'
      },
      {
        campaign_name: 'Welcome Series - Day 3',
        segment: 'new_customers',
        locale: 'en',
        subject_a: 'Our Best Sellers (and why customers love them)',
        subject_b: '{{first_name}}, check out what\'s trending',
        preview_text: 'Discover our most popular designs',
        body_html: '<html><body><h1>Hi {{first_name}},</h1><p>Here are our bestsellers this week...</p></body></html>',
        cta_a: 'View Bestsellers',
        cta_b: 'Shop Now',
        drip_sequence: 'welcome',
        drip_step: 3,
        status: 'draft'
      },
      {
        campaign_name: 'Welcome Series - Day 7',
        segment: 'new_customers',
        locale: 'en',
        subject_a: 'Still thinking? Here\'s an extra 5% off',
        subject_b: 'Your first order awaits (extra discount inside)',
        preview_text: 'Complete your first purchase with an exclusive offer',
        body_html: '<html><body><h1>{{first_name}}, ready to shop?</h1><p>Use WELCOME5 for an extra 5% off</p></body></html>',
        cta_a: 'Get My Discount',
        cta_b: 'Start Shopping',
        drip_sequence: 'welcome',
        drip_step: 7,
        status: 'draft'
      },

      // Post-Purchase Series (2 emails)
      {
        campaign_name: 'Post-Purchase - Day 7',
        segment: 'recent_buyers',
        locale: 'en',
        subject_a: 'How\'s your order? We\'d love your feedback',
        subject_b: 'Quick question about your recent purchase',
        preview_text: 'Help us improve with a 30-second survey',
        body_html: '<html><body><h1>Hi {{first_name}},</h1><p>How are you enjoying your order?</p></body></html>',
        cta_a: 'Share Feedback',
        cta_b: 'Take Survey',
        drip_sequence: 'post_purchase',
        drip_step: 7,
        status: 'draft'
      },
      {
        campaign_name: 'Post-Purchase - Day 14',
        segment: 'recent_buyers',
        locale: 'en',
        subject_a: 'Love your order? Leave a review (get 10% off)',
        subject_b: 'Your opinion = 10% off your next order',
        preview_text: 'Review your purchase and earn a discount',
        body_html: '<html><body><h1>{{first_name}}, share your thoughts!</h1><p>Leave a review and get 10% off</p></body></html>',
        cta_a: 'Write Review',
        cta_b: 'Get Discount',
        drip_sequence: 'post_purchase',
        drip_step: 14,
        status: 'draft'
      },

      // Win-Back Series (3 emails)
      {
        campaign_name: 'Win-Back - Week 1',
        segment: 'at_risk',
        locale: 'en',
        subject_a: 'We miss you! 💙',
        subject_b: '{{first_name}}, come back and get 15% off',
        preview_text: 'It\'s been a while - here\'s a special offer',
        body_html: '<html><body><h1>Hey {{first_name}},</h1><p>We noticed you haven\'t visited in a while</p></body></html>',
        cta_a: 'Claim My Discount',
        cta_b: 'Browse New Designs',
        drip_sequence: 'win_back',
        drip_step: 1,
        status: 'draft'
      },
      {
        campaign_name: 'Win-Back - Week 3',
        segment: 'at_risk',
        locale: 'en',
        subject_a: 'Exclusive offer: 25% off just for you',
        subject_b: '{{first_name}}, this discount won\'t last long',
        preview_text: 'Your biggest discount yet - 25% off everything',
        body_html: '<html><body><h1>{{first_name}}, we really miss you!</h1><p>25% off with code WELCOME_BACK</p></body></html>',
        cta_a: 'Shop with 25% Off',
        cta_b: 'Redeem Offer',
        drip_sequence: 'win_back',
        drip_step: 3,
        status: 'draft'
      },
      {
        campaign_name: 'Win-Back - Week 6',
        segment: 'at_risk',
        locale: 'en',
        subject_a: 'Last chance: One final offer before we say goodbye',
        subject_b: '{{first_name}}, should we remove you from our list?',
        preview_text: 'Final re-engagement attempt - 30% off or goodbye',
        body_html: '<html><body><h1>This is it, {{first_name}}</h1><p>30% off or we\'ll unsubscribe you</p></body></html>',
        cta_a: 'Take 30% Off',
        cta_b: 'Stay Subscribed',
        drip_sequence: 'win_back',
        drip_step: 6,
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

    // Count by sequence
    const welcome = data?.filter(c => c.drip_sequence === 'welcome').length || 0;
    const postPurchase = data?.filter(c => c.drip_sequence === 'post_purchase').length || 0;
    const winBack = data?.filter(c => c.drip_sequence === 'win_back').length || 0;

    return NextResponse.json({
      success: true,
      campaigns_created: data?.length || 0,
      welcome_series: welcome,
      post_purchase_series: postPurchase,
      win_back_series: winBack,
      message: 'All drip sequences created successfully'
    });
  } catch (error) {
    console.error('Test drip campaigns error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
