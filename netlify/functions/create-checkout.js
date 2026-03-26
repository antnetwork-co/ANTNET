import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { email, userId, promoCode } = await req.json()

    const BASE_URL = process.env.URL || 'http://localhost:8888'

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { supabase_user_id: userId }
      },
      metadata: { supabase_user_id: userId },
      customer_email: email,
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      success_url: `${BASE_URL}/upgrade?success=true`,
      cancel_url: `${BASE_URL}/upgrade?canceled=true`,
    }

    // If a promo code was entered, look it up and check if it's 100% off (beta = no card needed)
    if (promoCode) {
      const codes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 })
      if (codes.data.length > 0) {
        const promoObj = codes.data[0]
        const coupon = promoObj.coupon
        const isFullyFree = coupon.percent_off === 100 || coupon.amount_off >= 2500

        sessionParams.discounts = [{ promotion_code: promoObj.id }]
        delete sessionParams.allow_promotion_codes

        if (isFullyFree) {
          // Beta access — no card required, no trial period needed
          sessionParams.payment_method_collection = 'if_required'
          delete sessionParams.subscription_data.trial_period_days
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
