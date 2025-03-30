import React from 'react';
import { EmbeddableChat } from '@/components/customer/EmbeddableChat';

export default function EmbeddableChatPage() {
  return (
    <div className="h-screen w-full bg-neutral-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl h-full flex flex-col">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-primary">Customer Support Chat</h1>
          <p className="text-neutral-500 text-sm mt-1">
            This is a standalone chat component that can be embedded in your website.
          </p>
        </header>
        
        <div className="flex-grow bg-white rounded-lg shadow overflow-hidden border border-neutral-200">
          <EmbeddableChat fullPage={true} />
        </div>
      </div>
    </div>
  );
}