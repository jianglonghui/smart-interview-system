# 智能面试管理系统

一个基于React + Node.js的全栈智能面试管理系统，支持简历管理、AI智能生成面试题、答案评分、面试记录管理、题库管理、真题爬虫等功能。

## 🚀 功能特性

### 📄 **简历管理**
- 支持上传PDF简历文件或直接输入文本
- AI智能生成简历总览和关键信息提取
- 简历内容智能分析

### 🤖 **AI智能功能**
- 基于简历内容自动生成面试题
- 提供AI参考答案和评分标准
- 自动评分和详细反馈
- 支持多轮面试问题生成

### 📝 **面试管理**
- 支持一面、二面、三面多轮面试
- 记录候选人回答和评分
- 问题手动添加和编辑
- 面试进度跟踪

### 🗂️ **题库管理**
- 本地题库存储和管理
- 按类别、难度筛选问题
- 支持批量导入和导出
- AI智能生成分类题目

### 🕷️ **真题爬虫系统**
- 支持多个招聘平台爬取
- 智能去重和分类
- 缓存机制提升性能
- 反爬虫对策

### 📊 **面试记录管理**
- 完整的面试记录保存
- 支持继续未完成的面试
- 历史记录查看和分析
- 数据导出功能

### 🎨 **界面设计**
- 左右分栏布局（1:3默认比例）
- 支持拖动调整面板大小
- 响应式设计
- 现代化UI组件

## 🛠 技术栈

### 前端
- **React 19** + TypeScript
- **Tailwind CSS** - 样式框架
- **Radix UI** - 无障碍组件库
- **Framer Motion** - 动画库
- **Lucide React** - 图标库
- **React Resizable Panels** - 可调整面板

### 后端
- **Node.js** + **Express.js** - Web框架
- **TypeScript** - 类型安全
- **Playwright** - 无头浏览器爬虫
- **Redis** - 缓存和会话管理
- **SQLite** - 数据存储
- **Winston** - 日志系统
- **Joi** - 数据验证
- **Multer** - 文件上传处理

### 开发工具
- **ESLint** - 代码质量检查
- **Jest** - 单元测试
- **Concurrently** - 并发运行前后端

## 🏗️ 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React前端     │────▶│  Express后端    │────▶│ Playwright爬虫  │
│  (Port 3000)    │     │  (Port 3001)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────┐          ┌─────────────────┐
                        │    Redis    │          │   目标网站      │
                        │   缓存层    │          │ 牛客/CSDN/掘金 │
                        └─────────────┘          └─────────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   SQLite    │
                        │   数据库    │
                        └─────────────┘
```

## 🚀 快速开始

### 1. 一键安装
```bash
# 克隆项目
git clone <repository-url>
cd interview-system

# 执行安装脚本
./setup.sh
```

### 2. 配置环境变量

复制环境变量文件并配置：

```bash
# 前端环境变量
cp .env.example .env

# 后端环境变量
cd server
cp .env.example .env
```

编辑环境变量文件：

**前端 (.env):**
```env
REACT_APP_GLM_API_KEY=your_glm_api_key_here
```

**后端 (server/.env):**
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
REDIS_URL=redis://localhost:6379
GLM_API_KEY=your_glm_api_key_here
CRAWLER_TIMEOUT=30000
CRAWLER_MAX_RETRIES=3
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
```

### 3. 启动服务

#### 启动后端服务（Terminal 1）
```bash
cd server
npm run dev
# 服务将在 http://localhost:3001 启动
```

#### 启动前端应用（Terminal 2）
```bash
npm start
# 应用将在 http://localhost:3000 启动
```

#### 一键启动（推荐）
```bash
npm run dev
# 同时启动前后端服务
```

## 📖 使用说明

### 1. **简历管理**
- 在左侧面板上传PDF简历文件或直接粘贴简历内容
- 系统会自动分析简历并提取关键信息

### 2. **岗位设置**
- 点击"设置岗位描述"按钮
- 输入目标岗位的详细描述和要求

### 3. **生成面试题**
- 点击"AI生成问题"自动基于简历和岗位描述生成面试题
- 或手动添加自定义问题
- 支持按类别和难度筛选

### 4. **题库管理**
- 点击"题库管理"进入题库界面
- 支持本地题库管理
- 使用爬虫功能获取真题
- 支持批量导入导出

### 5. **面试进行**
- 展开问题卡片，记录候选人的回答
- 点击"生成参考"获取AI参考答案
- 点击"获取评分"获得AI评分和反馈
- 使用顶部按钮切换不同面试轮次

### 6. **面试记录**
- 点击"查看面试记录"查看历史面试
- 支持继续未完成的面试
- 完整的面试数据保存

## 🔧 爬虫功能

### 支持的岗位类别
- 前端开发
- 后端开发
- 算法岗
- 测试开发
- 运维开发
- 产品经理
- 数据分析

### 支持的爬取网站
- **牛客网** - 面试经验、真题分享
- **CSDN** - 技术博客、面试题整理
- **掘金** - 技术文章、面试分享
- **BOSS直聘** - 招聘信息
- **猎聘网** - 招聘信息
- **拉勾网** - 招聘信息
- **前程无忧** - 招聘信息

### 爬虫特色功能
- 智能去重和分类
- Redis缓存24小时
- 反爬虫对策（随机User-Agent、请求延迟）
- 自动重试机制
- 并发爬取支持

## 📁 项目结构

```
interview-system/
├── src/                          # 前端源码
│   ├── components/               # React组件
│   │   ├── ResizablePanel.tsx   # 可调整大小的面板
│   │   ├── ResumePanel.tsx      # 简历管理面板
│   │   ├── InterviewPanel.tsx   # 面试管理面板
│   │   ├── QuestionBankModal.tsx # 题库管理模态框
│   │   ├── JobSettingsModal.tsx # 岗位设置模态框
│   │   ├── InterviewRecordsModal.tsx # 面试记录模态框
│   │   ├── JobMatchingAnalysis.tsx # 岗位匹配分析
│   │   └── TopicManager.tsx     # 主题管理器
│   ├── services/                 # 服务层
│   │   ├── aiService.ts         # AI服务接口
│   │   ├── pdfService.ts        # PDF处理服务
│   │   ├── questionImportService.ts # 题目导入服务
│   │   └── webCrawlerService.ts # 爬虫服务
│   ├── types/                    # TypeScript类型定义
│   └── App.tsx                  # 主应用组件
├── server/                       # 后端服务
│   ├── src/
│   │   ├── routes/              # API路由
│   │   │   ├── health.ts        # 健康检查
│   │   │   ├── pdf.ts           # PDF处理
│   │   │   ├── crawler.ts       # 爬虫接口
│   │   │   ├── interview.ts     # 面试接口
│   │   │   ├── questionBank.ts  # 题库接口
│   │   │   ├── favorites.ts     # 收藏接口
│   │   │   └── pdf.ts           # PDF生成
│   │   ├── services/            # 业务逻辑服务
│   │   │   ├── CrawlerService.ts # 爬虫服务
│   │   │   ├── InterviewCrawlerService.ts # 面试爬虫
│   │   │   ├── PdfService.ts    # PDF服务
│   │   │   ├── QuestionBankService.ts # 题库服务
│   │   │   └── CacheService.ts  # 缓存服务
│   │   ├── config/              # 配置文件
│   │   └── types/               # 类型定义
│   ├── data/                    # 数据文件
│   ├── logs/                    # 日志文件
│   └── uploads/                 # 上传文件
├── public/                       # 静态资源
├── package.json                  # 前端依赖
├── server/package.json           # 后端依赖
└── setup.sh                     # 安装脚本
```

## 🚀 开发命令

### 前端
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

### 后端
```bash
cd server

# 启动开发服务器（热重载）
npm run dev

# 构建项目
npm run build

# 启动生产服务器
npm start

# 运行测试
npm test

# 代码检查
npm run lint
```

