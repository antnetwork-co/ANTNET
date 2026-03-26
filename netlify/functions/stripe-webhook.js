import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req) {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const session = event.data.object
  const userId = session.metadata?.supabase_user_id

  if (!userId) return new Response('No user ID', { status: 200 })

  switch (event.type) {
    case 'checkout.session.completed': {
      // Trial started — mark as trialing
      await supabase.from('profiles').update({
        plan: 'trialing',
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      }).eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      const plan = sub.status === 'active' ? 'pro'
        : sub.status === 'trialing' ? 'trialing'
        : 'free'
      await supabase.from('profiles').update({
        plan,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
      }).eq('stripe_customer_id', sub.customer)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await supabase.from('profiles').update({
        plan: 'free',
        stripe_subscription_id: null,
      }).eq('stripe_customer_id', sub.customer)
      break
    }

    case 'invoice.payment_failed': {
      await supabase.from('profiles').update({ plan: 'past_due' })
        .eq('stripe_customer_id', session.customer)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
