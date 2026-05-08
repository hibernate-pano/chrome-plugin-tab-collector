import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { loadSettings } from '@/store/slices/settingsSlice';
import { loadGroups } from '@/store/slices/tabSlice';
import Layout from '@/components/layout/Layout';
import Header from '@/components/layout/Header';
import TabList from '@/components/tabs/TabList';
import { TabListDndKit } from '@/components/tabs/TabListDndKit';
import { useToast } from '@/contexts/ToastContext';

const PopupContent: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    store.dispatch(loadSettings());
    store.dispatch(loadGroups());

    const urlParams = new URLSearchParams(window.location.search);
    const savedTabs = urlParams.get('saved');
    if (savedTabs) {
      const tabs = JSON.parse(decodeURIComponent(savedTabs));
      showToast(`已保存 ${tabs.length} 个标签页`, 'success');
    }
  }, [showToast]);

  const useDndKit = true;

  return (
    <Layout>
      <Header onSearch={setSearchQuery} />
      {useDndKit ? (
        <TabListDndKit searchQuery={searchQuery} />
      ) : (
        <TabList searchQuery={searchQuery} />
      )}
    </Layout>
  );
};

const Popup: React.FC = () => {
  return (
    <Provider store={store}>
      <PopupContent />
    </Provider>
  );
};

export default Popup;
