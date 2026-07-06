/**
 * BusLoop Payment Service - Razorpay Integration
 * Uses Supabase Edge Functions so fares and tickets are validated server-side.
 */
import { supabase } from '../lib/supabase';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

function loadRazorpaySDK() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load payment SDK. Check your connection.'));
    document.head.appendChild(script);
  });
}

async function withTimeout(promise, message, timeoutMs = 45000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function invokeFunction(name, body, timeoutMs = 45000) {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(name, { body }),
    'Payment server is taking too long. Please check My Tickets before retrying.',
    timeoutMs,
  );
  if (error) {
    let msg = error.message || 'Payment server error';
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const json = await ctx.json();
        if (json?.error) msg = json.error;
      }
    } catch {
      // Keep the original function error.
    }
    throw new Error(msg);
  }
  return data;
}

export async function initiatePayment({
  amount,
  busName,
  tripId,
  routeId,
  fromStopId,
  toStopId,
  userEmail,
  userName,
  onClose,
  onVerifying,
}) {
  if (!RAZORPAY_KEY_ID) throw new Error('Payment key is not configured.');
  if (!tripId || !routeId || !fromStopId || !toStopId) {
    throw new Error('Please choose a valid live route and stops before paying.');
  }

  const sdkPromise = loadRazorpaySDK();
  const displayAmount = Number(amount || 0);
  if (!Number.isFinite(displayAmount) || displayAmount < 1) {
    throw new Error('Invalid fare. Please refresh and try again.');
  }

  const orderData = await invokeFunction('razorpay-create-order', {
    trip_id: tripId,
    route_id: routeId,
    from_stop_id: fromStopId,
    to_stop_id: toStopId,
  });

  const order = orderData.order;
  if (!order?.id) throw new Error('Invalid order response from payment server.');
  const trustedAmount = Number(order.amount || 0) / 100;

  await sdkPromise;

  return new Promise((resolve, reject) => {
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'BusLoop',
      description: `Bus Ticket - ${busName || 'BusLoop'}`,
      order_id: order.id,
      prefill: {
        name: userName || '',
        email: userEmail || '',
      },
      theme: { color: 'var(--brand)' },
      method: {
        upi: true,
        card: true,
        netbanking: false,
        wallet: false,
        emi: false,
        paylater: false,
      },
      config: {
        display: {
          blocks: {
            upi_block: {
              name: 'Pay via UPI App',
              instruments: [{ method: 'upi', flows: ['collect', 'intent', 'qr'] }],
            },
            card_block: {
              name: 'Pay via Card',
              instruments: [{ method: 'card' }],
            },
          },
          sequence: ['block.upi_block', 'block.card_block'],
          preferences: { show_default_blocks: false },
        },
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (onClose) onClose();
          reject(new Error('PAYMENT_CANCELLED'));
        },
      },
      handler: async (response) => {
        try {
          if (onVerifying) onVerifying();
          const result = await invokeFunction('razorpay-verify-payment', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (result?.ticket) {
            resolve({
              ...result.ticket,
              amount_paid: result.ticket.amount_paid || trustedAmount,
            });
          } else {
            reject(new Error('Payment completed but ticket was not created. Contact support.'));
          }
        } catch (err) {
          reject(err);
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp.error?.description || 'Payment declined. Please try another method.'));
    });
    rzp.open();
  });
}
