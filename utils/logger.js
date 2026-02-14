// نظام تسجيل متقدم
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.logFile = path.join(__dirname, '../logs/bot.log');
    this.ensureLogDir();
  }

  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (error) {
        console.error('Could not create log directory:', error);
      }
    }
  }

  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };

    this.logs.push(logEntry);
    
    // الحفاظ على آخر 1000 سجل فقط
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // طباعة في Console
    const logMessage = `[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage, meta);

    // الكتابة في ملف (اختياري)
    this.writeToFile(logEntry);
  }

  writeToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      // تجاهل أخطاء الكتابة لعدم إيقاف البوت
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }

  getErrorLogs() {
    return this.logs.filter(log => log.level === 'error');
  }

  clearLogs() {
    this.logs = [];
  }
}

module.exports = new Logger();
