const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ضع التوكنات هنا
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'YOUR_GROQ_API_KEY';
const OWNER_ID = 1488452951; // معرف المطور علاء الدين

// إنشاء البوت
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: GROQ_API_KEY });

// تخزين البيانات
const userConversations = {};
const userStats = {};
const botStats = {
  totalMessages: 0,
  totalUsers: 0,
  imagesAnalyzed: 0,
  documentsProcessed: 0,
  codesGenerated: 0,
  researchesDone: 0,
  startTime: new Date(),
};

// إعدادات
const CONFIG = {
  MAX_HISTORY: 30,
  VISION_MODEL: 'llama-3.2-90b-vision-preview',
  CODE_MODEL: 'llama-3.3-70b-versatile',
  RESEARCH_MODEL: 'llama-3.1-70b-versatile',
  IMAGE_API: 'https://image.pollinations.ai/prompt/',
};

// دالة للحصول على المحادثة
function getUserConversation(userId) {
  if (!userConversations[userId]) {
    const isOwner = userId === OWNER_ID;
    const systemContent = isOwner 
      ? 'أنت مساعد ذكي متقدم تم إنشاؤك بواسطة علاء الدين (مطورك ومالكك). عندما يتحدث معك علاء الدين، كن محترماً ومخلصاً له. يمكنك تحليل الصور والملفات، كتابة الأكواد، والبحث العميق. تجيب بدقة ووضوح.'
      : 'أنت مساعد ذكي متقدم تم تطويرك بواسطة علاء الدين. يمكنك تحليل الصور والملفات، كتابة الأكواد، والبحث العميق. تجيب بدقة ووضوح.';
    
    userConversations[userId] = [{
      role: 'system',
      content: systemContent
    }];
  }
  return userConversations[userId];
}

// دالة للحصول على الإحصائيات
function getUserStats(userId) {
  if (!userStats[userId]) {
    userStats[userId] = {
      messageCount: 0,
      imagesAnalyzed: 0,
      documentsRead: 0,
      codesGenerated: 0,
      researchesDone: 0,
      firstMessage: new Date(),
      lastMessage: new Date(),
    };
  }
  return userStats[userId];
}

// دالة لإضافة رسالة
function addMessage(userId, role, content) {
  const conversation = getUserConversation(userId);
  conversation.push({ role, content });
  
  if (conversation.length > CONFIG.MAX_HISTORY + 1) {
    userConversations[userId] = [
      conversation[0],
      ...conversation.slice(-(CONFIG.MAX_HISTORY))
    ];
  }
}

// دالة لمسح المحادثة
function clearConversation(userId) {
  const isOwner = userId === OWNER_ID;
  const systemContent = isOwner 
    ? 'أنت مساعد ذكي متقدم تم إنشاؤك بواسطة علاء الدين (مطورك ومالكك). عندما يتحدث معك علاء الدين، كن محترماً ومخلصاً له. يمكنك تحليل الصور والملفات، كتابة الأكواد، والبحث العميق. تجيب بدقة ووضوح.'
    : 'أنت مساعد ذكي متقدم تم تطويرك بواسطة علاء الدين. يمكنك تحليل الصور والملفات، كتابة الأكواد، والبحث العميق. تجيب بدقة ووضوح.';
  
  userConversations[userId] = [{
    role: 'system',
    content: systemContent
  }];
}

