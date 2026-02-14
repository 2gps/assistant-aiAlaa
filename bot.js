const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// ضع التوكنات هنا
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';

// إنشاء البوت
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// تخزين محادثات المستخدمين في الذاكرة
const userConversations = {};

// الحد الأقصى لعدد الرسائل المحفوظة لكل مستخدم
const MAX_HISTORY = 20;

// دالة للحصول على أو إنشاء محادثة المستخدم
function getUserConversation(userId) {
  if (!userConversations[userId]) {
    userConversations[userId] = [
      {
        role: 'system',
        content: 'أنت مساعد ذكي ومفيد. تجيب على الأسئلة باللغة العربية أو الإنجليزية حسب لغة السؤال.'
      }
    ];
  }
  return userConversations[userId];
}

// دالة لإضافة رسالة للمحادثة
function addMessage(userId, role, content) {
  const conversation = getUserConversation(userId);
  conversation.push({ role, content });
  
  // حفظ آخر MAX_HISTORY رسالة فقط (مع الاحتفاظ بالـ system message)
  if (conversation.length > MAX_HISTORY + 1) {
    userConversations[userId] = [
      conversation[0], // system message
      ...conversation.slice(-(MAX_HISTORY))
    ];
  }
}

// دالة لمسح محادثة المستخدم
function clearConversation(userId) {
  userConversations[userId] = [
    {
      role: 'system',
      content: 'أنت مساعد ذكي ومفيد. تجيب على الأسئلة باللغة العربية أو الإنجليزية حسب لغة السؤال.'
    }
  ];
}

// أمر /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name || 'صديقي';
  
  bot.sendMessage(chatId, 
    `🤖 مرحباً ${username}!\n\n` +
    `أنا بوت ذكي يستخدم ChatGPT للإجابة على أسئلتك.\n\n` +
    `📝 **الأوامر المتاحة:**\n` +
    `/start - عرض هذه الرسالة\n` +
    `/help - عرض المساعدة\n` +
    `/clear - مسح المحادثة والبدء من جديد\n` +
    `/stats - عرض إحصائيات المحادثة\n\n` +
    `✨ فقط أرسل لي أي سؤال وسأجيبك!`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    `📚 **كيفية الاستخدام:**\n\n` +
    `1️⃣ أرسل أي سؤال أو نص وسأجيبك\n` +
    `2️⃣ أحتفظ بتاريخ المحادثة (آخر ${MAX_HISTORY} رسالة)\n` +
    `3️⃣ استخدم /clear لبدء محادثة جديدة\n` +
    `4️⃣ استخدم /stats لمعرفة عدد رسائلك\n\n` +
    `💡 **أمثلة:**\n` +
    `• اشرح لي الذكاء الاصطناعي\n` +
    `• Write a poem about the moon\n` +
    `• ساعدني في حل مسألة رياضية\n` +
    `• برمج لي كود بايثون بسيط`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /clear
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  clearConversation(userId);
  
  bot.sendMessage(chatId, 
    `🗑️ تم مسح المحادثة!\n\n` +
    `يمكنك البدء بمحادثة جديدة الآن.`,
    { parse_mode: 'Markdown' }
  );
});

// أمر /stats
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const conversation = getUserConversation(userId);
  const messageCount = Math.floor((conversation.length - 1) / 2); // عدد تبادل الرسائل
  const totalUsers = Object.keys(userConversations).length;
  
  bot.sendMessage(chatId,
    `📊 **إحصائيات المحادثة:**\n\n` +
    `💬 عدد رسائلك: ${messageCount}\n` +
    `👥 إجمالي المستخدمين: ${totalUsers}\n` +
    `📝 الرسائل المحفوظة: ${conversation.length - 1} رسالة\n` +
    `🔄 الحد الأقصى: ${MAX_HISTORY} رسالة`,
    { parse_mode: 'Markdown' }
  );
});

// معالجة الرسائل النصية
bot.on('message', async (msg) => {
  // تجاهل الأوامر
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text;
  
  // التحقق من وجود رسالة
  if (!userMessage) {
    return;
  }
  
  try {
    // إرسال رسالة "يكتب..."
    await bot.sendChatAction(chatId, 'typing');
    
    // إضافة رسالة المستخدم للتاريخ
    addMessage(userId, 'user', userMessage);
    
    // الحصول على الرد من ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: getUserConversation(userId),
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const assistantMessage = completion.choices[0].message.content;
    
    // إضافة رد المساعد للتاريخ
    addMessage(userId, 'assistant', assistantMessage);
    
    // إرسال الرد للمستخدم
    await bot.sendMessage(chatId, assistantMessage);
    
  } catch (error) {
    console.error('Error:', error);
    
    let errorMessage = '❌ عذراً، حدث خطأ في معالجة طلبك.';
    
    if (error.code === 'insufficient_quota') {
      errorMessage = '⚠️ انتهت رصيد API الخاص بـ OpenAI. يرجى التحقق من حسابك.';
    } else if (error.status === 429) {
      errorMessage = '⏳ تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى بعد قليل.';
    } else if (error.status === 401) {
      errorMessage = '🔑 خطأ في مفتاح API. تحقق من صحة المفتاح.';
    }
    
    await bot.sendMessage(chatId, errorMessage);
  }
});

// معالجة الأخطاء
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Bot is running...');
console.log('✅ Ready to receive messages!');

// Keep-alive للحفاظ على عمل البوت
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Bot is alive - Users: ${Object.keys(userConversations).length}`);
}, 300000); // كل 5 دقائق
