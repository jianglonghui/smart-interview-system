interface CrawlResult {
  questions: CrawledQuestion[];
  source: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface CrawledQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
  source: string;
  company?: string;
  tags: string[];
  url?: string;
}

interface CrawlOptions {
  category: string;
  maxQuestions: number;
  targetSites: string[];
  company?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

class WebCrawlerService {
  private readonly corsProxyUrl = 'https://cors-anywhere.herokuapp.com/';
  private readonly backupProxyUrl = 'https://api.allorigins.win/raw?url=';
  
  private readonly defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  // 支持的招聘网站配置
  private readonly siteConfigs = {
    nowcoder: {
      name: '牛客网',
      baseUrl: 'https://www.nowcoder.com',
      searchPath: '/interview/center/search',
      enabled: true,
    },
    leetcode: {
      name: 'LeetCode中国',
      baseUrl: 'https://leetcode.cn',
      searchPath: '/problemset/all',
      enabled: true,
    },
    csdn: {
      name: 'CSDN',
      baseUrl: 'https://blog.csdn.net',
      searchPath: '/search',
      enabled: true,
    },
    juejin: {
      name: '掘金',
      baseUrl: 'https://juejin.cn',
      searchPath: '/search',
      enabled: true,
    }
  };

  private readonly categoryKeywords = {
    '前端开发': ['前端', 'javascript', 'vue', 'react', 'html', 'css', 'frontend', 'web开发'],
    '后端开发': ['后端', 'java', 'spring', '数据库', 'mysql', 'redis', 'backend'],
    '算法岗': ['算法', 'leetcode', '数据结构', '动态规划', '二叉树', 'algorithm'],
    '产品经理': ['产品经理', '产品设计', '需求分析', '用户体验', 'product manager'],
    '数据分析': ['数据分析', 'sql', 'python', '数据挖掘', '机器学习', 'data analyst'],
    '运维开发': ['运维', 'linux', 'docker', 'kubernetes', '监控', 'devops'],
    '测试开发': ['测试', '自动化测试', '性能测试', '测试用例', 'qa', 'test']
  };

  /**
   * 发起网络请求（处理CORS）
   */
  private async fetchWithCorsProxy(url: string, options: RequestInit = {}): Promise<Response> {
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      mode: 'cors',
    };

    // 首先尝试直接请求
    try {
      const response = await fetch(url, requestOptions);
      if (response.ok) return response;
    } catch (error) {
      console.warn('直接请求失败，尝试使用代理:', error);
    }

    // 尝试使用CORS代理
    try {
      const proxyUrl = `${this.corsProxyUrl}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        ...requestOptions,
        headers: {
          ...requestOptions.headers,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      if (response.ok) return response;
    } catch (error) {
      console.warn('CORS代理请求失败:', error);
    }

    // 最后尝试备用代理
    try {
      const backupUrl = `${this.backupProxyUrl}${encodeURIComponent(url)}`;
      return await fetch(backupUrl, requestOptions);
    } catch (error) {
      throw new Error(`网络请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析HTML内容
   */
  private parseHTML(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  /**
   * 主要爬取方法
   */
  async crawlInterviewQuestions(options: CrawlOptions): Promise<CrawlResult> {
    let allQuestions: CrawledQuestion[] = [];
    let errors: string[] = [];

    try {
      console.log(`开始爬取 ${options.category} 相关面试题...`);

      // 并行爬取多个网站
      const crawlPromises = options.targetSites.map(async (site) => {
        try {
          switch (site) {
            case 'nowcoder':
              return await this.crawlNowcoder(options);
            case 'csdn':
              return await this.crawlCSDN(options);
            case 'juejin':
              return await this.crawlJuejin(options);
            default:
              return { questions: [], source: site };
          }
        } catch (error) {
          console.error(`爬取 ${site} 失败:`, error);
          errors.push(`${site}: ${error instanceof Error ? error.message : '未知错误'}`);
          return { questions: [], source: site };
        }
      });

      const results = await Promise.allSettled(crawlPromises);
      
      // 合并结果
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.questions) {
          allQuestions.push(...result.value.questions);
        }
      });

      // 去重和过滤
      const uniqueQuestions = this.deduplicateQuestions(allQuestions);
      const filteredQuestions = this.filterQuestionsByQuality(uniqueQuestions);
      const finalQuestions = filteredQuestions.slice(0, options.maxQuestions);

      return {
        questions: finalQuestions,
        source: '多源爬取',
        timestamp: Date.now(),
        success: true,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };

    } catch (error) {
      console.error('爬取过程出错:', error);
      return {
        questions: [],
        source: '爬虫服务',
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : '爬取失败'
      };
    }
  }

  /**
   * 爬取牛客网面试题
   */
  private async crawlNowcoder(options: CrawlOptions): Promise<{ questions: CrawledQuestion[], source: string }> {
    const keywords = this.categoryKeywords[options.category as keyof typeof this.categoryKeywords] || [options.category];
    const questions: CrawledQuestion[] = [];

    try {
      console.log('开始爬取牛客网面试题...');
      
      // 牛客网面试经验页面
      const baseUrl = 'https://www.nowcoder.com/discuss';
      const searchQueries = keywords.slice(0, 2); // 限制关键词数量
      
      for (const keyword of searchQueries) {
        if (questions.length >= options.maxQuestions) break;
        
        // 构建搜索URL - 牛客网的讨论区搜索
        const searchUrl = `${baseUrl}?type=2&order=4&query=${encodeURIComponent(keyword)}面试`;
        
        try {
          console.log(`正在爬取关键词: ${keyword}`);
          const response = await this.fetchWithCorsProxy(searchUrl);
          const html = await response.text();
          
          if (html.length < 100) {
            console.warn('牛客网返回内容过短，可能被拦截');
            continue;
          }

          const doc = this.parseHTML(html);
          
          // 解析牛客网的讨论列表页面
          const discussionItems = doc.querySelectorAll('.discuss-main .discuss-item');
          
          for (const item of Array.from(discussionItems)) {
            if (questions.length >= Math.ceil(options.maxQuestions * 0.4)) break; // 牛客网贡献40%
            
            const titleElement = item.querySelector('.discuss-item-title a');
            const contentElement = item.querySelector('.discuss-content');
            const authorElement = item.querySelector('.discuss-author');
            
            if (titleElement) {
              const title = titleElement.textContent?.trim() || '';
              const content = contentElement?.textContent?.trim() || '';
              const href = titleElement.getAttribute('href');
              
              // 过滤出面试相关的内容
              if (this.isInterviewRelated(title, content)) {
                // 尝试从标题和内容中提取面试问题
                const extractedQuestions = this.extractQuestionsFromNowcoder(title, content);
                
                extractedQuestions.forEach((questionText, index) => {
                  if (questions.length < Math.ceil(options.maxQuestions * 0.4)) {
                    questions.push({
                      id: `nowcoder_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                      question: questionText,
                      category: options.category,
                      difficulty: this.inferDifficulty(questionText, content),
                      type: this.inferQuestionType(questionText, content),
                      source: '牛客网',
                      company: this.extractCompanyFromContent(title, content),
                      tags: [keyword, ...this.extractTagsFromContent(content)],
                      url: href ? `https://www.nowcoder.com${href}` : undefined
                    });
                  }
                });
              }
            }
          }
          
          // 添加延迟避免被反爬虫机制检测
          await this.delay(1000 + Math.random() * 2000);
          
        } catch (error) {
          console.warn(`爬取关键词 ${keyword} 失败:`, error);
          continue;
        }
      }

      console.log(`牛客网爬取完成，获得 ${questions.length} 道题`);
      return { questions, source: '牛客网' };
      
    } catch (error) {
      console.error('牛客网爬取失败:', error);
      // 如果网络爬取失败，使用备用数据确保功能可用
      const fallbackQuestions = this.generateSampleQuestions(options.category, 'nowcoder');
      return { 
        questions: fallbackQuestions.slice(0, Math.ceil(options.maxQuestions * 0.2)).map((q, index) => ({
          id: `nowcoder_fallback_${Date.now()}_${index}`,
          question: q.title,
          category: options.category,
          difficulty: this.inferDifficulty(q.title),
          type: this.inferQuestionType(q.title),
          source: '牛客网(备用)',
          company: q.company,
          tags: q.tags,
          url: q.url
        })), 
        source: '牛客网' 
      };
    }
  }

