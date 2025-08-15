import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Bot, Loader2, Search, Download, Globe } from 'lucide-react';
import aiService from '../services/aiService';
import questionImportService, { ImportOptions } from '../services/questionImportService';
import { interviewApi, CrawlOptions } from '../services/api/interviewApi';
import { QuestionBankItem } from '../types/interview';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestions: (questions: QuestionBankItem[]) => void;
  selectedCategory?: string;
}

const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  onSelectQuestions,
  selectedCategory
}) => {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState(selectedCategory || '');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    category: selectedCategory || '前端开发',
    company: '',
    position: '',
    count: 20,
    difficulty: 'mixed'
  });
  const [isCrawling, setIsCrawling] = useState(false);
  const [showCrawlerModal, setShowCrawlerModal] = useState(false);
  const [crawlOptions, setCrawlOptions] = useState<CrawlOptions>({
    category: selectedCategory || '前端开发',
    maxQuestions: 20,
    targetSites: ['nowcoder', 'csdn'],
    keywords: []
  });
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    category: selectedCategory || '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    type: '技术问题'
  });

  useEffect(() => {
    if (isOpen) {
      loadQuestions();
    }
  }, [isOpen]);

  const loadQuestions = () => {
    const saved = localStorage.getItem('questionBank');
    if (saved) {
      setQuestions(JSON.parse(saved));
    }
  };

  const saveQuestions = (newQuestions: QuestionBankItem[]) => {
    localStorage.setItem('questionBank', JSON.stringify(newQuestions));
    setQuestions(newQuestions);
  };

  const generateQuestionsForCategory = async (category: string) => {
    setIsGenerating(true);
    try {
      const prompt = `为"${category}"这个面试考察主题生成15个不同难度的面试问题。
      请包含：
      - 5个简单问题（基础概念、定义）
      - 7个中等问题（实际应用、经验）
      - 3个困难问题（深度思考、复杂场景）
      
      每个问题单独一行，格式：[难度] 问题内容
      例如：[简单] 什么是闭包？`;

      const response = await aiService.generateResponse(prompt);
      const lines = response.split('\n').filter(line => line.trim());
      
      const newQuestions: QuestionBankItem[] = lines.map((line, index) => {
        let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
        let questionText = line.trim();
        
        if (line.includes('[简单]') || line.includes('[easy]')) {
          difficulty = 'easy';
          questionText = line.replace(/\[简单\]|\[easy\]/i, '').trim();
        } else if (line.includes('[困难]') || line.includes('[hard]')) {
          difficulty = 'hard';
          questionText = line.replace(/\[困难\]|\[hard\]/i, '').trim();
        } else if (line.includes('[中等]') || line.includes('[medium]')) {
          difficulty = 'medium';
          questionText = line.replace(/\[中等\]|\[medium\]/i, '').trim();
        }
        
        return {
          id: `${Date.now()}-${index}`,
          question: questionText,
          category: category,
          difficulty,
          type: '技术问题'
        };
      });

      const updatedQuestions = [...questions, ...newQuestions];
      saveQuestions(updatedQuestions);
    } catch (error) {
      console.error('生成问题失败:', error);
      alert('生成问题失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const smartImportQuestions = async () => {
    setIsImporting(true);
    try {
      // 导入新问题
      const importedQuestions = await questionImportService.importQuestionsByCategory(importOptions);

      // 检测重复问题
      const uniqueQuestions = await questionImportService.detectDuplicates(importedQuestions, 
        questions.map(q => ({ ...q, tags: [], source: '题库' }))
      );
      
      const finalQuestions: QuestionBankItem[] = uniqueQuestions.map((q, index) => ({
        id: `import-${Date.now()}-${index}`,
        question: q.question,
        category: q.category,
        difficulty: q.difficulty,
        type: q.type
      }));

      const updatedQuestions = [...questions, ...finalQuestions];
      saveQuestions(updatedQuestions);
      
      alert(`成功导入 ${finalQuestions.length} 道问题！${importedQuestions.length - finalQuestions.length > 0 ? 
        `过滤了 ${importedQuestions.length - finalQuestions.length} 道重复问题。` : ''}`);
      
      setShowImportModal(false);
    } catch (error) {
      console.error('智能导入失败:', error);
      alert('智能导入失败，请重试');
    } finally {
      setIsImporting(false);
    }
  };

  const crawlRealQuestions = async () => {
    setIsCrawling(true);
    try {
      console.log('开始爬取真题...', crawlOptions);
      
      // Check backend health first
      const isHealthy = await interviewApi.checkHealth();
      if (!isHealthy) {
        throw new Error('后端服务未启动，请先启动后端服务（cd server && npm run dev）');
      }
      
      // Use new backend API
      const crawlResult = await interviewApi.crawlQuestions(crawlOptions);
      
      if (!crawlResult.success) {
        throw new Error(crawlResult.error || '爬取失败');
      }

      // Convert to QuestionBankItem format
      const finalQuestions: QuestionBankItem[] = crawlResult.questions.map((q, index) => ({
        id: `crawl-${Date.now()}-${index}`,
        question: q.question,
        category: q.category,
        difficulty: q.difficulty,
        type: q.type
      }));

      // Check for duplicates
      const existingQuestionTexts = new Set(questions.map(q => q.question.toLowerCase()));
      const uniqueQuestions = finalQuestions.filter(q => 
        !existingQuestionTexts.has(q.question.toLowerCase())
      );

      const updatedQuestions = [...questions, ...uniqueQuestions];
      saveQuestions(updatedQuestions);
      
      // Get source information
      const sources = new Set(crawlResult.questions.map(q => q.source));
      const sourceArray = Array.from(sources);
      const sourceInfo = crawlResult.questions.length > 0 ? 
        `来源：${sourceArray.join('、')}` : '';
      
      const cacheInfo = crawlResult.cached ? '（来自缓存）' : '';
      
      alert(`🎉 成功爬取 ${uniqueQuestions.length} 道真题！${cacheInfo}\n${sourceInfo}\n${
        finalQuestions.length - uniqueQuestions.length > 0 ? 
        `过滤了 ${finalQuestions.length - uniqueQuestions.length} 道重复题目` : ''
      }`);
      
      setShowCrawlerModal(false);
    } catch (error) {
      console.error('爬取失败:', error);
      alert(`爬取失败: ${error instanceof Error ? error.message : '未知错误'}\n请检查网络连接或稍后重试`);
    } finally {
      setIsCrawling(false);
    }
  };

  const addQuestion = () => {
    if (!newQuestion.question.trim()) return;
    
    const question: QuestionBankItem = {
      id: Date.now().toString(),
      ...newQuestion
    };
    
    const updatedQuestions = [...questions, question];
    saveQuestions(updatedQuestions);
    setNewQuestion({
      question: '',
      category: selectedCategory || '',
      difficulty: 'medium',
      type: '技术问题'
    });
  };

  const deleteQuestion = (id: string) => {
    const updatedQuestions = questions.filter(q => q.id !== id);
    saveQuestions(updatedQuestions);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedQuestions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedQuestions(newSelection);
  };

  const handleSelectQuestions = () => {
    const selected = questions.filter(q => selectedQuestions.has(q.id));
    onSelectQuestions(selected);
    onClose();
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || q.category === filterCategory;
    const matchesDifficulty = !filterDifficulty || q.difficulty === filterDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const categories = Array.from(new Set(questions.map(q => q.category)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[1000px] h-[700px] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">题库管理</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：题库列表 */}
          <div className="w-2/3 border-r flex flex-col">
            {/* 搜索和筛选 */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex gap-2 mb-2">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索问题..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="">所有类别</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="">所有难度</option>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
                {selectedCategory && (
                  <button
                    onClick={() => generateQuestionsForCategory(selectedCategory)}
                    disabled={isGenerating}
                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Bot size={14} />
                    )}
                    AI生成
                  </button>
                )}
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={isImporting}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  智能导入
                </button>
                <button
                  onClick={() => setShowCrawlerModal(true)}
                  disabled={isCrawling}
                  className="flex items-center gap-1 px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                >
                  {isCrawling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Globe size={14} />
                  )}
                  爬取真题
                </button>
              </div>
            </div>

            {/* 问题列表 */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {filteredQuestions.map(q => (
                  <div
                    key={q.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedQuestions.has(q.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleSelection(q.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{q.question}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-200 px-2 py-1 rounded">{q.category}</span>
                          <span className={`px-2 py-1 rounded ${
                            q.difficulty === 'easy' ? 'bg-green-200 text-green-700' :
                            q.difficulty === 'medium' ? 'bg-yellow-200 text-yellow-700' :
                            'bg-red-200 text-red-700'
                          }`}>
                            {q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuestion(q.id);
                        }}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-4 border-t flex justify-between">
              <span className="text-sm text-gray-600">
                已选择 {selectedQuestions.size} 个问题
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  取消
                </button>
                <button
                  onClick={handleSelectQuestions}
                  disabled={selectedQuestions.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  添加到面试
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：添加问题 */}
          <div className="w-1/3 p-4">
            <h3 className="text-lg font-medium mb-4">添加新问题</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">问题内容</label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
                  placeholder="输入面试问题..."
                  className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">类别</label>
                <input
                  type="text"
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion({...newQuestion, category: e.target.value})}
                  placeholder="考察主题..."
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">难度</label>
                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({...newQuestion, difficulty: e.target.value as 'easy' | 'medium' | 'hard'})}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
              <button
                onClick={addQuestion}
                disabled={!newQuestion.question.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                <Plus size={16} />
                添加问题
              </button>
            </div>
          </div>
        </div>

        {/* 智能导入弹窗 */}
        {showImportModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg w-[500px] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe size={20} className="text-blue-500" />
                  智能导入真题
                </h3>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">题目类别</label>
                  <select
                    value={importOptions.category}
                    onChange={(e) => setImportOptions({...importOptions, category: e.target.value})}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {questionImportService.getAvailableCategories().map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">目标公司（可选）</label>
                    <select
                      value={importOptions.company || ''}
                      onChange={(e) => setImportOptions({...importOptions, company: e.target.value})}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">随机公司</option>
                      {questionImportService.getPopularCompanies().map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">岗位（可选）</label>
                    <input
                      type="text"
                      value={importOptions.position || ''}
                      onChange={(e) => setImportOptions({...importOptions, position: e.target.value})}
                      placeholder="如：高级前端工程师"
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">导入数量</label>
                    <select
                      value={importOptions.count}
                      onChange={(e) => setImportOptions({...importOptions, count: parseInt(e.target.value)})}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10 道题</option>
                      <option value={20}>20 道题</option>
                      <option value={30}>30 道题</option>
                      <option value={50}>50 道题</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">难度分布</label>
                    <select
                      value={importOptions.difficulty}
                      onChange={(e) => setImportOptions({...importOptions, difficulty: e.target.value as any})}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="mixed">混合难度</option>
                      <option value="easy">仅简单题</option>
                      <option value="medium">仅中等题</option>
                      <option value="hard">仅困难题</option>
                    </select>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  <p><strong>功能说明：</strong></p>
                  <p>• 基于AI生成模拟真实面试场景的题目</p>
                  <p>• 自动过滤重复题目，确保题库质量</p>
                  <p>• 涵盖多种难度和题型，适合不同水平候选人</p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={smartImportQuestions}
                    disabled={isImporting}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        开始导入
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 真题爬取弹窗 */}
        {showCrawlerModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg w-[600px] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe size={20} className="text-purple-500" />
                  爬取面试真题
                </h3>
                <button 
                  onClick={() => setShowCrawlerModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">题目类别</label>
                    <select
                      value={crawlOptions.category}
                      onChange={(e) => setCrawlOptions({...crawlOptions, category: e.target.value})}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="前端开发">前端开发</option>
                      <option value="后端开发">后端开发</option>
                      <option value="算法岗">算法岗</option>
                      <option value="产品经理">产品经理</option>
                      <option value="数据分析">数据分析</option>
                      <option value="运维开发">运维开发</option>
                      <option value="测试开发">测试开发</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">爬取数量</label>
                    <select
                      value={crawlOptions.maxQuestions}
                      onChange={(e) => setCrawlOptions({...crawlOptions, maxQuestions: parseInt(e.target.value)})}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={10}>10 道题</option>
                      <option value={20}>20 道题</option>
                      <option value={30}>30 道题</option>
                      <option value={50}>50 道题</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">目标网站</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'nowcoder', name: '牛客网', enabled: true },
                      { key: 'csdn', name: 'CSDN', enabled: true },
                      { key: 'juejin', name: '掘金', enabled: true }
                    ].map(site => (
                      <label key={site.key} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={crawlOptions.targetSites?.includes(site.key) || false}
                          onChange={(e) => {
                            const currentSites = crawlOptions.targetSites || [];
                            if (e.target.checked) {
                              setCrawlOptions({
                                ...crawlOptions,
                                targetSites: [...currentSites, site.key]
                              });
                            } else {
                              setCrawlOptions({
                                ...crawlOptions,
                                targetSites: currentSites.filter((s: string) => s !== site.key)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{site.name}</span>
                        {!site.enabled && (
                          <span className="text-xs text-gray-400">(维护中)</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">自定义关键词（可选）</label>
                  <input
                    type="text"
                    value={crawlOptions.keywords?.join(', ') || ''}
                    onChange={(e) => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                      setCrawlOptions({...crawlOptions, keywords});
                    }}
                    placeholder="如：Spring Boot, 微服务, Redis"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">多个关键词用逗号分隔，留空则使用默认关键词</p>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800 mb-2">🔍 爬取说明</h4>
                  <ul className="text-xs text-purple-700 space-y-1">
                    <li>• 从多个招聘网站实时爬取最新面试真题</li>
                    <li>• 自动过滤低质量和重复问题，确保题库质量</li>
                    <li>• 支持按公司和难度筛选，获得精准题目</li>
                    <li>• 爬取过程可能需要10-30秒，请耐心等待</li>
                  </ul>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCrawlerModal(false)}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={crawlRealQuestions}
                    disabled={isCrawling || crawlOptions.targetSites.length === 0}
                    className="flex-1 py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCrawling ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        爬取中...
                      </>
                    ) : (
                      <>
                        <Globe size={16} />
                        开始爬取
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBankModal;