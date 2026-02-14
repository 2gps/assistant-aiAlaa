// خدمة تحليل الصور المتقدمة
const Groq = require('groq-sdk');
const { API_KEYS } = require('../config/constants');
const { MODELS } = require('../config/models');
const logger = require('../utils/logger');

const groq = new Groq({ apiKey: API_KEYS.GROQ });

class VisionService {
  constructor() {
    this.analysisCount = 0;
  }

  /**
   * تحليل صورة بدقة عالية
   */
  async analyzeImage(imageBase64, prompt, options = {}) {
    try {
      this.analysisCount++;
      
      const model = MODELS.GROQ.VISION;
      
      logger.info('Starting image analysis', {
        model: model.name,
        promptLength: prompt.length
      });
      
      // طلب تحليل أساسي
      const basicAnalysis = await this.basicAnalysis(imageBase64, prompt);
      
      // إذا كان التحليل يحتاج تفاصيل أكثر
      if (options.detailed) {
        const detailedAnalysis = await this.detailedAnalysis(imageBase64, basicAnalysis);
        return this.mergeAnalysis(basicAnalysis, detailedAnalysis);
      }
      
      return basicAnalysis;
      
    } catch (error) {
      logger.error('Image analysis error:', error);
      throw error;
    }
  }

  /**
   * تحليل أساسي للصورة
   */
  async basicAnalysis(imageBase64, prompt) {
    const completion = await groq.chat.completions.create({
      model: MODELS.GROQ.VISION.name,
      messages: [{
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: this.enhancePrompt(prompt)
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }],
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    return {
      description: completion.choices[0].message.content,
      confidence: this.estimateConfidence(completion.choices[0].message.content),
      model: MODELS.GROQ.VISION.name
    };
  }

  /**
   * تحليل تفصيلي إضافي
   */
  async detailedAnalysis(imageBase64, basicResult) {
    // طلبات متعددة لجوانب مختلفة
    const aspects = [
      'صف الألوان والإضاءة في الصورة بالتفصيل',
      'حدد جميع الأشياء والعناصر الموجودة',
      'اشرح السياق والموقف في الصورة'
    ];
    
    const detailedResults = await Promise.all(
      aspects.map(aspect => this.analyzeAspect(imageBase64, aspect))
    );
    
    return {
      colors: detailedResults[0],
      objects: detailedResults[1],
      context: detailedResults[2]
    };
  }

  /**
   * تحليل جانب معين من الصورة
   */
  async analyzeAspect(imageBase64, aspect) {
    const completion = await groq.chat.completions.create({
      model: MODELS.GROQ.VISION.name,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: aspect },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }],
      temperature: 0.3,
      max_tokens: 500,
    });
    
    return completion.choices[0].message.content;
  }

  /**
   * تحسين Prompt لنتائج أفضل
   */
  enhancePrompt(originalPrompt) {
    // إذا كان Prompt بسيط جداً، نحسنه
    if (originalPrompt.length < 20) {
      return `${originalPrompt}. قدم وصفاً دقيقاً وتفصيلياً. إذا كان في الصورة نص، اقرأه بدقة. إذا كان في مسألة أو سؤال، حلّه بالتفصيل.`;
    }
    
    // إضافة تعليمات لقراءة النصوص
    if (!originalPrompt.includes('نص') && !originalPrompt.includes('text')) {
      return `${originalPrompt}. ملاحظة: إذا كان في الصورة أي نصوص أو كتابة، اقرأها بدقة.`;
    }
    
    return originalPrompt;
  }

  /**
   * تقدير مستوى الثقة في التحليل
   */
  estimateConfidence(description) {
    // معايير بسيطة لتقدير الثقة
    if (description.includes('غير واضح') || description.includes('ربما')) {
      return 'متوسط';
    }
    if (description.length > 200) {
      return 'عالي';
    }
    return 'جيد';
  }

  /**
   * دمج التحليل الأساسي والتفصيلي
   */
  mergeAnalysis(basic, detailed) {
    return {
      description: basic.description,
      detailedAnalysis: {
        colors: detailed.colors,
        objects: detailed.objects,
        context: detailed.context
      },
      confidence: basic.confidence,
      model: basic.model
    };
  }

  /**
   * OCR متقدم - قراءة النصوص من الصور
   */
  async extractText(imageBase64) {
    return await this.analyzeImage(
      imageBase64,
      'اقرأ جميع النصوص الموجودة في هذه الصورة بدقة تامة. احرص على قراءة كل كلمة وحرف بشكل صحيح، مع الحفاظ على التنسيق والترتيب.',
      { detailed: false }
    );
  }

  /**
   * حل المسائل من الصور
   */
  async solveProblem(imageBase64, subject = '') {
    const prompt = subject 
      ? `هذه صورة لمسألة في ${subject}. اقرأ المسألة بدقة ثم حلها خطوة بخطوة مع الشرح التفصيلي.`
      : 'اقرأ المسألة أو السؤال في هذه الصورة، ثم قدم الحل الكامل مع الشرح خطوة بخطوة.';
    
    return await this.analyzeImage(imageBase64, prompt, { detailed: true });
  }

  /**
   * تحليل المخططات والرسوم البيانية
   */
  async analyzeChart(imageBase64) {
    return await this.analyzeImage(
      imageBase64,
      'هذه صورة لمخطط أو رسم بياني. حلل البيانات الموجودة فيه، واستخرج الأرقام والمعلومات، ثم قدم تحليلاً شاملاً للنتائج والاتجاهات.',
      { detailed: true }
    );
  }

  /**
   * الحصول على إحصائيات الخدمة
   */
  getStats() {
    return {
      totalAnalyses: this.analysisCount
    };
  }
}

module.exports = new VisionService();
