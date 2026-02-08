const env = require('../config/env');
const AppError = require('../utils/AppError');

const MAX_HISTORY_ITEMS = 8;
const MAX_TEXT_LENGTH = 800;

const normalizeText = (value, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.trim();
};

const truncate = (value, maxLength = MAX_TEXT_LENGTH) => {
  const text = normalizeText(value);

  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
};

const toCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_ITEMS)
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        normalizeText(item.content).length > 0
    )
    .map((item) => ({
      role: item.role,
      content: truncate(item.content)
    }));
};

const buildSystemPrompt = () =>
  [
    'You are Omnia Charity Tracking public chatbot assistant.',
    'Answer only using facts from the provided live context.',
    'If information is missing, say so clearly and suggest /public/reports or /public/info.',
    'Keep replies concise, friendly, and practical (2 to 5 short sentences).',
    'Never invent data, links, or numbers.'
  ].join(' ');

const buildContextPrompt = (context) =>
  JSON.stringify(
    {
      organization: context.organization || {},
      impact: context.impact || {},
      latestReports: Array.isArray(context.latestReports) ? context.latestReports.slice(0, 3) : [],
      campaigns: Array.isArray(context.posts) ? context.posts.slice(0, 5) : []
    },
    null,
    2
  );

const fallbackReply = (message, context) => {
  const normalized = normalizeText(message).toLowerCase();

  if (/(^|\\b)(hi|hello|hey|bonjour|salut|salam|aslema)(\\b|$)/i.test(normalized)) {
    return 'Hi! Ask me about our mission, how to donate, campaign progress, latest reports, or families by area.';
  }

  if (/(mission|goal|about|purpose)/i.test(normalized)) {
    return (
      context.organization?.mission ||
      'Our mission is to support vulnerable families through structured aid and transparent follow-up.'
    );
  }

  if (/(donate|donation|payment|support)/i.test(normalized)) {
    return 'You can donate from the Community Donation Posts section on /public/info. Choose a campaign, enter an amount, then click Donate Now.';
  }

  if (/(progress|campaign|raised|goal)/i.test(normalized)) {
    const post = Array.isArray(context.posts) && context.posts.length ? context.posts[0] : null;

    if (!post) {
      return 'No active campaign data is available right now.';
    }

    return `Current campaign "${post.title}" is at ${post.progressPercent}% (${toCurrency(
      post.amountRaised
    )} raised of ${toCurrency(post.donationGoal)}).`;
  }

  if (/(zone|area|families in|family in)/i.test(normalized)) {
    const areas = Array.isArray(context.impact?.areas) ? context.impact.areas : [];

    if (!areas.length) {
      return 'Family-by-area data is not available right now.';
    }

    const top = [...areas]
      .sort((left, right) => Number(right.totalFamilies || 0) - Number(left.totalFamilies || 0))
      .slice(0, 3)
      .map((item) => `${item.zone}: ${Number(item.totalFamilies || 0)} families`);

    return `Top areas by supported families: ${top.join(', ')}.`;
  }

  if (/(report|impact report|financial)/i.test(normalized)) {
    const report = Array.isArray(context.latestReports) && context.latestReports.length
      ? context.latestReports[0]
      : null;

    if (!report) {
      return 'You can view available reports at /public/reports.';
    }

    return `Latest report is "${report.title}" (${report.year}). Open /public/reports for details.`;
  }

  return 'Ask me about our mission, how to donate, campaign progress, latest reports, or families by area.';
};

const parseProviderErrorMessage = async (response) => {
  try {
    const payload = await response.json();
    return normalizeText(payload?.error?.message, 'OpenAI request failed.');
  } catch (_error) {
    return 'OpenAI request failed.';
  }
};

const parseChatCompletionContent = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join(' ')
      .trim();
  }

  return '';
};

const requestOpenAIReply = async ({ message, history, context }) => {
  if (typeof fetch !== 'function') {
    throw new AppError(
      503,
      'CHATBOT_PROVIDER_UNAVAILABLE',
      'OpenAI client is unavailable in this Node.js runtime.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.openaiTimeoutMs);

  try {
    const response = await fetch(`${env.openaiApiBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt()
          },
          {
            role: 'system',
            content: `Live context:\n${buildContextPrompt(context)}`
          },
          ...history,
          {
            role: 'user',
            content: truncate(message, 1000)
          }
        ]
      })
    });

    if (!response.ok) {
      const details = await parseProviderErrorMessage(response);
      throw new AppError(502, 'CHATBOT_PROVIDER_ERROR', `OpenAI request failed: ${details}`);
    }

    const payload = await response.json();
    const reply = parseChatCompletionContent(payload);

    if (!reply) {
      throw new AppError(502, 'CHATBOT_PROVIDER_EMPTY_RESPONSE', 'OpenAI returned an empty chatbot response.');
    }

    return {
      reply,
      provider: 'openai',
      model: payload?.model || env.openaiModel
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(504, 'CHATBOT_PROVIDER_TIMEOUT', 'OpenAI request timed out. Please try again.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const generatePublicChatbotReply = async ({ message, history, context }) => {
  const cleanMessage = normalizeText(message);

  if (!cleanMessage) {
    throw new AppError(422, 'CHATBOT_MESSAGE_REQUIRED', 'message is required.');
  }

  const cleanHistory = sanitizeHistory(history);

  if (!env.openaiApiKey) {
    return {
      reply: fallbackReply(cleanMessage, context),
      provider: 'fallback',
      model: null
    };
  }

  try {
    return await requestOpenAIReply({
      message: cleanMessage,
      history: cleanHistory,
      context
    });
  } catch (error) {
    if (env.nodeEnv !== 'test') {
      console.error('[public-chatbot] Falling back after provider error:', error.message);
    }

    return {
      reply: fallbackReply(cleanMessage, context),
      provider: 'fallback',
      model: null
    };
  }
};

module.exports = {
  generatePublicChatbotReply
};
