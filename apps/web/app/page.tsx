'use client';

import React, { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Workspace } from '@/components/Workspace';
import { AISidebar } from '@/components/AISidebar';
import { useStore } from '@/store/useStore';
import { TaskDrawer } from '@/components/TaskDrawer';

export default function Page() {
  const { fetchData, isLoading } = useStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#F8FAFB]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <div className="text-sm text-slate-500 font-medium">Loading TaskPulse Workspace...</div>
      </div>
    );
  }

  return (
    <Layout>
      <Workspace />
      <AISidebar />
      <TaskDrawer />
    </Layout>
  );
}
