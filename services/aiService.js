// خدمة الذكاء الاصطناعي - اختيار النموذج المناسب تلقائياً
const Groq = require('groq-sdk');
const { API_KEYS, LIMITS } = require('../config/constants');
const { selectModel, analyzeDifficulty, analyzeContentType } = require('../config/models');
const logger = require('../utils/logger');

const groq = new Groq({ apiKey: API_KEYS.GROQ });

class AIService {
  constructor() {
    this.requestCount = 0;
    this.cache = new Map();
  }

  /**
   * اختيار النموذج الأمثل بناءً على السؤال
   */
  async selectOptimalModel(message, context = {}) {
    try {
      // تحليل السؤال
      const difficulty = analyzeDifficulty(message);
      const contentType = analyzeContentType(message);
      
      // تحديد المتطلبات
      const requirements = {
        difficulty,
        type: contentType,
        requiresVision: context.hasImage || false,
        requiresLongContext: message.length > 2000 || context.hasDocument || false,
        requiresCode: contentType === 'code' || message.includes('```'),
        ...context
      };
      
      // اختيار النموذج
      const model = selectModel(requirements);
      
      logger.info(`Selected model: ${model.name} for difficulty: ${difficulty}, type: ${contentType}`);
      
      return model;
    } catch (error) {
      logger.error('Model selection error:', error);
      // الرجوع للنموذج المتوازن في حالة الخطأ
      return selectModel({ difficulty: 'moderate' });
    }
  }

  /**
   * إرسال طلب للذكاء الاصطناعي مع إدارة ذكية
   */
  async sendRequest(messages, options = {}) {
    try {
      this.requestCount++;
      
      // اختيار النموذج
      const lastMessage = messages[messages.length - 1];
      const userMessage = typeof lastMessage === 'string' ? lastMessage : lastMessage.content;
      const model = await this.selectOptimalModel(userMessage, options);
      
      // إعدادات الطلب
      const requestConfig = {
        model: model.name,
        messages: this.formatMessages(messages),
        max_tokens: options.maxTokens || LIMITS.MAX_TOKENS,
        temperature: options.temperature || 0.7,
        ...options.extraParams
      };
      
      logger.info(`Sending request to ${model.name}`, {
        messagesCount: messages.length,
        maxTokens: requestConfig.max_tokens
      });
      
      // إرسال الطلب
      const startTime = Date.now();
      const completion = await groq.chat.completions.create(requestConfig);
      const responseTime = Date.now() - startTime;
      
      logger.info(`Response received in ${responseTime}ms`, {
        model: model.name,
        finishReason: completion.choices[0].finish_reason
      });
      
      return {
        content: completion.choices[0].message.content,
        model: model.name,
        finishReason: completion.choices[0].finish_reason,
        responseTime,
        usage: completion.usage
      };
      
    } catch (error) {
      logger.error('AI request error:', error);
      throw error;
    }
  }

  /**
   * إرسال طلب مع استمرار تلقائي للردود الطويلة
   */
  async sendRequestWithContinuation(messages, options = {}) {
    let fullResponse = '';
    let allUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let continueCount = 0;
    const maxContinues = options.maxContinues || LIMITS.MAX_CONTINUES;
    
    // الطلب الأول
    let response = await this.sendRequest(messages, options);
    fullResponse = response.content;
    
    if (response.usage) {
      allUsage.prompt_tokens += response.usage.prompt_tokens || 0;
      allUsage.completion_tokens += response.usage.completion_tokens || 0;
      allUsage.total_tokens += response.usage.total_tokens || 0;
    }
    
    // الاستمرار إذا اتقطع
    while (response.finishReason === 'length' && continueCount < maxContinues) {
      continueCount++;
      logger.info(`Continuing response (${continueCount}/${maxContinues})`);
      
      // إضافة رسالة الاستمرار
      const continueMessages = [
        ...messages,
        { role: 'assistant', content: fullResponse },
        { role: 'user', content: 'أكمل من حيث توقفت' }
      ];
      
      response = await this.sendRequest(continueMessages, options);
      fullResponse += '\n\n' + response.content;
      
      if (response.usage) {
        allUsage.prompt_tokens += response.usage.prompt_tokens || 0;
        allUsage.completion_tokens += response.usage.completion_tokens || 0;
        allUsage.total_tokens += response.usage.total_tokens || 0;
      }
    }
    
    return {
      content: fullResponse,
      model: response.model,
      continuations: continueCount,
      usage: allUsage,
      responseTime: response.responseTime
    };
  }

  /**
   * تنسيق الرسائل للإرسال
   */
  formatMessages(messages) {
    return messages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return msg;
    });
  }

  /**
   * الحصول على إحصائيات الخدمة
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      cacheSize: this.cache.size
    };
  }
}

module.exports = new AIService();
