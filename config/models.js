// نماذج AI المتعددة مع قدراتها
const { DIFFICULTY } = require('./constants');

const MODELS = {
  // نماذج Groq (سريعة ومجانية) - محدثة 2024
  GROQ: {
    // النموذج الرئيسي - الأقوى والأحدث
    MAIN: {
      name: 'llama-3.3-70b-versatile',
      provider: 'groq',
      speed: 'very_fast',
      quality: 'superior',
      difficulty: 'all',
      tokens: 8000,
      description: 'النموذج الرئيسي - الأقوى والأسرع'
    },
    
    // للصور فقط
    VISION: {
      name: 'llama-3.2-11b-vision-preview',
      provider: 'groq',
      speed: 'fast',
      quality: 'excellent',
      difficulty: 'all',
      tokens: 8000,
      description: 'تحليل الصور والرؤية'
    },
    
    // نموذج سريع جداً
    FAST: {
      name: 'llama-3.3-70b-versatile',
      provider: 'groq',
      speed: 'very_fast',
      quality: 'superior',
      difficulty: 'all',
      tokens: 8000,
      description: 'سريع جداً'
    }
  }
};

// دالة لاختيار النموذج المناسب
function selectModel(context) {
  const { difficulty, type, requiresVision, requiresCode } = context;
  
  // للصور
  if (requiresVision) {
    return MODELS.GROQ.VISION;
  }
  
  // لكل شيء آخر نستخدم النموذج الرئيسي (أقوى وأسرع)
  return MODELS.GROQ.MAIN;
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
