# 面试管理系统

一个基于React的智能面试管理系统，支持简历管理、AI智能生成面试题、答案评分等功能。

## 功能特性

- 📄 **简历管理**
  - 支持上传简历文件或直接输入文本
  - AI智能生成简历总览
  
- 🤖 **AI智能功能**
  - 基于简历内容自动生成面试题
  - 提供AI参考答案
  - 自动评分和反馈
  
- 📝 **面试管理**
  - 支持一面、二面、三面多轮面试
  - 记录候选人回答
  - 问题手动添加和编辑
  
- 🎨 **界面设计**
  - 左右分栏布局（1:3默认比例）
  - 支持拖动调整面板大小
  - 响应式设计

## 技术栈

- React 18 + TypeScript
- Tailwind CSS
- GLM-4.5 API
- Lucide React Icons

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env`，并填入你的GLM API密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
REACT_APP_GLM_API_KEY=your_glm_api_key_here
```

### 3. 启动开发服务器

```bash
npm start
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动。

## 使用说明

1. **上传简历**：在左侧面板上传简历文件或直接粘贴简历内容
2. **生成面试题**：点击"AI生成问题"自动基于简历生成面试题，或手动添加问题
3. **记录回答**：展开问题卡片，记录候选人的回答
4. **获取参考**：点击"生成参考"获取AI参考答案
5. **评分反馈**：记录回答后，点击"获取评分"获得AI评分和反馈
6. **切换轮次**：使用顶部按钮切换不同面试轮次

## 项目结构

```
interview-system/
├── src/
│   ├── components/
│   │   ├── ResizablePanel.tsx    # 可调整大小的面板组件
│   │   ├── ResumePanel.tsx       # 简历管理面板
│   │   └── InterviewPanel.tsx    # 面试管理面板
│   ├── services/
│   │   └── aiService.ts          # AI服务接口
│   ├── App.tsx                   # 主应用组件
│   └── index.css                 # 全局样式
├── .env.example                  # 环境变量示例
└── README.md                     # 项目文档
```

## 开发命令

```bash
# 启动开发服务器
npm start

# 构建生产版本
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

## 注意事项

- 请确保已获取GLM API密钥
- API调用可能产生费用，请合理使用
- 建议在生产环境中添加适当的错误处理和日志记录

## License

MIT
