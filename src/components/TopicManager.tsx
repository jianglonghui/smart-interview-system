import React, { useState } from 'react';
import { Plus, Trash2, Edit, Bot, Loader2 } from 'lucide-react';
import aiService from '../services/aiService';
import { Topic } from '../types/interview';

interface TopicManagerProps {
  topics: Topic[];
  onTopicsChange: (topics: Topic[]) => void;
  resumeText: string;
  jobDescription: string;
}

const TopicManager: React.FC<TopicManagerProps> = ({
  topics,
  onTopicsChange,
  resumeText,
  jobDescription
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const generateTopics = async () => {
    setIsGenerating(true);
    try {
      const prompt = `基于以下简历和职位要求，生成5-8个面试考察主题。
      
      职位要求：
      ${jobDescription || '通用技术岗位'}
      
      候选人简历：
      ${resumeText}
      
      请生成考察主题，每个主题一行，格式：主题名称 - 简短描述
      例如：
      技术基础 - 考察编程语言基础知识和核心概念
      项目经验 - 了解候选人的实际项目开发经验
      `;

      const response = await aiService.generateResponse(prompt);
      const lines = response.split('\n').filter(line => line.trim() && line.includes(' - '));
      
      const newTopics: Topic[] = lines.map((line, index) => {
        const [name, description] = line.split(' - ');
        return {
          id: `topic-${Date.now()}-${index}`,
          name: name.trim(),
          description: description.trim(),
          questions: []
        };
      });

      onTopicsChange([...topics, ...newTopics]);
    } catch (error) {
      console.error('生成主题失败:', error);
      alert('生成主题失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const addTopic = () => {
    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      name: '新考察主题',
      description: '描述这个主题的考察内容',
      questions: []
    };
    onTopicsChange([...topics, newTopic]);
    setEditingTopic(newTopic.id);
    setEditValue(newTopic.name);
  };

  const deleteTopic = (topicId: string) => {
    const updatedTopics = topics.filter(t => t.id !== topicId);
    onTopicsChange(updatedTopics);
  };

  const startEdit = (topic: Topic) => {
    setEditingTopic(topic.id);
    setEditValue(topic.name);
  };

  const saveEdit = () => {
    if (!editingTopic || !editValue.trim()) return;
    
    const updatedTopics = topics.map(topic =>
      topic.id === editingTopic
        ? { ...topic, name: editValue.trim() }
        : topic
    );
    onTopicsChange(updatedTopics);
    setEditingTopic(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingTopic(null);
    setEditValue('');
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-800">考察主题</h3>
        <div className="flex gap-2">
          <button
            onClick={generateTopics}
            disabled={isGenerating || !resumeText}
            className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Bot size={14} />
            )}
            AI生成主题
          </button>
          <button
            onClick={addTopic}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            <Plus size={14} />
            添加主题
          </button>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
          <div className="flex flex-col items-center gap-3">
            <Bot className="text-gray-400" size={32} />
            <div>
              <p className="font-medium">还没有考察主题</p>
              <p className="text-sm text-gray-400 mt-1">使用AI生成或手动添加考察主题开始面试</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 mb-2">
            已添加 {topics.length} 个考察主题
          </div>
          <div className="grid gap-2">
            {topics.map(topic => (
              <div key={topic.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-1">
                  {editingTopic === topic.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                        onBlur={saveEdit}
                        autoFocus
                      />
                      <button
                        onClick={saveEdit}
                        className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-gray-800">{topic.name}</div>
                      <div className="text-sm text-gray-600">{topic.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {topic.questions.length} 个问题
                      </div>
                    </div>
                  )}
                </div>
                {editingTopic !== topic.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(topic)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => deleteTopic(topic.id)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicManager;