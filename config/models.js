// نماذج AI المتعددة مع قدراتها
const { DIFFICULTY } = require('./constants');

const MODELS = {
  // نماذج Groq (سريعة ومجانية)
  GROQ: {
    // للأسئلة البسيطة - سريع جداً
    FAST: {
      name: 'gemma2-9b-it',
      provider: 'groq',
      speed: 'very_fast',
      quality: 'good',
      difficulty: [DIFFICULTY.SIMPLE],
      tokens: 8000,
      description: 'للأسئلة البسيطة والسريعة'
    },
    
    // للأسئلة المتوسطة - متوازن
    BALANCED: {
      name: 'llama-3.1-70b-versatile',
      provider: 'groq',
      speed: 'fast',
      quality: 'excellent',
      difficulty: [DIFFICULTY.SIMPLE, DIFFICULTY.MODERATE],
      tokens: 8000,
      description: 'متوازن بين السرعة والجودة'
    },
    
    // للأسئلة المعقدة - الأقوى
    POWER: {
      name: 'llama-3.3-70b-versatile',
      provider: 'groq',
      speed: 'fast',
      quality: 'superior',
      difficulty: [DIFFICULTY.MODERATE, DIFFICULTY.COMPLEX, DIFFICULTY.EXPERT],
      tokens: 8000,
      description: 'الأقوى - للمسائل المعقدة'
    },
    
    // لتحليل الصور
    VISION: {
      name: 'llama-3.2-11b-vision-preview',
      provider: 'groq',
      speed: 'fast',
      quality: 'excellent',
      difficulty: 'all',
      tokens: 8000,
      description: 'تحليل الصور والرؤية'
    },
    
    // للأكواد
    CODE: {
      name: 'llama-3.3-70b-versatile',
      provider: 'groq',
      speed: 'fast',
      quality: 'superior',
      difficulty: 'all',
      tokens: 8000,
      description: 'متخصص في البرمجة'
    },
    
    // للبحث والتحليل
    RESEARCH: {
      name: 'llama-3.1-70b-versatile',
      provider: 'groq',
      speed: 'fast',
      quality: 'excellent',
      difficulty: [DIFFICULTY.MODERATE, DIFFICULTY.COMPLEX],
      tokens: 8000,
      description: 'للبحث والتحليل العميق'
    }
  },

  // نماذج Mixtral (سياق طويل)
  MIXTRAL: {
    LONG_CONTEXT: {
      name: 'mixtral-8x7b-32768',
      provider: 'groq',
      speed: 'medium',
      quality: 'excellent',
      difficulty: [DIFFICULTY.COMPLEX],
      tokens: 32000,
      description: 'للنصوص الطويلة والتحليل العميق'
    }
  }
};

// دالة لاختيار النموذج المناسب
function selectModel(context) {
  const { difficulty, type, requiresVision, requiresLongContext, requiresCode } = context;
  
  // للصور
  if (requiresVision) {
    return MODELS.GROQ.VISION;
  }
  
  // للأكواد
  if (requiresCode || type === 'code') {
    return MODELS.GROQ.CODE;
  }
  
  // للسياق الطويل
  if (requiresLongContext) {
    return MODELS.MIXTRAL.LONG_CONTEXT;
  }
  
  // للبحث
  if (type === 'research') {
    return MODELS.GROQ.RESEARCH;
  }
  
  // حسب الصعوبة
  switch (difficulty) {
    case DIFFICULTY.SIMPLE:
      return MODELS.GROQ.FAST;
    
    case DIFFICULTY.MODERATE:
      return MODELS.GROQ.BALANCED;
    
    case DIFFICULTY.COMPLEX:
    case DIFFICULTY.EXPERT:
      return MODELS.GROQ.POWER;
    
    default:
      return MODELS.GROQ.BALANCED;
  }
}

// دالة لتحليل صعوبة السؤال
function analyzeDifficulty(question) {
  const lowerQ = question.toLowerCase();
  
  // كلمات مفتاحية للصعوبة
  const simpleKeywords = ['ما هو', 'من هو', 'متى', 'أين', 'كم', 'هل', 'what', 'who', 'when', 'where'];
  const complexKeywords = ['اشرح', 'حلل', 'قارن', 'ناقش', 'برهن', 'explain', 'analyze', 'compare', 'prove'];
  const expertKeywords = ['نظرية', 'معادلة', 'خوارزمية', 'فلسفة', 'theory', 'algorithm', 'philosophy'];
  
  // فحص الكلمات المفتاحية
  if (expertKeywords.some(kw => lowerQ.includes(kw))) {
    return DIFFICULTY.EXPERT;
  }
  
  if (complexKeywords.some(kw => lowerQ.includes(kw))) {
    return DIFFICULTY.COMPLEX;
  }
  
  if (simpleKeywords.some(kw => lowerQ.includes(kw))) {
    return DIFFICULTY.SIMPLE;
  }
  
  // طول السؤال
  if (question.length < 50) {
    return DIFFICULTY.SIMPLE;
  } else if (question.length < 150) {
    return DIFFICULTY.MODERATE;
  } else {
    return DIFFICULTY.COMPLEX;
  }
}

// دالة لتحليل نوع المحتوى
function analyzeContentType(message) {
  const lower = message.toLowerCase();
  
  // كود برمجي
  const codeKeywords = ['كود', 'برمج', 'code', 'program', 'function', 'class', 'script'];
  if (codeKeywords.some(kw => lower.includes(kw)) || message.includes('```')) {
    return 'code';
  }
  
  // بحث
  const researchKeywords = ['ابحث', 'ابحث عن', 'search', 'research', 'find'];
  if (researchKeywords.some(kw => lower.includes(kw))) {
    return 'research';
  }
  
  return 'text';
}

module.exports = {
  MODELS,
  selectModel,
  analyzeDifficulty,
  analyzeContentType
};
