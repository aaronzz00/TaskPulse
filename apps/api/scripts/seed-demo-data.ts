import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // Create demo project
  const project = await prisma.project.create({
    data: {
      name: '网站重构项目',
      description: '将旧版网站迁移到现代技术栈，包括前端重构、后端API升级和数据库迁移',
      startDate: new Date('2026-01-06'),
      endDate: new Date('2026-04-30'),
      status: 'active',
    },
  });
  console.log(`✅ Created project: ${project.name} (${project.id})`);

  // Create tasks
  const tasksData = [
    {
      title: '需求分析与规划',
      description: '收集业务需求，制定技术方案，确定项目里程碑',
      plannedStart: new Date('2026-01-06'),
      plannedEnd: new Date('2026-01-17'),
      estimatedHours: 80,
      priority: 'high',
      status: 'done',
      progress: 100,
    },
    {
      title: '技术选型与架构设计',
      description: '评估技术栈，设计系统架构，制定开发规范',
      plannedStart: new Date('2026-01-13'),
      plannedEnd: new Date('2026-01-24'),
      estimatedHours: 60,
      priority: 'high',
      status: 'done',
      progress: 100,
    },
    {
      title: '数据库设计与迁移',
      description: '设计新数据库Schema，编写迁移脚本，验证数据完整性',
      plannedStart: new Date('2026-01-20'),
      plannedEnd: new Date('2026-02-07'),
      estimatedHours: 100,
      priority: 'critical',
      status: 'in_progress',
      progress: 65,
    },
    {
      title: '后端API开发',
      description: '开发RESTful API，实现业务逻辑，编写单元测试',
      plannedStart: new Date('2026-01-27'),
      plannedEnd: new Date('2026-02-21'),
      estimatedHours: 160,
      priority: 'critical',
      status: 'in_progress',
      progress: 40,
    },
    {
      title: '前端框架搭建',
      description: '初始化前端项目，配置构建工具，搭建组件库',
      plannedStart: new Date('2026-02-03'),
      plannedEnd: new Date('2026-02-14'),
      estimatedHours: 80,
      priority: 'high',
      status: 'in_progress',
      progress: 30,
    },
    {
      title: '用户认证模块',
      description: '实现登录/注册/权限管理功能',
      plannedStart: new Date('2026-02-10'),
      plannedEnd: new Date('2026-02-21'),
      estimatedHours: 60,
      priority: 'high',
      status: 'todo',
      progress: 0,
    },
    {
      title: '核心业务页面开发',
      description: '开发首页、产品页、用户中心等核心页面',
      plannedStart: new Date('2026-02-17'),
      plannedEnd: new Date('2026-03-14'),
      estimatedHours: 200,
      priority: 'high',
      status: 'todo',
      progress: 0,
    },
    {
      title: '管理后台开发',
      description: '开发内容管理、用户管理、数据统计等后台功能',
      plannedStart: new Date('2026-02-24'),
      plannedEnd: new Date('2026-03-21'),
      estimatedHours: 160,
      priority: 'medium',
      status: 'todo',
      progress: 0,
    },
    {
      title: '系统集成测试',
      description: '端到端测试，性能测试，安全测试',
      plannedStart: new Date('2026-03-17'),
      plannedEnd: new Date('2026-03-28'),
      estimatedHours: 80,
      priority: 'high',
      status: 'todo',
      progress: 0,
    },
    {
      title: '用户验收测试',
      description: '组织UAT测试，收集反馈，修复问题',
      plannedStart: new Date('2026-03-24'),
      plannedEnd: new Date('2026-04-04'),
      estimatedHours: 60,
      priority: 'high',
      status: 'todo',
      progress: 0,
    },
    {
      title: '生产环境部署',
      description: '配置生产服务器，部署应用，配置监控告警',
      plannedStart: new Date('2026-03-31'),
      plannedEnd: new Date('2026-04-11'),
      estimatedHours: 60,
      priority: 'critical',
      status: 'todo',
      progress: 0,
    },
    {
      title: '项目文档编写',
      description: '编写技术文档、用户手册、运维文档',
      plannedStart: new Date('2026-04-07'),
      plannedEnd: new Date('2026-04-18'),
      estimatedHours: 40,
      priority: 'medium',
      status: 'todo',
      progress: 0,
    },
    {
      title: '项目上线',
      description: '正式上线，监控系统运行，处理线上问题',
      plannedStart: new Date('2026-04-14'),
      plannedEnd: new Date('2026-04-25'),
      estimatedHours: 40,
      priority: 'critical',
      status: 'todo',
      progress: 0,
    },
  ];

  const createdTasks = [];
  for (const [index, taskData] of tasksData.entries()) {
    const task = await prisma.task.create({
      data: {
        ...taskData,
        displayId: `T-${String(index + 1).padStart(3, '0')}`,
        projectId: project.id,
      },
    });
    createdTasks.push(task);
    console.log(`  📋 ${task.title} (${task.status})`);
  }

  // Create dependencies (FS relationships)
  const dependencies = [
    { source: 0, target: 1 },   // 需求分析 -> 技术选型
    { source: 1, target: 2 },   // 技术选型 -> 数据库设计
    { source: 1, target: 3 },   // 技术选型 -> 后端API
    { source: 1, target: 4 },   // 技术选型 -> 前端框架
    { source: 2, target: 3 },   // 数据库 -> 后端API
    { source: 3, target: 5 },   // 后端API -> 用户认证
    { source: 4, target: 6 },   // 前端框架 -> 核心业务页面
    { source: 5, target: 6 },   // 用户认证 -> 核心业务页面
    { source: 3, target: 7 },   // 后端API -> 管理后台
    { source: 6, target: 8 },   // 核心业务 -> 集成测试
    { source: 7, target: 8 },   // 管理后台 -> 集成测试
    { source: 8, target: 9 },   // 集成测试 -> UAT
    { source: 9, target: 10 },  // UAT -> 生产部署
    { source: 10, target: 12 }, // 生产部署 -> 项目上线
  ];

  for (const dep of dependencies) {
    await prisma.dependency.create({
      data: {
        sourceTaskId: createdTasks[dep.source].id,
        targetTaskId: createdTasks[dep.target].id,
        type: 'FS',
      },
    });
  }
  console.log(`\n🔗 Created ${dependencies.length} dependencies`);

  // Create some AI insights
  const insights = [
    {
      projectId: project.id,
      type: 'RISK',
      severity: 'warning',
      content: '后端API开发与数据库设计存在并行依赖，建议加强协调',
      reasoning: JSON.stringify({ detectedAt: new Date(), tasks: ['数据库设计', '后端API开发'] }),
    },
    {
      projectId: project.id,
      type: 'PROGRESS',
      severity: 'info',
      content: '项目整体进度正常，需求分析和技术选型已按计划完成',
      reasoning: JSON.stringify({ progressPercentage: 25, completedMilestones: 2 }),
    },
    {
      projectId: project.id,
      type: 'BOTTLENECK',
      severity: 'warning',
      content: '核心业务页面开发任务较重，建议增加人手或拆分任务',
      reasoning: JSON.stringify({ taskHours: 200, estimatedDays: 20 }),
    },
  ];

  for (const insight of insights) {
    await prisma.aIInsight.create({ data: insight });
  }
  console.log(`💡 Created ${insights.length} AI insights`);

  console.log('\n✨ Demo data seeding completed!');
  console.log(`\nProject ID: ${project.id}`);
  console.log(`Total tasks: ${createdTasks.length}`);
  console.log(`Total dependencies: ${dependencies.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