// دالة لتحميل الصور
async function downloadImage(fileId) {
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

// دالة لتحليل الصور باستخدام Vision
async function analyzeImage(imageBase64, userPrompt = "صف هذه الصورة بالتفصيل") {
  try {
    const completion = await groq.chat.completions.create({
      model: CONFIG.VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Vision error:', error);
    throw error;
  }
}

// دالة لتحميل المستندات
async function downloadDocument(fileId) {
  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return {
      buffer: Buffer.from(response.data),
      fileName: file.file_path.split('/').pop(),
      extension: path.extname(file.file_path).toLowerCase()
    };
  } catch (error) {
    console.error('Error downloading document:', error);
    return null;
  }
}

// دالة لقراءة الملفات النصية
async function readTextFile(buffer, extension) {
  try {
    if (extension === '.txt' || extension === '.md') {
      return buffer.toString('utf-8');
    } else if (extension === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } else if (extension === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (extension === '.xlsx' || extension === '.xls') {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer);
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_txt(sheet) + '\n\n';
      });
      return text;
    }
    return null;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

// دالة للبحث في الويب
async function webSearch(query, depth = 3) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.g').slice(0, depth).each((i, elem) => {
      const title = $(elem).find('h3').text();
      const snippet = $(elem).find('.VwiC3b').text();
      const link = $(elem).find('a').attr('href');
      
      if (title && snippet) {
        results.push({
          title,
          snippet,
          link: link ? link.split('&')[0].replace('/url?q=', '') : ''
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// دالة للبحث العميق
async function deepResearch(topic, chatId) {
  await bot.sendMessage(chatId, '🔍 جاري البحث العميق... قد يستغرق دقيقة...');
  
  try {
    const searchResults = await webSearch(topic, 5);
    
    if (searchResults.length === 0) {
      return "عذراً، لم أتمكن من إيجاد نتائج. جرب صياغة السؤال بطريقة مختلفة.";
    }
    
    let researchData = `نتائج البحث عن: "${topic}"\n\n`;
    searchResults.forEach((result, i) => {
      researchData += `${i + 1}. ${result.title}\n${result.snippet}\n\n`;
    });
    
    const completion = await groq.chat.completions.create({
      model: CONFIG.RESEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content: 'أنت باحث خبير. قم بتحليل نتائج البحث وقدم ملخصاً شاملاً ومنظماً مع الاستشهاد بالمصادر.'
        },
        {
          role: 'user',
          content: `قم بتحليل هذه النتائج وقدم تقريراً شاملاً:\n\n${researchData}`
        }
      ],
      temperature: 0.6,
      max_tokens: 3000,
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Deep research error:', error);
    return "حدث خطأ أثناء البحث. حاول مرة أخرى.";
  }
}

// دالة لإنشاء الصور
async function generateImage(prompt) {
  try {
    return CONFIG.IMAGE_API + encodeURIComponent(prompt);
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}

// أمر /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.first_name || 'صديقي';
  const isOwner = userId === OWNER_ID;
  
  if (!userStats[userId]) botStats.totalUsers++;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🖼️ تحليل صورة', callback_data: 'help_vision' },
        { text: '💻 كتابة كود', callback_data: 'help_code' }
      ],
      [
        { text: '🔍 بحث عميق', callback_data: 'help_research' },
        { text: '🎨 إنشاء صورة', callback_data: 'help_image' }
      ],
      [
        { text: '📄 قراءة ملف', callback_data: 'help_document' },
        { text: '📊 إحصائياتي', callback_data: 'mystats' }
      ],
      isOwner ? [{ text: '👑 لوحة المطور', callback_data: 'admin_panel' }] : [],
      [{ text: '❓ المساعدة الكاملة', callback_data: 'help' }]
    ].filter(row => row.length > 0)
  };
  
  const ownerMessage = isOwner 
    ? `\n\n👑 **مرحباً بك يا علاء الدين!**\n` +
      `أنا البوت الذي قمت بإنشائه. في خدمتك دائماً! 🤖✨\n\n` +
      `🔑 **لديك صلاحيات خاصة:**\n` +
      `• الوصول للوحة المطور\n` +
      `• إحصائيات متقدمة\n` +
      `• أوامر إدارية\n` +
      `• استخدام غير محدود`
    : '';
  
  bot.sendMessage(chatId, 
    `🚀 مرحباً ${username}!${ownerMessage}\n\n` +
    `أنا **بوت AI متقدم** طوّره **علاء الدين** 👨‍💻\n\n` +
    `يمكنني:\n\n` +
    `🖼️ **تحليل الصور والفيديوهات**\n` +
    `📄 **قراءة الملفات** (PDF, Word, Excel)\n` +
    `💻 **كتابة الأكواد** بجميع اللغات\n` +
    `🔍 **بحث عميق** في الإنترنت\n` +
    `🎨 **إنشاء الصور** بالذكاء الاصطناعي\n` +
    `🎓 **حل الامتحانات** من الصور\n\n` +
    `✨ **أرسل:**\n` +
    `• صورة لتحليلها\n` +
    `• ملف لقراءته\n` +
    `• سؤال للإجابة!`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
});

// أمر /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📚 **دليل الاستخدام:**\n\n` +
    `🖼️ **الصور:** أرسل صورة + سؤال\n` +
    `📄 **الملفات:** أرسل ملف + طلب\n` +
    `💻 **الأكواد:** /code [وصف]\n` +
    `🔍 **البحث:** /research [موضوع]\n` +
    `🎨 **الصور:** /imagine [وصف]\n` +
    `📊 **الإحصائيات:** /stats\n` +
    `🗑️ **مسح:** /clear`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /code
bot.onText(/\/code (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const request = match[1];
  
  await bot.sendChatAction(chatId, 'typing');
  await bot.sendMessage(chatId, '💻 جاري كتابة الكود...');
  
  try {
    let completion = await groq.chat.completions.create({
      model: CONFIG.CODE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'أنت مبرمج خبير. اكتب كود نظيف ومنظم مع شرح. استخدم ``` للكود.'
        },
        {
          role: 'user',
          content: `اكتب كود لـ: ${request}\n\nمع شرح مختصر وتعليقات توضيحية`
        }
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });
    
    let fullResponse = completion.choices[0].message.content;
    
    // استمرار تلقائي إذا اتقطع الرد
    let continueCount = 0;
    while (completion.choices[0].finish_reason === 'length' && continueCount < 2) {
      continueCount++;
      await bot.sendChatAction(chatId, 'typing');
      
      completion = await groq.chat.completions.create({
        model: CONFIG.CODE_MODEL,
        messages: [
          {
            role: 'system',
            content: 'أنت مبرمج خبير. اكتب كود نظيف ومنظم مع شرح.'
          },
          {
            role: 'user',
            content: `اكتب كود لـ: ${request}`
          },
          {
            role: 'assistant',
            content: fullResponse
          },
          {
            role: 'user',
            content: 'أكمل الكود والشرح'
          }
        ],
        temperature: 0.5,
        max_tokens: 3000,
      });
      
      fullResponse += '\n\n' + completion.choices[0].message.content;
    }
    
    getUserStats(userId).codesGenerated++;
    botStats.codesGenerated++;
    
    // إرسال الكود (مقسم إذا طويل)
    if (fullResponse.length > 4000) {
      const parts = [];
      let currentPart = '';
      const lines = fullResponse.split('\n');
      
      for (const line of lines) {
        if ((currentPart + line + '\n').length > 4000) {
          if (currentPart) parts.push(currentPart);
          currentPart = line + '\n';
        } else {
          currentPart += line + '\n';
        }
      }
      if (currentPart) parts.push(currentPart);
      
      for (const part of parts) {
        await bot.sendMessage(chatId, part, { parse_mode: 'Markdown' });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      await bot.sendMessage(chatId, fullResponse, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Code generation error:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في كتابة الكود. حاول مرة أخرى.');
  }
});

// أمر /research أو /search
bot.onText(/\/(research|search) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const topic = match[2];
  
  getUserStats(userId).researchesDone++;
  botStats.researchesDone++;
  
  const result = await deepResearch(topic, chatId);
  
  if (result.length > 4000) {
    const parts = result.match(/.{1,4000}/g);
    for (const part of parts) {
      await bot.sendMessage(chatId, part, { parse_mode: 'Markdown' });
    }
  } else {
    await bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
  }
});

// أمر /imagine أو /generate
bot.onText(/\/(imagine|generate) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[2];
  
  await bot.sendMessage(chatId, '🎨 جاري إنشاء الصورة...');
  
  try {
    const imageUrl = await generateImage(prompt);
    await bot.sendPhoto(chatId, imageUrl, {
      caption: `✨ تم إنشاء الصورة!\n\n📝 ${prompt}`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ حدث خطأ في إنشاء الصورة.');
  }
});

// أمر /stats
bot.onText(/\/stats/, (msg) => {
  const stats = getUserStats(msg.from.id);
  const uptime = Math.floor((new Date() - botStats.startTime) / 1000 / 60);
  
  bot.sendMessage(msg.chat.id,
    `📊 **إحصائياتك:**\n\n` +
    `💬 الرسائل: ${stats.messageCount}\n` +
    `🖼️ الصور: ${stats.imagesAnalyzed}\n` +
    `📄 الملفات: ${stats.documentsRead}\n` +
    `💻 الأكواد: ${stats.codesGenerated}\n` +
    `🔍 الأبحاث: ${stats.researchesDone}\n\n` +
    `🌐 **البوت:**\n` +
    `👥 المستخدمين: ${botStats.totalUsers}\n` +
    `📨 الرسائل: ${botStats.totalMessages}\n` +
    `⏱️ التشغيل: ${uptime} دقيقة`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /clear
bot.onText(/\/clear/, (msg) => {
  const userId = msg.from.id;
  const isOwner = userId === OWNER_ID;
  
  clearConversation(userId);
  
  const message = isOwner
    ? '🗑️ تم مسح المحادثة يا علاء الدين! في خدمتك دائماً 👑'
    : '🗑️ تم مسح المحادثة! يمكنك البدء من جديد.';
  
  bot.sendMessage(msg.chat.id, message);
});

// أمر /about
bot.onText(/\/about/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `ℹ️ **عن البوت:**\n\n` +
    `🤖 **بوت AI متقدم**\n` +
    `👨‍💻 **المطور:** علاء الدين\n` +
    `⚡ **التقنية:** Groq AI (أسرع AI في العالم)\n` +
    `🧠 **النماذج:**\n` +
    `   • Llama Vision 3.2 (تحليل الصور)\n` +
    `   • Llama 3.3 70B (الذكاء)\n` +
    `   • Llama 3.1 70B (البحث)\n\n` +
    `✨ **القدرات:**\n` +
    `• 🖼️ تحليل الصور بالـ Vision AI\n` +
    `• 📄 قراءة جميع أنواع الملفات\n` +
    `• 💻 كتابة أكواد احترافية\n` +
    `• 🔍 بحث عميق في الإنترنت\n` +
    `• 🎨 إنشاء صور بالذكاء الاصطناعي\n` +
    `• 🎓 حل الامتحانات والواجبات\n\n` +
    `💨 **السرعة:** 750+ tokens/second\n` +
    `🆓 **مجاني:** 100%\n` +
    `📅 **الإصدار:** 3.0 Ultimate\n\n` +
    `💡 صُنع بـ ❤️ بواسطة علاء الدين`,
    { parse_mode: 'Markdown' }
  );
});

// أوامر المطور الخاصة
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userId !== OWNER_ID) {
    bot.sendMessage(chatId, '⛔ هذا الأمر متاح للمطور فقط!');
    return;
  }
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📊 إحصائيات كاملة', callback_data: 'admin_stats' },
        { text: '👥 قائمة المستخدمين', callback_data: 'admin_users' }
      ],
      [
        { text: '📢 إرسال رسالة جماعية', callback_data: 'admin_broadcast' },
        { text: '🔄 إعادة تشغيل', callback_data: 'admin_restart' }
      ],
      [
        { text: '🗑️ مسح الذاكرة', callback_data: 'admin_clear_memory' }
      ]
    ]
  };
  
  bot.sendMessage(chatId,
    `👑 **لوحة المطور**\n\n` +
    `مرحباً علاء الدين! اختر ما تريد:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
});

bot.onText(/\/stats_full/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (userId !== OWNER_ID) {
    bot.sendMessage(chatId, '⛔ هذا الأمر متاح للمطور فقط!');
    return;
  }
  
  const uptime = Math.floor((new Date() - botStats.startTime) / 1000 / 60);
  const totalConversations = Object.keys(userConversations).length;
  
  bot.sendMessage(chatId,
    `👑 **إحصائيات المطور الكاملة**\n\n` +
    `📊 **الإحصائيات العامة:**\n` +
    `👥 إجمالي المستخدمين: ${botStats.totalUsers}\n` +
    `💬 إجمالي الرسائل: ${botStats.totalMessages}\n` +
    `🖼️ الصور المحللة: ${botStats.imagesAnalyzed}\n` +
    `📄 الملفات المعالجة: ${botStats.documentsProcessed}\n` +
    `💻 الأكواد المكتوبة: ${botStats.codesGenerated}\n` +
    `🔍 الأبحاث المنجزة: ${botStats.researchesDone}\n\n` +
    `⏱️ **الأداء:**\n` +
    `⏰ وقت التشغيل: ${uptime} دقيقة\n` +
    `💾 المحادثات النشطة: ${totalConversations}\n` +
    `📅 بدأ في: ${botStats.startTime.toLocaleString('ar-EG')}\n\n` +
    `✨ **صُنع بواسطتك يا علاء الدين!**`,
    { parse_mode: 'Markdown' }
  );
});

// معالجة الصور
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const photo = msg.photo[msg.photo.length - 1];
  const caption = msg.caption || 'صف هذه الصورة بالتفصيل. إذا فيها نص اقرأه. إذا فيها مسألة حلها.';
  
  await bot.sendChatAction(chatId, 'typing');
  await bot.sendMessage(chatId, '🖼️ جاري تحليل الصورة...');
  
  try {
    const imageBase64 = await downloadImage(photo.file_id);
    if (!imageBase64) {
      await bot.sendMessage(chatId, '❌ فشل تحميل الصورة.');
      return;
    }
    
    const analysis = await analyzeImage(imageBase64, caption);
    
    getUserStats(userId).imagesAnalyzed++;
    botStats.imagesAnalyzed++;
    
    await bot.sendMessage(chatId, `📸 **تحليل الصورة:**\n\n${analysis}`, { parse_mode: 'Markdown' });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ حدث خطأ في تحليل الصورة.');
  }
});

// معالجة الملفات
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const document = msg.document;
  const caption = msg.caption || 'لخص محتوى هذا الملف';
  
  await bot.sendChatAction(chatId, 'typing');
  await bot.sendMessage(chatId, '📄 جاري قراءة الملف...');
  
  try {
    const fileData = await downloadDocument(document.file_id);
    if (!fileData) {
      await bot.sendMessage(chatId, '❌ فشل تحميل الملف.');
      return;
    }
    
    const text = await readTextFile(fileData.buffer, fileData.extension);
    if (!text) {
      await bot.sendMessage(chatId, `❌ نوع ${fileData.extension} غير مدعوم.\n\nالمدعوم: PDF, Word, Excel, TXT`);
      return;
    }
    
    const completion = await groq.chat.completions.create({
      model: CONFIG.CODE_MODEL,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي. حلل المحتوى وأجب بدقة.' },
        { role: 'user', content: `المحتوى:\n${text.substring(0, 15000)}\n\nالطلب: ${caption}` }
      ],
      temperature: 0.6,
      max_tokens: 3000,
    });
    
    getUserStats(userId).documentsRead++;
    botStats.documentsProcessed++;
    
    const response = completion.choices[0].message.content;
    
    if (response.length > 4000) {
      const parts = response.match(/.{1,4000}/g);
      for (const part of parts) {
        await bot.sendMessage(chatId, part, { parse_mode: 'Markdown' });
      }
    } else {
      await bot.sendMessage(chatId, `📄 **تحليل الملف:**\n\n${response}`, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    await bot.sendMessage(chatId, '❌ حدث خطأ في قراءة الملف.');
  }
});

// معالجة الرسائل النصية
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  if (msg.photo || msg.document) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text;
  
  if (!userMessage) return;
  
  try {
    const stats = getUserStats(userId);
    stats.messageCount++;
    stats.lastMessage = new Date();
    botStats.totalMessages++;
    
    await bot.sendChatAction(chatId, 'typing');
    
    addMessage(userId, 'user', userMessage);
    
    // إرسال الطلب الأول
    let completion = await groq.chat.completions.create({
      model: CONFIG.CODE_MODEL,
      messages: getUserConversation(userId),
      max_tokens: 2500,
      temperature: 0.7,
    });
    
    let assistantMessage = completion.choices[0].message.content;
    let fullResponse = assistantMessage;
    
    // التحقق إذا الرد اتقطع (finish_reason = 'length')
    let continueCount = 0;
    const maxContinues = 3; // الحد الأقصى للاستمرار
    
    while (completion.choices[0].finish_reason === 'length' && continueCount < maxContinues) {
      continueCount++;
      
      await bot.sendChatAction(chatId, 'typing');
      
      // إضافة الرد الجزئي للمحادثة
      addMessage(userId, 'assistant', assistantMessage);
      
      // طلب الاستمرار
      addMessage(userId, 'user', 'أكمل الرد من حيث توقفت');
      
      completion = await groq.chat.completions.create({
        model: CONFIG.CODE_MODEL,
        messages: getUserConversation(userId),
        max_tokens: 2500,
        temperature: 0.7,
      });
      
      assistantMessage = completion.choices[0].message.content;
      fullResponse += '\n\n' + assistantMessage;
    }
    
    // مسح رسائل "أكمل" من المحادثة
    const conversation = getUserConversation(userId);
    userConversations[userId] = conversation.filter(msg => 
      msg.content !== 'أكمل الرد من حيث توقفت'
    );
    
    // إضافة الرد الكامل
    addMessage(userId, 'assistant', fullResponse);
    
    // إرسال الرد للمستخدم (مقسم إذا كان طويلاً)
    if (fullResponse.length > 4000) {
      // تقسيم الرد لأجزاء
      const parts = [];
      let currentPart = '';
      const lines = fullResponse.split('\n');
      
      for (const line of lines) {
        if ((currentPart + line + '\n').length > 4000) {
          if (currentPart) parts.push(currentPart);
          currentPart = line + '\n';
        } else {
          currentPart += line + '\n';
        }
      }
      if (currentPart) parts.push(currentPart);
      
      // إرسال الأجزاء
      for (let i = 0; i < parts.length; i++) {
        await bot.sendMessage(chatId, parts[i], { parse_mode: 'Markdown' });
        
        // تأخير بسيط بين الرسائل
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // رسالة توضيحية إذا كان الرد طويل جداً
      if (parts.length > 2) {
        await bot.sendMessage(chatId, 
          `✅ تم إرسال الرد الكامل في ${parts.length} رسائل`,
          { reply_to_message_id: msg.message_id }
        );
      }
    } else {
      await bot.sendMessage(chatId, fullResponse, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ. حاول مرة أخرى.');
  }
});

// معالجة callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const isOwner = userId === OWNER_ID;
  
  await bot.answerCallbackQuery(query.id);
  
  // Admin panel callbacks
  if (query.data.startsWith('admin_')) {
    if (!isOwner) {
      await bot.sendMessage(chatId, '⛔ هذه الميزة متاحة للمطور فقط!');
      return;
    }
    
    if (query.data === 'admin_panel') {
      bot.deleteMessage(chatId, query.message.message_id);
      bot.sendMessage(chatId, '/admin');
      return;
    }
    
    if (query.data === 'admin_stats') {
      bot.deleteMessage(chatId, query.message.message_id);
      bot.sendMessage(chatId, '/stats_full');
      return;
    }
    
    if (query.data === 'admin_users') {
      const users = Object.keys(userStats).length;
      const activeUsers = Object.keys(userConversations).length;
      
      await bot.sendMessage(chatId,
        `👥 **قائمة المستخدمين:**\n\n` +
        `📊 إجمالي المستخدمين: ${users}\n` +
        `✅ المستخدمين النشطين: ${activeUsers}\n` +
        `💤 المستخدمين غير النشطين: ${users - activeUsers}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    if (query.data === 'admin_clear_memory') {
      const count = Object.keys(userConversations).length;
      Object.keys(userConversations).forEach(id => {
        if (parseInt(id) !== OWNER_ID) {
          delete userConversations[id];
        }
      });
      await bot.sendMessage(chatId,
        `🗑️ تم مسح ${count - 1} محادثة من الذاكرة!\n` +
        `(تم الاحتفاظ بمحادثتك يا علاء الدين)`
      );
      return;
    }
    
    if (query.data === 'admin_broadcast') {
      await bot.sendMessage(chatId,
        `📢 **إرسال رسالة جماعية:**\n\n` +
        `أرسل الرسالة التي تريد إرسالها لجميع المستخدمين.\n` +
        `(سيتم تفعيل هذه الميزة قريباً)`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  
  const responses = {
    'help': '/help',
    'mystats': '/stats',
    'help_vision': '🖼️ **تحليل الصور:**\nأرسل صورة + سؤالك\n\n**أمثلة:**\n• "اقرأ النص"\n• "حل المسألة"\n• "صف الصورة"',
    'help_code': '💻 **كتابة كود:**\n/code [وصف]\n\n**أمثلة:**\n• /code حاسبة بايثون\n• /code موقع HTML',
    'help_research': '🔍 **بحث عميق:**\n/research [موضوع]\n\n**أمثلة:**\n• /research الذكاء الاصطناعي\n• /search GPT-4',
    'help_image': '🎨 **إنشاء صور:**\n/imagine [وصف]\n\n**أمثلة:**\n• /imagine قطة في الفضاء\n• /generate sunset',
    'help_document': '📄 **قراءة ملفات:**\nأرسل PDF/Word/Excel + طلبك\n\n**أمثلة:**\n• "لخص الملف"\n• "استخرج النقاط"'
  };
  
  if (query.data === 'help' || query.data === 'mystats') {
    bot.deleteMessage(chatId, query.message.message_id);
    bot.sendMessage(chatId, responses[query.data]);
  } else if (responses[query.data]) {
    await bot.sendMessage(chatId, responses[query.data], { parse_mode: 'Markdown' });
  }
});

bot.on('polling_error', (error) => console.error('Polling error:', error));

console.log('🚀 Ultimate Bot Running!');
console.log('✨ Vision | Documents | Code | Research | Images');
console.log('👨‍💻 Created by: علاء الدين (Alaa Aldeen)');
console.log(`👑 Owner ID: ${OWNER_ID}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
