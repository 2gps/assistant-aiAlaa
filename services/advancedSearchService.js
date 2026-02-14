// خدمة البحث المتقدمة - بحث حقيقي في Google مع تصفح المواقع
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class AdvancedSearchService {
  constructor() {
    this.searchCount = 0;
    this.cache = new Map();
  }

  /**
   * بحث متقدم في Google مع جلب المحتوى الكامل
   */
  async deepSearch(query, options = {}) {
    try {
      this.searchCount++;
      const maxResults = options.maxResults || 5;
      
      logger.info(`Deep search started: "${query}"`);
      
      // البحث في Google
      const searchResults = await this.googleSearch(query, maxResults);
      
      if (searchResults.length === 0) {
        return {
          success: false,
          message: 'لم أجد نتائج للبحث'
        };
      }
      
      // جلب محتوى كل نتيجة
      const detailedResults = await Promise.all(
        searchResults.map(result => this.fetchPageContent(result))
      );
      
      // تحليل وتلخيص النتائج
      const analysis = await this.analyzeResults(query, detailedResults);
      
      return {
        success: true,
        query,
        resultsCount: detailedResults.length,
        results: detailedResults,
        analysis,
        sources: detailedResults.map(r => ({ title: r.title, url: r.url }))
      };
      
    } catch (error) {
      logger.error('Deep search error:', error);
      throw error;
    }
  }

  /**
   * البحث في Google
   */
  async googleSearch(query, maxResults = 5) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encodedQuery}&num=${maxResults}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ar,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      // استخراج النتائج
      $('.g').each((i, elem) => {
        if (results.length >= maxResults) return false;
        
        const titleElem = $(elem).find('h3').first();
        const linkElem = $(elem).find('a').first();
        const snippetElem = $(elem).find('.VwiC3b, .yXK7lf').first();
        
        const title = titleElem.text().trim();
        let url = linkElem.attr('href');
        const snippet = snippetElem.text().trim();
        
        if (url && url.startsWith('/url?q=')) {
          url = url.split('/url?q=')[1].split('&')[0];
          url = decodeURIComponent(url);
        }
        
        if (title && url && this.isValidUrl(url)) {
          results.push({ title, url, snippet });
        }
      });
      
      logger.info(`Found ${results.length} search results`);
      return results;
      
    } catch (error) {
      logger.error('Google search error:', error);
      
      // محاولة بديلة باستخدام DuckDuckGo
      return await this.duckDuckGoSearch(query, maxResults);
    }
  }

  /**
   * بحث بديل في DuckDuckGo
   */
  async duckDuckGoSearch(query, maxResults = 5) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      $('.result').each((i, elem) => {
        if (results.length >= maxResults) return false;
        
        const title = $(elem).find('.result__a').text().trim();
        const url = $(elem).find('.result__url').attr('href');
        const snippet = $(elem).find('.result__snippet').text().trim();
        
        if (title && url) {
          results.push({ title, url, snippet });
        }
      });
      
      logger.info(`DuckDuckGo found ${results.length} results`);
      return results;
      
    } catch (error) {
      logger.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  /**
   * جلب محتوى الصفحة كاملاً
   */
  async fetchPageContent(result) {
    try {
      const response = await axios.get(result.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000,
        maxContentLength: 500000 // 500KB max
      });
      
      const $ = cheerio.load(response.data);
      
      // إزالة العناصر غير المرغوبة
      $('script, style, nav, header, footer, iframe, ads').remove();
      
      // استخراج النص الرئيسي
      let mainContent = '';
      
      // محاولة إيجاد المحتوى الرئيسي
      const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
        '.entry-content',
        '#content'
      ];
      
      for (const selector of contentSelectors) {
        const elem = $(selector).first();
        if (elem.length > 0) {
          mainContent = elem.text();
          break;
        }
      }
      
      // إذا لم نجد، نأخذ body
      if (!mainContent) {
        mainContent = $('body').text();
      }
      
      // تنظيف النص
      mainContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
        .substring(0, 3000); // أول 3000 حرف
      
      return {
        ...result,
        content: mainContent,
        fetched: true
      };
      
    } catch (error) {
      logger.warn(`Failed to fetch ${result.url}:`, error.message);
      return {
        ...result,
        content: result.snippet,
        fetched: false
      };
    }
  }

  /**
   * تحليل النتائج باستخدام AI
   */
  async analyzeResults(query, results) {
    const aiService = require('./aiService');
    
    // تجميع المحتوى
    let combinedContent = `نتائج البحث عن: "${query}"\n\n`;
    
    results.forEach((result, i) => {
      combinedContent += `[${i + 1}] ${result.title}\n`;
      combinedContent += `المصدر: ${result.url}\n`;
      combinedContent += `المحتوى: ${result.content}\n\n`;
    });
    
    // طلب التحليل من AI
    const analysisPrompt = `قم بتحليل نتائج البحث التالية وقدم إجابة شاملة ودقيقة عن السؤال: "${query}"\n\n${combinedContent}\n\nقدم:\n1. إجابة مباشرة وواضحة\n2. معلومات إضافية مهمة\n3. اذكر المصادر المستخدمة`;
    
    const response = await aiService.sendRequest([
      { role: 'user', content: analysisPrompt }
    ], { 
      maxTokens: 2000,
      temperature: 0.3 // أقل للدقة
    });
    
    return response.content;
  }

  /**
   * بحث عن الصور
   */
  async searchImages(query, maxResults = 5) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const images = [];
      
      // استخراج روابط الصور من JavaScript
      const scriptData = $('script').text();
      const imageMatches = scriptData.match(/\["(https:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*)"/gi);
      
      if (imageMatches) {
        imageMatches.forEach((match, i) => {
          if (images.length >= maxResults) return;
          
          const url = match.replace(/^\["/, '').replace(/"$/, '');
          if (this.isValidImageUrl(url)) {
            images.push({
              url,
              index: i + 1
            });
          }
        });
      }
      
      logger.info(`Found ${images.length} images for: ${query}`);
      return images;
      
    } catch (error) {
      logger.error('Image search error:', error);
      return [];
    }
  }

  /**
   * التحقق من صحة URL
   */
  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * التحقق من صحة رابط الصورة
   */
  isValidImageUrl(url) {
    return this.isValidUrl(url) && 
           /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  }

  /**
   * الحصول على إحصائيات
   */
  getStats() {
    return {
      totalSearches: this.searchCount,
      cacheSize: this.cache.size
    };
  }
}

module.exports = new AdvancedSearchService();
