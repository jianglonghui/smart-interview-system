export interface Question {
  id: string;
  text: string;
  answer: string;
  referenceAnswer: string;
  score: number | null;
  feedback: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

export interface InterviewRound {
  id: string;
  name: string;
  topics: Topic[];
}

export interface QuestionBankItem {
  id: string;
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
}

export interface InterviewRecord {
  id: number;
  date: string;
  jobDescription: string;
  resumeText: string;
  candidateName?: string;
  rounds?: InterviewRound[];
  currentRound?: string;
  totalQuestions?: number;
  answeredQuestions?: number;
  scoredQuestions?: number;
  overallScore?: number;
  isCompleted?: boolean;
}

export interface InterviewData {
  rounds: InterviewRound[];
  currentRound: string;
  totalQuestions: number;
  answeredQuestions: number;
  scoredQuestions: number;
  overallScore: number;
}

export interface JobMatchingAnalysis {
  overallScore: number; // 0-100 整体匹配度
  strengths: string[]; // 优势匹配点
  weaknesses: string[]; // 不足之处
  suggestions: string[]; // 改进建议
  skillsMatch: {
    matched: string[]; // 匹配的技能
    missing: string[]; // 缺失的技能
  };
  experienceMatch: {
    score: number; // 0-100
    analysis: string;
  };
  educationMatch: {
    score: number; // 0-100
    analysis: string;
  };
}