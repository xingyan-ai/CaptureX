const {
  calculateHeight,
  calculateWidth,
  getDefaultDimensions,
  validateDimensions,
  RATIO_CONFIGS,
  SIZE_LIMITS
} = require('../utils/ratio-calculator');

describe('RatioCalculator', () => {

  // Test calculateHeight
  test('TC-UNIT-001: should calculate height correctly for BLOG_BANNER', () => {
    const width = RATIO_CONFIGS.BLOG_BANNER.defaultWidth;
    const expectedHeight = Math.round(width / RATIO_CONFIGS.BLOG_BANNER.ratio);
    expect(calculateHeight(RATIO_CONFIGS.BLOG_BANNER.ratio, width)).toBe(expectedHeight);
  });

  test('TC-UNIT-002: should calculate height correctly for WECHAT_COVER', () => {
    const width = RATIO_CONFIGS.WECHAT_COVER.defaultWidth;
    const expectedHeight = Math.round(width / RATIO_CONFIGS.WECHAT_COVER.ratio);
    expect(calculateHeight(RATIO_CONFIGS.WECHAT_COVER.ratio, width)).toBe(expectedHeight);
  });

  test('TC-UNIT-003: should throw error for invalid ratio in calculateHeight', () => {
    expect(() => calculateHeight(1.5, 400)).toThrow('不支持的比例: 1.5');
  });

  test('TC-UNIT-004: should throw error for width out of bounds in calculateHeight', () => {
    expect(() => calculateHeight(1.75, 50)).toThrow(/宽度超出范围/);
    expect(() => calculateHeight(1.75, 3000)).toThrow(/宽度超出范围/);
  });

  // Test calculateWidth
  test('TC-UNIT-005: should calculate width correctly', () => {
    const height = 200;
    const expectedWidth = Math.round(RATIO_CONFIGS.BLOG_BANNER.ratio * height);
    expect(calculateWidth(RATIO_CONFIGS.BLOG_BANNER.ratio, height)).toBe(expectedWidth);
  });

  // Test getDefaultDimensions
  test('TC-UNIT-006: should get default dimensions for a given ratio', () => {
    const dimensions = getDefaultDimensions(RATIO_CONFIGS.WECHAT_COVER.ratio);
    expect(dimensions.width).toBe(RATIO_CONFIGS.WECHAT_COVER.defaultWidth);
    expect(dimensions.height).toBe(170);
    expect(dimensions.ratio).toBe(RATIO_CONFIGS.WECHAT_COVER.ratio);
  });

  // Test validateDimensions
  test('TC-UNIT-007: should validate correct dimensions successfully', () => {
    const result = validateDimensions(700, 400, RATIO_CONFIGS.BLOG_BANNER.ratio);
    expect(result.isValid).toBe(true);
  });

  test('TC-UNIT-008: should invalidate incorrect dimensions', () => {
    const result = validateDimensions(700, 300, RATIO_CONFIGS.BLOG_BANNER.ratio);
    expect(result.isValid).toBe(false);
    expect(result.correctedDimensions).not.toBeNull();
  });
});