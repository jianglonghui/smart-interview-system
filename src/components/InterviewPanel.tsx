import React, { useState, useEffect, useCallback } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ChevronDown,
  Star,
  RefreshCw,
  Library
} from 'lucide-react';
import clsx from 'clsx';
import aiService from '../services/aiService';
import TopicManager from './TopicManager';
import QuestionBankModal from './QuestionBankModal';
import { Question, Topic, InterviewRound } from '../types/interview';

interface InterviewPanelProps {
  resumeText: string;
  jobDescription?: string;
  onDataChange?: (data: any) => void;
  initialData?: any[];
  readOnly?: boolean;
}

const InterviewPanel: React.FC<InterviewPanelProps> = ({ 
  resumeText, 
  jobDescription, 
  onDataChange, 
  initialData, 
  readOnly = false 
}) => {
  const [rounds, setRounds] = useState<InterviewRound[]>(
    initialData || [
      { id: '1', name: '一面', topics: [] },
      { id: '2', name: '二面', topics: [] },
      { id: '3', name: '三面', topics: [] },
    ]
  );
  const [currentRoundId, setCurrentRoundId] = useState('1');
  const [isGeneratingRef, setIsGeneratingRef] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState<string | null>(null);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [selectedTopicForBank, setSelectedTopicForBank] = useState<string>('');

  const currentRound = rounds.find(r => r.id === currentRoundId) || rounds[0];

  // 计算统计数据
  useEffect(() => {
    const allQuestions = rounds.flatMap(r => r.topics.flatMap(t => t.questions));
    const answeredQuestions = allQuestions.filter(q => q.answer);
    const scoredQuestions = allQuestions.filter(q => q.score !== null);
    const avgScore = scoredQuestions.length > 0
      ? scoredQuestions.reduce((acc, q) => acc + (q.score || 0), 0) / scoredQuestions.length
      : 0;

    onDataChange?.({
      rounds,
      currentRound: currentRound.name,
      totalQuestions: allQuestions.length,
      answeredQuestions: answeredQuestions.length,
      scoredQuestions: scoredQuestions.length,
      overallScore: Math.round(avgScore)
    });
  }, [rounds, currentRound, onDataChange]);

  // 处理主题变化
  const handleTopicsChange = useCallback((topics: Topic[]) => {
    setRounds(prev => prev.map(round =>
      round.id === currentRoundId
        ? { ...round, topics }
        : round
    ));
  }, [currentRoundId]);

  // 添加问题到主题
  const addQuestionToTopic = useCallback((topicId: string) => {
    const newQuestion: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: '',
      answer: '',
      referenceAnswer: '',
      score: null,
      feedback: '',
    };

    setRounds(prev => prev.map(round =>
      round.id === currentRoundId
        ? {
            ...round,
            topics: round.topics.map(topic =>
              topic.id === topicId
                ? { ...topic, questions: [...topic.questions, newQuestion] }
                : topic
            )
          }
        : round
    ));
  }, [currentRoundId]);

  // 更新问题
  const updateQuestion = useCallback((questionId: string, field: keyof Question, value: any) => {
    setRounds(prev => prev.map(round =>
      round.id === currentRoundId
        ? {
            ...round,
            topics: round.topics.map(topic => ({
              ...topic,
              questions: topic.questions.map(q =>
                q.id === questionId ? { ...q, [field]: value } : q
              )
            }))
          }
        : round
    ));
  }, [currentRoundId]);

  // 删除问题
  const deleteQuestion = useCallback((questionId: string) => {
    if (window.confirm('确定要删除这个问题吗？')) {
      setRounds(prev => prev.map(round =>
        round.id === currentRoundId
          ? {
              ...round,
              topics: round.topics.map(topic => ({
                ...topic,
                questions: topic.questions.filter(q => q.id !== questionId)
              }))
            }
          : round
      ));
    }
  }, [currentRoundId]);

  // 生成参考答案
  const generateReferenceAnswer = useCallback(async (questionId: string) => {
    const question = currentRound.topics
      .flatMap(t => t.questions)
      .find(q => q.id === questionId);
    
    if (!question || !question.text.trim() || isGeneratingRef === questionId) return;

    setIsGeneratingRef(questionId);
    try {
      // 限制传入的简历文本长度，优化性能
      const limitedResumeText = resumeText.length > 800 
        ? resumeText.substring(0, 800) + '...' 
        : resumeText;
      
      const reference = await aiService.generateReferenceAnswer(question.text, limitedResumeText);
      updateQuestion(questionId, 'referenceAnswer', reference);
    } catch (error) {
      console.error('Failed to generate reference answer:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '生成参考答案失败，请重试';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请检查网络连接后重试';
        } else if (error.message.includes('failed')) {
          errorMessage = '服务暂时不可用，请稍后重试';
        }
      }
      alert(errorMessage);
    } finally {
      setIsGeneratingRef(null);
    }
  }, [currentRound.topics, resumeText, isGeneratingRef, updateQuestion]);

  // 评分答案
  const scoreAnswer = useCallback(async (questionId: string) => {
    const question = currentRound.topics
      .flatMap(t => t.questions)
      .find(q => q.id === questionId);
    
    if (!question || !question.answer.trim() || isScoring === questionId) return;

    setIsScoring(questionId);
    try {
      const result = await aiService.scoreAnswer(
        question.text,
        question.answer,
        question.referenceAnswer
      );
      updateQuestion(questionId, 'score', result.score);
      updateQuestion(questionId, 'feedback', result.feedback);
    } catch (error) {
      console.error('Failed to score answer:', error);
      alert('获取评分失败，请重试');
    } finally {
      setIsScoring(null);
    }
  }, [currentRound.topics, isScoring, updateQuestion]);

  // 打开题库
  const openQuestionBank = useCallback((topicName: string) => {
    setSelectedTopicForBank(topicName);
    setShowQuestionBank(true);
  }, []);

  // 从题库选择问题
  const handleSelectQuestions = useCallback((selectedQuestions: any[]) => {
    const topic = currentRound.topics.find(t => t.name === selectedTopicForBank);
    if (!topic) return;

    const newQuestions: Question[] = selectedQuestions.map(q => ({
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: q.question,
      answer: '',
      referenceAnswer: '',
      score: null,
      feedback: '',
    }));

    setRounds(prev => prev.map(round =>
      round.id === currentRoundId
        ? {
            ...round,
            topics: round.topics.map(t =>
              t.id === topic.id
                ? { ...t, questions: [...t.questions, ...newQuestions] }
                : t
            )
          }
        : round
    ));
  }, [currentRound.topics, selectedTopicForBank, currentRoundId]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b px-6 py-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">面试管理</h2>
        
        {/* 轮次选择 - 使用Tabs组件 */}
        <Tabs.Root value={currentRoundId} onValueChange={setCurrentRoundId}>
          <Tabs.List className="flex gap-2">
            {rounds.map(round => (
              <Tabs.Trigger
                key={round.id}
                value={round.id}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-all',
                  'hover:bg-gray-100',
                  'data-[state=active]:bg-blue-500 data-[state=active]:text-white'
                )}
              >
                {round.name}
                <span className="ml-2 text-xs opacity-80">
                  ({round.topics.reduce((acc, t) => acc + t.questions.length, 0)}题)
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-6">
        {!readOnly && (
          <div className="mb-6">
            <TopicManager
              topics={currentRound.topics}
              onTopicsChange={handleTopicsChange}
              resumeText={resumeText}
              jobDescription={jobDescription || ''}
            />
          </div>
        )}

        {currentRound.topics.length > 0 && (
          <Accordion.Root type="multiple" className="space-y-4">
            <AnimatePresence>
              {currentRound.topics.map((topic, topicIndex) => (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: topicIndex * 0.1 }}
                >
                  <Accordion.Item
                    value={topic.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    <Accordion.Header>
                      <Accordion.Trigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <ChevronDown className="text-gray-500 group-data-[state=open]:rotate-180 transition-transform" size={20} />
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-800">{topic.name}</h3>
                            <p className="text-sm text-gray-500">{topic.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                            {topic.questions.length} 题
                          </span>
                          {topic.questions.filter(q => q.score !== null).length > 0 && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                              {topic.questions.filter(q => q.score !== null).length} 已评分
                            </span>
                          )}
                        </div>
                      </Accordion.Trigger>
                    </Accordion.Header>

                    <Accordion.Content className="px-4 pb-4">
                      {!readOnly && (
                        <div className="flex gap-2 mt-4 mb-4">
                          <button
                            onClick={() => openQuestionBank(topic.name)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <Library size={16} />
                            从题库选择
                          </button>
                          <button
                            onClick={() => addQuestionToTopic(topic.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            <Plus size={16} />
                            手动添加问题
                          </button>
                        </div>
                      )}

                      {topic.questions.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          暂无问题，请添加面试问题
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {topic.questions.map((question, qIndex) => (
                            <motion.div
                              key={question.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: qIndex * 0.05 }}
                              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                            >
                              {/* 问题头部 */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-600">
                                    问题 {qIndex + 1}
                                  </span>
                                  {question.score !== null && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded">
                                      <Star size={14} className="text-yellow-600" />
                                      <span className="text-sm font-medium text-yellow-700">
                                        {question.score}分
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {!readOnly && (
                                  <button
                                    onClick={() => deleteQuestion(question.id)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>

                              {/* 问题内容 */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-sm font-medium text-gray-700 block mb-1">
                                    面试问题
                                  </label>
                                  <textarea
                                    value={question.text}
                                    onChange={e => updateQuestion(question.id, 'text', e.target.value)}
                                    placeholder="输入面试问题..."
                                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                    readOnly={readOnly}
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-medium text-gray-700 block mb-1">
                                    候选人回答
                                  </label>
                                  <textarea
                                    value={question.answer}
                                    onChange={e => updateQuestion(question.id, 'answer', e.target.value)}
                                    placeholder="记录候选人的回答..."
                                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    readOnly={readOnly}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium text-gray-700">
                                      AI 参考答案
                                    </label>
                                    {!readOnly && (
                                      <button
                                        onClick={() => generateReferenceAnswer(question.id)}
                                        disabled={isGeneratingRef === question.id || !question.text}
                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                      >
                                        {isGeneratingRef === question.id ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <RefreshCw size={14} />
                                        )}
                                        生成参考
                                      </button>
                                    )}
                                  </div>
                                  <textarea
                                    value={question.referenceAnswer}
                                    onChange={e => updateQuestion(question.id, 'referenceAnswer', e.target.value)}
                                    placeholder="AI 参考答案..."
                                    className="w-full p-3 bg-green-50 border border-green-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                                    rows={3}
                                    readOnly={readOnly}
                                  />
                                </div>

                                {question.answer && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-sm font-medium text-gray-700">
                                        AI 评分与反馈
                                      </label>
                                      {!readOnly && (
                                        <button
                                          onClick={() => scoreAnswer(question.id)}
                                          disabled={isScoring === question.id}
                                          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
                                        >
                                          {isScoring === question.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : (
                                            <Star size={14} />
                                          )}
                                          获取评分
                                        </button>
                                      )}
                                    </div>
                                    {question.feedback && (
                                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {question.feedback}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </Accordion.Content>
                  </Accordion.Item>
                </motion.div>
              ))}
            </AnimatePresence>
          </Accordion.Root>
        )}
      </div>

      {/* 题库弹窗 */}
      {showQuestionBank && (
        <QuestionBankModal
          isOpen={showQuestionBank}
          onClose={() => setShowQuestionBank(false)}
          onSelectQuestions={handleSelectQuestions}
          selectedCategory={selectedTopicForBank}
        />
      )}
    </div>
  );
};

export default InterviewPanel;