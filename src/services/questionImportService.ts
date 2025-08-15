import aiService from './aiService';

export interface ImportedQuestion {
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
  source: string;
  tags: string[];
}

export interface ImportOptions {
  category: string;
  company?: string;
  position?: string;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

class QuestionImportService {
  private readonly popularCompanies = [
    '阿里巴巴', '腾讯', '字节跳动', '美团', '滴滴', '京东', 
    '百度', '网易', '小米', '华为', '拼多多', '快手',
    'Google', 'Microsoft', 'Amazon', 'Apple', 'Facebook'
  ];

  private readonly questionTypes = {
    '前端开发': ['JavaScript基础', 'Vue/React框架', 'CSS布局', '浏览器原理', '性能优化', '工程化'],
    '后端开发': ['Java基础', 'Spring框架', '数据库', '缓存', '消息队列', '微服务'],
    '算法岗': ['数据结构', '算法设计', '动态规划', '贪心算法', '图论', '字符串'],
    '产品经理': ['产品设计', '用户体验', '数据分析', '竞品分析', '项目管理'],
    '数据分析': ['SQL', 'Python', '统计学', '机器学习', '数据挖掘', '可视化'],
    '运维开发': ['Linux', 'Docker', 'Kubernetes', '监控', '自动化', '网络'],
    '测试开发': ['测试理论', '自动化测试', '性能测试', '测试工具', '质量保证']
  };

  async importQuestionsByCategory(options: ImportOptions): Promise<ImportedQuestion[]> {
    const { category, company, position, count = 20, difficulty = 'mixed' } = options;
    
    try {
      const questions = await this.generateQuestionsWithAI(options);
      return this.processAndValidateQuestions(questions, category);
    } catch (error) {
      console.error('Failed to import questions:', error);
      throw new Error('导入题目失败，请重试');
    }
  }

  private async generateQuestionsWithAI(options: ImportOptions): Promise<any[]> {
    const { category, company, position, count, difficulty } = options;
    
    const difficultyDistribution = this.getDifficultyDistribution(difficulty!, count!);
    const subCategories = this.questionTypes[category as keyof typeof this.questionTypes] || [category];
    
    const prompt = `请生成${count}道${category}相关的面试真题，要求：

1. 题目来源要真实可信，模拟来自知名公司如${company || this.getRandomCompanies()}的实际面试
2. 题目类型包含：${subCategories.join('、')}
3. 难度分布：
   - 简单题：${difficultyDistribution.easy}道
   - 中等题：${difficultyDistribution.medium}道  
   - 困难题：${difficultyDistribution.hard}道
4. ${position ? `针对${position}岗位特点` : '适合该领域从业者'}

请以JSON数组格式返回，每个题目包含以下字段：
{
  "question": "具体面试问题",
  "category": "${category}",
  "difficulty": "easy/medium/hard",
  "type": "问题类型（如技术问题、项目经验、算法题等）",
  "source": "模拟来源公司",
  "tags": ["相关标签1", "相关标签2"],
  "explanation": "题目考察要点说明"
}

要求题目具有以下特点：
- 真实性：模拟真实面试场景
- 实用性：考察实际工作能力
- 多样性：覆盖不同知识点
- 层次性：难度递进合理

请确保返回有效的JSON格式，不要包含任何其他文本。`;

    const response = await aiService.generateResponse(prompt, { maxTokens: 4000 });
    return this.parseAIResponse(response);
  }

  private parseAIResponse(response: string): any[] {
    try {
      // 清理响应文本
      let cleanResponse = response.trim();
      
      // 移除可能的markdown代码块标记
      cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
      
      // 尝试找到JSON数组的开始和结束
      const arrayStart = cleanResponse.indexOf('[');
      const arrayEnd = cleanResponse.lastIndexOf(']') + 1;
      
      if (arrayStart >= 0 && arrayEnd > arrayStart) {
        cleanResponse = cleanResponse.substring(arrayStart, arrayEnd);
      }
      
      const questions = JSON.parse(cleanResponse);
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
      
      return questions;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.log('Raw response:', response);
      
      // 如果解析失败，返回一些默认题目
      return this.getFallbackQuestions(response);
    }
  }

