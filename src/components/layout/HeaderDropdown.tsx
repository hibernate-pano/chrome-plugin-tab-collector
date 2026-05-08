import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deleteAllGroups } from '@/store/slices/tabSlice';
import {
  saveSettings,
  toggleCollectPinnedTabs,
  toggleConfirmBeforeDelete,
  toggleShowNotifications,
} from '@/store/slices/settingsSlice';
import { storage } from '@/utils/storage';
import { ThemeStyleSelector } from './ThemeStyleSelector';
import { useToast } from '@/contexts/ToastContext';
import { trackProductEvent } from '@/utils/productEvents';

interface HeaderDropdownProps {
  onClose: () => void;
}

export const HeaderDropdown: React.FC<HeaderDropdownProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);
  const [openSubmenu, setOpenSubmenu] = useState<'export' | 'import' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showAlert, showConfirm } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const persistSettingChange = async (action: unknown) => {
    dispatch(action as never);
    await dispatch(saveSettings() as never);
  };

  const handleDeleteAllGroups = () => {
    const runDeleteAll = () => {
      onClose();

      dispatch(deleteAllGroups())
        .then((result: any) => {
          const count = result.payload?.count || 0;
          showAlert({
            title: '删除成功',
            message: `成功删除了 ${count} 个会话`,
            type: 'success',
            onClose: () => {},
          });
        })
        .catch(error => {
          console.error('删除所有会话失败:', error);
          showAlert({
            title: '删除失败',
            message: '删除所有会话失败',
            type: 'error',
            onClose: () => {},
          });
        });
    };

    if (!settings.confirmBeforeDelete) {
      runDeleteAll();
      return;
    }

    showConfirm({
      title: '删除确认',
      message: '确定要删除所有会话吗？此操作无法撤销。',
      type: 'danger',
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: runDeleteAll,
      onCancel: () => {},
    });
  };

  const handleExportData = async () => {
    try {
      setOpenSubmenu(null);
      const exportData = await storage.exportData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const date = new Date();
      const filename = `onetab-backup-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(date.getDate()).padStart(2, '0')}.json`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error('导出数据失败:', error);
      showAlert({
        title: '导出失败',
        message: '导出数据失败，请重试',
        type: 'error',
        onClose: () => {},
      });
    }
  };

  const handleExportOneTabFormat = async () => {
    try {
      setOpenSubmenu(null);
      const oneTabText = await storage.exportToOneTabFormat();
      const blob = new Blob([oneTabText], { type: 'text/plain' });

      const date = new Date();
      const filename = `onetab-export-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(date.getDate()).padStart(2, '0')}.txt`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error('导出 OneTab 数据失败:', error);
      showAlert({
        title: '导出失败',
        message: '导出 OneTab 格式数据失败，请重试',
        type: 'error',
        onClose: () => {},
      });
    }
  };

  const handleImportJson = async (file: File, input: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const success = await storage.importData(data);
        input.value = '';
        showAlert({
          title: success ? '导入成功' : '导入失败',
          message: success ? '数据导入成功' : '数据导入失败',
          type: success ? 'success' : 'error',
          onClose: () => {
            if (success) {
              window.location.reload();
            }
          },
        });
      } catch (error) {
        console.error('解析导入文件失败:', error);
        input.value = '';
        showAlert({
          title: '导入失败',
          message: '解析导入文件失败，请确保文件格式正确',
          type: 'error',
          onClose: () => {},
        });
      }
      onClose();
    };
    reader.readAsText(file);
  };

  const handleImportOneTab = async (file: File, input: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const success = await storage.importFromOneTabFormat(text);
        input.value = '';

        if (success) {
          await trackProductEvent('onetab_import_completed', {
            importSource: 'onetab',
            importedSessions: text.split('\n\n').filter(Boolean).length,
          });
        }

        showAlert({
          title: success ? '导入成功' : '导入失败',
          message: success ? 'OneTab 数据导入成功' : 'OneTab 数据导入失败',
          type: success ? 'success' : 'error',
          onClose: () => {
            if (success) {
              window.location.reload();
            }
          },
        });
      } catch (error) {
        console.error('解析 OneTab 导入文件失败:', error);
        input.value = '';
        showAlert({
          title: '导入失败',
          message: '解析 OneTab 导入文件失败，请确保文件格式正确',
          type: 'error',
          onClose: () => {},
        });
      }
      onClose();
    };
    reader.readAsText(file);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 z-20"
    >
      <div className="py-2">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">本地模式</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            所有会话、设置和导入导出都只保存在当前浏览器中。
          </p>
        </div>

        <div className="px-4 py-2">
          <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">设置</p>

          <div className="mb-3">
            <p className="mb-2 px-1 text-xs text-gray-500 dark:text-gray-400">通用设置</p>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">通知提醒</span>
              <button
                onClick={() => void persistSettingChange(toggleShowNotifications())}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showNotifications ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.showNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">删除前确认</span>
              <button
                onClick={() => void persistSettingChange(toggleConfirmBeforeDelete())}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.confirmBeforeDelete ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.confirmBeforeDelete ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mb-1">
            <p className="mb-2 px-1 text-xs text-gray-500 dark:text-gray-400">标签页设置</p>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">保存固定标签页</span>
              <button
                onClick={() => void persistSettingChange(toggleCollectPinnedTabs())}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.collectPinnedTabs ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.collectPinnedTabs ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
        <ThemeStyleSelector />
        <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenSubmenu(current => (current === 'export' ? null : 'export'))}
            className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300"
          >
            <span>导出数据</span>
            <span className="text-gray-500">›</span>
          </button>
          {openSubmenu === 'export' && (
            <div className="absolute left-full top-0 ml-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={handleExportData}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300"
              >
                JSON 格式
              </button>
              <button
                type="button"
                onClick={handleExportOneTabFormat}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300"
              >
                OneTab 格式
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenSubmenu(current => (current === 'import' ? null : 'import'))}
            className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300"
          >
            <span>导入数据</span>
            <span className="text-gray-500">›</span>
          </button>
          {openSubmenu === 'import' && (
            <div className="absolute left-full top-0 ml-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <label className="block cursor-pointer px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                JSON 格式
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImportJson(file, event.target);
                    }
                  }}
                />
              </label>
              <label className="block cursor-pointer px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                OneTab 格式
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImportOneTab(file, event.target);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <button
          onClick={handleDeleteAllGroups}
          className="mt-1 flex w-full items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
        >
          <span className="flex-1">
            <span className="block">删除所有会话</span>
            <span className="mt-0.5 block text-xs font-normal text-rose-600/80 dark:text-rose-300/80">
              清空当前浏览器内的所有已保存会话，此操作无法撤销。
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};
