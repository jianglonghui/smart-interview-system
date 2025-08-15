import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Briefcase } from 'lucide-react';
import ResizablePanel from './components/ResizablePanel';
import ResumePanel from './components/ResumePanel';
import InterviewPanel from './components/InterviewPanel';
import JobSettingsModal from './components/JobSettingsModal';
import InterviewRecordsModal from './components/InterviewRecordsModal';
import './App.css';

function App() {
  const [resumeText, setResumeText] = useState<string>('');
  const [showJobSettings, setShowJobSettings] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [interviewData, setInterviewData] = useState<any>(null);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);

  useEffect(() => {
    const savedJobDescription = localStorage.getItem('jobDescription');
    if (savedJobDescription) {
      setJobDescription(savedJobDescription);
    }
  }, []);

  const handleSaveInterview = () => {
    if (!interviewData) {
      alert('没有面试数据可保存');
      return;
    }
    
    const record = {
      id: Date.now(),
      date: new Date().toISOString(),
      jobDescription,
      resumeText,
      rounds: interviewData.rounds,
      currentRound: interviewData.currentRound,
      totalQuestions: interviewData.totalQuestions,
      answeredQuestions: interviewData.answeredQuestions,
      scoredQuestions: interviewData.scoredQuestions,
      overallScore: interviewData.overallScore,
      isCompleted: isInterviewCompleted
    };
    
    const existingRecords = JSON.parse(localStorage.getItem('interviewRecords') || '[]');
    existingRecords.push(record);
    localStorage.setItem('interviewRecords', JSON.stringify(existingRecords));
    
    if (isInterviewCompleted) {
      alert('面试已完成并保存');
      // 重置面试状态
      setIsInterviewCompleted(false);
      setInterviewData(null);
    } else {
      alert('面试记录已保存');
    }
  };

  const handleViewRecords = () => {
    setShowRecords(true);
  };

  const handleContinueInterview = (record: any) => {
    // 加载面试记录数据到当前界面
    setResumeText(record.resumeText);
    setJobDescription(record.jobDescription || '');
    setInterviewData(record);
    setIsInterviewCompleted(false);
    
    // 移除原记录，因为会作为新记录重新保存
    const existingRecords = JSON.parse(localStorage.getItem('interviewRecords') || '[]');
    const updatedRecords = existingRecords.filter((r: any) => r.id !== record.id);
    localStorage.setItem('interviewRecords', JSON.stringify(updatedRecords));
  };

  const handleSetJobDescription = () => {
    setShowJobSettings(true);
  };

  return (
    <div className="h-screen w-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">面试管理系统</h1>
            <button
              onClick={handleSetJobDescription}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              <Briefcase size={18} />
              <span>设置岗位描述</span>
            </button>
          </div>
          <button
            onClick={handleViewRecords}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            <FolderOpen size={18} />
            <span>查看面试记录</span>
          </button>
        </div>
      </header>
      
      <div className="h-[calc(100vh-144px)]">
        <ResizablePanel
          leftContent={<ResumePanel onResumeChange={setResumeText} jobDescription={jobDescription} />}
          rightContent={
            <InterviewPanel 
              resumeText={resumeText} 
              jobDescription={jobDescription}
              onDataChange={setInterviewData}
              readOnly={isInterviewCompleted}
            />
          }
          defaultLeftWidth={25}
          minLeftWidth={20}
          maxLeftWidth={40}
        />
      </div>
      
      <footer className="h-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center">
        <button
          onClick={handleSaveInterview}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Save size={20} />
          <span>保存面试记录</span>
        </button>
        
        {!isInterviewCompleted && interviewData && (
          <button
            onClick={() => setIsInterviewCompleted(true)}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <span>完成面试</span>
          </button>
        )}
        
        {isInterviewCompleted && (
          <div className="flex items-center gap-2 px-6 py-3 bg-orange-100 text-orange-800 rounded-lg font-medium">
            <span>面试已完成，请保存记录</span>
          </div>
        )}
      </footer>

      {showJobSettings && (
        <JobSettingsModal
          isOpen={showJobSettings}
          onClose={() => setShowJobSettings(false)}
          jobDescription={jobDescription}
          onSave={setJobDescription}
        />
      )}
      
      {showRecords && (
        <InterviewRecordsModal
          isOpen={showRecords}
          onClose={() => setShowRecords(false)}
          onContinueInterview={handleContinueInterview}
        />
      )}
    </div>
  );
}

export default App;
