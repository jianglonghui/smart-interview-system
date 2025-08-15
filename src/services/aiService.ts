interface AIServiceOptions {
  model?: string;
  maxTokens?: number;
}


class AIService {
  private baseURL: string = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  async generateResponse(prompt: string, options: AIServiceOptions = {}): Promise<string> {
    const sanitizedPrompt = prompt.trim();
    
    const requestBody = {
      model: options.model || "glm-4.5",
      max_tokens: options.maxTokens || 2000,
      messages: [{ role: "user", content: sanitizedPrompt }],
      thinking: { type: "disabled" }
    };

    // 增加超时时间到45秒，并添加重试机制
    const maxRetries = 2;
    const timeoutMs = 45000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`AI request timeout after ${timeoutMs}ms (attempt ${attempt + 1})`);
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(this.baseURL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.REACT_APP_GLM_API_KEY}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid API response format');
        }
        
        return data.choices[0].message.content;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // 如果是AbortError且不是最后一次尝试，则重试
        if (error instanceof Error && error.name === 'AbortError' && attempt < maxRetries) {
          console.warn(`Request aborted, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 递增延迟
          continue;
        }
        
        console.error('AI Service Error:', error);
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  async generateResumeSummary(resumeText: string): Promise<string> {
    const prompt = `请为以下简历生成一个简洁的智能总览，包括：
    1. 个人基本信息
    2. 教育背景
    3. 工作经验亮点
    4. 核心技能
    5. 项目经验总结
    
    简历内容：
    ${resumeText}
    
    请用中文回答，格式清晰。`;

    return this.generateResponse(prompt);
  }

  async generateInterviewQuestions(resumeText: string, position: string = ""): Promise<string[]> {
    const prompt = `基于以下简历内容，生成10个面试问题。${position ? `职位：${position}` : ''}
    
    简历内容：
    ${resumeText}
    
    请生成包含技术问题、项目经验问题和软技能问题的综合面试题目。
    每个问题单独一行，不要编号。`;

    const response = await this.generateResponse(prompt);
    return response.split('\n').filter(q => q.trim().length > 0);
  }

  async generateReferenceAnswer(question: string, resumeContext?: string): Promise<string> {
    // 限制简历上下文长度，避免请求过长导致超时
    let contextSummary = '';
    if (resumeContext && resumeContext.length > 500) {
      // 如果简历内容过长，只提取关键信息
      contextSummary = resumeContext.substring(0, 500) + '...';
    } else if (resumeContext) {
      contextSummary = resumeContext;
    }

    const prompt = `请为以下面试问题提供一个专业的参考答案：

问题：${question}
${contextSummary ? `\n候选人背景摘要：${contextSummary}` : ''}

请提供一个简洁而专业的参考答案，重点说明关键要点。答案长度控制在200字以内。`;

    return this.generateResponse(prompt, { maxTokens: 1000 });
  }

  async scoreAnswer(question: string, answer: string, referenceAnswer?: string): Promise<{
    score: number;
    feedback: string;
  }> {
    const prompt = `请评估以下面试回答的质量：
    
    问题：${question}
    候选人回答：${answer}
    ${referenceAnswer ? `\n参考答案：${referenceAnswer}` : ''}
    
    请给出：
    1. 评分（0-100分）
    2. 评价和改进建议
    
    格式：
    评分：[分数]
    评价：[详细评价]`;

    const response = await this.generateResponse(prompt);
    
    const scoreMatch = response.match(/评分[：:]\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const feedbackMatch = response.match(/评价[：:]\s*([\s\S]+)/);
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : response;

    return { score, feedback };
  }

  async analyzeJobMatching(resumeText: string, jobDescription: string): Promise<{
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    skillsMatch: {
      matched: string[];
      missing: string[];
    };
    experienceMatch: {
      score: number;
      analysis: string;
    };
    educationMatch: {
      score: number;
      analysis: string;
    };
  }> {
    const prompt = `请分析候选人简历与岗位要求的匹配度，并以JSON格式返回详细分析结果：

    岗位描述：
    ${jobDescription}
    
    候选人简历：
    ${resumeText}
    
    请返回JSON格式的分析结果，包含以下字段：
    {
      "overallScore": 整体匹配度评分(0-100),
      "strengths": ["优势点1", "优势点2", ...],
      "weaknesses": ["不足点1", "不足点2", ...],
      "suggestions": ["建议1", "建议2", ...],
      "skillsMatch": {
        "matched": ["匹配的技能1", "匹配的技能2", ...],
        "missing": ["缺失的技能1", "缺失的技能2", ...]
      },
      "experienceMatch": {
        "score": 工作经验匹配度评分(0-100),
        "analysis": "工作经验匹配度分析"
      },
      "educationMatch": {
        "score": 教育背景匹配度评分(0-100),
        "analysis": "教育背景匹配度分析"
      }
    }
    
    请确保返回的是有效的JSON格式，不要包含任何其他文本。`;

    try {
      const response = await this.generateResponse(prompt, { maxTokens: 3000 });
      
      // 尝试解析JSON响应
      let cleanResponse = response.trim();
      
      // 移除可能的markdown代码块标记
      cleanResponse = cleanResponse.replace(/```json\s*|\s*```/g, '');
      
      // 尝试找到JSON对象的开始和结束
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleanResponse = cleanResponse.substring(jsonStart, jsonEnd);
      }
      
      const analysis = JSON.parse(cleanResponse);
      
      // 验证并确保所有必要字段存在
      return {
        overallScore: analysis.overallScore || 0,
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
        suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
        skillsMatch: {
          matched: Array.isArray(analysis.skillsMatch?.matched) ? analysis.skillsMatch.matched : [],
          missing: Array.isArray(analysis.skillsMatch?.missing) ? analysis.skillsMatch.missing : []
        },
        experienceMatch: {
          score: analysis.experienceMatch?.score || 0,
          analysis: analysis.experienceMatch?.analysis || ''
        },
        educationMatch: {
          score: analysis.educationMatch?.score || 0,
          analysis: analysis.educationMatch?.analysis || ''
        }
      };
    } catch (error) {
      console.error('Failed to parse job matching analysis:', error);
      
      // 返回默认值
      return {
        overallScore: 0,
        strengths: ['分析失败'],
        weaknesses: ['无法获取分析结果'],
        suggestions: ['请重试分析'],
        skillsMatch: {
          matched: [],
          missing: []
        },
        experienceMatch: {
          score: 0,
          analysis: '分析失败'
        },
        educationMatch: {
          score: 0,
          analysis: '分析失败'
        }
      };
    }
  }
}

const aiService = new AIService();
export default aiService;