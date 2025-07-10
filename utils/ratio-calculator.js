/**
 * ScreenCut 比例计算工具
 * 负责精准的比例计算和尺寸验证
 * 确保1.75:1和2.35:1比例的准确性
 */

// ============================================================================
// 比例常量定义
// ============================================================================

/**
 * 支持的截图比例配置
 */
const RATIO_CONFIGS = {
  BLOG_BANNER: {
    ratio: 1.75,
    name: '博客横幅',
    description: '适合博客文章头图',
    defaultWidth: 400,
    recommendedWidths: [300, 400, 500, 600, 800]
  },
  WECHAT_COVER: {
    ratio: 2.35,
    name: '公众号封面', 
    description: '适合微信公众号封面',
    defaultWidth: 400,
    recommendedWidths: [300, 400, 500, 600, 900]
  }
};

/**
 * 尺寸限制配置
 */
const SIZE_LIMITS = {
  minWidth: 100,      // 最小宽度
  maxWidth: 2000,     // 最大宽度
  minHeight: 50,      // 最小高度
  maxHeight: 1500,    // 最大高度
  tolerance: 0.01     // 比例容差
};

// ============================================================================
// 核心计算函数
// ============================================================================

/**
 * 根据比例和宽度计算高度
 * @param {number} ratio - 比例值 (1.75 或 2.35)
 * @param {number} width - 宽度值
 * @returns {number} 计算得出的高度值
 */
function calculateHeight(ratio, width) {
  if (!isValidRatio(ratio)) {
    throw new Error(`不支持的比例: ${ratio}`);
  }
  
  if (width < SIZE_LIMITS.minWidth || width > SIZE_LIMITS.maxWidth) {
    throw new Error(`宽度超出范围: ${width}，有效范围: ${SIZE_LIMITS.minWidth}-${SIZE_LIMITS.maxWidth}`);
  }
  
  return Math.round(width / ratio);
}

/**
 * 根据比例和高度计算宽度
 * @param {number} ratio - 比例值 (1.75 或 2.35)
 * @param {number} height - 高度值
 * @returns {number} 计算得出的宽度值
 */
function calculateWidth(ratio, height) {
  if (!isValidRatio(ratio)) {
    throw new Error(`不支持的比例: ${ratio}`);
  }
  
  if (height < SIZE_LIMITS.minHeight || height > SIZE_LIMITS.maxHeight) {
    throw new Error(`高度超出范围: ${height}，有效范围: ${SIZE_LIMITS.minHeight}-${SIZE_LIMITS.maxHeight}`);
  }
  
  return Math.round(ratio * height);
}

/**
 * 根据比例获取默认尺寸
 * @param {number} ratio - 比例值 (1.75 或 2.35)
 * @returns {Object} 包含width和height的尺寸对象
 */
function getDefaultDimensions(ratio) {
  const config = getRatioConfig(ratio);
  if (!config) {
    throw new Error(`不支持的比例: ${ratio}`);
  }
  
  const width = config.defaultWidth;
  const height = calculateHeight(ratio, width);
  
  return {
    width,
    height,
    ratio,
    description: config.description
  };
}

/**
 * 验证给定的尺寸是否符合指定比例
 * @param {number} width - 宽度
 * @param {number} height - 高度  
 * @param {number} expectedRatio - 期望的比例
 * @returns {Object} 验证结果对象
 */
function validateDimensions(width, height, expectedRatio) {
  const actualRatio = width / height;
  const difference = Math.abs(actualRatio - expectedRatio);
  const isValid = difference <= SIZE_LIMITS.tolerance;
  
  return {
    isValid,
    actualRatio: Math.round(actualRatio * 100) / 100,
    expectedRatio,
    difference: Math.round(difference * 1000) / 1000,
    tolerance: SIZE_LIMITS.tolerance,
    correctedDimensions: isValid ? null : getCorrectedDimensions(width, height, expectedRatio)
  };
}

/**
 * 获取修正后的尺寸（保持比例）
 * @param {number} width - 原始宽度
 * @param {number} height - 原始高度
 * @param {number} targetRatio - 目标比例
 * @returns {Object} 修正后的尺寸对象
 */
function getCorrectedDimensions(width, height, targetRatio) {
  // 根据宽度调整高度
  const heightFromWidth = calculateHeight(targetRatio, width);
  
  // 根据高度调整宽度
  const widthFromHeight = calculateWidth(targetRatio, height);
  
  // 选择变化最小的方案
  const widthDiff = Math.abs(width - widthFromHeight);
  const heightDiff = Math.abs(height - heightFromWidth);
  
  if (widthDiff <= heightDiff) {
    return {
      width: widthFromHeight,
      height,
      adjustedDimension: 'width'
    };
  } else {
    return {
      width,
      height: heightFromWidth,
      adjustedDimension: 'height'
    };
  }
}

// ============================================================================
// 等比例缩放功能
// ============================================================================

/**
 * 等比例缩放尺寸
 * @param {Object} currentDimensions - 当前尺寸 {width, height}
 * @param {number} scaleFactor - 缩放因子
 * @param {number} ratio - 目标比例
 * @returns {Object} 缩放后的尺寸对象
 */
