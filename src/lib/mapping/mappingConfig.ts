import type { MappingRule } from '../docx/types';

/**
 * Declarative mapping rules: template placeholder → source content location.
 *
 * sourceType:
 *   'productInfo' — from ProductInfo fields (extracted from Para 8)
 *   'section'     — from source document section (by heading path)
 *   'table'       — from a specific source table (by index)
 *   'manual'      — requires manual user input
 *
 * contentFilter:
 *   'all'      — all content recursively (sub-sections included)
 *   'bodyOnly' — only direct content (excludes sub-section content)
 *
 * sectionPaths:
 *   Ordered list of candidate heading paths. The first path that resolves
 *   wins. If none match, a flat document-wide search is tried on the last
 *   segment of the first path as a final fallback.
 *
 *   Multiple paths handle documents where:
 *   - The same section has different names across product lines
 *     (e.g. '限制' vs '局限性', '自备材料' vs '需要但未提供的材料')
 *   - The same section lives at different nesting levels
 *     (e.g. '执行质量控制' as H2 under '程序' vs standalone H1)
 */
export const MAPPING_RULES: MappingRule[] = [
  // ===== Title & Product Name =====
  {
    placeholderId: 'title',
    templateDescription: '[xxx]说明书 — document title',
    sourceType: 'productInfo',
    productInfoField: 'chineseProductName',
  },
  {
    placeholderId: 'productName.chinese',
    templateDescription: '通用名称',
    sourceType: 'productInfo',
    productInfoField: 'chineseProductName',
  },
  {
    placeholderId: 'productName.english',
    templateDescription: '英文名称',
    sourceType: 'productInfo',
    productInfoField: 'englishProductName',
  },

  // ===== Package Specification =====
  {
    placeholderId: 'packageSpec',
    templateDescription: '[xxx]测试/盒',
    sourceType: 'table',
    tableIndex: 2,
    extractionRule: 'testCount',
  },

  // ===== Intended Use =====
  {
    placeholderId: 'intendedUse.main',
    templateDescription: '预期用途 — main text',
    sourceType: 'section',
    sectionPaths: [['用途']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'intendedUse.summary',
    templateDescription: '摘要和解释',
    sourceType: 'section',
    sectionPaths: [['概要和说明']],
    contentFilter: 'all',
  },

  // ===== Test Principle =====
  {
    placeholderId: 'testPrinciple',
    templateDescription: '检验原理',
    sourceType: 'section',
    sectionPaths: [['程序原理']],
    contentFilter: 'all',
  },

  // ===== Main Components =====
  {
    placeholderId: 'components.reagentTable',
    templateDescription: '试剂组分 table',
    sourceType: 'table',
    tableIndex: 0,
  },
  {
    placeholderId: 'components.notProvided',
    templateDescription: '需要而未提供的材料',
    sourceType: 'section',
    // '自备材料' (HBcT2, ACI) vs '需要但未提供的材料' (CEN, AIM)
    sectionPaths: [
      ['程序', '自备材料'],
      ['程序', '需要但未提供的材料'],
    ],
    contentFilter: 'all',
  },

  // ===== Storage Conditions =====
  {
    placeholderId: 'storage.months',
    templateDescription: '有效期 xx 个月',
    sourceType: 'manual',
    manualInputLabel: '有效期（月）',
  },
  {
    placeholderId: 'storage.days',
    templateDescription: '开封稳定期 xx 天',
    sourceType: 'manual',
    manualInputLabel: '开封稳定期（天）',
  },
  {
    placeholderId: 'storage.text',
    templateDescription: '储存条件文本',
    sourceType: 'section',
    sectionPaths: [['试剂', '储存和稳定性']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'storage.onboard',
    templateDescription: '机载稳定性',
    sourceType: 'section',
    sectionPaths: [['试剂', '机载稳定性']],
    contentFilter: 'all',
  },

  // ===== Applicable Instruments =====
  {
    placeholderId: 'instrument',
    templateDescription: '适用仪器',
    sourceType: 'productInfo',
    productInfoField: 'system',
  },

  // ===== Sample Requirements =====
  {
    placeholderId: 'sample.main',
    templateDescription: '样本要求 — main text',
    sourceType: 'section',
    // '样本收集和处理' (most) vs '样本采集和处理' (AMH AIM — 收→采)
    sectionPaths: [
      ['样本收集和处理'],
      ['样本采集和处理'],
    ],
    contentFilter: 'bodyOnly',
  },
  {
    placeholderId: 'sample.collection',
    templateDescription: '样本的采集',
    sourceType: 'section',
    // Child name also varies: '收集样本' vs '采集样本'
    sectionPaths: [
      ['样本收集和处理', '收集样本'],
      ['样本采集和处理', '采集样本'],
      ['样本收集和处理', '采集样本'],
      ['样本采集和处理', '收集样本'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'sample.storage',
    templateDescription: '样本的保存',
    sourceType: 'section',
    sectionPaths: [
      ['样本收集和处理', '储存样本'],
      ['样本采集和处理', '储存样本'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'sample.transport',
    templateDescription: '样本的运输',
    sourceType: 'section',
    sectionPaths: [
      ['样本收集和处理', '输送样本'],
      ['样本采集和处理', '输送样本'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'sample.preparation',
    templateDescription: '样本的制备',
    sourceType: 'section',
    sectionPaths: [
      ['样本收集和处理', '准备样本'],
      ['样本采集和处理', '准备样本'],
    ],
    contentFilter: 'all',
  },

  // ===== Test Methods =====
  {
    placeholderId: 'method.steps',
    templateDescription: '检测步骤',
    sourceType: 'section',
    sectionPaths: [['程序', '检测程序']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.reagentPrep',
    templateDescription: '试剂的准备',
    sourceType: 'section',
    sectionPaths: [['程序', '准备试剂']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.systemPrep',
    templateDescription: '系统的准备',
    sourceType: 'section',
    sectionPaths: [['程序', '准备系统']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.masterCurve',
    templateDescription: '主曲线定义',
    sourceType: 'section',
    sectionPaths: [['程序', '主曲线定义']],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.calibration',
    templateDescription: '校准的执行',
    sourceType: 'section',
    // HBcT2: H2 under '程序'
    // CEN:   H2 '执行校准' under '程序' (appears twice — first occurrence)
    // AIM:   H1 '执行校准'
    // ACI:   H1 '正在执行校准'
    sectionPaths: [
      ['程序', '正在执行校准'],
      ['程序', '执行校准'],
      ['正在执行校准'],
      ['执行校准'],
    ],
    contentFilter: 'bodyOnly',
  },
  {
    placeholderId: 'method.calibFreq',
    templateDescription: '校准频率',
    sourceType: 'section',
    sectionPaths: [
      ['程序', '校准频率'],
      ['程序', '正在执行校准', '校准频率'],
      ['正在执行校准', '校准频率'],
      ['执行校准', '校准频率'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.calibPrep',
    templateDescription: '校准品的制备',
    sourceType: 'section',
    sectionPaths: [
      ['程序', '制备校准品'],
      ['程序', '正在执行校准', '制备校准品'],
      ['正在执行校准', '制备校准品'],
      ['执行校准', '制备校准品'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.calibProc',
    templateDescription: '校准程序',
    sourceType: 'section',
    sectionPaths: [
      ['程序', '校准程序'],
      ['程序', '正在执行校准', '校准程序'],
      ['正在执行校准', '校准程序'],
      ['执行校准', '校准程序'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.qc',
    templateDescription: '执行质量控制',
    sourceType: 'section',
    // HBcT2: H2 under '程序'; AMH files: standalone H1
    sectionPaths: [
      ['程序', '执行质量控制'],
      ['执行质量控制'],
    ],
    contentFilter: 'bodyOnly',
  },
  {
    placeholderId: 'method.corrective',
    templateDescription: '采取纠正措施',
    sourceType: 'section',
    sectionPaths: [
      ['程序', '采取纠正措施'],
      ['程序', '执行质量控制', '采取纠正措施'],
      ['执行质量控制', '采取纠正措施'],
    ],
    contentFilter: 'all',
  },
  {
    placeholderId: 'method.results',
    templateDescription: '计算结果',
    sourceType: 'section',
    sectionPaths: [['结果', '计算结果']],
    contentFilter: 'all',
  },

  // ===== Positive Judgment / Reference Interval =====
  {
    placeholderId: 'positiveJudgment',
    templateDescription: '阳性判断值',
    sourceType: 'section',
    sectionPaths: [['预期值']],
    contentFilter: 'all',
  },

  // ===== Result Interpretation =====
  {
    placeholderId: 'resultInterpretation',
    templateDescription: '检验结果的解释',
    sourceType: 'section',
    sectionPaths: [['结果', '判读结果']],
    contentFilter: 'all',
  },

  // ===== Limitations =====
  {
    placeholderId: 'limitations',
    templateDescription: '检验方法的局限性',
    sourceType: 'section',
    // '限制' (HBcT2, ACI) vs '局限性' (CEN, AIM — standalone H1 or under '结果')
    sectionPaths: [
      ['限制'],
      ['局限性'],
      ['结果', '局限性'],
    ],
    contentFilter: 'all',
  },

  // ===== Performance (block copy entire section, excluding 标准化) =====
  {
    placeholderId: 'performance',
    templateDescription: '产品性能指标',
    sourceType: 'section',
    sectionPaths: [['性能特性']],
    contentFilter: 'all',
  },

  // ===== Standardization (mapped separately from performance) =====
  {
    placeholderId: 'standardization',
    templateDescription: '标准化',
    sourceType: 'section',
    // HBcT2: H2 under '性能特性'; AMH files: standalone H1
    sectionPaths: [
      ['性能特性', '标准化'],
      ['标准化'],
    ],
    contentFilter: 'all',
  },

  // ===== Warnings / Precautions =====
  {
    placeholderId: 'warnings',
    templateDescription: '注意事项',
    sourceType: 'section',
    sectionPaths: [['试剂', '警告和注意事项']],
    contentFilter: 'all',
  },

  // ===== Symbol Definitions =====
  {
    placeholderId: 'symbols',
    templateDescription: '标识的解释',
    sourceType: 'section',
    sectionPaths: [['符号定义']],
    contentFilter: 'all',
  },

  // ===== References =====
  {
    placeholderId: 'references',
    templateDescription: '参考文献',
    sourceType: 'section',
    sectionPaths: [['参考资料']],
    contentFilter: 'all',
  },

  // ===== Basic Info =====
  {
    placeholderId: 'basicInfo',
    templateDescription: '基本信息',
    sourceType: 'section',
    sectionPaths: [['法律信息']],
    contentFilter: 'all',
  },

  // ===== Manual Input Fields =====
  {
    placeholderId: 'clinicalStudy',
    templateDescription: '境内临床研究',
    sourceType: 'manual',
    manualInputLabel: '境内临床研究',
  },
  {
    placeholderId: 'registrationNumber',
    templateDescription: '医疗器械注册证编号',
    sourceType: 'manual',
    manualInputLabel: '注册证编号',
  },
  {
    placeholderId: 'approvalDates',
    templateDescription: '说明书批准日期',
    sourceType: 'manual',
    manualInputLabel: '批准日期',
  },
  {
    placeholderId: 'contactInfo',
    templateDescription: '联系方式',
    sourceType: 'manual',
    manualInputLabel: '联系方式',
  },
];
