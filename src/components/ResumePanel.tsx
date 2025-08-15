import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import aiService from '../services/aiService';
import pdfService from '../services/pdfService';
import JobMatchingAnalysis from './JobMatchingAnalysis';

interface ResumePanelProps {
  onResumeChange?: (resumeText: string) => void;
  jobDescription?: string;
}

const ResumePanel: React.FC<ResumePanelProps> = ({ onResumeChange, jobDescription }) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>('');
  const [resumeSummary, setResumeSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setFileError('');
    setIsProcessingFile(true);
    
    try {
      const text = await pdfService.extractTextFromFile(file);
      setResumeText(text);
      onResumeChange?.(text);
      
      if (text) {
        await generateSummary(text);
      }
    } catch (error) {
      console.error('File processing error:', error);
      setFileError(error instanceof Error ? error.message : '文件处理失败');
      setResumeText('');
      setResumeSummary('');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const generateSummary = async (text: string) => {
    setIsGeneratingSummary(true);
    try {
      const summary = await aiService.generateResumeSummary(text);
      setResumeSummary(summary);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      setResumeSummary('生成摘要失败，请稍后重试。');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleTextInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setResumeText(text);
    onResumeChange?.(text);
  };

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800">候选人简历</h2>
      
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessingFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingFile}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessingFile ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>处理文件中...</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>上传简历文件 (支持PDF/TXT)</span>
            </>
          )}
        </button>
        {fileError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={16} />
            <span>{fileError}</span>
          </div>
        )}
        {resumeFile && !fileError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <FileText size={16} />
            <span>{resumeFile.name}</span>
          </div>
        )}
      </div>

      {/* 使用flex-1确保下面的内容占据剩余空间 */}
      <div className="flex-1 flex flex-col min-h-0 custom-scrollbar overflow-auto">
        <div className="mb-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">简历内容</label>
            {resumeText && (
              <button
                onClick={() => generateSummary(resumeText)}
                disabled={isGeneratingSummary}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isGeneratingSummary ? 'animate-spin' : ''} />
                重新生成总览
              </button>
            )}
          </div>
          <textarea
            value={resumeText}
            onChange={handleTextInput}
            placeholder="粘贴或输入简历内容..."
            className="h-40 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4 flex flex-col">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            AI 智能总览
            {isGeneratingSummary && <Loader2 size={16} className="animate-spin" />}
          </h3>
          <div className="h-32 p-3 bg-blue-50 border border-blue-200 rounded-lg overflow-auto">
            {resumeSummary ? (
              <div className="whitespace-pre-wrap text-sm text-gray-700">{resumeSummary}</div>
            ) : (
              <div className="text-sm text-gray-500">
                {isGeneratingSummary ? '正在生成智能总览...' : '上传或输入简历后将自动生成智能总览'}
              </div>
            )}
          </div>
        </div>

        {/* 岗位匹配度分析 - 紧凑版 */}
        {(resumeText && jobDescription) && (
          <div className="mb-4">
            <JobMatchingAnalysis
              resumeText={resumeText}
              jobDescription={jobDescription || ''}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumePanel;