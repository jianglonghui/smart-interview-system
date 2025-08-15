import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CheckCircle2, 
  XCircle, 
  Lightbulb,
  Award,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import aiService from '../services/aiService';
import { JobMatchingAnalysis as JobMatchingAnalysisType } from '../types/interview';

interface JobMatchingAnalysisProps {
  resumeText: string;
  jobDescription: string;
  onAnalysisUpdate?: (analysis: JobMatchingAnalysisType | null) => void;
}

const ScoreCircle: React.FC<{ 
  score: number; 
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  animated?: boolean;
}> = ({ score, size = 'md', label, animated = true }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setAnimatedScore(score);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAnimatedScore(score);
    }
  }, [score, animated]);
  
  const sizes = {
    sm: { circle: 40, strokeWidth: 4, text: 'text-xs' },
    md: { circle: 60, strokeWidth: 6, text: 'text-sm' },
    lg: { circle: 80, strokeWidth: 8, text: 'text-lg' }
  };
  
  const { circle, strokeWidth, text } = sizes[size];
  const radius = (circle - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: circle, height: circle }}>
        <svg
          className="transform -rotate-90"
          width={circle}
          height={circle}
          viewBox={`0 0 ${circle} ${circle}`}
        >
          {/* 背景圆环 */}
          <circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-gray-200"
          />
          {/* 进度圆环 */}
          <circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={clsx(
              getScoreColor(score),
              'transition-all duration-1000 ease-out'
            )}
            style={{ strokeLinecap: 'round' }}
          />
        </svg>
        {/* 分数文字 */}
        <div className={clsx(
          'absolute inset-0 flex items-center justify-center',
          text,
          'font-bold',
          getScoreColor(score)
        )}>
          {animatedScore}
        </div>
      </div>
      {label && (
        <span className="text-xs text-gray-600 mt-1 text-center">{label}</span>
      )}
    </div>
  );
};

const JobMatchingAnalysis: React.FC<JobMatchingAnalysisProps> = ({
  resumeText,
  jobDescription,
  onAnalysisUpdate
}) => {
  const [analysis, setAnalysis] = useState<JobMatchingAnalysisType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAnalysis = async () => {
    if (!resumeText || !jobDescription) {
      setError('请先上传简历并设置岗位描述');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await aiService.analyzeJobMatching(resumeText, jobDescription);
      setAnalysis(result);
      onAnalysisUpdate?.(result);
    } catch (error) {
      console.error('Job matching analysis failed:', error);
      setError('分析失败，请重试');
      onAnalysisUpdate?.(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (resumeText && jobDescription && !analysis) {
      performAnalysis();
    }
  }, [resumeText, jobDescription]);

  if (!resumeText || !jobDescription) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-gray-500">请先上传简历并设置岗位描述以进行匹配度分析</p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-blue-500" size={32} />
            <p className="text-gray-600">正在分析岗位匹配度...</p>
            <p className="text-sm text-gray-400 mt-1">这可能需要几秒钟时间</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle size={20} />
            <span>{error}</span>
          </div>
          <button
            onClick={performAnalysis}
            className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-4">
          <button
            onClick={performAnalysis}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
          >
            <Target size={16} />
            开始分析岗位匹配度
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* 紧凑头部 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="text-blue-600" size={16} />
            <h3 className="font-medium text-gray-800 text-sm">岗位匹配度</h3>
          </div>
          <button
            onClick={performAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={isAnalyzing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 紧凑评分展示 */}
        <div className="flex items-center justify-between">
          <ScoreCircle 
            score={analysis.overallScore} 
            size="md" 
            label="综合匹配度"
          />
          <div className="flex gap-2">
            <div className="text-center">
              <ScoreCircle 
                score={analysis.experienceMatch.score} 
                size="sm" 
                label="经验"
              />
            </div>
            <div className="text-center">
              <ScoreCircle 
                score={analysis.educationMatch.score} 
                size="sm" 
                label="学历"
              />
            </div>
          </div>
        </div>

        {/* 技能匹配 - 紧凑版 */}
        {(analysis.skillsMatch.matched.length > 0 || analysis.skillsMatch.missing.length > 0) && (
          <div className="space-y-2">
            {analysis.skillsMatch.matched.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle2 size={12} className="text-green-600" />
                  <span className="text-xs font-medium text-green-700">匹配技能</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.skillsMatch.matched.slice(0, 6).map((skill, index) => (
                    <span
                      key={index}
                      className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                    >
                      {skill}
                    </span>
                  ))}
                  {analysis.skillsMatch.matched.length > 6 && (
                    <span className="text-xs text-gray-500">+{analysis.skillsMatch.matched.length - 6}</span>
                  )}
                </div>
              </div>
            )}
            
            {analysis.skillsMatch.missing.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <XCircle size={12} className="text-red-600" />
                  <span className="text-xs font-medium text-red-700">待提升</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.skillsMatch.missing.slice(0, 4).map((skill, index) => (
                    <span
                      key={index}
                      className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                    >
                      {skill}
                    </span>
                  ))}
                  {analysis.skillsMatch.missing.length > 4 && (
                    <span className="text-xs text-gray-500">+{analysis.skillsMatch.missing.length - 4}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 关键信息 - 紧凑版 */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {analysis.strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp size={12} className="text-green-600" />
                <span className="font-medium text-green-700">主要优势</span>
              </div>
              <ul className="space-y-1">
                {analysis.strengths.slice(0, 3).map((strength, index) => (
                  <li key={index} className="text-gray-600 truncate" title={strength}>
                    • {strength}
                  </li>
                ))}
                {analysis.strengths.length > 3 && (
                  <li className="text-gray-500">+{analysis.strengths.length - 3} 更多</li>
                )}
              </ul>
            </div>
          )}
          
          {analysis.suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Lightbulb size={12} className="text-yellow-600" />
                <span className="font-medium text-yellow-700">改进建议</span>
              </div>
              <ul className="space-y-1">
                {analysis.suggestions.slice(0, 3).map((suggestion, index) => (
                  <li key={index} className="text-gray-600 truncate" title={suggestion}>
                    • {suggestion}
                  </li>
                ))}
                {analysis.suggestions.length > 3 && (
                  <li className="text-gray-500">+{analysis.suggestions.length - 3} 更多</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default JobMatchingAnalysis;