  /**
   * 检查内容是否与面试相关
   */
  private isInterviewRelated(title: string, content: string): boolean {
    const text = `${title} ${content}`.toLowerCase();
    const interviewKeywords = ['面试', '面经', '笔试', '求职', '面试题', '面试官', '技术面', '算法题'];
    return interviewKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 从牛客网内容中提取面试问题
   */
  private extractQuestionsFromNowcoder(title: string, content: string): string[] {
    const questions: string[] = [];
    const text = `${title}\n${content}`;
    
    // 更精确的面试问题提取正则
    const questionPatterns = [
      /面试官[问：:](.{10,200}[？?])/g,
      /问题\d*[：:](.{10,200}[？?])/g,
      /题目[：:](.{10,200}[？?])/g,
      /\d+[、.]\s*(.{10,200}[？?])/g,
      /问[：:](.{10,200}[？?])/g,
    ];

    questionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null && questions.length < 10) {
        const question = match[1].trim();
        if (question.length > 8 && question.length < 300 && !questions.includes(question)) {
          questions.push(question);
        }
      }
    });

    return questions;
  }

  /**
   * 从内容中提取公司名称
   */
  private extractCompanyFromContent(title: string, content: string): string | undefined {
    const text = `${title} ${content}`;
    const companies = ['阿里巴巴', '腾讯', '字节跳动', '百度', '美团', '滴滴', '京东', '网易', '小米', '华为'];
    
    for (const company of companies) {
      if (text.includes(company)) {
        return company;
      }
    }
    
    // 尝试匹配公司模式
    const companyMatch = text.match(/([A-Z][a-z]+|[\u4e00-\u9fa5]{2,6})(公司|科技|集团)/);
    return companyMatch ? companyMatch[0] : undefined;
  }

  /**
   * 从内容中提取标签
   */
  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];
    const text = content.toLowerCase();
    
    // 技术标签匹配
    const techTags = ['javascript', 'react', 'vue', 'angular', 'node.js', 'java', 'spring', 'mysql', 'redis', 'docker'];
    techTags.forEach(tag => {
      if (text.includes(tag)) tags.push(tag);
    });
    
    return tags.slice(0, 3); // 限制标签数量
  }

  /**
   * 爬取CSDN面试题
   */
  private async crawlCSDN(options: CrawlOptions): Promise<{ questions: CrawledQuestion[], source: string }> {
    const questions: CrawledQuestion[] = [];

    try {
      console.log('开始爬取CSDN面试题...');
      
      const keywords = this.categoryKeywords[options.category as keyof typeof this.categoryKeywords] || [options.category];
      const searchQueries = keywords.slice(0, 2);
      
      for (const keyword of searchQueries) {
        if (questions.length >= Math.ceil(options.maxQuestions * 0.3)) break; // CSDN贡献30%
        
        // CSDN搜索URL
        const searchUrl = `https://so.csdn.net/so/search?q=${encodeURIComponent(keyword)}面试题&t=all&p=1&s=0`;
        
        try {
          console.log(`正在爬取CSDN关键词: ${keyword}`);
          const response = await this.fetchWithCorsProxy(searchUrl);
          const html = await response.text();
          
          const doc = this.parseHTML(html);
          
          // 解析CSDN搜索结果
          const searchResults = doc.querySelectorAll('.search-list .search-list-item');
          
          for (const item of Array.from(searchResults)) {
            if (questions.length >= Math.ceil(options.maxQuestions * 0.3)) break;
            
            const titleElement = item.querySelector('.search-list-item-title a');
            const summaryElement = item.querySelector('.search-list-item-summary');
            
            if (titleElement && summaryElement) {
              const title = titleElement.textContent?.trim() || '';
              const summary = summaryElement.textContent?.trim() || '';
              const articleUrl = titleElement.getAttribute('href');
              
              if (this.isInterviewRelated(title, summary)) {
                // 从摘要中提取问题
                const extractedQuestions = this.extractQuestionsFromContent(summary, options.category);
                
                extractedQuestions.forEach((questionText, index) => {
                  if (questions.length < Math.ceil(options.maxQuestions * 0.3)) {
                    questions.push({
                      id: `csdn_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                      question: questionText,
                      category: options.category,
                      difficulty: this.inferDifficulty(questionText, summary),
                      type: this.inferQuestionType(questionText, summary),
                      source: 'CSDN',
                      company: this.extractCompanyFromContent(title, summary),
                      tags: [keyword, ...this.extractTagsFromContent(summary)],
                      url: articleUrl || undefined
                    });
                  }
                });
              }
            }
          }
          
          await this.delay(800 + Math.random() * 1200);
          
        } catch (error) {
          console.warn(`爬取CSDN关键词 ${keyword} 失败:`, error);
          continue;
        }
      }

      console.log(`CSDN爬取完成，获得 ${questions.length} 道题`);
      return { questions, source: 'CSDN' };
      
    } catch (error) {
      console.error('CSDN爬取失败:', error);
      // 备用数据
      const fallbackQuestions = this.generateSampleQuestions(options.category, 'csdn');
      return { 
        questions: fallbackQuestions.slice(0, Math.ceil(options.maxQuestions * 0.15)).map((q, index) => ({
          id: `csdn_fallback_${Date.now()}_${index}`,
          question: q.title,
          category: options.category,
          difficulty: this.inferDifficulty(q.title),
          type: this.inferQuestionType(q.title),
          source: 'CSDN(备用)',
          company: q.company,
          tags: q.tags,
          url: q.url
        })), 
        source: 'CSDN' 
      };
    }
  }

  /**
   * 爬取掘金面试题
   */
  private async crawlJuejin(options: CrawlOptions): Promise<{ questions: CrawledQuestion[], source: string }> {
    const questions: CrawledQuestion[] = [];

    try {
      console.log('开始爬取掘金面试题...');
      
      const keywords = this.categoryKeywords[options.category as keyof typeof this.categoryKeywords] || [options.category];
      const searchQueries = keywords.slice(0, 2);
      
      for (const keyword of searchQueries) {
        if (questions.length >= Math.ceil(options.maxQuestions * 0.3)) break; // 掘金贡献30%
        
        // 掘金搜索API (JSON格式)
        const searchUrl = `https://api.juejin.cn/search_api/v1/search?keyword=${encodeURIComponent(keyword)}面试&id_type=2&sort_type=0&cursor=0&limit=20`;
        
        try {
          console.log(`正在爬取掘金关键词: ${keyword}`);
          const response = await this.fetchWithCorsProxy(searchUrl, {
            headers: {
              'Content-Type': 'application/json',
              'Referer': 'https://juejin.cn/',
            }
          });
          
          const data = await response.json();
          
          if (data.data && data.data.length > 0) {
            for (const item of data.data) {
              if (questions.length >= Math.ceil(options.maxQuestions * 0.3)) break;
              
              const article = item.result_model;
              if (article && article.article_info) {
                const title = article.article_info.title || '';
                const content = article.article_info.brief_content || '';
                const articleId = article.article_info.article_id;
                
                if (this.isInterviewRelated(title, content)) {
                  // 从标题和摘要中提取问题
                  const extractedQuestions = this.extractQuestionsFromContent(content, options.category);
                  
                  extractedQuestions.forEach((questionText, index) => {
                    if (questions.length < Math.ceil(options.maxQuestions * 0.3)) {
                      questions.push({
                        id: `juejin_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                        question: questionText,
                        category: options.category,
                        difficulty: this.inferDifficulty(questionText, content),
                        type: this.inferQuestionType(questionText, content),
                        source: '掘金',
                        company: this.extractCompanyFromContent(title, content),
                        tags: [keyword, ...this.extractTagsFromContent(content)],
                        url: articleId ? `https://juejin.cn/post/${articleId}` : undefined
                      });
                    }
                  });
                }
              }
            }
          }
          
          await this.delay(1200 + Math.random() * 1500);
          
        } catch (error) {
          console.warn(`爬取掘金关键词 ${keyword} 失败:`, error);
          continue;
        }
      }

      console.log(`掘金爬取完成，获得 ${questions.length} 道题`);
      return { questions, source: '掘金' };
      
    } catch (error) {
      console.error('掘金爬取失败:', error);
      // 备用数据
      const fallbackQuestions = this.generateSampleQuestions(options.category, 'juejin');
      return { 
        questions: fallbackQuestions.slice(0, Math.ceil(options.maxQuestions * 0.15)).map((q, index) => ({
          id: `juejin_fallback_${Date.now()}_${index}`,
          question: q.title,
          category: options.category,
          difficulty: this.inferDifficulty(q.title),
          type: this.inferQuestionType(q.title),
          source: '掘金(备用)',
          company: q.company,
          tags: q.tags,
          url: q.url
        })), 
        source: '掘金' 
      };
    }
  }

  /**
   * 增强版问题提取方法
   */
  private extractQuestionsFromContent(content: string, category: string): string[] {
    const questions: string[] = [];
    
    // 改进的问题匹配正则表达式
    const questionPatterns = [
      // 标准问题格式
      /(?:问题|题目|面试题)[：:]\s*(.{10,200}[？?])/g,
      // 编号问题格式
      /^\s*\d+[、．.]\s*(.{10,200}[？?])/gm,
      // 问号结尾的疑问句
      /([什么是什么叫如何怎样为什么哪些怎么][^。！？?]*[？?])/g,
      // 面试官问题格式
      /面试官[问询](.{10,200}[？?])/g,
      // 技术问题格式
      /(?:说说|谈谈|讲讲|解释|描述)(.{5,150})/g,
    ];

    questionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null && questions.length < 15) {
        const question = match[1]?.trim() || match[0]?.trim();
        if (question && 
            question.length > 8 && 
            question.length < 250 && 
            !questions.includes(question) &&
            this.isValidQuestion(question)) {
          // 清理和格式化问题
          const cleanQuestion = this.cleanQuestion(question);
          if (cleanQuestion) {
            questions.push(cleanQuestion);
          }
        }
      }
    });

    return questions;
  }

  /**
   * 验证问题的有效性
   */
  private isValidQuestion(question: string): boolean {
    // 排除无效内容
    const invalidPatterns = [
      /^[\d\s\-\.\(\)]+$/, // 纯数字或符号
      /^.{1,5}$/, // 过短
      /^.{250,}$/, // 过长
      /(点击|链接|下载|广告|推荐)/, // 广告内容
      /^(是|不是|对|错)$/, // 单字答案
    ];

    return !invalidPatterns.some(pattern => pattern.test(question));
  }

  /**
   * 清理和格式化问题
   */
  private cleanQuestion(question: string): string | null {
    // 移除多余的空白和符号
    let cleaned = question.trim()
      .replace(/\s+/g, ' ') // 多个空格替换为单个空格
      .replace(/^[^\u4e00-\u9fa5a-zA-Z]+/, '') // 移除开头的非中英文字符
      .replace(/[^\u4e00-\u9fa5a-zA-Z\s\?\？]+$/, ''); // 移除结尾的非中英文字符(除了问号)

    // 确保问题以问号结尾
    if (!cleaned.endsWith('?') && !cleaned.endsWith('？')) {
      // 如果是疑问句但没有问号，添加问号
      if (/^(什么|如何|怎样|为什么|哪些|怎么|是否)/.test(cleaned)) {
        cleaned += '？';
      }
    }

    return cleaned.length > 8 ? cleaned : null;
  }

  /**
   * 生成示例问题数据 (模拟真实爬取结果)
   */
  private generateSampleQuestions(category: string, source: string) {
    const questionTemplates = {
      '前端开发': [
        { title: 'JavaScript闭包的原理是什么？', company: '阿里巴巴', tags: ['javascript', '闭包'] },
        { title: 'Vue的生命周期有哪些？', company: '字节跳动', tags: ['vue', '生命周期'] },
        { title: 'React Hooks的使用场景', company: '腾讯', tags: ['react', 'hooks'] },
        { title: 'CSS盒模型的理解', company: '美团', tags: ['css', '盒模型'] },
        { title: 'HTTP和HTTPS的区别', company: '滴滴', tags: ['网络', 'http'] }
      ],
      '后端开发': [
        { title: 'Spring Boot的自动装配原理', company: '阿里巴巴', tags: ['spring', '自动装配'] },
        { title: 'MySQL索引的优化策略', company: '字节跳动', tags: ['mysql', '索引'] },
        { title: 'Redis的持久化机制', company: '腾讯', tags: ['redis', '持久化'] },
        { title: 'JVM垃圾回收机制', company: '美团', tags: ['jvm', 'gc'] },
        { title: '分布式锁的实现方案', company: '滴滴', tags: ['分布式', '锁'] }
      ],
      '算法岗': [
        { title: '二叉树的遍历算法实现', company: 'Google', tags: ['二叉树', '遍历'] },
        { title: '动态规划解决背包问题', company: 'Microsoft', tags: ['动态规划', '背包'] },
        { title: '快速排序的时间复杂度分析', company: '字节跳动', tags: ['排序', '复杂度'] },
        { title: '图的最短路径算法', company: '阿里巴巴', tags: ['图', '最短路径'] },
        { title: 'LRU缓存淘汰算法实现', company: '腾讯', tags: ['缓存', 'lru'] }
      ]
    };

    const templates = questionTemplates[category as keyof typeof questionTemplates] || [];
    return templates.map(template => ({
      ...template,
      content: `关于"${template.title}"的详细解答和分析...`,
      url: `https://www.nowcoder.com/interview/${template.title.replace(/\s+/g, '-')}`
    }));
  }

  /**
   * 网站可用性检查（增强版）
   */
  async checkSiteAvailability(siteKey: string): Promise<boolean> {
    try {
      const config = this.siteConfigs[siteKey as keyof typeof this.siteConfigs];
      if (!config) return false;
      
      // 实际检查网站响应
      const testUrl = config.baseUrl;
      const response = await this.fetchWithCorsProxy(testUrl, { 
        method: 'HEAD',
        headers: { 'Accept': 'text/html' }
      });
      
      return response.ok;
    } catch (error) {
      console.error(`检查 ${siteKey} 可用性失败:`, error);
      return false;
    }
  }


  /**
   * 推断问题难度
   */
  private inferDifficulty(question: string, content?: string): 'easy' | 'medium' | 'hard' {
    const easyKeywords = ['是什么', '定义', '基本', '简单', '概念'];
    const hardKeywords = ['原理', '实现', '源码', '优化', '架构', '设计模式', '算法复杂度'];
    
    const text = `${question} ${content || ''}`.toLowerCase();
    
    if (hardKeywords.some(keyword => text.includes(keyword))) {
      return 'hard';
    } else if (easyKeywords.some(keyword => text.includes(keyword))) {
      return 'easy';
    }
    
    return 'medium';
  }

  /**
   * 推断问题类型
   */
  private inferQuestionType(question: string, content?: string): string {
    const text = `${question} ${content || ''}`.toLowerCase();
    
    if (text.includes('算法') || text.includes('数据结构')) return '算法题';
    if (text.includes('项目') || text.includes('经验')) return '项目经验';
    if (text.includes('原理') || text.includes('机制')) return '原理题';
    if (text.includes('优化') || text.includes('性能')) return '优化题';
    
    return '技术问题';
  }

  /**
   * 去重
   */
  private deduplicateQuestions(questions: CrawledQuestion[]): CrawledQuestion[] {
    const seen = new Set<string>();
    return questions.filter(q => {
      const key = q.question.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 质量过滤
   */
  private filterQuestionsByQuality(questions: CrawledQuestion[]): CrawledQuestion[] {
    return questions.filter(q => {
      // 长度过滤
      if (q.question.length < 10 || q.question.length > 300) return false;
      
      // 内容质量过滤
      if (q.question.includes('...') || q.question.includes('等等')) return false;
      
      // 必须包含问号或疑问词
      const hasQuestionMark = q.question.includes('？') || q.question.includes('?');
      const hasQuestionWord = /(?:什么|如何|怎样|为什么|哪些|如何|怎么)/.test(q.question);
      
      return hasQuestionMark || hasQuestionWord;
    });
  }

  /**
   * 获取支持的网站列表
   */
  getSupportedSites(): Array<{name: string, key: string, enabled: boolean}> {
    return Object.entries(this.siteConfigs).map(([key, config]) => ({
      name: config.name,
      key,
      enabled: config.enabled
    }));
  }


  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const webCrawlerService = new WebCrawlerService();
export default webCrawlerService;
export type { CrawlResult, CrawledQuestion, CrawlOptions };