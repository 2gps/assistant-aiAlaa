// إعدادات ثابتة للبوت
module.exports = {
  // معلومات المطور
  OWNER: {
    ID: 1488452951,
    NAME: 'علاء الدين',
    NAME_EN: 'Alaa Aldeen'
  },

  // معلومات البوت
  BOT: {
    NAME: '3laa\'s Assistant',
    VERSION: '4.0 Ultimate Pro',
    DESCRIPTION: 'أقوى بوت AI في تيليجرام'
  },

  // إعدادات المحادثة
  CONVERSATION: {
    MAX_HISTORY: 30,
    MAX_TOKENS: 3000,
    TEMPERATURE: 0.7
  },

  // حدود الاستخدام
  LIMITS: {
    MESSAGE_LENGTH: 4000,
    FILE_SIZE: 20 * 1024 * 1024, // 20MB
    IMAGE_SIZE: 20 * 1024 * 1024,
    DAILY_REQUESTS: 14400,
    MAX_CONTINUES: 3
  },

  // API Keys (من environment)
  API_KEYS: {
    TELEGRAM: process.env.TELEGRAM_TOKEN,
    GROQ: process.env.GROQ_API_KEY,
    OPENAI: process.env.OPENAI_API_KEY, // اختياري
    ANTHROPIC: process.env.ANTHROPIC_API_KEY, // اختياري
  },

  // URLs
  URLS: {
    IMAGE_GEN: 'https://image.pollinations.ai/prompt/',
    SEARCH_ENGINE: 'https://www.google.com/search?q='
  },

  // إعدادات السيرفر
  SERVER: {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0'
  },

  // مستويات الصعوبة
  DIFFICULTY: {
    SIMPLE: 'simple',      // أسئلة بسيطة
    MODERATE: 'moderate',  // أسئلة متوسطة
    COMPLEX: 'complex',    // أسئلة معقدة
    EXPERT: 'expert'       // أسئلة خبيرة
  },

  // أنواع المحتوى
  CONTENT_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    DOCUMENT: 'document',
    CODE: 'code',
    RESEARCH: 'research'
  }
};
