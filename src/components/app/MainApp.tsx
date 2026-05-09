import React, { useState, useEffect, lazy, Suspense, useDeferredValue } from 'react';
import { Header } from '@/components/layout/Header';
import { TabList } from '@/components/tabs/TabList';
import { useAppDispatch } from '@/store/hooks';
import { loadSettings } from '@/store/slices/settingsSlice';
import { OnboardingGuide } from '@/components/onboarding/OnboardingGuide';
import { shouldShowOnboarding } from '@/utils/onboardingStorage';
import { getAppVersionLabel } from '@/utils/runtimeInfo';

// 使用动态导入懒加载拖放功能
const DndProvider = lazy(() =>
  import('@/components/dnd/DndProvider').then(module => ({ default: module.DndProvider }))
);

// 导入样式文件
import '@/styles/drag-drop.css';
import '@/styles/animations.css';

/**
 * 主应用组件
 * 负责应用的主要布局和功能
 */
export const MainApp: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // 加载用户设置
  useEffect(() => {
    dispatch(loadSettings());
  }, [dispatch]);

  // 检查是否需要显示用户引导
  useEffect(() => {
    shouldShowOnboarding().then(should => {
      if (should) {
        setShowOnboarding(true);
      }
    });
  }, []);

  // 统一使用相同宽度，单栏和双栏布局保持一致
  const getContainerWidthClass = () => {
    return 'layout-double-width';
  };

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-gray-900 dark:text-gray-100 flex flex-col items-center justify-center">
          加载拖放功能...
        </div>
      }
    >
      <DndProvider>
        <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
          <Header onSearch={setSearchQuery} />
          <main className={`flex-1 w-full pb-4 pt-3 ${getContainerWidthClass()}`}>
            <Suspense fallback={<div className="p-4 text-center">加载标签列表...</div>}>
              <TabList searchQuery={deferredSearchQuery} />
            </Suspense>
          </main>
          <footer className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] text-xs text-[var(--color-text-secondary)]">
            <div className={`flex items-center justify-between gap-3 py-2 ${getContainerWidthClass()}`}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                <span className="font-medium">Tag Collector {getAppVersionLabel()}</span>
              </div>
              <div className="hidden sm:block text-[var(--color-text-muted)]">
                临时收纳当前工作窗口，恢复时保持节奏不断档
              </div>
            </div>
          </footer>
        </div>
      </DndProvider>

      {/* 用户引导弹窗 */}
      {showOnboarding && (
        <OnboardingGuide onComplete={() => setShowOnboarding(false)} />
      )}
    </Suspense>
  );
};
