'use client';

import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, KeyRound, Send, Settings2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, type AIProviderConfig } from '@/services/api';
import { useStore, type AIMessage } from '@/store/useStore';

export const AISidebar: React.FC = () => {
  const { isAiSidebarOpen, toggleAiSidebar, aiMessages, sendAIMessage, currentProjectId } = useStore();
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [providerForm, setProviderForm] = useState({
    name: '',
    provider: 'openai-compatible' as AIProviderConfig['provider'],
    baseUrl: '',
    model: '',
    apiKey: '',
  });
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    if (!isAiSidebarOpen) return;
    void loadProviders().then(setProviders);
  }, [isAiSidebarOpen]);

  const handleSend = async () => {
    const message = inputVal.trim();
    if (!message || !currentProjectId || isTyping) return;

    setInputVal('');
    setIsTyping(true);
    await sendAIMessage(message);
    setIsTyping(false);
  };

  const handleCreateProvider = async () => {
    if (!providerForm.name.trim() || !providerForm.model.trim() || !providerForm.apiKey.trim()) return;

    const provider = await api.createAIProvider({
      name: providerForm.name.trim(),
      provider: providerForm.provider,
      baseUrl: providerForm.baseUrl.trim() || undefined,
      model: providerForm.model.trim(),
      apiKey: providerForm.apiKey.trim(),
      isDefault: providers.length === 0,
    });
    setProviders((current) => [provider, ...current.filter((candidate) => candidate.id !== provider.id)]);
    setProviderForm({ name: '', provider: 'openai-compatible', baseUrl: '', model: '', apiKey: '' });
    setSettingsMessage('Provider saved');
  };

  const handleTestProvider = async (id: string) => {
    const result = await api.testAIProvider(id);
    setSettingsMessage(result.ok ? 'Connection succeeded' : result.message || 'Connection failed');
  };

  const handleDefaultProvider = async (id: string) => {
    const updated = await api.setDefaultAIProvider(id);
    setProviders((current) => current.map((provider) => ({
      ...provider,
      isDefault: provider.id === updated.id,
      enabled: provider.id === updated.id ? updated.enabled : provider.enabled,
    })));
  };

  return (
    <AnimatePresence>
      {isAiSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="h-full shrink-0 overflow-hidden border-l border-slate-200 bg-slate-50 z-20"
        >
          <div className="flex h-full w-[340px] flex-col bg-slate-50">
            <div className="h-14 px-4 flex items-center border-b border-slate-200 bg-white shrink-0">
              <span className="mr-2 flex items-center justify-center rounded bg-indigo-100 p-1.5 text-indigo-600">
                <Bot size={18} />
              </span>
              <h2 className="text-sm font-bold text-slate-800">AI Assistant</h2>
              <button
                onClick={() => setShowSettings((value) => !value)}
                className="ml-auto rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="AI provider settings"
              >
                <Settings2 size={18} />
              </button>
              <button
                onClick={toggleAiSidebar}
                className="ml-1 rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Close AI sidebar"
              >
                <X size={20} />
              </button>
            </div>

            {showSettings ? (
              <div className="flex-1 overflow-y-auto p-4">
                <ProviderSettings
                  form={providerForm}
                  providers={providers}
                  message={settingsMessage}
                  onFormChange={setProviderForm}
                  onCreate={handleCreateProvider}
                  onTest={handleTestProvider}
                  onDefault={handleDefaultProvider}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    AI suggestions are read-only in this slice. Schedule changes require preview, version save, and user confirmation before database writes.
                  </div>

                  <div className="my-4 text-center">
                    <span className="rounded bg-slate-200/60 px-2 py-1 text-[10px] font-medium text-slate-500">
                      Current Session
                    </span>
                  </div>

                  {(aiMessages.length ? aiMessages : initialMessages).map((msg, idx) => (
                    <div key={`${msg.role}-${idx}`} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-normal shadow-sm ${
                          msg.role === 'user'
                            ? 'rounded-tr-none bg-indigo-600 text-white'
                            : 'rounded-tl-none border border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <div>{msg.text}</div>
                        {msg.role === 'ai' && msg.provider && (
                          <div className="mt-2 text-[10px] text-slate-400">
                            {msg.provider} · {msg.model}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex w-12 items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
                        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(event) => setInputVal(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleSend();
                      }}
                      placeholder="Ask about this project..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-10 text-xs outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputVal.trim() || isTyping || !currentProjectId}
                      className="absolute right-2 top-[5px] flex items-center justify-center rounded-md bg-indigo-600 p-[5px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      title="Send"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[9px] font-medium text-slate-400">
                    {providers.find((provider) => provider.isDefault)?.name || 'Environment provider'}
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

type ProviderSettingsProps = {
  form: {
    name: string;
    provider: AIProviderConfig['provider'];
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  providers: AIProviderConfig[];
  message: string;
  onFormChange: (form: ProviderSettingsProps['form']) => void;
  onCreate: () => Promise<void>;
  onTest: (id: string) => Promise<void>;
  onDefault: (id: string) => Promise<void>;
};

function ProviderSettings({
  form,
  providers,
  message,
  onFormChange,
  onCreate,
  onTest,
  onDefault,
}: ProviderSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            placeholder="Provider name"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={form.provider}
            onChange={(event) => onFormChange({ ...form, provider: event.target.value as AIProviderConfig['provider'] })}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <input
          value={form.baseUrl}
          onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
          placeholder="Base URL"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={form.model}
          onChange={(event) => onFormChange({ ...form, model: event.target.value })}
          placeholder="Model"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <input
            value={form.apiKey}
            onChange={(event) => onFormChange({ ...form, apiKey: event.target.value })}
            type="password"
            placeholder="API key"
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => void onCreate()}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-2 text-white hover:bg-slate-800"
            title="Save provider"
          >
            <KeyRound size={15} />
          </button>
        </div>
        {message && <div className="text-[11px] text-slate-500">{message}</div>}
      </div>

      <div className="space-y-2">
        {providers.map((provider) => (
          <div key={provider.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{provider.name}</div>
                <div className="truncate text-[11px] text-slate-500">
                  {provider.provider} · {provider.model}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-400">{provider.apiKeyPreview}</div>
              </div>
              {provider.isDefault && <CheckCircle2 size={16} className="text-emerald-600" />}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void onTest(provider.id)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => void onDefault(provider.id)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                Default
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function loadProviders() {
  return api.fetchAIProviders().catch(() => []);
}

const initialMessages: AIMessage[] = [
  {
    role: 'ai' as const,
    text: 'I can answer questions about the current project, risks, dependencies, and schedule structure.',
  },
];
