import React from 'react';
import { useAppSelector } from '@/store/hooks';

export const TabCounter: React.FC = () => {
  const { groups } = useAppSelector(state => state.tabs);

  const groupCount = groups.length;
  const tabCount = groups.reduce((total, group) => total + group.tabs.length, 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
        style={{
          borderColor: 'var(--color-border-default)',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>会话</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {groupCount}
        </span>
      </div>
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
        style={{
          borderColor: 'var(--color-border-default)',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>标签</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {tabCount}
        </span>
      </div>
    </div>
  );
};

export default TabCounter;
