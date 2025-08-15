import React, { useState, useEffect } from 'react';
import { X, Calendar, Briefcase, Trash2, Eye, ArrowLeft, Edit } from 'lucide-react';
import ResizablePanel from './ResizablePanel';
import InterviewPanel from './InterviewPanel';
import { InterviewRecord } from '../types/interview';

interface InterviewRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueInterview?: (record: InterviewRecord) => void;
}

const InterviewRecordsModal: React.FC<InterviewRecordsModalProps> = ({
  isOpen,
  onClose,
  onContinueInterview
}) => {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<InterviewRecord | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [interviewData, setInterviewData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const savedRecords = JSON.parse(localStorage.getItem('interviewRecords') || '[]');
      setRecords(savedRecords);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: number) => {
    const updatedRecords = records.filter(r => r.id !== id);
    setRecords(updatedRecords);
    localStorage.setItem('interviewRecords', JSON.stringify(updatedRecords));
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewDetail = (record: InterviewRecord) => {
    setSelectedRecord(record);
    setViewMode('detail');
  };

  const handleContinueInterview = (record: InterviewRecord) => {
    if (onContinueInterview) {
      onContinueInterview(record);
      onClose();
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedRecord(null);
  };

  if (!isOpen) return null;

  if (viewMode === 'detail' && selectedRecord) {
    return (
      <div className="fixed inset-0 bg-white z-50">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToList}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft size={18} />
                <span>返回记录列表</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">面试记录详情</h1>
                <p className="text-sm text-gray-600">查看时间：{formatDate(selectedRecord.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!selectedRecord?.isCompleted && (
                <button
                  onClick={() => handleContinueInterview(selectedRecord!)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  <span>继续面试</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </header>
        
        <div className="h-[calc(100vh-160px)]">
          <ResizablePanel
            leftContent={
              <div className="h-full flex flex-col p-4">
                <h2 className="text-xl font-bold mb-4 text-gray-800">候选人简历</h2>
                
                {selectedRecord.jobDescription && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">岗位描述</h3>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">{selectedRecord.jobDescription}</div>
                  </div>
                )}
                
                <div className="mb-4 flex-1 flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">简历内容</label>
                  <div className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-lg overflow-auto">
                    <div className="whitespace-pre-wrap text-sm text-gray-700">{selectedRecord.resumeText}</div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">面试统计</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>当前轮次：{selectedRecord.currentRound || '未知'}</div>
                    <div>问题总数：{selectedRecord.totalQuestions || 0}</div>
                    <div>已回答：{selectedRecord.answeredQuestions || 0}</div>
                    <div>已评分：{selectedRecord.scoredQuestions || 0}</div>
                    <div className="text-lg font-bold text-green-600">综合评分：{selectedRecord.overallScore || 0} 分</div>
                  </div>
                </div>
              </div>
            }
            rightContent={
              <InterviewPanel 
                resumeText={selectedRecord.resumeText}
                jobDescription={selectedRecord.jobDescription}
                initialData={selectedRecord.rounds}
                readOnly={selectedRecord.isCompleted || false}
                onDataChange={setInterviewData}
              />
            }
            defaultLeftWidth={25}
            minLeftWidth={20}
            maxLeftWidth={40}
          />
        </div>
        
        {!selectedRecord.isCompleted && (
          <footer className="h-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                // 保存当前编辑的记录，包含最新的面试数据
                const updatedRecord = {
                  ...selectedRecord,
                  ...interviewData,
                  date: new Date().toISOString()
                };
                
                const existingRecords = JSON.parse(localStorage.getItem('interviewRecords') || '[]');
                const updatedRecords = existingRecords.map((r: any) => r.id === selectedRecord.id ? updatedRecord : r);
                localStorage.setItem('interviewRecords', JSON.stringify(updatedRecords));
                
                // 更新本地状态
                setSelectedRecord(updatedRecord);
                setRecords(updatedRecords);
                
                alert('面试记录已保存');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <span>保存记录</span>
            </button>
            
            <button
              onClick={() => {
                // 标记面试为完成状态并保存，包含最新的面试数据
                const completedRecord = {
                  ...selectedRecord,
                  ...interviewData,
                  isCompleted: true,
                  date: new Date().toISOString()
                };
                
                const existingRecords = JSON.parse(localStorage.getItem('interviewRecords') || '[]');
                const updatedRecords = existingRecords.map((r: any) => r.id === selectedRecord.id ? completedRecord : r);
                localStorage.setItem('interviewRecords', JSON.stringify(updatedRecords));
                
                // 更新本地状态
                setSelectedRecord(completedRecord);
                setRecords(updatedRecords);
                
                alert('面试已完成并保存');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <span>完成面试</span>
            </button>
          </footer>
        )}
        
        {selectedRecord.isCompleted && (
          <footer className="h-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center">
            <div className="flex items-center gap-2 px-6 py-3 bg-orange-100 text-orange-800 rounded-lg font-medium">
              <span>面试已完成</span>
            </div>
          </footer>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[900px] h-[600px] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">面试记录</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 border-r overflow-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">记录列表</h3>
              {records.length === 0 ? (
                <p className="text-gray-400 text-center py-8">暂无面试记录</p>
              ) : (
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 border rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar size={12} />
                          <span>{formatDate(record.date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!record.isCompleted && (
                            <button
                              onClick={() => handleContinueInterview(record)}
                              className="p-1 hover:bg-green-100 rounded transition-colors"
                              title="继续面试"
                            >
                              <Edit size={14} className="text-green-500" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewDetail(record)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title={record.isCompleted ? '查看详情' : '继续编辑'}
                          >
                            <Eye size={14} className="text-blue-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(record.id);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="删除记录"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate">
                          面试记录 #{record.id}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          record.isCompleted 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {record.isCompleted ? '已完成' : '进行中'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Briefcase size={12} />
                          <span className="truncate">评分: {record.overallScore || 0}分</span>
                        </div>
                        <span className="text-xs text-gray-500">{record.currentRound || '一面'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="text-center text-gray-500">
              <p>点击记录右侧的 <Eye className="inline" size={16} /> 按钮查看完整面试界面</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRecordsModal;