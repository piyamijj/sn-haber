'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Sparkles, Send, X } from 'lucide-react';

import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'hosgeldin-mesaji',
  role: 'assistant',
  content:
    'Merhaba! Ben SN Haber AI Asistanı. Güncel haberler hakkında soru sorabilirsin, örneğin "Bugün ekonomide neler oldu?" gibi. Elimdeki en taze haberlere bakıp sana özet bir yanıt hazırlarım.',
  createdAt: new Date().toISOString(),
};

/**
 * Sağ altta sabit duran, Framer Motion animasyonlu floating AI chatbot
 * balonu. Tıklandığında RAG tabanlı bir sohbet paneli açılır; kullanıcı
 * güncel haberler hakkında soru sorabilir, yanıtlar /api/chat uç
 * noktasından alınır ve ilgili haber kaynakları küçük bağlantı
 * etiketleri (chip) olarak yanıtın altında gösterilir.
 */
export function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isOpen, isLoading]);

  const handleToggle = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmed = inputValue.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `kullanici-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInputValue('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Sohbet yanıtı alınamadı');
        }

        const data = (await response.json()) as {
          content: string;
          citedArticles?: ChatMessage['citedArticles'];
        };

        const assistantMessage: ChatMessage = {
          id: `asistan-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          citedArticles: data.citedArticles,
          createdAt: new Date().toISOString(),
        };

        setMessages((previous) => [...previous, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: `hata-${Date.now()}`,
          role: 'assistant',
          content:
            'Üzgünüm, şu anda yanıt oluşturamadım. Lütfen birazdan tekrar dener misin?',
          createdAt: new Date().toISOString(),
        };
        setMessages((previous) => [...previous, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, messages],
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="flex h-[520px] w-[340px] flex-col overflow-hidden rounded-xl border border-oled-border bg-oled-panel shadow-2xl sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-oled-border bg-oled-panel2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  SN Haber AI Asistanı
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-oled hover:text-foreground"
                aria-label="Sohbet panelini kapat"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col gap-1.5',
                      message.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-oled-panel2 text-foreground/90',
                      )}
                    >
                      {message.content}
                    </div>

                    {message.role === 'assistant' &&
                      message.citedArticles &&
                      message.citedArticles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {message.citedArticles.map((article) => (
                            <Link
                              key={article.id}
                              href={`/haber/${article.slug}`}
                              className="rounded-full border border-oled-border bg-oled px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              {article.title}
                            </Link>
                          ))}
                        </div>
                      )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start">
                    <div className="flex items-center gap-1 rounded-lg bg-oled-panel2 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                )}

                <div ref={scrollAnchorRef} />
              </div>
            </ScrollArea>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-oled-border bg-oled-panel2 p-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Güncel haberler hakkında sor..."
                disabled={isLoading}
                className="flex-1 rounded-md border border-oled-border bg-oled px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || inputValue.trim().length === 0}
                aria-label="Mesajı gönder"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleToggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
        aria-label={isOpen ? 'Sohbet panelini kapat' : 'AI Asistanı ile sohbet et'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close-icon"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="chat-icon"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-6 w-6" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}