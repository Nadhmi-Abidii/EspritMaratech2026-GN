const crypto = require('crypto');
const AppError = require('../utils/AppError');
const env = require('../config/env');

let stripeClient = null;
const mockSessions = new Map();

const supportedProviders = ['stripe', 'mock'];

const normalizeCurrency = (currency) =>
  String(currency || env.donationCurrency || 'usd')
    .trim()
    .toLowerCase();

const resolveProvider = () => {
  const provider = String(env.paymentProvider || 'stripe').toLowerCase();

  // Hackathon/dev-friendly fallback: if Stripe is selected but not configured,
  // default to the mock provider so the donation flow can still be tested end-to-end.
  if (provider === 'stripe' && !env.stripeSecretKey && env.nodeEnv !== 'production') {
    return 'mock';
  }

  return provider;
};

const normalizeAmount = (amount) => Number(Number(amount || 0).toFixed(2));

const toMinorAmount = (amount) => Math.round(normalizeAmount(amount) * 100);

const basePublicInfoUrl = () => `${env.publicSiteUrl.replace(/\/+$/, '')}/public/info`;

const buildReturnUrls = (postId) => {
  const safePostId = encodeURIComponent(String(postId));

  return {
    successUrl: `${basePublicInfoUrl()}?donationStatus=success&postId=${safePostId}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${basePublicInfoUrl()}?donationStatus=cancel&postId=${safePostId}`
  };
};

const getStripeClient = () => {
  if (!env.stripeSecretKey) {
    throw new AppError(
      503,
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Stripe payment provider is not configured. Set STRIPE_SECRET_KEY.'
    );
  }

  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
};

const createMockCheckoutSession = ({ postId, amount, currency }) => {
  const normalizedAmount = normalizeAmount(amount);
  const normalizedCurrency = normalizeCurrency(currency);
  const { successUrl } = buildReturnUrls(postId);
  const sessionId = `mock_${crypto.randomBytes(12).toString('hex')}`;

  mockSessions.set(sessionId, {
    id: sessionId,
    postId: String(postId),
    amount: normalizedAmount,
    amountMinor: toMinorAmount(normalizedAmount),
    currency: normalizedCurrency,
    paymentStatus: 'paid',
    status: 'complete',
    createdAt: new Date().toISOString()
  });

  return {
    provider: 'mock',
    sessionId,
    checkoutUrl: successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId),
    expiresAt: null
  };
};

const createStripeCheckoutSession = async ({ postId, postTitle, donationGoal, amount, currency }) => {
  const stripe = getStripeClient();
  const normalizedCurrency = normalizeCurrency(currency);
  const normalizedAmount = normalizeAmount(amount);
  const minorAmount = toMinorAmount(normalizedAmount);
  const { successUrl, cancelUrl } = buildReturnUrls(postId);
  const itemName = String(postTitle || 'Omnia Charity Donation').trim().slice(0, 80);

  if (!minorAmount || minorAmount <= 0) {
    throw new AppError(422, 'INVALID_DONATION_AMOUNT', 'Donation amount must be greater than 0.');
  }

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'donate',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: normalizedCurrency,
            unit_amount: minorAmount,
            product_data: {
              name: itemName,
              description: `Support this post goal (${donationGoal} ${normalizedCurrency.toUpperCase()}).`
            }
          }
        }
      ],
      metadata: {
        postId: String(postId),
        amount: normalizedAmount.toFixed(2)
      },
      payment_intent_data: {
        metadata: {
          postId: String(postId)
        }
      }
    });
  } catch (_error) {
    throw new AppError(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'Unable to initialize Stripe checkout session.'
    );
  }

  if (!session?.url || !session.id) {
    throw new AppError(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'Stripe did not return a valid checkout session URL.'
    );
  }

  return {
    provider: 'stripe',
    sessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
  };
};

const getMockSession = (sessionId) => {
  const session = mockSessions.get(sessionId);

  if (!session) {
    throw new AppError(404, 'PAYMENT_SESSION_NOT_FOUND', 'Payment session was not found.');
  }

  return {
    provider: 'mock',
    sessionId: session.id,
    postId: session.postId,
    amount: session.amount,
    currency: session.currency,
    paymentStatus: session.paymentStatus,
    status: session.status,
    donorEmail: null
  };
};

const getStripeSession = async (sessionId) => {
  const stripe = getStripeClient();
  let session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (_error) {
    throw new AppError(404, 'PAYMENT_SESSION_NOT_FOUND', 'Payment session was not found.');
  }

  const amountMinor =
    typeof session.amount_total === 'number'
      ? session.amount_total
      : typeof session.amount_subtotal === 'number'
        ? session.amount_subtotal
        : 0;

  return {
    provider: 'stripe',
    sessionId: session.id,
    postId: String(session.metadata?.postId || ''),
    amount: Number((amountMinor / 100).toFixed(2)),
    currency: normalizeCurrency(session.currency),
    paymentStatus: String(session.payment_status || ''),
    status: String(session.status || ''),
    donorEmail: session.customer_details?.email || null
  };
};

const createDonationCheckoutSession = async ({ postId, postTitle, donationGoal, amount, currency }) => {
  const provider = resolveProvider();

  if (!supportedProviders.includes(provider)) {
    throw new AppError(
      500,
      'UNSUPPORTED_PAYMENT_PROVIDER',
      `Unsupported payment provider "${provider}".`
    );
  }

  if (provider === 'mock') {
    return createMockCheckoutSession({
      postId,
      amount,
      currency
    });
  }

  return createStripeCheckoutSession({
    postId,
    postTitle,
    donationGoal,
    amount,
    currency
  });
};

const fetchDonationCheckoutSession = async (sessionId) => {
  const provider = resolveProvider();

  if (provider === 'mock') {
    return getMockSession(sessionId);
  }

  if (provider === 'stripe') {
    return getStripeSession(sessionId);
  }

  throw new AppError(
    500,
    'UNSUPPORTED_PAYMENT_PROVIDER',
    `Unsupported payment provider "${provider}".`
  );
};

module.exports = {
  createDonationCheckoutSession,
  fetchDonationCheckoutSession
};