function scaleProportionally(currentDimensions, scaleFactor, ratio) {
  const { width, height } = currentDimensions;
  
  // 验证输入参数
  if (scaleFactor <= 0) {
    throw new Error('缩放因子必须大于0');
  }
  
  if (!isValidRatio(ratio)) {
    throw new Error(`不支持的比例: ${ratio}`);
  }
  
  // 计算新的宽度
  const newWidth = Math.round(width * scaleFactor);
  
  // 根据比例计算对应的高度
  const newHeight = calculateHeight(ratio, newWidth);
  
  // 检查尺寸限制
  if (newWidth < SIZE_LIMITS.minWidth || newWidth > SIZE_LIMITS.maxWidth ||
      newHeight < SIZE_LIMITS.minHeight || newHeight > SIZE_LIMITS.maxHeight) {
    throw new Error('缩放后的尺寸超出允许范围');
  }
  
  return {
    width: newWidth,
    height: newHeight,
    scaleFactor,
    ratio
  };
}

/**
 * 适应容器的等比例缩放
 * @param {number} ratio - 目标比例
 * @param {Object} container - 容器尺寸 {width, height}
 * @param {number} padding - 内边距 (默认50px)
 * @returns {Object} 适应后的尺寸对象
 */
function fitToContainer(ratio, container, padding = 50) {
  const availableWidth = container.width - padding * 2;
  const availableHeight = container.height - padding * 2;
  
  // 根据可用宽度计算高度
  let width = availableWidth;
  let height = calculateHeight(ratio, width);
  
  // 如果高度超出可用区域，则根据高度计算宽度
  if (height > availableHeight) {
    height = availableHeight;
    width = calculateWidth(ratio, height);
  }
  
  // 确保不小于最小尺寸
  if (width < SIZE_LIMITS.minWidth) {
    width = SIZE_LIMITS.minWidth;
    height = calculateHeight(ratio, width);
  }
  
  if (height < SIZE_LIMITS.minHeight) {
    height = SIZE_LIMITS.minHeight;
    width = calculateWidth(ratio, height);
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height),
    ratio,
    fitsInContainer: true
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检查是否为支持的比例
 * @param {number} ratio - 要检查的比例值
 * @returns {boolean} 是否为支持的比例
 */
function isValidRatio(ratio) {
  return ratio === RATIO_CONFIGS.BLOG_BANNER.ratio || 
         ratio === RATIO_CONFIGS.WECHAT_COVER.ratio;
}

/**
 * 根据比例值获取配置信息
 * @param {number} ratio - 比例值
 * @returns {Object|null} 比例配置对象
 */
function getRatioConfig(ratio) {
  if (ratio === RATIO_CONFIGS.BLOG_BANNER.ratio) {
    return RATIO_CONFIGS.BLOG_BANNER;
  }
  if (ratio === RATIO_CONFIGS.WECHAT_COVER.ratio) {
    return RATIO_CONFIGS.WECHAT_COVER;
  }
  return null;
}

/**
 * 获取所有支持的比例列表
 * @returns {Array} 比例配置数组
 */
function getSupportedRatios() {
  return Object.values(RATIO_CONFIGS);
}

/**
 * 格式化比例显示文本
 * @param {number} ratio - 比例值
 * @returns {string} 格式化的比例文本
 */
function formatRatio(ratio) {
  if (ratio === 1.75) return '1.75:1';
  if (ratio === 2.35) return '2.35:1';
  return `${ratio}:1`;
}

/**
 * 计算两个尺寸间的缩放因子
 * @param {Object} fromDimensions - 原始尺寸 {width, height}
 * @param {Object} toDimensions - 目标尺寸 {width, height}
 * @returns {number} 缩放因子
 */
function calculateScaleFactor(fromDimensions, toDimensions) {
  const widthScale = toDimensions.width / fromDimensions.width;
  const heightScale = toDimensions.height / fromDimensions.height;
  
  // 返回较小的缩放因子以确保不超出目标尺寸
  return Math.min(widthScale, heightScale);
}

/**
 * 根据设备像素比调整尺寸
 * @param {Object} dimensions - 逻辑尺寸 {width, height}
 * @param {number} pixelRatio - 设备像素比 (默认使用当前设备的)
 * @returns {Object} 物理像素尺寸对象
 */
function adjustForPixelRatio(dimensions, pixelRatio) {
  const dpr = pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
  return {
    logical: dimensions,
    physical: {
      width: Math.round(dimensions.width * dpr),
      height: Math.round(dimensions.height * dpr)
    },
    pixelRatio: dpr
  };
}

// ============================================================================
// 导出接口
// ============================================================================

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    calculateHeight,
    calculateWidth,
    getDefaultDimensions,
    validateDimensions,
    getCorrectedDimensions,
    scaleProportionally,
    fitToContainer,
    calculateScaleFactor,
    isValidRatio,
    getRatioConfig,
    getSupportedRatios,
    formatRatio,
    adjustForPixelRatio,
    RATIO_CONFIGS,
    SIZE_LIMITS
  };
} 