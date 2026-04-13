import type { PlaceholderMapEntry } from './types';

/**
 * Static ordered list mapping each template placeholder to its placeholderId.
 *
 * This list mirrors the template's top-to-bottom document order.
 * The TemplatePlaceholderScanner consumes entries from this list as it walks
 * the template DOM, matching each placeholder by section context.
 *
 * Standalone [xxx] entries appear in the order they are encountered within
 * each section. The scanner tracks the current section/sub-section header
 * and matches against sectionLabel + subLabel.
 */

/** Standalone and inline [xxx] placeholders in document order */
export const PLACEHOLDER_MAP: PlaceholderMapEntry[] = [
  // ===== Title (before any section header) =====
  {
    placeholderId: 'title',
    type: 'inline',
    sectionLabel: null,
    subLabel: null,
    textPattern: '[xxx]说明书',
  },

  // ===== 【产品名称】 =====
  {
    placeholderId: 'productName.chinese',
    type: 'inline',
    sectionLabel: '【产品名称】',
    subLabel: null,
    textPattern: '通用名称',
  },
  {
    placeholderId: 'productName.english',
    type: 'inline',
    sectionLabel: '【产品名称】',
    subLabel: null,
    textPattern: '英文名称',
  },

  // ===== 【包装规格】 =====
  {
    placeholderId: 'packageSpec',
    type: 'inline',
    sectionLabel: '【包装规格】',
    subLabel: null,
    textPattern: '测试/盒',
  },

  // ===== 【预期用途】 =====
  {
    placeholderId: 'intendedUse.main',
    type: 'standalone',
    sectionLabel: '【预期用途】',
    subLabel: null,
  },
  {
    placeholderId: 'intendedUse.summary',
    type: 'standalone',
    sectionLabel: '【预期用途】',
    subLabel: '摘要和解释',
  },

  // ===== 【检验原理】 =====
  {
    placeholderId: 'testPrinciple',
    type: 'standalone',
    sectionLabel: '【检验原理】',
    subLabel: null,
  },

  // ===== 【主要组成成分】 =====
  {
    placeholderId: 'components.reagentText',
    type: 'standalone',
    sectionLabel: '【主要组成成分】',
    subLabel: '试剂组分',
  },
  // Template Table 0 (reagent component table)
  {
    placeholderId: 'components.reagentTable',
    type: 'table-whole',
    sectionLabel: '【主要组成成分】',
    subLabel: '试剂组分',
    tableIndex: 0,
  },
  {
    placeholderId: 'components.notProvided',
    type: 'standalone',
    sectionLabel: '【主要组成成分】',
    subLabel: '需要而未提供的材料',
  },
  // Template Table 1 (materials not provided table)
  {
    placeholderId: 'components.notProvidedTable',
    type: 'table-whole',
    sectionLabel: '【主要组成成分】',
    subLabel: '需要而未提供的材料',
    tableIndex: 1,
  },

  // ===== 【储存条件及有效期】 =====
  {
    placeholderId: 'storage.months',
    type: 'numeric',
    sectionLabel: '【储存条件及有效期】',
    subLabel: null,
    textPattern: '个月',
  },
  {
    placeholderId: 'storage.days',
    type: 'numeric',
    sectionLabel: '【储存条件及有效期】',
    subLabel: null,
    textPattern: '天',
  },
  {
    placeholderId: 'storage.text',
    type: 'standalone',
    sectionLabel: '【储存条件及有效期】',
    subLabel: null,
  },
  {
    placeholderId: 'storage.onboard',
    type: 'standalone',
    sectionLabel: '【储存条件及有效期】',
    subLabel: '机载稳定性',
  },

  // ===== 【适用仪器】 =====
  {
    placeholderId: 'instrument',
    type: 'standalone',
    sectionLabel: '【适用仪器】',
    subLabel: null,
  },

  // ===== 【样本要求】 =====
  {
    placeholderId: 'sample.main',
    type: 'standalone',
    sectionLabel: '【样本要求】',
    subLabel: null,
  },
  {
    placeholderId: 'sample.collection',
    type: 'standalone',
    sectionLabel: '【样本要求】',
    subLabel: '样本的采集',
  },
  {
    placeholderId: 'sample.storage',
    type: 'standalone',
    sectionLabel: '【样本要求】',
    subLabel: '样本的保存',
  },
  {
    placeholderId: 'sample.transport',
    type: 'standalone',
    sectionLabel: '【样本要求】',
    subLabel: '样本的运输',
  },
  {
    placeholderId: 'sample.preparation',
    type: 'standalone',
    sectionLabel: '【样本要求】',
    subLabel: '样本的制备',
  },

  // ===== 【检验方法】 =====
  {
    placeholderId: 'method.steps',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '检测步骤',
  },
  {
    placeholderId: 'method.reagentPrep',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '试剂的准备',
  },
  {
    placeholderId: 'method.systemPrep',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '系统的准备',
  },
  {
    placeholderId: 'method.masterCurve',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '主曲线定义',
  },
  {
    placeholderId: 'method.calibration',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '校准的执行',
  },
  {
    placeholderId: 'method.calibFreq',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '校准频率',
  },
  {
    placeholderId: 'method.calibPrep',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '校准品的制备',
  },
  {
    placeholderId: 'method.calibProc',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '校准程序',
  },
  {
    placeholderId: 'method.qc',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '执行质量控制',
  },
  {
    placeholderId: 'method.corrective',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '采取纠正措施',
  },
  {
    placeholderId: 'method.results',
    type: 'standalone',
    sectionLabel: '【检验方法】',
    subLabel: '计算结果',
  },

  // ===== 【阳性判断值】/【参考区间】 =====
  {
    placeholderId: 'positiveJudgment',
    type: 'standalone',
    sectionLabel: '【阳性判断值】',
    subLabel: null,
  },

  // ===== 【检验结果的解释】 =====
  {
    placeholderId: 'resultInterpretation',
    type: 'standalone',
    sectionLabel: '【检验结果的解释】',
    subLabel: null,
  },

  // ===== 【检验方法的局限性】 =====
  {
    placeholderId: 'limitations',
    type: 'standalone',
    sectionLabel: '【检验方法的局限性】',
    subLabel: null,
  },

  // ===== 【产品性能指标】 =====
  {
    placeholderId: 'performance',
    type: 'standalone',
    sectionLabel: '【产品性能指标】',
    subLabel: null,
  },

  // ===== 标准化 =====
  {
    placeholderId: 'standardization',
    type: 'standalone',
    sectionLabel: '标准化',
    subLabel: null,
  },

  // ===== 【注意事项】 =====
  {
    placeholderId: 'warnings',
    type: 'standalone',
    sectionLabel: '【注意事项】',
    subLabel: '警告和注意事项',
  },

  // ===== 【标识的解释】 =====
  {
    placeholderId: 'symbols',
    type: 'standalone',
    sectionLabel: '【标识的解释】',
    subLabel: null,
  },

  // ===== 【参考文献】 =====
  {
    placeholderId: 'references',
    type: 'standalone',
    sectionLabel: '【参考文献】',
    subLabel: null,
  },
];