  private getFallbackQuestions(originalResponse: string): any[] {
    // 尝试从响应中提取问题文本
    const lines = originalResponse.split('\n').filter(line => 
      line.trim() && 
      (line.includes('问') || line.includes('？') || line.includes('?'))
    );
    
    return lines.slice(0, 10).map((line, index) => ({
      question: line.trim().replace(/^\d+[.\-)\s]*/, ''),
      category: '通用',
      difficulty: index < 3 ? 'easy' : index < 7 ? 'medium' : 'hard',
      type: '技术问题',
      source: '智能生成',
      tags: ['面试', '基础'],
      explanation: '从AI响应中提取的问题'
    }));
  }

  private processAndValidateQuestions(questions: any[], category: string): ImportedQuestion[] {
    return questions
      .filter(q => q && q.question && typeof q.question === 'string')
      .map(q => ({
        question: q.question.trim(),
        category: q.category || category,
        difficulty: this.validateDifficulty(q.difficulty),
        type: q.type || '技术问题',
        source: q.source || '智能导入',
        tags: Array.isArray(q.tags) ? q.tags : [category]
      }))
      .filter(q => q.question.length > 10 && q.question.length < 500) // 过滤长度
      .slice(0, 50); // 限制数量
  }

  private validateDifficulty(difficulty: string): 'easy' | 'medium' | 'hard' {
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (validDifficulties.includes(difficulty)) {
      return difficulty as 'easy' | 'medium' | 'hard';
    }
    
    // 根据关键词判断难度
    const lowerDifficulty = difficulty?.toLowerCase() || '';
    if (lowerDifficulty.includes('简单') || lowerDifficulty.includes('基础')) {
      return 'easy';
    } else if (lowerDifficulty.includes('困难') || lowerDifficulty.includes('高级')) {
      return 'hard';
    }
    return 'medium';
  }

  private getDifficultyDistribution(difficulty: string, count: number) {
    switch (difficulty) {
      case 'easy':
        return { easy: count, medium: 0, hard: 0 };
      case 'medium':
        return { easy: 0, medium: count, hard: 0 };
      case 'hard':
        return { easy: 0, medium: 0, hard: count };
      default: // mixed
        return {
          easy: Math.ceil(count * 0.4),
          medium: Math.ceil(count * 0.4),
          hard: Math.floor(count * 0.2)
        };
    }
  }

  private getRandomCompanies(): string {
    const shuffled = [...this.popularCompanies].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).join('、');
  }

  // 检测题目重复
  async detectDuplicates(newQuestions: ImportedQuestion[], existingQuestions: ImportedQuestion[]): Promise<ImportedQuestion[]> {
    const unique: ImportedQuestion[] = [];
    const existingTexts = new Set(existingQuestions.map(q => q.question.toLowerCase().trim()));
    
    for (const question of newQuestions) {
      const questionText = question.question.toLowerCase().trim();
      
      // 简单的文本相似度检查
      let isDuplicate = false;
      
      if (existingTexts.has(questionText)) {
        isDuplicate = true;
      } else {
        // 检查高相似度（90%以上相同字符）
        existingTexts.forEach(existing => {
          if (this.calculateSimilarity(questionText, existing) > 0.9) {
            isDuplicate = true;
            return;
          }
        });
      }
      
      if (!isDuplicate) {
        unique.push(question);
        existingTexts.add(questionText);
      }
    }
    
    return unique;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // 获取可用的题目类别
  getAvailableCategories(): string[] {
    return Object.keys(this.questionTypes);
  }

  // 获取热门公司列表
  getPopularCompanies(): string[] {
    return [...this.popularCompanies];
  }
}

const questionImportService = new QuestionImportService();
export default questionImportService;