### 一键启动
```bash
# 同时启动前后端
npm run dev
```

## 📡 API接口

### 健康检查
- `GET /api/health` - 基本健康检查
- `GET /api/health/detailed` - 详细系统信息
- `GET /api/health/ready` - 就绪探针
- `GET /api/health/live` - 存活探针

### PDF处理
- `POST /api/pdf/parse` - 解析PDF并提取文本
- `POST /api/pdf/validate` - 验证PDF文件
- `GET /api/pdf/info` - 获取PDF服务信息

### 爬虫服务
- `POST /api/crawler/job` - 爬取单个职位
- `POST /api/crawler/jobs/batch` - 批量爬取职位
- `GET /api/crawler/status/:jobId` - 获取爬取任务状态
- `GET /api/crawler/platforms` - 获取支持的平台
- `GET /api/crawler/health` - 检查爬虫服务健康状态
- `DELETE /api/crawler/cache` - 清除爬虫缓存

### 面试管理
- `POST /api/interview/create` - 创建面试
- `GET /api/interview/:id` - 获取面试详情
- `PUT /api/interview/:id` - 更新面试
- `DELETE /api/interview/:id` - 删除面试

### 题库管理
- `GET /api/questions` - 获取题目列表
- `POST /api/questions` - 创建题目
- `PUT /api/questions/:id` - 更新题目
- `DELETE /api/questions/:id` - 删除题目
- `POST /api/questions/import` - 批量导入题目
- `GET /api/questions/export` - 导出题目

## 🔐 安全特性

- **Helmet** - 安全头设置
- **CORS** - 跨域保护
- **Rate Limiting** - 请求频率限制
- **Input Validation** - 输入验证（Joi）
- **File Upload Restrictions** - 文件上传限制
- **Request Sanitization** - 请求清理

## 📊 性能特性

- **Redis缓存** - 频繁访问数据缓存
- **连接池** - 数据库连接池管理
- **优雅关闭** - 优雅关闭处理
- **内存监控** - 内存使用监控
- **并发爬取** - 支持多实例并发

## 🐳 Docker支持

### 创建Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### 使用Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
      - db
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  db:
    image: sqlite:latest
    volumes:
      - ./data:/data
```

## 🐛 故障排查

### 常见问题

1. **Redis连接失败**
   - 确保Redis运行：`redis-cli ping`
   - 检查环境变量中的Redis URL

2. **Playwright浏览器未找到**
   - 安装浏览器：`npx playwright install chromium`
   - 确保有足够的磁盘空间

3. **PDF解析失败**
   - 检查文件格式和大小限制
   - 验证pdf-parse依赖安装

4. **爬虫无响应**
   - 检查后端服务是否启动
   - 检查Redis是否运行
   - 查看 `server/logs/error.log`

5. **爬取失败**
   - 检查网络连接
   - 目标网站可能更新了结构
   - 尝试减少爬取数量

### 调试模式

启用调试日志：
```bash
# 后端
LOG_LEVEL=debug npm run dev

# 前端
REACT_APP_DEBUG=true npm start
```

### 日志文件

日志文件位置：
- `server/logs/combined.log` - 所有日志
- `server/logs/error.log` - 错误日志
- `server/logs/requests.log` - HTTP请求日志

## 📈 后续优化计划

- [ ] 添加代理池支持
- [ ] 实现分布式爬虫
- [ ] 添加更多数据源
- [ ] 机器学习题目分类
- [ ] 自动更新爬虫规则
- [ ] WebSocket实时进度
- [ ] 面试报告生成
- [ ] 数据可视化分析
- [ ] 多语言支持
- [ ] 移动端适配

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 打开Pull Request

### 开发规范

- 遵循TypeScript严格模式指南
- 为所有新功能添加类型定义
- 包含错误处理和日志记录
- 为新功能编写测试
- 根据需要更新文档

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 技术支持

如遇到问题，请查看：
1. 日志文件：`server/logs/`
2. 浏览器控制台
3. 后端终端输出
4. 项目Issues页面

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！
