/**
 * Favicon URL 处理工具
 * 用于确保 favicon URL 符合 CSP 安全策略
 */

/**
 * 清理和验证 favicon URL，确保符合 CSP 策略
 * @param faviconUrl 原始 favicon URL
 * @returns 安全的 favicon URL 或空字符串
 */
export function sanitizeFaviconUrl(faviconUrl: string | undefined | null): string {
  // 如果没有 favicon URL，返回空字符串
  if (!faviconUrl || typeof faviconUrl !== 'string') {
    return '';
  }

  // 移除首尾空格
  const cleanUrl = faviconUrl.trim();

  // 如果是空字符串，返回空
  if (!cleanUrl) {
    return '';
  }

  try {
    const url = new URL(cleanUrl);

    // 允许的协议：https、http、data、chrome-extension
    const allowedProtocols = ['https:', 'http:', 'data:', 'chrome-extension:'];

    // 危险的协议列表
    const dangerousProtocols = ['javascript:', 'vbscript:', 'file:', 'ftp:'];

    // 检查是否是危险协议
    if (dangerousProtocols.includes(url.protocol)) {
      console.warn(`危险的 favicon 协议，已过滤: ${url.protocol} - ${cleanUrl}`);
      return '';
    }

    // 检查是否是允许的协议
    if (allowedProtocols.includes(url.protocol)) {
      return cleanUrl;
    }

    // 其他未知协议，返回空字符串
    console.warn(`未知的 favicon 协议，已过滤: ${url.protocol} - ${cleanUrl}`);
    return '';

  } catch (error) {
    // URL 格式无效
    console.warn(`无效的 favicon URL 格式，已过滤: ${cleanUrl}`, error);
    return '';
  }
}

/**
 * 批量处理 favicon URLs
 * @param faviconUrls favicon URL 数组
 * @returns 清理后的 favicon URL 数组
 */
export function sanitizeFaviconUrls(faviconUrls: (string | undefined | null)[]): string[] {
  return faviconUrls.map(sanitizeFaviconUrl).filter(url => url !== '');
}

/**
 * 检查 favicon URL 是否安全
 * 现在允许 HTTP 和 HTTPS 协议，但仍然过滤危险协议
 * @param faviconUrl favicon URL
 * @returns 是否安全
 */
export function isFaviconUrlSafe(faviconUrl: string | undefined | null): boolean {
  if (!faviconUrl) return false;

  try {
    const url = new URL(faviconUrl);

    // 允许的协议：https、http、data、chrome-extension
    const allowedProtocols = ['https:', 'http:', 'data:', 'chrome-extension:'];

    // 危险的协议列表
    const dangerousProtocols = ['javascript:', 'vbscript:', 'file:', 'ftp:'];

    // 检查是否是危险协议
    if (dangerousProtocols.includes(url.protocol)) {
      console.warn(`危险的 favicon 协议，已过滤: ${url.protocol} - ${faviconUrl}`);
      return false;
    }

    // 检查是否是允许的协议
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}
